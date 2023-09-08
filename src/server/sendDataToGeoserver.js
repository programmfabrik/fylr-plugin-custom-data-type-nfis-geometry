let info = undefined;
if (process.argv.length >= 3) {
    info = JSON.parse(process.argv[2])
}


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

    wfsConfiguration.fields.shift();

    for (let fieldConfiguration of wfsConfiguration.fields) {
        const geometryIds = getGeometryIds(object, fieldConfiguration.field_path.split('/'));
        if (!geometryIds?.length) continue;

        for (let geometryId of geometryIds) {
            await updateGeometry(geometryId, object.name, fieldConfiguration.wfs_url, authorizationString);
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


async function updateGeometry(geometryId, name, wfsUrl, authorizationString) {

    const changeMap = {
        layer: name
    };

    const requestXml = getRequestXml(geometryId, changeMap);
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
        if (!/<wfs:totalUpdated>1<\/wfs:totalUpdated>/.test(xmlResult)) {
            throwErrorToFrontend('Failed to update PostGIS database');
        }
    } catch (err) {
        throwErrorToFrontend(err);
    }    
}


function getRequestXml(geometryId, changeMap) {

    return '<?xml version="1.0" ?>'
        + '<wfs:Transaction '
        + 'version="1.1.0" '
        + 'service="WFS" '
        + 'xmlns:ogc="http://www.opengis.net/ogc" '
        + 'xmlns:wfs="http://www.opengis.net/wfs" '
        + 'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
        + 'xsi:schemaLocation="http://www.opengis.net/wfs">'
        + '<wfs:Update typeName="adabweb:nfis_wfs">'
        + getPropertiesXml(changeMap)
        + getFilterXml(geometryId)
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


function getFilterXml(geometryId) {

    return '<ogc:Filter>'
            + '<ogc:PropertyIsEqualTo>'
            + '<ogc:PropertyName>ouuid</ogc:PropertyName>'
            + '<ogc:Literal>' + geometryId + '</ogc:Literal>'
            + '</ogc:PropertyIsEqualTo>'
        + '</ogc:Filter>';
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
