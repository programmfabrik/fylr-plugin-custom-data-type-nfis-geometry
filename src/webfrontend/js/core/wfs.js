function loadData(fieldConfiguration, geometryIds, geometryIdFieldName, authorizationString) {
    return new Promise((resolve, reject) => {
        const wfsUrl = geometryIds?.length
            ? getLoadDataUrl(fieldConfiguration, geometryIds, geometryIdFieldName)
            : undefined;
        if (!wfsUrl) return resolve(undefined);

        const xhr = new XMLHttpRequest();
        xhr.open('GET', wfsUrl);
        xhr.setRequestHeader('Authorization', authorizationString);
        xhr.onload = function() {
            if (xhr.status == 200) {
                const data = JSON.parse(xhr.responseText);
                resolve(data);
            } else {
                reject('Failed to load data from WFS');
            }
        };
        xhr.onerror = error => {
            reject(error);
        };
        xhr.send();
    });
}

function getLoadDataUrl(fieldConfiguration, geometryIds, geometryIdFieldName) {
    let baseUrl = fieldConfiguration.display_wfs_url;
    const featureType = fieldConfiguration.display_wfs_feature_type;

    if (!baseUrl || !featureType) return '';
    if (!baseUrl.endsWith('/')) baseUrl += '/';

    return baseUrl
        + '?service=WFS&version=1.1.0&request=GetFeature&typename='
        + featureType
        + '&outputFormat=application/json&srsname=EPSG:25832&cql_filter='
        + geometryIdFieldName
        + ' in ('
        + geometryIds.map(id => '\'' + id + '\'').join(',')
        + ')';
}

function editData(fieldConfiguration, geometryId, propertyName, propertyValue, geometryIdFieldName, authorizationString) {
    return new Promise((resolve, reject) => {
        const wfsUrl = getEditDataUrl(fieldConfiguration);
        if (!wfsUrl) return resolve(undefined);

        const requestXml = getEditRequestXml(
            fieldConfiguration.edit_wfs_feature_type,
            geometryIdFieldName,
            geometryId,
            propertyName,
            propertyValue
        );

        const xhr = new XMLHttpRequest();
        xhr.open('POST', wfsUrl);
        xhr.setRequestHeader('Authorization', authorizationString);
        xhr.setRequestHeader('Content-Type', 'application/xml');
        xhr.onload = function() {
            if (xhr.status == 200) {
                resolve();
            } else {
                reject('Failed to edit data via WFS');
            }
        };
        xhr.onerror = error => {
            reject(error);
        };
        xhr.send(requestXml);
    });
}

function getEditDataUrl(fieldConfiguration) {
    let baseUrl = fieldConfiguration.edit_wfs_url;
    const featureType = fieldConfiguration.edit_wfs_feature_type;

    if (!baseUrl || !featureType) return undefined;
    if (!baseUrl.endsWith('/')) baseUrl += '/';

    return baseUrl + 'service=WFS&version=1.1.0&request=Transaction';
}

function getEditRequestXml(featureType, geometryIdPropertyName, geometryId, propertyName, propertyValue) {
    return '<?xml version="1.0" ?>'
        + '<wfs:Transaction '
        + 'version="1.1.0" '
        + 'service="WFS" '
        + 'xmlns:ogc="http://www.opengis.net/ogc" '
        + 'xmlns:wfs="http://www.opengis.net/wfs" '
        + 'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
        + 'xsi:schemaLocation="http://www.opengis.net/wfs">'
        + '<wfs:Update typeName="' + featureType + '">'
        + '<wfs:Property>'
        + '<wfs:Name>' + propertyName + '</wfs:Name>'
        + '<wfs:Value>' + propertyValue + '</wfs:Value>'
        + '</wfs:Property>'
        + '<ogc:Filter>'
        + '<ogc:PropertyIsEqualTo>'
        + '<ogc:PropertyName>' + geometryIdPropertyName + '</ogc:PropertyName>'
        + '<ogc:Literal>' + geometryId + '</ogc:Literal>'
        + '</ogc:PropertyIsEqualTo>'
        + '</ogc:Filter>'
        + '</wfs:Update>'
        + '</wfs:Transaction>';
}

export default {
    loadData,
    getLoadDataUrl,
    editData
};
