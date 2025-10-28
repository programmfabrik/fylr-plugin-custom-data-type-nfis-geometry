const info = process.argv.length >= 3
    ? JSON.parse(process.argv[2])
    : {};

const objectCache = {};

let input = '';
process.stdin.on('data', d => {
    try {
        input += d.toString();
    } catch (err) {
        console.error(`Could not read input into string: ${err.message}`, err.stack);
        process.exit(1);
    }
});

process.stdin.on('end', async () => {
    const data = JSON.parse(input);
    const tagGroups = await getTagGroups();
    const changedObjects = [];

    for (let object of data.objects) {
        await updateObject(
            getObjectData(object),
            object._current ? getObjectData(object._current) : undefined
        );
        if (await handleNewlyDrawnGeometries(object, tagGroups)) changedObjects.push(object);
    }

    console.log(JSON.stringify({ objects: changedObjects }));

    if (!changedObjects.length) {
        console.error('No changes');
        process.exit(0);
    }
});

function getObjectData(object) {
    const objectData = JSON.parse(JSON.stringify(object[object._objecttype]));
    objectData._uuid = object._uuid;
    objectData._objecttype = object._objecttype;
    return objectData;
}

function getPluginConfiguration() {
    return info.config.plugin['custom-data-type-nfis-geometry'].config.nfisGeoservices;
}

function getWFSConfiguration(configuration, objectType) {
    const wfsConfiguration = configuration.wfs_configuration;
    return wfsConfiguration?.find(configuration => configuration.object_type === objectType);
}

async function updateObject(object, currentObject) {
    const configuration = getPluginConfiguration();

    if (currentObject) addDataFromCurrentObject(object, currentObject);
    addToObjectCache(object);

    const linkedObjectConfiguration = getLinkedObjectConfiguration(object._objecttype, configuration);
    if (linkedObjectConfiguration) return await updateLinkedObjects(object, linkedObjectConfiguration);

    const wfsConfiguration = getWFSConfiguration(configuration, object._objecttype);
    if (!wfsConfiguration) return;

    for (let fieldConfiguration of wfsConfiguration.geometry_fields) {
        const geometryIds = await getGeometryIds(object, fieldConfiguration.field_path.split('.'));
        if (geometryIds.length && await hasUsedGeometryIds(configuration, geometryIds, object._uuid)) {
            return throwErrorToFrontend('Eine oder mehrere Geometrien sind bereits mit anderen Objekten verknüpft.', undefined, 'multipleGeometryLinking');
        }

        await editGeometries(object, fieldConfiguration, geometryIds);
        if (currentObject) await deleteGeometries(fieldConfiguration, geometryIds, currentObject);
    }
}

function getLinkedObjectConfiguration(objectType, configuration) {
    return configuration.linked_objects.find(entry => entry.object_type === objectType);
}

async function updateLinkedObjects(object, linkedObjectConfiguration) {
    const linkedObjects = await getFieldValues(object, linkedObjectConfiguration.link_field_name.split('.'));

    for (let linkedObject of linkedObjects) {
        await updateObject(linkedObject, undefined);
    }
}

async function getGeometryIds(object, pathSegments) {
    let geometryIds = [];

    for (let fieldValue of await getFieldValues(object, pathSegments)) {
        if (!fieldValue?.geometry_ids?.length) continue;
        geometryIds = geometryIds.concat(
            fieldValue.geometry_ids.filter(value => value !== undefined)
        );
    }

    return geometryIds;
}

async function hasUsedGeometryIds(configuration, geometryIds, uuid) {
    const geometryFieldPaths = getGeometryFieldPaths(configuration);
    const url = info.api_url + '/api/v1/search?access_token=' + info.api_user_access_token;
    const searchRequest = {
        search: geometryIds.map(geometryId => {
            return {
                type: 'match',
                bool: 'should',
                fields: geometryFieldPaths,
                string: geometryId
            };
        })
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(searchRequest)
        });
        const result = await response.json();
        return result.objects.length > 1
            || (result.objects.length === 1 && (!uuid || result.objects[0]._uuid !== uuid));
    } catch (err) {
        throwErrorToFrontend('Bei der Prüfung auf mehrfach verknüpfte Geometrien ist ein Fehler aufgetreten:', err.toString());
    }    
}

function getGeometryFieldPaths(configuration) {
    const fieldPaths = [];

    for (let wfsConfiguration of configuration.wfs_configuration) {
        const objectType = wfsConfiguration.object_type;
        for (let geometryFieldPath of wfsConfiguration.geometry_fields) {
            fieldPaths.push(objectType + '.' + geometryFieldPath.field_path + '.geometry_ids');
        }
    }

    return fieldPaths;
}

async function editGeometries(object, fieldConfiguration, geometryIds) {
    if (isSendingDataToGeoserverActivated(fieldConfiguration, geometryIds)) {
        const changeMap = await getChangeMap(object, fieldConfiguration);
        if (Object.keys(changeMap).length) {
            const requestXml = getEditRequestXml(geometryIds, changeMap, fieldConfiguration.edit_wfs_feature_type);
            await performEditTransaction(geometryIds, requestXml, fieldConfiguration);
        }
    }
}

async function deleteGeometries(fieldConfiguration, geometryIds, currentObject) {
    if (!currentObject) return;
    const deletedGeometryIds = await getDeletedGeometryIds(geometryIds, currentObject, fieldConfiguration);
    if (deletedGeometryIds.length) await performDeleteTransaction(deletedGeometryIds, fieldConfiguration);
}

async function getDeletedGeometryIds(geometryIds, currentObject, fieldConfiguration) {
    const currentGeometryIds = await getGeometryIds(currentObject, fieldConfiguration.field_path.split('.'));
    return currentGeometryIds.filter(geometryId => !geometryIds.includes(geometryId));
}

function isSendingDataToGeoserverActivated(fieldConfiguration, geometryIds) {
    return fieldConfiguration.send_data_to_geoserver
        && fieldConfiguration.edit_wfs_url
        && geometryIds?.length;
}

function addDataFromCurrentObject(object, currentObject) {
    for (let fieldName of Object.keys(object)) {
        if (!fieldName.startsWith('_reverse_nested')) continue;
        if (Array.isArray(object[fieldName])) {
            for (let i = 0; i < object[fieldName].length; i++) {
                if (!hasLinkedObjectData(object[fieldName][i])) {
                    object[fieldName][i] = currentObject[fieldName].find(entry => entry._id === object[fieldName][i]._id);
                }
            }
        } else if (!hasLinkedObjectData(object[fieldName])) {
            object[fieldName] = currentObject[fieldName];
        }
    }
}

function hasLinkedObjectData(fieldContent) {
    return Object.values(fieldContent).find(subfield => subfield._mask && subfield._objecttype);
}

async function getChangeMap(object, fieldConfiguration) {
    const changeMap = {};
    addPoolFieldToChangeMap(object, fieldConfiguration, changeMap);

    if (!fieldConfiguration.fields) return changeMap;

    for (let field of fieldConfiguration.fields) {
        const wfsFieldName = field.wfs_field_name;
        const fylrFieldName = field.fylr_field_name;
        const fylrFunction = field.fylr_function;
        if (fylrFieldName || fylrFunction) {
            const fieldValue = fylrFieldName
                ? (await getFieldValues(object, fylrFieldName.split('.')))?.[0]
                : getValueFromCustomFunction(object, fylrFunction);
            addToChangeMap(wfsFieldName, fieldValue, changeMap);
        }
    }

    return changeMap;
}

async function getFieldValues(object, pathSegments) {
    const fieldName = pathSegments.shift();
    let field = object[fieldName];

    if (field === undefined) return [];

    if (!Array.isArray(field) && field._objecttype && field._mask && field[field._objecttype]?._id !== undefined) {
        field = await getLinkedObject(field);
    }

    if (pathSegments.length === 0) {
        return [field];
    } else if (Array.isArray(field)) {
        const fieldValues = [];
        for (let entry of field) {
            fieldValues.push(await getFieldValues(entry, pathSegments.slice()));
        }
        return fieldValues.filter(data => data !== undefined)
            .reduce((result, fieldValues) => result.concat(fieldValues), []);
    } else {
        return await getFieldValues(field, pathSegments);
    }
}

async function getLinkedObject(field) {
    const objectType = field._objecttype;
    const id = field[objectType]._id;

    const cachedObject = objectCache[objectType]?.[id];
    if (cachedObject) return cachedObject;
    
    const linkedObject = await fetchObject(field._objecttype, field._mask, id);
    if (!linkedObject) {
        throwErrorToFrontend('Das Objekt ' + id + ' vom Typ ' + objectType + ' konnte nicht abgerufen werden.');
    }

    addToObjectCache(linkedObject);

    return linkedObject;
}

function addToObjectCache(object) {
    const objectType = object._objecttype;
    const id = object._id;

    if (!objectCache[objectType]) objectCache[objectType] = {};
    objectCache[objectType][id] = object;
}

async function fetchObject(objectType, mask, id) {
    const url = info.api_url + '/api/v1/db/' + objectType + '/' + mask + '/' + id + '?access_token=' + info.api_user_access_token;

    try {
        const response = await fetch(url, { method: 'GET' });
        const result = await response.json();
        return result?.length
            ? getObjectData(result[0])
            : undefined;
    } catch (err) {
        throwErrorToFrontend('Objektabfrage fehlgeschlagen.', JSON.stringify(err));
    }
}

function getValueFromCustomFunction(object, functionDefinition) {
    const customFunction = new Function('object', functionDefinition);
    return customFunction(object);
}

function addPoolFieldToChangeMap(object, fieldConfiguration, changeMap) {
    const targetFieldName = fieldConfiguration.wfs_pool_field;
    if (!targetFieldName) return;

    const poolName = getPoolName(object, fieldConfiguration);
    if (poolName) changeMap[targetFieldName] = poolName;
}

function getPoolName(object, fieldConfiguration) {
    if (!object._pool) return undefined;

    const poolNames = getPoolNamesForDataTransfer(fieldConfiguration);
    for (let entry of object._pool._path) {
        const poolName = entry.pool.name?.['de-DE'];
        if (poolNames.includes(poolName)) return poolName;
    }

    return object._pool.pool?.name?.['de-DE'];
}

function getPoolNamesForDataTransfer(fieldConfiguration) {
    return fieldConfiguration.pool_names?.map(entry => {
        return entry.pool_name;
    }) ?? [];
}

function addToChangeMap(wfsFieldName, fieldValue, changeMap) {
    if (!fieldValue) return;

    if (typeof fieldValue === 'string') {
        changeMap[wfsFieldName] = escapeSpecialCharacters(fieldValue);
    } else if (typeof fieldValue === 'number') {
        changeMap[wfsFieldName] = fieldValue;
    } else if (isDanteConcept(fieldValue)) {
        changeMap[wfsFieldName + '_uri'] = escapeSpecialCharacters(fieldValue.conceptURI);
        changeMap[wfsFieldName + '_text'] = escapeSpecialCharacters(fieldValue.conceptName);
    }
}

function escapeSpecialCharacters(fieldValue) {
    return fieldValue.replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('\'', '&apos;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

function isDanteConcept(fieldValue) {
    return typeof fieldValue === 'object'
        && fieldValue.conceptName !== undefined && typeof fieldValue.conceptName === 'string'
        && fieldValue.conceptURI !== undefined && typeof fieldValue.conceptURI === 'string';
}

async function performEditTransaction(geometryIds, requestXml, fieldConfiguration) {
    const result = await performTransaction(requestXml, fieldConfiguration.edit_wfs_url);

    if (!new RegExp('<wfs:totalUpdated>' + geometryIds.length + '<\/wfs:totalUpdated>').test(result)) {
        throwErrorToFrontend('Bei der Aktualisierung von Geometrie-Datensätzen ist ein Fehler aufgetreten:', result);
    }
}

async function performDeleteTransaction(geometryIds, fieldConfiguration) {
    const result = await performTransaction(
        getDeleteRequestXml(geometryIds, fieldConfiguration.edit_wfs_feature_type),
        fieldConfiguration.edit_wfs_url
    );

    if (!new RegExp('<wfs:totalDeleted>' + geometryIds.length + '<\/wfs:totalDeleted>').test(result)) {
        throwErrorToFrontend('Beim Löschen von Geometrie-Datensätzen ist ein Fehler aufgetreten:', result);
    }
}

async function performTransaction(requestXml, wfsUrl) {
    const transactionUrl = wfsUrl + '?service=WFS&version=1.1.0&request=Transaction';;

    try {
        const response = await fetch(transactionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/xml',
                'Authorization': 'Basic ' + getAuthorizationString(getPluginConfiguration())
            },
            body: requestXml
        });
        return await response.text();
    } catch (err) {
        throwErrorToFrontend('Beim Zugriff auf den WFS-T ist ein Fehler aufgetreten:', err.toString());
    }    
}

function getEditRequestXml(geometryIds, changeMap, featureType) {
    return getTransactionXml(
        '<wfs:Update typeName="' + featureType + '">'
        + getPropertiesXml(changeMap)
        + getFilterXml(geometryIds)
        + '</wfs:Update>'
    );
}

function getMarkAsTemporaryRequestXml(geometryIds, propertyName, featureType) {
    return getTransactionXml(
        '<wfs:Update typeName="' + featureType + '">'
        + '<wfs:Property>'
        + '<wfs:Name>' + propertyName + '</wfs:Name>'
        + '<wfs:Value>true</wfs:Value>'
        + '</wfs:Property>'
        + getFilterXml(geometryIds)
        + '</wfs:Update>'
    );
}

function getDeleteRequestXml(geometryIds, featureType) {
    return getTransactionXml(
        '<wfs:Delete typeName="' + featureType + '">'
        + getFilterXml(geometryIds)
        + '</wfs:Delete>'
    );
}

function getTransactionXml(actionXml) {
    return '<?xml version="1.0" ?>'
    + '<wfs:Transaction '
    + 'version="1.1.0" '
    + 'service="WFS" '
    + 'xmlns:ogc="http://www.opengis.net/ogc" '
    + 'xmlns:wfs="http://www.opengis.net/wfs" '
    + 'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
    + 'xsi:schemaLocation="http://www.opengis.net/wfs">'
    + actionXml
    + '</wfs:Transaction>';
}

function getPropertiesXml(changeMap) {
    return Object.keys(changeMap).map(propertyName => {
        return '<wfs:Property>'
                + '<wfs:Name>' + propertyName + '</wfs:Name>'
                + '<wfs:Value>' + changeMap[propertyName] + '</wfs:Value>'
            + '</wfs:Property>';
    }).join('');
}

function getFilterXml(geometryIds) {
    return '<ogc:Filter>'
        + (geometryIds.length === 1
            ? getGeometryFilterXml(geometryIds[0])
            : '<ogc:Or>' + geometryIds.map(getGeometryFilterXml).join('') + '</ogc:Or>'
        )
        + '</ogc:Filter>';
}

function getGeometryFilterXml(geometryId) {
    const geometryIdPropertyName = getPluginConfiguration().wfs_geometry_id_field_name;

    return '<ogc:PropertyIsEqualTo>'
        + '<ogc:PropertyName>' + geometryIdPropertyName + '</ogc:PropertyName>'
        + '<ogc:Literal>' + geometryId + '</ogc:Literal>'
        + '</ogc:PropertyIsEqualTo>';
}

async function handleNewlyDrawnGeometries(object, tagGroups) {
    const configuration = getPluginConfiguration();
    const wfsConfiguration = getWFSConfiguration(configuration, object._objecttype);
    if (!wfsConfiguration) return false;

    const wfsTemporaryGeometryFieldName = configuration.wfs_temporary_geometry_field_name;
    const temporaryGeometryTagId = configuration.temporary_geometry_tag_id;

    let changed = false;
    for (let fieldConfiguration of wfsConfiguration.geometry_fields) {
        for (let fieldValue of await getFieldValues(object[object._objecttype], fieldConfiguration.field_path.split('.'))) {
            const newlyDrawnGeometryIds = fieldValue.newly_drawn_geometry_ids;
            delete fieldValue.newly_drawn_geometry_ids;
            changed = true;
            if (!newlyDrawnGeometryIds?.length) continue;

            if (wfsTemporaryGeometryFieldName) {
                await markGeometriesAsTemporary(newlyDrawnGeometryIds, fieldConfiguration, wfsTemporaryGeometryFieldName);
            }
            if (temporaryGeometryTagId) setTag(object, temporaryGeometryTagId, tagGroups);
        }
    }

    return changed;
}

async function markGeometriesAsTemporary(geometryIds, fieldConfiguration, wfsTemporaryGeometryFieldName) {
    const requestXml = getMarkAsTemporaryRequestXml(geometryIds, wfsTemporaryGeometryFieldName, fieldConfiguration.edit_wfs_feature_type);
    await performEditTransaction(geometryIds, requestXml, fieldConfiguration);
}

function getAuthorizationString(configuration) {
    const username = configuration.geoserver_write_username;
    const password = configuration.geoserver_write_password;

    return btoa(username + ':' + password);
}

function setTag(object, tagId, tagGroups) {
    const tagGroup = tagGroups.find(group => group._tags.find(entry => entry.tag._id === tagId));
    const tagsIdsToRemove = tagGroup.taggroup.type === 'choice'
        ? tagGroup._tags.map(entry => entry.tag._id)
        : [tagId];
    object._tags = object._tags.filter(tag => !tagsIdsToRemove.includes(tag._id))
        .concat([{ _id: tagId }]);
}

async function getTagGroups() {
    const url = info.api_url + '/api/v1/tags?access_token=' + info.api_user_access_token;

    try {
        const response = await fetch(url, { method: 'GET' });
        return await response.json();
    } catch (err) {
        throwErrorToFrontend('Die Abfrage der konfigurierten Tags ist fehlgeschlagen.', JSON.stringify(err));
    }
}

function throwErrorToFrontend(error, description, realm) {
    console.log(JSON.stringify({
        error: {
            code: 'error.nfisGeometry',
            statuscode: 400,
            realm: realm ?? 'api',
            error,
            parameters: {},
            description
        }
    }));

    process.exit(0);
}
