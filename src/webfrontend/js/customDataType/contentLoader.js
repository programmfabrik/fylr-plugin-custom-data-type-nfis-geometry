import Map from 'ol/Map';
import View from 'ol/View';
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer';
import { TileWMS, Vector as VectorSource } from 'ol/source';
import { defaults } from 'ol/interaction/defaults';
import MouseWheelZoom from 'ol/interaction/MouseWheelZoom';
import Select from 'ol/interaction/Select';
import { Style, Stroke, Fill } from 'ol/style';
import { GeoJSON } from 'ol/format';
import { shiftKeyOnly, platformModifierKeyOnly, click } from 'ol/events/condition';
import * as olProj from 'ol/proj';
import * as olProj4 from 'ol/proj/proj4';
import * as olLoadingstrategy from 'ol/loadingstrategy';
import proj4 from 'proj4';
import SLDParser from 'geostyler-sld-parser';
import OpenLayersParser from 'geostyler-openlayers-parser';


export function load(contentElement, cdata, objectType, fieldPath, isMultiSelect, mode) {
    const fieldConfiguration = getFieldConfiguration(objectType, fieldPath);
    if (!fieldConfiguration) return console.error('No configuration found for field path "' + fieldPath + '"');

    const settings = {
        isMultiSelect,
        fieldConfiguration,
        geometryIdFieldName: getGeometryIdFieldName()
    };

    loadWFSData(settings, cdata.geometry_ids).then(
        wfsData => renderContent(contentElement, cdata, settings, mode, wfsData),
        error => console.error(error)
    );
}

function loadWFSData(settings, geometryIds) {
    return new Promise((resolve, reject) => {
        const wfsUrl = geometryIds?.length ? getWfsUrl(settings, geometryIds) : undefined;
        if (!wfsUrl) return resolve(undefined);

        const xhr = new XMLHttpRequest();
        xhr.open('GET', wfsUrl);
        xhr.setRequestHeader('Authorization', getAuthorizationString());
        xhr.onload = function() {
            if (xhr.status == 200) {
                const data = JSON.parse(xhr.responseText);
                resolve(data)
            } else {
                reject('Failed to load data from WFS service');
            }
        };
        xhr.onerror = error => {
            reject(error);
        };
        xhr.send();
    });
}

function renderPlaceholder(contentElement, type) {
    const placeholderElement = new CUI.EmptyLabel({ text: $$('custom.data.type.nfis.geometry.placeholder.' + type) });
    CUI.dom.append(contentElement, placeholderElement);
}

function renderContent(contentElement, cdata, settings, mode, wfsData, selectedGeometryId) {
    if (mode === 'detail') {
        renderDetailContent(contentElement, cdata, settings, wfsData);
    } else {
        renderEditorContent(contentElement, cdata, settings, wfsData, selectedGeometryId);
    }
}

function renderDetailContent(contentElement, cdata, settings, wfsData) {
    if (!wfsData?.totalFeatures) {
        renderPlaceholder(contentElement, 'empty');
    } else {
        renderMap(
            contentElement, cdata, settings, wfsData, false,
            renderViewGeometriesButton(contentElement)
        );
    }
}

function renderEditorContent(contentElement, cdata, settings, wfsData, selectedGeometryId) {
    if (!settings.isMultiSelect && cdata.geometry_ids?.length === 1) {
        selectedGeometryId = cdata.geometry_ids[0];
    }

    if (wfsData?.totalFeatures) {
        renderMap(
            contentElement, cdata, settings, wfsData,
            settings.isMultiSelect || cdata.geometry_ids?.length > 1,
            renderEditorButtons(contentElement, cdata, settings, wfsData, selectedGeometryId)
        );
    } else {
        renderEditorButtons(contentElement, cdata, settings, wfsData, selectedGeometryId)(undefined);
    }
}

function renderEditorButtons(contentElement, cdata, settings, wfsData, selectedGeometryId) {
    return extent => {
        const buttons = [];

        if (!selectedGeometryId) {
            if (isAddingGeometriesAllowed(cdata, settings)) {
                if (getBaseConfiguration().show_upload_button) {
                    buttons.push(createUploadGeometryButton(contentElement, cdata, settings, wfsData, extent));
                    buttons.push(createCreateGeometryButton(contentElement, cdata, settings, wfsData, extent, true));
                } else {
                    buttons.push(createCreateGeometryButton(contentElement, cdata, settings, wfsData, extent));
                }
                buttons.push(createLinkExistingGeometryButton(contentElement, cdata, settings));
            }
        } else {
            buttons.push(createEditGeometryButton(contentElement, cdata, settings, wfsData, selectedGeometryId));
            buttons.push(createDeleteGeometryButton(contentElement, cdata, settings, selectedGeometryId));
        }

        const buttonBarElement = new CUI.Buttonbar({ buttons: buttons });

        CUI.dom.append(contentElement, buttonBarElement);
    }
}

function isAddingGeometriesAllowed(cdata, settings) {
    return settings.isMultiSelect || !cdata.geometry_ids?.length
}

function renderViewGeometriesButton(contentElement) {
    return extent => {
        const showGeometryButton = new CUI.ButtonHref({
            href: getViewGeometriesUrl(extent),
            target: '_blank',
            icon_left: new CUI.Icon({ class: 'fa-external-link' }),
            text: $$('custom.data.type.nfis.geometry.viewGeometry')
        });

        CUI.dom.append(contentElement, showGeometryButton);
    };
}

function createEditGeometryButton(contentElement, cdata, settings, wfsData, uuid) {
    return new CUI.Button({
        text: $$('custom.data.type.nfis.geometry.editGeometry'),
        icon_left: new CUI.Icon({ class: 'fa-pencil' }),
        onClick: () => editGeometry(contentElement, cdata, settings, wfsData, uuid)
    });
}

function createDeleteGeometryButton(contentElement, cdata, settings, uuid) {
    return new CUI.Button({
        text: $$('custom.data.type.nfis.geometry.deleteGeometry'),
        icon_left: new CUI.Icon({ class: 'fa-trash' }),
        onClick: () => deleteGeometry(contentElement, cdata, settings, uuid)
    });
}

function createCreateGeometryButton(contentElement, cdata, settings, wfsData, extent, showDrawLabel = false) {
    return new CUI.Button({
        text: showDrawLabel
            ? $$('custom.data.type.nfis.geometry.drawNewGeometry')
            : $$('custom.data.type.nfis.geometry.createNewGeometry'),
        icon_left: new CUI.Icon({ class: 'fa-plus' }),
        onClick: () => createGeometry(contentElement, cdata, settings, wfsData, extent)
    });
}

function createUploadGeometryButton(contentElement, cdata, settings, wfsData, extent) {
    return new CUI.Button({
        text: $$('custom.data.type.nfis.geometry.uploadNewGeometry'),
        icon_left: new CUI.Icon({ class: 'fa-upload' }),
        onClick: () => createGeometry(contentElement, cdata, settings, wfsData, extent, true)
    });
}

function createLinkExistingGeometryButton(contentElement, cdata, settings) {
    const label = $$('custom.data.type.nfis.geometry.linkExistingGeometry');
    return new CUI.Button({
        text: label,
        icon_left: new CUI.Icon({ class: 'fa-link' }),
        onClick: () => openSetGeometryModal(contentElement, cdata, settings, label)
    });
}

function editGeometry(contentElement, cdata, settings, wfsData, uuid) {
    const extent = wfsData?.features.find(feature => {
        return feature.properties[settings.geometryIdFieldName] === uuid;
    })?.bbox;

    if (!extent) return;

    window.open(getEditGeometryUrl(settings, wfsData, extent), '_blank');
    openEditGeometryModal(contentElement, cdata, settings, wfsData);
}

function createGeometry(contentElement, cdata, settings, wfsData, extent, upload = false) {
    const newGeometryId = window.crypto.randomUUID();
    navigator.clipboard.writeText(newGeometryId);
    window.open(getEditGeometryUrl(settings, wfsData, extent, upload), '_blank');
    openCreateGeometryModal(contentElement, cdata, settings, newGeometryId, !upload);
}

function openEditGeometryModal(contentElement, cdata, settings) {
    const modalDialog = new CUI.ConfirmationDialog({
        title: $$('custom.data.type.nfis.geometry.edit.modal.title'),
        text: $$('custom.data.type.nfis.geometry.edit.modal.text'),
        cancel: false,
        buttons: [{
            text: $$('custom.data.type.nfis.geometry.modal.ok'),
            primary: true,
            onClick: () => {
                reloadEditorContent(contentElement, cdata, settings);
                modalDialog.destroy();
            }
        }]
    });
    
    return modalDialog.show();
}

function openCreateGeometryModal(contentElement, cdata, settings, newGeometryId, drawn, error) {
    let text = '';
    if (error) text += $$('custom.data.type.nfis.geometry.create.modal.error.notFound') + '\n\n';
    text += $$('custom.data.type.nfis.geometry.create.modal.text.1') + '\n\n'
        + newGeometryId + '\n\n'
        + $$('custom.data.type.nfis.geometry.create.modal.text.2');

    const modalDialog = new CUI.ConfirmationDialog({
        title: $$('custom.data.type.nfis.geometry.createNewGeometry'),
        text: text,
        cancel: false,
        buttons: [{
            text: $$('custom.data.type.nfis.geometry.modal.cancel'),
            onClick: () => modalDialog.destroy()
        }, {
            text: $$('custom.data.type.nfis.geometry.modal.ok'),
            primary: true,
            onClick: () => {
                setGeometryId(contentElement, cdata, settings, newGeometryId, drawn).then(
                    () => {},
                    error => {
                        if (error) console.error(error);
                        openCreateGeometryModal(
                            contentElement, cdata, settings, newGeometryId, drawn, true
                        );
                    }
                );
                modalDialog.destroy();
            }
        }]
    });
    
    return modalDialog.show();
}

function openSetGeometryModal(contentElement, cdata, settings, title, error) {
    let text = $$('custom.data.type.nfis.geometry.set.modal.text');
    if (error) text = $$('custom.data.type.nfis.geometry.set.modal.error.notFound') + '\n\n' + text;

    CUI.prompt({
        title,
        text,
        min_length: 36
    }).done(geometryId => {
        setGeometryId(contentElement, cdata, settings, geometryId).then(
            () => {},
            error => {
                if (error) console.error(error);
                openSetGeometryModal(contentElement, cdata, settings, title, true);
            }
        );
    });
}

function setGeometryId(contentElement, cdata, settings, newGeometryId, drawn = false) {
    return new Promise((resolve, reject) => {
        loadWFSData(settings, [newGeometryId]).then((wfsData) => {
            if (wfsData.totalFeatures > 0) {
                if (!cdata.geometry_ids.includes(newGeometryId)) {
                    cdata.geometry_ids = cdata.geometry_ids.concat([newGeometryId]);
                    if (drawn && !cdata.newly_drawn_geometry_ids.includes(newGeometryId)) {
                        cdata.newly_drawn_geometry_ids = cdata.newly_drawn_geometry_ids.concat([newGeometryId]);
                    }
                }
                applyChanges(
                    contentElement, cdata, settings, wfsData,
                    settings.isMultiSelect ? undefined : newGeometryId
                );
                resolve();
            } else {
                reject();
            }
        }).catch(error => reject(error));
    });
}

function deleteGeometry(contentElement, cdata, settings, uuid) {
    cdata.geometry_ids = cdata.geometry_ids.filter(geometryId => geometryId !== uuid);
    notifyEditor(contentElement);
    reloadEditorContent(contentElement, cdata, settings);
}

function reloadEditorContent(contentElement, cdata, settings) {
    CUI.dom.removeChildren(contentElement);

    loadWFSData(settings, cdata.geometry_ids).then(
        wfsData => renderContent(contentElement, cdata, settings, 'editor', wfsData),
        error => console.error(error)
    );
}

function applyChanges(contentElement, cdata, settings, wfsData, selectedGeometryId) {
    CUI.dom.removeChildren(contentElement);
    renderContent(contentElement, cdata, settings, 'editor', wfsData, selectedGeometryId);
    notifyEditor(contentElement);
}

function rerenderEditorButtons(contentElement, cdata, settings, wfsData, extent, selectedGeometryId) {
    const buttonsBarElement = CUI.dom.findElement(contentElement, '.cui-buttonbar');
    CUI.dom.remove(buttonsBarElement);
    renderEditorButtons(contentElement, cdata, settings, wfsData, selectedGeometryId)(extent);
}

function notifyEditor(contentElement) {
    CUI.Events.trigger({
        node: contentElement,
        type: 'editor-changed'
    });
    CUI.Events.trigger({
        node: contentElement,
        type: 'data-changed'
    });
}

function renderMap(contentElement, cdata, settings, wfsData, allowSelection, onLoad) {
    const mapElement = CUI.dom.div('nfis-geometry-map');
    CUI.dom.append(contentElement, mapElement);
    CUI.dom.append(mapElement, createLegendButton(mapElement, settings.fieldConfiguration));

    initializeMap(contentElement, mapElement, cdata, settings, wfsData, allowSelection, onLoad);
}

function createLegendButton(mapElement, fieldConfiguration) {
    const legendElement = createLegend(fieldConfiguration);
    CUI.dom.append(mapElement, legendElement);
    
    const legendButtonElement = CUI.dom.div('nfis-geometry-legend-button');
    legendButtonElement.onclick = () => toggleLegend(legendElement);
    CUI.dom.hideElement(legendElement);
    
    const legendButtonIconElement = CUI.dom.div('fa fa-map');
    CUI.dom.append(legendButtonElement, legendButtonIconElement);

    return legendButtonElement;
}

function createLegend(fieldConfiguration) {
    const legendElement = CUI.dom.div('nfis-geometry-legend');
    const legendImageElement = CUI.dom.img(
        'nfis-geometry-legend-image',
        {
            src: fieldConfiguration.legend_image_file.versions.original.url + '?access_token=' + ez5.session.token
        }
    );
    CUI.dom.append(legendElement, legendImageElement);

    return legendElement;
}

function toggleLegend(legendElement) {
    if (CUI.dom.isVisible(legendElement)) {
        CUI.dom.hideElement(legendElement);
    } else {
        CUI.dom.showElement(legendElement);
    }
}

function initializeMap(contentElement, mapElement, cdata, settings, wfsData, allowSelection, onLoad) {
    const projection = getMapProjection();
    const map = new Map({
        target: mapElement,
        view: new View({
            projection,
            center: [561397, 5709705],
            maxZoom: 19,
            zoom: 7,
        }),
        interactions: defaults({ mouseWheelZoom: false })
    });

    getVectorStyle(settings.fieldConfiguration).then(vectorStyle => {
        const rasterLayer = getRasterLayer(projection);
        const vectorLayer = getVectorLayer(cdata.geometry_ids, settings, vectorStyle);
        map.setLayers([rasterLayer, vectorLayer]);

        vectorLayer.getSource().on('featuresloadend', () => {
            const extent = vectorLayer.getSource().getExtent();
            map.getView().fit(extent, { padding: [20, 20, 20, 20] });
            if (onLoad) onLoad(extent);
    
            configureMouseWheelZoom(map);
            if (allowSelection) {
                configureGeometrySelection(map, contentElement, cdata, settings, wfsData, extent);
                configureCursor(map);
            }
        }); 
    }).catch(error => console.error('Failed to parse SLD data:', error));
}

function getVectorStyle(fieldConfiguration) {
    return new Promise((resolve, reject) => {
        loadSLDFile(fieldConfiguration).then(sldData => {
            const sldParser = new SLDParser({ sldVersion: '1.1.0' });
            return sldParser.readStyle(sldData);
        }).then(({ output: parsedStyle }) => {
            const openLayersParser = new OpenLayersParser();
            openLayersParser.writeStyle(parsedStyle)
                .then(({ output: openLayersStyle }) => resolve(openLayersStyle))
                .catch(error => reject(error));
        })
        .catch(error => reject(error));
    });
}

function loadSLDFile(fieldConfiguration) {
    const url = fieldConfiguration.sld_file.versions.original.url + '?access_token=' + ez5.session.token;
    return fetch(url).then(result => result.text());
}

function getMapProjection() {
    const epsg = 'EPSG:25832';
    proj4.defs(epsg, '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs');
    olProj4.register(proj4);

    return olProj.get(
        new olProj.Projection({
            code: epsg,
            units: 'm',
            extent: [120000, 5661139.2, 1378291.2, 6500000]
        })
    );
}

function getRasterLayer(projection) {
    return new TileLayer({
        extent: projection.getExtent(),
        source: getRasterSource(projection)
    });
}

function getRasterSource(projection) {
    return new TileWMS({
        url: 'https://sgx.geodatenzentrum.de/wms_basemapde',
        params: {
            LAYERS: 'de_basemapde_web_raster_farbe'
        },
        projection
    });
}

function getVectorLayer(geometryIds, settings, style) {
    const wfsUrl = getWfsUrl(settings, geometryIds);
    const authorizationString = getAuthorizationString();
    const vectorSource = getVectorSource(wfsUrl, authorizationString);

    return new VectorLayer({
        source: vectorSource,
        style
    });
}

function getVectorSource(wfsUrl, authorizationString) {
    const vectorSource = new VectorSource({
        format: new GeoJSON(),
        loader: function(extent, resolution, projection, success, failure) {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', wfsUrl);
            xhr.setRequestHeader('Authorization', authorizationString);

            const onError = function() {
                vectorSource.removeLoadedExtent(extent);
                failure();
            };

            xhr.onerror = onError;
            xhr.onload = function() {
                if (xhr.status == 200) {
                    const features = vectorSource.getFormat().readFeatures(xhr.responseText);
                    vectorSource.addFeatures(features);
                    success(features);
                } else {
                    onError();
                }
            }
            if (wfsUrl) xhr.send();
        },
        strategy: olLoadingstrategy.all,
    });

    return vectorSource;
}

function configureMouseWheelZoom(map) {
    const mouseWheelInteraction = new MouseWheelZoom();
    map.addInteraction(mouseWheelInteraction);
    map.on('wheel', event => {
        mouseWheelInteraction.setActive(
            shiftKeyOnly(event) || platformModifierKeyOnly(event)
        );
    });
}

function configureGeometrySelection(map, contentElement, cdata, settings, wfsData, extent) {
    const select = new Select({
        condition: click,
        style: new Style({
            stroke: new Stroke({
                width: 1.5,
                color: 'white'
            }),
            fill: new Fill({
                color: 'rgba(255,255,255,0.25)'
            })
        })
    });

    map.addInteraction(select);
    select.on('select', event => {
        const selectedGeometryId = event.selected.length > 0
            ? event.selected[0].get(settings.geometryIdFieldName)
            : undefined;
        rerenderEditorButtons(contentElement, cdata, settings, wfsData, extent, selectedGeometryId);
    });
}

function configureCursor(map) {
    map.on('pointermove', event => {
        if (event.dragging) return;
        const mouseOverFeature = map.hasFeatureAtPixel(map.getEventPixel(event.originalEvent));
        map.getTargetElement().style.cursor = mouseOverFeature ? 'pointer' : 'default';
    });
}

function getViewGeometriesUrl(extent) {
    const url = getMasterportalUrl();
    if (!url) return '';
    
    return url + 'zoomToExtent=' + extent.join(',');
}

function getEditGeometryUrl(settings, wfsData, extent, upload = false) {
    let url = getMasterportalUrl();
    const layerIds = getMasterportalLayerIds(settings.fieldConfiguration, wfsData);
    if (!url) return '';
    
    if (extent) url += 'zoomToExtent=' + extent.join(',') + '&';
    url += upload
        ? 'menu={%22secondary%22:{%22currentComponent%22:%22wfstUploader%22}}'
        : 'isinitopen=wfst';
    
    if (layerIds?.length) url += '&layerids=' + layerIds.join(',');

    return url;
}

function getMasterportalLayerIds(fieldConfiguration, wfsData) {
    const rasterLayerId = fieldConfiguration.masterportal_raster_layer_id;
    const vectorLayerIds = getMasterportalVectorLayerIds(fieldConfiguration, wfsData);
    
    return rasterLayerId
        ? [rasterLayerId].concat(vectorLayerIds)
        : vectorLayerIds;
}

function getMasterportalVectorLayerIds(fieldConfiguration, wfsData) {
    const fieldName = fieldConfiguration.masterportal_vector_layer_field_name;
    const mapping = fieldConfiguration.masterportal_vector_layer_ids;

    let result;
    if (fieldName && mapping && wfsData) {
        result = wfsData.features.map(feature => feature.properties[fieldName])
            .reduce((result, value) => {
                const layerId = mapping.find(entry => entry.field_value === value)?.layer_id;
                if (layerId && !result.includes(layerId)) result.push(layerId);
                return result;
            }, []);
    }

    if (result?.length) {
        return result;
    } else {
        const defaultLayerId = getDefaultMasterportalVectorLayerId(fieldConfiguration);
        return defaultLayerId ? [defaultLayerId] : [];
    }
}

function getDefaultMasterportalVectorLayerId(fieldConfiguration) {
    return fieldConfiguration.masterportal_default_vector_layer_id
        ?.find(entry => entry.group_id === null || getUserGroupIds().includes(entry.group_id))
        ?.layer_id;
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
    const configurationId = getUserConfiguration().masterportal_configuration;
    if (!configurationId?.length) return undefined;
    
    const configuration = getBaseConfiguration().masterportal_configurations?.find(entry => entry.id === configurationId);
    return configuration?.file_name;
}

function getWfsUrl(settings, geometryIds) {
    let baseUrl = settings.fieldConfiguration.display_wfs_url;
    const featureType = settings.fieldConfiguration.display_wfs_feature_type;

    if (!baseUrl || !featureType) return '';
    if (!baseUrl.endsWith('/')) baseUrl += '/';

    return baseUrl
        + '?service=WFS&version=1.1.0&request=GetFeature&typename='
        + featureType
        + '&outputFormat=application/json&srsname=EPSG:25832&cql_filter='
        + settings.geometryIdFieldName
        + ' in ('
        + geometryIds.map(id => '\'' + id + '\'').join(',')
        + ')';
}

function getAuthorizationString() {
    const username = getBaseConfiguration().geoserver_read_username;
    const password = getBaseConfiguration().geoserver_read_password;

    return 'Basic ' + window.btoa(username + ':' + password);
}

function getGeometryIdFieldName() {
    const fieldName = getBaseConfiguration().wfs_geometry_id_field_name;

    return fieldName?.length
        ? fieldName
        : 'ouuid';
}

function getBaseConfiguration() {
    return ez5.session.getBaseConfig('plugin', 'custom-data-type-nfis-geometry')['nfisGeoservices'];
}

function getFieldConfiguration(objectType, fieldPath) {
    return getBaseConfiguration().wfs_configuration.find(objectConfiguration => objectConfiguration.object_type === objectType)
        ?.geometry_fields.find(fieldConfiguraton => fieldConfiguraton.field_path === fieldPath);
}

function getUserConfiguration() {
    return ez5.session.user.opts.user.user.custom_data;
}

function getUserGroupIds() {
    return ez5.session.user.data.__group_ids;
}
