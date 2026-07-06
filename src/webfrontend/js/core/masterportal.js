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

    const menuSettings = getMenuSettings(masterportalConfiguration, geometryIds, geometryIdFieldName);
    const layerSettings = getLayerSettings(masterportalConfiguration, geometryIds);

    return url + 'menu=' + JSON.stringify(menuSettings) + '&layers=' + JSON.stringify(layerSettings);
}

function getMenuSettings(masterportalConfiguration, geometryIds, geometryIdFieldName) {
    return {
        main: {
            currentComponent: 'root'
        },
        secondary: {
            currentComponent: 'filter',
            attributes: {
                rulesOfFilters: getFilters(masterportalConfiguration, geometryIds, geometryIdFieldName),
                selectedAccordions: getAccordions(masterportalConfiguration, geometryIds)
            },
            selectedGroups: []
        }
    };
}

function getFilters(masterportalConfiguration, geometryIds, geometryIdFieldName) {
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

function getAccordions(masterportalConfiguration, geometryIds) {
    return getFiltersConfiguration(masterportalConfiguration).layers
        .map((layerConfiguration, index) => {
            return { layerId: layerConfiguration.layerId, filterId: index };
        }).filter(layerConfiguration => geometryIds[layerConfiguration.layerId]);
        
}

function getLayerSettings(masterportalConfiguration, geometryIds) {
    return masterportalConfiguration.layerConfig.baselayer.elements.filter(layer => layer.type !== 'folder').map(layer => {
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
}

function getFiltersConfiguration(masterportalConfiguration) {
    return masterportalConfiguration.portalConfig.secondaryMenu.sections?.[0]?.find(section => section.type === 'filter');
}

async function getEditGeometryUrl(object, fieldConfiguration, extent, geometryIdFieldName, geometryId) {
    let url = getMasterportalUrl();
    const { layerIds, vectorLayerId } = getLayerIds(object, fieldConfiguration);
    if (!url) return '';

    if (extent) url += 'zoomToExtent=' + extent.join(',') + '&';

    const masterportalVersion = configuration.get().masterportal_version;
    const masterportalConfiguration = await getConfigurationFile();

    const wfstLayerIds = masterportalConfiguration.portalConfig.secondaryMenu.sections?.[0]?.find(section => section.type === 'wfst')?.layerIds;
    const layerIndex = wfstLayerIds?.indexOf(vectorLayerId);
    if (!wfstLayerIds || layerIndex === -1) return '';

    if (masterportalVersion === '3') {
        const menu = {
            main: {
                currentComponent: 'root'
            },
            secondary: {
                currentComponent: 'wfst',
                attributes: {
                    currentLayerIndex: layerIndex
                }
            }
        };
        if (geometryIdFieldName && geometryId) {
            menu.secondary.attributes.featureValues = [
                {
                    key: geometryIdFieldName,
                    value: geometryId
                }
            ];
        }
        url += 'menu=' + JSON.stringify(menu);
    } else {
        url += 'isinitopen=wfst';
    }
    
    if (layerIds?.length) url += '&layerids=' + layerIds.join(',');

    return url;
}

function getUploadGeometryUrl(object, fieldConfiguration, extent, geometryId) {
    let url = getMasterportalUrl();
    const { layerIds, vectorLayerId } = getLayerIds(object, fieldConfiguration);
    if (!url) return '';

    if (extent) url += 'zoomToExtent=' + extent.join(',') + '&';

    const menu = {
        main: {
            currentComponent: 'root'
        },
        secondary: {
            currentComponent: 'wfstUploader'
        }
    };

    url += 'menu=' + JSON.stringify(menu) + '&uploadlayerid=' + vectorLayerId + '&uuid=' + geometryId;
    
    if (layerIds?.length) url += '&layerids=' + layerIds.join(',');

    return url;
}

function getLayerIds(object, fieldConfiguration) {
    const rasterLayerId = fieldConfiguration.masterportal_raster_layer_id;
    const vectorLayerId = getVectorLayerId(object, fieldConfiguration);

    const layerIds = [];
    if (rasterLayerId) layerIds.push(rasterLayerId);
    if (vectorLayerId) layerIds.push(vectorLayerId);

    return { layerIds, vectorLayerId };
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
    getUploadGeometryUrl,
    getLayerIds,
    getVectorLayerId,
    getFilterGeometriesUrl
};
