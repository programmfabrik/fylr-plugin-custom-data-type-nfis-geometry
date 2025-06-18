const info = process.argv.length >= 3
    ? JSON.parse(process.argv[2])
    : {};

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
    const configuration = getPluginConfiguration();
    const authorizationString = getAuthorizationString(configuration);

    for (let object of data.objects) {
        await updateObject(
            object[object._objecttype],
            object._objecttype,
            object._uuid,
            await getCurrentObjectData(object[object._objecttype]._id, object._objecttype),
            configuration,
            authorizationString
        );
    }

    console.log(JSON.stringify({ objects: [] }));
    console.error('No changes');
    process.exit(0);
    return;
});

function getPluginConfiguration() {
    return info.config.plugin['custom-data-type-nfis-geometry'].config.nfisGeoservices;
}

function getWFSConfiguration(configuration, objectType) {
    const wfsConfiguration = configuration.wfs_configuration;
    return wfsConfiguration?.find(configuration => configuration.object_type === objectType);
}

function getAuthorizationString(configuration) {
    const username = configuration.geoserver_write_username;
    const password = configuration.geoserver_write_password;

    return btoa(username + ':' + password);
}

async function getCurrentObjectData(objectId, objectType) {
    if (!objectId) return undefined;

    const mask = await getPreferredMask(objectType);
    const url = info.api_url + '/api/v1/db/' + objectType + '/' + mask + '/' + objectId + '?access_token=' + info.api_user_access_token;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        const result = await response.json();
        if (!result.length) throwErrorToFrontend('Beim Abruf der aktuellen Objektversion ist ein Fehler aufgetreten.');
        return result[0][objectType];
    } catch (err) {
        throwErrorToFrontend('Beim Abruf der aktuellen Objektversion ist ein Fehler aufgetreten:', err.toString());
    }
}

async function getPreferredMask(objectType) {
    const url = info.api_url + '/api/v1/mask/CURRENT?access_token=' + info.api_user_access_token;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        const result = await response.json();
        const mask = result?.masks?.find(mask => mask.table_name_hint === objectType && mask.is_preferred)?.name;
        if (!mask) throwErrorToFrontend('Es konnte keine Maske für diesen Objekttyp gefunden werden.');
        return mask;
    } catch (err) {
        throwErrorToFrontend('Beim Abruf der Maske ist ein Fehler aufgetreten:', err.toString());
    }
}

async function updateObject(object, objectType, uuid, currentObject, configuration, authorizationString) {
    const wfsConfiguration = getWFSConfiguration(configuration, objectType);
    if (!wfsConfiguration) return;

    for (let fieldConfiguration of wfsConfiguration.geometry_fields) {
        const geometryIds = getGeometryIds(object, fieldConfiguration.field_path.split('.'));
        if (geometryIds.length && await hasUsedGeometryIds(configuration, geometryIds, uuid)) {
            return throwErrorToFrontend('Eine oder mehrere Geometrien sind bereits mit anderen Objekten verknüpft.', undefined, 'multipleGeometryLinking');
        }

        await editGeometries(object, fieldConfiguration, geometryIds, authorizationString);
        await deleteGeometries(fieldConfiguration, geometryIds, currentObject, authorizationString);
    }
}

function getGeometryIds(object, pathSegments) {
    let geometryIds = [];

    for (let fieldValue of getFieldValues(object, pathSegments)) {
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

async function editGeometries(object, fieldConfiguration, geometryIds, authorizationString) {
    if (isSendingDataToGeoserverActivated(fieldConfiguration, geometryIds)) {
        const changeMap = getChangeMap(object, fieldConfiguration);
        if (Object.keys(changeMap).length) {
            await performEditTransaction(geometryIds, changeMap, fieldConfiguration, authorizationString);
        }
    }
}

async function deleteGeometries(fieldConfiguration, geometryIds, currentObject, authorizationString) {
    if (!currentObject) return;
    const deletedGeometryIds = getDeletedGeometryIds(geometryIds, currentObject, fieldConfiguration);
    if (deletedGeometryIds.length) await performDeleteTransaction(deletedGeometryIds, fieldConfiguration, authorizationString);
}

function getDeletedGeometryIds(geometryIds, currentObject, fieldConfiguration) {
    const currentGeometryIds = getGeometryIds(currentObject, fieldConfiguration.field_path.split('.'));
    return currentGeometryIds.filter(geometryId => !geometryIds.includes(geometryId));
}

function isSendingDataToGeoserverActivated(fieldConfiguration, geometryIds) {
    return fieldConfiguration.send_data_to_geoserver
        && fieldConfiguration.edit_wfs_url
        && geometryIds?.length;
}

function getChangeMap(object, fieldConfiguration) {
    const changeMap = {};
    addPoolFieldToChangeMap(object, fieldConfiguration, changeMap);

    const fields = fieldConfiguration.fields ?? [];
    return fields.reduce((result, field) => {
        const wfsFieldName = field.wfs_field_name;
        const fylrFieldName = field.fylr_field_name;
        const fylrFunction = field.fylr_function;
        if (fylrFieldName || fylrFunction) {
            const fieldValue = fylrFieldName
                ? getFieldValues(object, fylrFieldName.split('.'))?.[0]
                : getValueFromCustomFunction(object, fylrFunction);
            addToChangeMap(wfsFieldName, fieldValue, result);
        }
        return result;
    }, changeMap);
}

function getFieldValues(object, pathSegments) {
    const fieldName = pathSegments.shift();
    const field = object[fieldName];

    if (field === undefined) {
        return [];
    } else if (pathSegments.length === 0) {
        return [field];
    } else if (Array.isArray(field)) {
        return field.map(entry => getFieldValues(entry, pathSegments.slice()))
            .filter(data => data !== undefined)
            .reduce((result, fieldValues) => result.concat(fieldValues), []);
    } else {
        return getFieldValues(field, pathSegments);
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

    if (typeof fieldValue === 'string' || typeof fieldValue === 'number') {
        changeMap[wfsFieldName] = fieldValue;
    } else if (isDanteConcept(fieldValue)) {
        changeMap[wfsFieldName + '_uri'] = fieldValue.conceptURI;
        changeMap[wfsFieldName + '_text'] = fieldValue.conceptName;
    }
}

function isDanteConcept(fieldValue) {
    return typeof fieldValue === 'object'
        && fieldValue.conceptName !== undefined
        && fieldValue.conceptURI !== undefined;
}

async function performEditTransaction(geometryIds, changeMap, fieldConfiguration, authorizationString) {
    const result = await performTransaction(
        getEditRequestXml(geometryIds, changeMap, fieldConfiguration.edit_wfs_feature_type),
        fieldConfiguration.edit_wfs_url,
        authorizationString
    );

    if (!new RegExp('<wfs:totalUpdated>' + geometryIds.length + '<\/wfs:totalUpdated>').test(result)) {
        throwErrorToFrontend('Bei der Aktualisierung von Geometrie-Datensätzen ist ein Fehler aufgetreten:', result);
    }
}

async function performDeleteTransaction(geometryIds, fieldConfiguration, authorizationString) {
    const result = await performTransaction(
        getDeleteRequestXml(geometryIds, fieldConfiguration.edit_wfs_feature_type),
        fieldConfiguration.edit_wfs_url,
        authorizationString
    );

    if (!new RegExp('<wfs:totalDeleted>' + geometryIds.length + '<\/wfs:totalDeleted>').test(result)) {
        throwErrorToFrontend('Beim Löschen von Geometrie-Datensätzen ist ein Fehler aufgetreten:', result);
    }
}

async function performTransaction(requestXml, wfsUrl, authorizationString) {
    const transactionUrl = wfsUrl + '?service=WFS&version=1.1.0&request=Transaction';

    try {
        const response = await fetch(transactionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/xml',
                'Authorization': 'Basic ' + authorizationString
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
    return '<ogc:PropertyIsEqualTo>'
        + '<ogc:PropertyName>ouuid</ogc:PropertyName>'
        + '<ogc:Literal>' + geometryId + '</ogc:Literal>'
        + '</ogc:PropertyIsEqualTo>';
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
