function getViewGeometriesUrl(fieldConfiguration, geometryIdFieldName, extent, wfsData) {
    const url = getMasterportalUrl();
    const masterportalVersion = getBaseConfiguration().masterportal_version;
    const layerId = getMasterportalVectorLayerId(fieldConfiguration, wfsData);

    if (!url || !layerId) return '';

    return masterportalVersion === '2' || masterportalVersion === '3_use_extent'
        ? (url + 'zoomToExtent=' + extent.join(','))
        : (url + 'highlightFeaturesByAttribute=1&wfsId=' + layerId
            + '&attributeName=' + geometryIdFieldName
            + '&attributeValue=' + wfsData.features.map(feature => feature.properties[geometryIdFieldName])
            + '&attributeQuery=isIn');
}


function getEditGeometryUrl(fieldConfiguration, wfsData, extent, geometryId, upload = false) {
    let url = getMasterportalUrl();
    const layerIds = getMasterportalLayerIds(fieldConfiguration, wfsData);
    if (!url) return '';
    
    if (extent) url += 'zoomToExtent=' + extent.join(',') + '&';
    url += upload
        ? 'menu={%22secondary%22:{%22currentComponent%22:%22wfstUploader%22}}'
        : 'isinitopen=wfst';

    if (geometryId) url += '&uuid=' + geometryId;
    
    if (layerIds?.length) url += '&layerids=' + layerIds.join(',');

    return url;
}

function getMasterportalLayerIds(fieldConfiguration, wfsData) {
    const rasterLayerId = fieldConfiguration.masterportal_raster_layer_id;
    const vectorLayerId = getMasterportalVectorLayerId(fieldConfiguration, wfsData);

    const result = [];
    if (rasterLayerId) result.push(rasterLayerId);
    if (vectorLayerId) result.push(vectorLayerId);

    return result;
}

function getMasterportalVectorLayerId(fieldConfiguration, wfsData) {
    const fieldName = fieldConfiguration.masterportal_vector_layer_field_name;
    const mapping = fieldConfiguration.masterportal_vector_layer_ids;

    return mapping.find(entry => {
        return (!entry.field_value || wfsData?.features.find(feature => feature.properties[fieldName] === entry.field_value))
            && (!entry.group_id || getUserGroupIds().includes(entry.group_id));
    })?.layer_id;
}

function getMasterportalUrl() {
    let masterportalUrl = getBaseConfiguration().masterportal_url;
    if (!masterportalUrl) return undefined;

    const configurationFileName = getConfigurationFileName();
    return configurationFileName
        ? masterportalUrl + '?configJson=' + configurationFileName + '&'
        : masterportalUrl + '?';
}

function getConfigurationFileName() {
    return getBaseConfiguration().masterportal_configurations?.find(entry => {
        return !entry.group_id || getUserGroupIds().includes(entry.group_id);
    })?.file_name;
}

function getBaseConfiguration() {
    return ez5.session.getBaseConfig('plugin', 'custom-data-type-nfis-geometry')['nfisGeoservices'];
}

function getUserGroupIds() {
    return ez5.session.user.data.__group_ids;
}

export default {
    getViewGeometriesUrl,
    getEditGeometryUrl
};
