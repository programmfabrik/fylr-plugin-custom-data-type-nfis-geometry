import configuration from './configuration';


function getViewGeometriesUrl(object, fieldConfiguration, geometryIdFieldName, extent, wfsData) {
    const url = getMasterportalUrl();
    const masterportalVersion = configuration.get().masterportal_version;
    const layerId = getVectorLayerId(object, fieldConfiguration);

    if (!url || !layerId) return '';

    return masterportalVersion === '2' || masterportalVersion === '3_use_extent'
        ? (url + 'zoomToExtent=' + extent.join(','))
        : (url + 'highlightFeaturesByAttribute=1&wfsId=' + layerId
            + '&attributeName=' + geometryIdFieldName
            + '&attributeValue=' + wfsData.features.map(feature => feature.properties[geometryIdFieldName])
            + '&attributeQuery=isIn');
}

async function getFilterGeometriesUrl(geometryIds, geometryIdFieldName) {
    const masterportalVersion = configuration.get().masterportal_version;
    if (masterportalVersion === '2') return '';

    const url = getMasterportalUrl();
    const masterportalConfiguration = await getConfigurationFile();

    const menuSettings = {
        main: {
            currentComponent: 'root'
        },
        secondary: {
            currentComponent: 'filter',
            attributes: {
                rulesOfFilters: getFilters(geometryIds, geometryIdFieldName, masterportalConfiguration),
                selectedAccordions: getAccordions(masterportalConfiguration)
            },
            selectedGroups: []
        }
    };

    const layerSettings = masterportalConfiguration.layerConfig.baselayer.elements.filter(layer => layer.type !== 'folder').map(layer => {
        return {
            id: Array.isArray(layer.id) ? layer.id.join('-') : layer.id,
            visibility: layer.visibility
        };
    }).concat(masterportalConfiguration.layerConfig.subjectlayer.elements.filter(layer => layer.type !== 'folder').map(layer => {
        return {
            id: Array.isArray(layer.id) ? layer.id.join('-') : layer.id,
            visibility: Object.keys(geometryIds).includes(layer.id)
        };
    }));

    return url + 'menu=' + JSON.stringify(menuSettings) + '&layers=' + JSON.stringify(layerSettings);
}

function getFilters(geometryIds, geometryIdFieldName, masterportalConfiguration) {
    const filtersConfiguration = getFiltersConfiguration(masterportalConfiguration);
    if (!filtersConfiguration) return [];

    return filtersConfiguration.layers.map(layerConfiguration => {
        return geometryIds[layerConfiguration.layerId]
            ? getSnippets(layerConfiguration, geometryIds, geometryIdFieldName)
            : null;
    });
}

function getSnippets(layerConfiguration, geometryIds, geometryIdFieldName) {
    return layerConfiguration.snippets.map((snippet, index) => {
        if (snippet.attrName === geometryIdFieldName) {
            return {
                snippetId: index,
                startup: false,
                fixed: false,
                attrName: geometryIdFieldName,
                attrLabel: snippet.title,
                operatorForAttrName: 'AND',
                operator: 'EQ',
                value: geometryIds[layerConfiguration.layerId]
            };
        } else {
            return null;
        }
    });
}

function getAccordions(masterportalConfiguration) {
    return getFiltersConfiguration(masterportalConfiguration).layers.map((layer, index) => {
        return { layerId: layer.layerId, filterId: index };
    });
}

function getFiltersConfiguration(masterportalConfiguration) {
    return masterportalConfiguration.portalConfig.secondaryMenu.sections?.[0].find(section => section.type === 'filter');
}

function getEditGeometryUrl(object, fieldConfiguration, extent, geometryId, upload = false) {
    let url = getMasterportalUrl();
    const layerIds = getLayerIds(object, fieldConfiguration);
    if (!url) return '';
    
    if (extent) url += 'zoomToExtent=' + extent.join(',') + '&';
    url += upload
        ? 'menu={%22secondary%22:{%22currentComponent%22:%22wfstUploader%22}}'
        : 'isinitopen=wfst';

    if (geometryId) url += '&uuid=' + geometryId;
    
    if (layerIds?.length) url += '&layerids=' + layerIds.join(',');

    return url;
}

function getLayerIds(object, fieldConfiguration) {
    const rasterLayerId = fieldConfiguration.masterportal_raster_layer_id;
    const vectorLayerId = getVectorLayerId(object, fieldConfiguration);

    const result = [];
    if (rasterLayerId) result.push(rasterLayerId);
    if (vectorLayerId) result.push(vectorLayerId);

    return result;
}

function getVectorLayerId(object, fieldConfiguration) {
    const values = getValues(object, configuration.get());

    const mapping = fieldConfiguration.masterportal_vector_layer_ids;

    return mapping.find(entry => {
        return (!entry.function || executeCustomFunction(object, values, entry.function))
            && (!entry.group_id || getUserGroupIds().includes(entry.group_id));
    })?.layer_id;
}

function getMasterportalUrl() {
    const masterportalUrl = configuration.get().masterportal_url;
    if (!masterportalUrl) return undefined;

    const configurationFileName = getConfigurationFileName();
    return configurationFileName
        ? masterportalUrl + '?configJson=' + configurationFileName + '&'
        : masterportalUrl + '?';
}

function getConfigurationFileName() {
    return getConfigurationFileDefinition()?.file_name;
}

async function getConfigurationFile() {
    const url = getConfigurationFileDefinition()?.file?.versions.original.url + '?access_token=' + ez5.session.token;
    const fileContent = await fetch(url);
    return fileContent.json();
}

function getConfigurationFileDefinition() {
    return configuration.get().masterportal_configurations?.find(entry => {
        return !entry.group_id || getUserGroupIds().includes(entry.group_id);
    });
}

function getUserGroupIds() {
    return ez5.session.user.data.__group_ids;
}

export default {
    getViewGeometriesUrl,
    getEditGeometryUrl,
    getLayerIds,
    getVectorLayerId,
    getFilterGeometriesUrl
};
