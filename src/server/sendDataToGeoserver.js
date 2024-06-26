const serverConfiguration = require('../serverConfiguration.json');

let input = '';
process.stdin.on('data', d => {
    try {
        input += d.toString();
    } catch(e) {
        console.error(`Could not read input into string: ${e.message}`, e.stack);
        process.exit(1);
    }
});

process.stdin.on('end', async () => {
    const data = JSON.parse(input);
    const configuration = await getPluginConfiguration();
    const authorizationString = getAuthorizationString(serverConfiguration);

    for (let object of data.objects) {
        await updateObject(
            object[object._objecttype],
            object._objecttype,
            getWFSConfiguration(configuration, object._objecttype),
            authorizationString
        );
    }

    console.log(JSON.stringify({'objects': []}));
    console.error('No changes');
    process.exit(0);
    return;
});

async function getPluginConfiguration() {
    const baseConfiguration = await getBaseConfiguration();
    return baseConfiguration.BaseConfigList.find(section => section.Name === 'nfisGeoservices').Values;
}

async function getBaseConfiguration() {
    const url = 'http://fylr.localhost:8082/inspect/config';
    const headers = { 'Accept': 'application/json' };

    let response;
    try {
        response = await fetch(url, { headers });
    } catch {
        throwErrorToFrontend('Failed to fetch base configuration');
    }

    if (response.ok) {
        return response.json();
    } else {
        throwErrorToFrontend('Failed to fetch base configuration', response.statusText);
    }
}

function getWFSConfiguration(configuration, objectType) {
    const wfsConfiguration = configuration.wfs_configuration.ValueTable;
    return wfsConfiguration?.find(configuration => configuration.object_type.ValueText === objectType);
}

function getAuthorizationString(serverConfiguration) {
    const username = serverConfiguration.geoserver.username;
    const password = serverConfiguration.geoserver.password;

    return btoa(username + ':' + password);
}

async function updateObject(object, objectType, wfsConfiguration, authorizationString) {
    if (!wfsConfiguration) return;

    for (let fieldConfiguration of wfsConfiguration.geometry_fields.ValueTable) {
        const geometryIds = getGeometryIds(object, objectType, fieldConfiguration.field_path.ValueText.split('.'));
        const poolName = getPoolName(object, fieldConfiguration);
        if (geometryIds?.length && poolName) {
            const changeMap = getChangeMap(object, objectType, fieldConfiguration, poolName);
            if (Object.keys(changeMap).length) {
                await performTransaction(
                    geometryIds, changeMap, fieldConfiguration.wfs_url.ValueText,
                    fieldConfiguration.wfs_feature_type.ValueText, authorizationString
                );
            }
        }
    }
}

function getGeometryIds(object, objectType, pathSegments) {
    const fieldValues = getFieldValues(object, objectType, pathSegments);
    return fieldValues.map(value => value?.geometry_ids)
        .filter(value => value !== undefined);
}

function getFieldValues(object, objectType, pathSegments) {
    const fieldName = pathSegments.shift();
    const field = object[fieldName] ?? object['_nested:' + objectType + '__' + fieldName];

    if (field === undefined) {
        return [];
    } else if (pathSegments.length === 0) {
        return [field];
    } else if (Array.isArray(field)) {
        return field.map(entry => getFieldValues(entry, objectType, pathSegments.slice()))
            .filter(data => data !== undefined)
            .reduce((result, fieldValues) => result.concat(fieldValues), []);
    } else {
        return getFieldValues(field, objectType, pathSegments);
    }
}

function getPoolName(object, fieldConfiguration) {
    const allowedPoolNames = getAllowedPoolNames(fieldConfiguration);
    const foundPoolNames = [];
    for (let entry of object._pool._path) {
        const poolName = entry.pool.name?.['de-DE'];
        foundPoolNames.push(poolName);
        if (allowedPoolNames.includes(poolName)) return poolName;
    }

    return undefined;
}

function getAllowedPoolNames(fieldConfiguration) {
    return fieldConfiguration.allowed_pool_names?.ValueTable?.map(entry => {
        return entry.allowed_pool_name.ValueText;
    });
}

function getChangeMap(object, objectType, fieldConfiguration, poolName) {
    const changeMap = {};
    addPoolFieldToChangeMap(fieldConfiguration, poolName, changeMap);
    addDesignationEventStatusFieldToChangeMap(object, objectType, fieldConfiguration, changeMap);

    const fields = fieldConfiguration.fields.ValueTable;
    return fields.reduce((result, field) => {
        const wfsFieldName = field.wfs_field_name.ValueText;
        const fylrFieldName = field.fylr_field_name.ValueText;
        const fieldValues = getFieldValues(object, objectType, fylrFieldName.split('.'));

        addToChangeMap(wfsFieldName, fylrFieldName, fieldValues?.[0], result);

        return result;
    }, changeMap);
}

function addPoolFieldToChangeMap(fieldConfiguration, poolName, changeMap) {
    const targetFieldName = fieldConfiguration.wfs_pool_field.ValueText;
    if (!targetFieldName) return;

    changeMap[targetFieldName] = poolName;
}

function addDesignationEventStatusFieldToChangeMap(object, objectType, fieldConfiguration, changeMap) {
    const targetFieldName = fieldConfiguration.wfs_event_status_field.ValueText;
    if (!targetFieldName) return;

    const latestEvent = getLatestDesignationEvent(object, objectType);
    if (!latestEvent) return;

    changeMap[targetFieldName] = latestEvent.lk_status.conceptName;
}

function getLatestDesignationEvent(object, objectType) {
    const events = object['_nested:' + objectType + '__event']
        .filter(event => {
            return event.lk_eventtyp?.conceptName === 'Ausweisung'
                && event.lk_status !== undefined
                && event.datum_ausweisung_beginn?.value;
        });
    if (!events.length) return undefined;

    events.sort((event1, event2) => {
        return new Date(event2.datum_ausweisung_beginn.value) - new Date(event1.datum_ausweisung_beginn.value);
    });

    return events[0];
}

function addToChangeMap(wfsFieldName, fylrFieldName, fieldValue, changeMap) {
    if (fieldValue) {
        if (typeof fieldValue === 'string') {
            changeMap[wfsFieldName] = fieldValue;
        } else if (isDanteConcept(fieldValue)) {
            changeMap[wfsFieldName + '_uri'] = fieldValue.conceptURI;
            changeMap[wfsFieldName + '_text'] = fieldValue.conceptName;
        } else {
            throwErrorToFrontend(
                'Invalid field value in field "' + fylrFieldName + '"',
                JSON.stringify(fieldValue)
            );
        }
    }
}

function isDanteConcept(fieldValue) {
    return typeof fieldValue === 'object'
        && fieldValue.conceptName !== undefined
        && fieldValue.conceptURI !== undefined;
}

async function performTransaction(geometryIds, changeMap, wfsUrl, wfsFeatureType, authorizationString) {
    const requestXml = getRequestXml(geometryIds, changeMap, wfsFeatureType);
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
        const xmlResult = await response.text();
        if (!new RegExp('<wfs:totalUpdated>' + geometryIds.length + '<\/wfs:totalUpdated>').test(xmlResult)) {
            throwErrorToFrontend('Failed to update PostGIS database: ' + xmlResult);
        }
    } catch (err) {
        throwErrorToFrontend(err);
    }    
}

function getRequestXml(geometryIds, changeMap, featureType) {
    return '<?xml version="1.0" ?>'
        + '<wfs:Transaction '
        + 'version="1.1.0" '
        + 'service="WFS" '
        + 'xmlns:ogc="http://www.opengis.net/ogc" '
        + 'xmlns:wfs="http://www.opengis.net/wfs" '
        + 'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
        + 'xsi:schemaLocation="http://www.opengis.net/wfs">'
        + '<wfs:Update typeName="' + featureType + '">'
        + getPropertiesXml(changeMap)
        + getFilterXml(geometryIds)
        + '</wfs:Update>'
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


function throwErrorToFrontend(error, description) {
    console.log(JSON.stringify({
        error: {
            code: 'error.nfisGeometry',
            statuscode: 400,
            realm: 'api',
            error,
            parameters: {},
            description
        }
    }));

    process.exit(0);
}
