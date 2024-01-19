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
    const authorizationString = getAuthorizationString(configuration);

    for (let object of data.objects) {
        await updateObject(
            object[object._objecttype],
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
    return wfsConfiguration.find(configuration => configuration.object_type.ValueText === objectType);
}


function getAuthorizationString(configuration) {

    const username = configuration.geoserver_username.ValueText;
    const password = configuration.geoserver_password.ValueText;

    return btoa(username + ':' + password);
}


async function updateObject(object, wfsConfiguration, authorizationString) {

    if (!wfsConfiguration) return;

    for (let fieldConfiguration of wfsConfiguration.geometry_fields.ValueTable) {
        const geometryIds = getGeometryIds(object, fieldConfiguration.field_path.ValueText.split('.'));
        if (geometryIds?.length) {
            const changeMap = getChangeMap(object, fieldConfiguration.fields.ValueTable);
            await performTransaction(
                geometryIds, changeMap, fieldConfiguration.wfs_url.ValueText,
                fieldConfiguration.wfs_feature_type.ValueText, authorizationString
            );
        }
    }
}


function getGeometryIds(object, pathSegments) {

    const fieldName = pathSegments.shift();
    const field = object[fieldName] ?? object['_nested:object__' + fieldName];

    if (field === undefined) {
        return undefined;
    } else if (pathSegments.length === 0) {
        return field?.geometry_ids;
    } else if (Array.isArray(field)) {
        return field.map(entry => getGeometryIds(entry, pathSegments.slice()))
            .filter(data => data !== undefined)
            .reduce((result, ids) => result.concat(ids), []);
    } else {
        return getGeometryIds(field, pathSegments);
    }
}

function getChangeMap(object, fields) {

    return fields.reduce((result, field) => {
        const wfsFieldName = field.wfs_field_name.ValueText;
        const fylrFieldName = field.fylr_field_name.ValueText;
        const fieldValue = object[fylrFieldName];

        addToChangeMap(wfsFieldName, fylrFieldName, fieldValue, result);

        return result;
    }, {});
}

function addToChangeMap(wfsFieldName, fylrFieldName, fieldValue, changeMap) {

    if (fieldValue) {
        if (typeof fieldValue === 'string') {
            changeMap[wfsFieldName] = fieldValue;
        } else if (isDanteConcept(fieldValue)) {
            changeMap[wfsFieldName + '_uuid'] = getDanteId(fieldValue);
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

function getDanteId(danteConcept) {

    const segments = danteConcept.conceptURI.split('/');
    return segments[segments.length - 1];
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
            throwErrorToFrontend('Failed to update PostGIS database');
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
