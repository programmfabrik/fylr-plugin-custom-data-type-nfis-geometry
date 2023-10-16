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
    const authorizationString = getAuthorizationString(data);

    for (let object of data.objects) {
        await updateObject(
            object[object._objecttype],
            getWFSConfiguration(data, object._objecttype),
            authorizationString
        );
    }

    console.log(JSON.stringify({'objects': []}));
    console.error('No changes');
    process.exit(0);
    return;
});


function getWFSConfiguration(data, objectType) {

    const wfsConfiguration = getPluginConfiguration(data).wfs_configuration;

    return wfsConfiguration.find(configuration => configuration.object_type === objectType);
}


function getAuthorizationString(data) {

    const username = getPluginConfiguration(data).geoserver_username;
    const password = getPluginConfiguration(data).geoserver_password;

    return btoa(username + ':' + password);
}


async function updateObject(object, wfsConfiguration, authorizationString) {

    if (!wfsConfiguration) return;

    for (let fieldConfiguration of wfsConfiguration.fields) {
        const geometryIds = getGeometryIds(object, fieldConfiguration.field_path.split('/'));
        if (geometryIds?.length) {
            await performTransaction(
                geometryIds, object.name, fieldConfiguration.wfs_url, fieldConfiguration.wfs_feature_type,
                authorizationString
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


async function performTransaction(geometryIds, name, wfsUrl, wfsFeatureType, authorizationString) {

    const changeMap = {
        layer: name
    };

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


function getPluginConfiguration(data) {

    return data.info.config.plugin['custom-data-type-nfis-geometry'].config.nfisGeoservices;
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
