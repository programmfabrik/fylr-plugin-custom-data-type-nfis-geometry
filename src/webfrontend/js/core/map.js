import Map from 'ol/Map';
import View from 'ol/View';
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer';
import { TileWMS, Vector as VectorSource } from 'ol/source';
import Feature from 'ol/Feature';
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
import configuration from './configuration';
import masterportal from './masterportal';
import wfs from './wfs';


function load(contentElement, cdata, object, objectType, fieldPath, isMultiSelect, mode) {
    const fieldConfiguration = configuration.getFieldConfiguration(objectType, fieldPath);
    if (!fieldConfiguration) return console.error('No configuration found for field path "' + fieldPath + '"');

    const settings = {
        isMultiSelect,
        fieldConfiguration,
        geometryIdFieldName: getGeometryIdFieldName(),
        isAvailableInMasterportal: isAvailableInMasterportal(object)
    };

    wfs.loadData(settings.fieldConfiguration, cdata.geometry_ids, settings.geometryIdFieldName, getAuthorizationString()).then(
        wfsData => renderContent(contentElement, cdata, object, settings, mode, wfsData),
        error => console.error(error)
    );
}

function isAvailableInMasterportal(object) {
    const functionDefinition = configuration.get().masterportal_buttons_condition;
    if (!functionDefinition?.length) return true;

    return executeCustomFunction(
        object,
        getValues(object, configuration.get()),
        functionDefinition
    );
}

function renderPlaceholder(contentElement, type) {
    const placeholderElement = new CUI.EmptyLabel({ text: $$('custom.data.type.nfis.geometry.placeholder.' + type) });
    CUI.dom.append(contentElement, placeholderElement);
}

function renderContent(contentElement, cdata, object, settings, mode, wfsData, selectedGeometryId) {
    if (mode === 'detail') {
        renderDetailContent(contentElement, cdata, object, settings, wfsData);
    } else {
        renderEditorContent(contentElement, cdata, object, settings, wfsData, selectedGeometryId);
    }
}

function renderDetailContent(contentElement, cdata, object, settings, wfsData) {
    if (!wfsData?.totalFeatures) {
        renderPlaceholder(contentElement, 'empty');
    } else {
        renderMap(
            contentElement, cdata, object, settings, wfsData, false,
            renderViewGeometriesButton(object, contentElement, settings, wfsData)
        );
    }
}

function renderEditorContent(contentElement, cdata, object, settings, wfsData, selectedGeometryId) {
    if (!settings.isMultiSelect && cdata.geometry_ids?.length === 1) {
        selectedGeometryId = cdata.geometry_ids[0];
    }

    if (wfsData?.totalFeatures) {
        renderMap(
            contentElement, cdata, object, settings, wfsData,
            settings.isMultiSelect || cdata.geometry_ids?.length > 1,
            renderEditorButtons(contentElement, cdata, object, settings, wfsData, selectedGeometryId)
        );
    } else {
        renderEditorButtons(contentElement, cdata, object, settings, wfsData, selectedGeometryId)(undefined);
    }
}

function renderEditorButtons(contentElement, cdata, object, settings, wfsData, selectedGeometryId) {
    return extent => {
        const buttons = [];

        if (settings.isAvailableInMasterportal) {
            if (!selectedGeometryId) {
                if (isAddingGeometriesAllowed(cdata, settings)) {
                    if (configuration.get().show_upload_button) {
                        buttons.push(createUploadGeometryButton(contentElement, cdata, object, settings, extent));
                        buttons.push(createCreateGeometryButton(contentElement, cdata, object, settings, extent, true));
                    } else {
                        buttons.push(createCreateGeometryButton(contentElement, cdata, object, settings, extent));
                    }
                    buttons.push(createLinkExistingGeometryButton(contentElement, cdata, object, settings));
                }
            } else {
                if (configuration.get().show_edit_button) {
                    buttons.push(createEditGeometryButton(contentElement, cdata, object, settings, wfsData, selectedGeometryId));
                }
                if (configuration.get().show_delete_button) {
                    buttons.push(createDeleteGeometryButton(contentElement, cdata, object, settings, selectedGeometryId));
                }
                if (configuration.get().show_replace_button) {
                    buttons.push(createReplaceGeometryButton(contentElement, cdata, object, settings, wfsData, selectedGeometryId));
                }
            }
        }

        const buttonBarElement = new CUI.Buttonbar({ buttons });

        CUI.dom.append(contentElement, buttonBarElement);
    }
}

function isAddingGeometriesAllowed(cdata, settings) {
    return settings.isMultiSelect || !cdata.geometry_ids?.length
}

function renderViewGeometriesButton(object, contentElement, settings, wfsData) {
    return extent => {
        if (!settings.isAvailableInMasterportal) return;

        const showGeometryButton = new CUI.ButtonHref({
            href: masterportal.getViewGeometriesUrl(object, settings.fieldConfiguration, settings.geometryIdFieldName, extent, wfsData),
            target: '_blank',
            icon_left: new CUI.Icon({ class: 'fa-external-link' }),
            text: $$('custom.data.type.nfis.geometry.viewGeometry')
        });

        CUI.dom.append(contentElement, showGeometryButton);
    };
}

function createEditGeometryButton(contentElement, cdata, object, settings, wfsData, uuid) {
    return new CUI.Button({
        text: $$('custom.data.type.nfis.geometry.editGeometry'),
        icon_left: new CUI.Icon({ class: 'fa-pencil' }),
        onClick: () => editGeometry(contentElement, cdata, object, settings, wfsData, uuid)
    });
}

function createDeleteGeometryButton(contentElement, cdata, object, settings, uuid) {
    return new CUI.Button({
        text: $$('custom.data.type.nfis.geometry.deleteGeometry'),
        icon_left: new CUI.Icon({ class: 'fa-trash' }),
        onClick: () => deleteGeometry(contentElement, cdata, object, settings, uuid)
    });
}

function createReplaceGeometryButton(contentElement, cdata, object, settings, wfsData, uuid) {
    return new CUI.Button({
        text: $$('custom.data.type.nfis.geometry.replaceGeometry'),
        icon_left: new CUI.Icon({ class: 'fa-refresh' }),
        onClick: () => replaceGeometry(contentElement, cdata, object, settings, wfsData, uuid)
    });
}

function createCreateGeometryButton(contentElement, cdata, object, settings, extent, showDrawLabel = false) {
    return new CUI.Button({
        text: showDrawLabel
            ? $$('custom.data.type.nfis.geometry.drawNewGeometry')
            : $$('custom.data.type.nfis.geometry.createNewGeometry'),
        icon_left: new CUI.Icon({ class: 'fa-plus' }),
        onClick: () => createGeometry(contentElement, cdata, object, settings, extent)
    });
}

function createUploadGeometryButton(contentElement, cdata, object, settings, extent) {
    return new CUI.Button({
        text: $$('custom.data.type.nfis.geometry.uploadNewGeometry'),
        icon_left: new CUI.Icon({ class: 'fa-upload' }),
        onClick: () => createGeometry(contentElement, cdata, object, settings, extent, true)
    });
}

function createLinkExistingGeometryButton(contentElement, cdata, object, settings) {
    const label = $$('custom.data.type.nfis.geometry.linkExistingGeometry');
    return new CUI.Button({
        text: label,
        icon_left: new CUI.Icon({ class: 'fa-link' }),
        onClick: () => openSetGeometryModal(contentElement, cdata, object, settings, label)
    });
}

function editGeometry(contentElement, cdata, object, settings, wfsData, uuid) {
    const extent = getExtent(wfsData, settings, uuid);
    if (!extent) return;

    window.open(masterportal.getEditGeometryUrl(object, settings.fieldConfiguration, extent), '_blank');
    openEditGeometryModal(contentElement, cdata, object, settings, wfsData);
}

function createGeometry(contentElement, cdata, object, settings, extent, upload = false) {
    const newGeometryId = generateGeometryId();
    window.open(masterportal.getEditGeometryUrl(object, settings.fieldConfiguration, extent, upload ? newGeometryId : undefined, upload), '_blank');
    openCreateGeometryModal(contentElement, cdata, object, settings, newGeometryId, undefined, !upload);
}

function openEditGeometryModal(contentElement, cdata, object, settings) {
    const modalDialog = new CUI.ConfirmationDialog({
        title: $$('custom.data.type.nfis.geometry.edit.modal.title'),
        text: $$('custom.data.type.nfis.geometry.edit.modal.text'),
        cancel: false,
        buttons: [{
            text: $$('custom.data.type.nfis.geometry.modal.ok'),
            primary: true,
            onClick: () => {
                reloadEditorContent(contentElement, cdata, object, settings);
                modalDialog.destroy();
            }
        }]
    });
    
    return modalDialog.show();
}

function openCreateGeometryModal(contentElement, cdata, object, settings, newGeometryId, replacedGeometryId, drawn, error) {
    let text = '';
    if (error) text += $$('custom.data.type.nfis.geometry.create.modal.error.notFound') + '\n\n';
    text += $$('custom.data.type.nfis.geometry.create.modal.text.1') + '\n\n'
        + newGeometryId + '\n\n'
        + $$('custom.data.type.nfis.geometry.create.modal.text.2');

    const modalDialog = new CUI.ConfirmationDialog({
        title: replacedGeometryId
            ? $$('custom.data.type.nfis.geometry.replaceGeometry')
            : $$('custom.data.type.nfis.geometry.createNewGeometry'),
        text: text,
        cancel: false,
        buttons: [{
            text: $$('custom.data.type.nfis.geometry.modal.cancel'),
            onClick: () => {
                if (replacedGeometryId) {
                    unmarkGeometryForDeletion(settings, replacedGeometryId).then(() => modalDialog.destroy());
                } else {
                    modalDialog.destroy();
                }
            }
        }, {
            text: $$('custom.data.type.nfis.geometry.modal.ok'),
            primary: true,
            onClick: () => {
                setGeometryId(contentElement, cdata, object, settings, newGeometryId, replacedGeometryId, drawn).then(
                    () => {},
                    error => {
                        if (error) console.error(error);
                        openCreateGeometryModal(
                            contentElement, cdata, object, settings, newGeometryId, replacedGeometryId, drawn, true
                        );
                    }
                );
                modalDialog.destroy();
            }
        }]
    });
    
    return modalDialog.show();
}

function openSetGeometryModal(contentElement, cdata, object, settings, title, error) {
    let text = $$('custom.data.type.nfis.geometry.set.modal.text');
    if (error) text = $$('custom.data.type.nfis.geometry.set.modal.error.notFound') + '\n\n' + text;

    CUI.prompt({
        title,
        text,
        min_length: 36
    }).done(geometryId => {
        setGeometryId(contentElement, cdata, object, settings, geometryId).then(
            () => {},
            error => {
                if (error) console.error(error);
                openSetGeometryModal(contentElement, cdata, object, settings, title, true);
            }
        );
    });
}

function setGeometryId(contentElement, cdata, object, settings, newGeometryId, replacedGeometryId, drawn = false) {
    return new Promise((resolve, reject) => {
        wfs.loadData(settings.fieldConfiguration, [newGeometryId], settings.geometryIdFieldName, getAuthorizationString()).then((wfsData) => {
            if (wfsData.totalFeatures > 0) {
                if (!cdata.geometry_ids.includes(newGeometryId)) {
                    cdata.geometry_ids = cdata.geometry_ids.concat([newGeometryId]);
                    if (drawn && !cdata.newly_drawn_geometry_ids.includes(newGeometryId)) {
                        cdata.newly_drawn_geometry_ids = cdata.newly_drawn_geometry_ids.concat([newGeometryId]);
                    }
                    if (replacedGeometryId) {
                        cdata.replaced_geometry_ids[replacedGeometryId] = newGeometryId;
                    }
                }
                if (replacedGeometryId) deleteGeometry(contentElement, cdata, object, settings, replacedGeometryId, false);
                applyChanges(
                    contentElement, cdata, object, settings, wfsData,
                    settings.isMultiSelect ? undefined : newGeometryId
                );
                resolve();
            } else {
                reject();
            }
        }).catch(error => reject(error));
    });
}

function deleteGeometry(contentElement, cdata, object, settings, uuid, reload = true) {
    cdata.geometry_ids = cdata.geometry_ids.filter(geometryId => geometryId !== uuid);

    if (reload) {
        notifyEditor(contentElement);
        reloadEditorContent(contentElement, cdata, object, settings);
    }
}

function replaceGeometry(contentElement, cdata, object, settings, wfsData, uuid) {
    const extent = getExtent(wfsData, settings, uuid);
    if (!extent) return;

    markGeometryForDeletion(settings, uuid).then(() => {
        const newGeometryId = generateGeometryId();
        openCreateGeometryModal(contentElement, cdata, object, settings, newGeometryId, uuid, false);
        window.open(masterportal.getEditGeometryUrl(object, settings.fieldConfiguration, extent, newGeometryId, true), '_blank');
    });
}

function markGeometryForDeletion(settings, uuid) {
    return setMarkedForDeletion(settings, uuid, true);
}

function unmarkGeometryForDeletion(settings, uuid) {
    return setMarkedForDeletion(settings, uuid, false);
}

function setMarkedForDeletion(settings, uuid, value) {
    const fieldName = configuration.get().wfs_marked_for_deletion_field_name;

    return fieldName?.length
        ? wfs.editData(settings.fieldConfiguration, uuid, fieldName, value, settings.geometryIdFieldName, getAuthorizationString())
        : Promise.resolve();
}

function reloadEditorContent(contentElement, cdata, object, settings) {
    CUI.dom.removeChildren(contentElement);

    wfs.loadData(settings.fieldConfiguration, cdata.geometry_ids, settings.geometryIdFieldName, getAuthorizationString()).then(
        wfsData => renderContent(contentElement, cdata, object, settings, 'editor', wfsData),
        error => console.error(error)
    );
}

function applyChanges(contentElement, cdata, object, settings, wfsData, selectedGeometryId) {
    CUI.dom.removeChildren(contentElement);
    renderContent(contentElement, cdata, object, settings, 'editor', wfsData, selectedGeometryId);
    notifyEditor(contentElement);
}

function rerenderEditorButtons(contentElement, cdata, object, settings, wfsData, extent, selectedGeometryId) {
    const buttonsBarElement = CUI.dom.findElement(contentElement, '.cui-buttonbar');
    CUI.dom.remove(buttonsBarElement);
    renderEditorButtons(contentElement, cdata, object, settings, wfsData, selectedGeometryId)(extent);
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

function renderMap(contentElement, cdata, object, settings, wfsData, allowSelection, onLoad) {
    const mapElement = CUI.dom.div('nfis-geometry-map');
    CUI.dom.append(contentElement, mapElement);
    CUI.dom.append(mapElement, createLegendButton(mapElement, settings.fieldConfiguration));

    initializeMap(contentElement, mapElement, cdata, object, settings, wfsData, allowSelection, onLoad);
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

function initializeMap(contentElement, mapElement, cdata, object, settings, wfsData, allowSelection, onLoad) {
    const projection = getMapProjection();
    let minZoom = configuration.get().min_zoom_level ?? 2;
    let maxZoom = Math.max(minZoom, configuration.get().max_zoom_level ?? 19);
    const map = new Map({
        target: mapElement,
        view: new View({
            projection,
            center: [561397, 5709705],
            minZoom,
            maxZoom,
            zoom: Math.max(minZoom, Math.min(7, maxZoom))
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
                configureGeometrySelection(map, contentElement, cdata, object, settings, wfsData, extent);
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
    const wfsUrl = wfs.getLoadDataUrl(settings.fieldConfiguration, geometryIds, settings.geometryIdFieldName);
    const authorizationString = getAuthorizationString();
    const vectorSource = getVectorSource(wfsUrl, authorizationString, settings);

    return new VectorLayer({
        source: vectorSource,
        style
    });
}

function getVectorSource(wfsUrl, authorizationString, settings) {
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
                    if (settings.fieldConfiguration.add_icon_points_to_polygons) {
                        addIconPointsToVectorSource(vectorSource, features);
                    }
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

function addIconPointsToVectorSource(vectorSource, features) {
    features.forEach(feature => {
        const geometry = feature.getGeometry();
        if (geometry.getType() !== 'Polygon') return;
    
        const properties = JSON.parse(JSON.stringify(feature.getProperties()));
        properties.geometry = geometry.getInteriorPoint();
        properties.iconPoint = true;
    
        vectorSource.addFeature(new Feature(properties));
    });
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

function configureGeometrySelection(map, contentElement, cdata, object, settings, wfsData, extent) {
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
        }),
        filter: (feature, _) => !feature.getProperties().iconPoint
    });

    map.addInteraction(select);
    select.on('select', event => {
        const selectedGeometryId = event.selected.length > 0
            ? event.selected[0].get(settings.geometryIdFieldName)
            : undefined;
        rerenderEditorButtons(contentElement, cdata, object, settings, wfsData, extent, selectedGeometryId);
    });
}

function configureCursor(map) {
    map.on('pointermove', event => {
        if (event.dragging) return;
        const mouseOverFeature = map.hasFeatureAtPixel(map.getEventPixel(event.originalEvent));
        map.getTargetElement().style.cursor = mouseOverFeature ? 'pointer' : 'default';
    });
}

function getGeometryIdFieldName() {
    const fieldName = configuration.get().wfs_geometry_id_field_name;

    return fieldName?.length
        ? fieldName
        : 'ouuid';
}

function getAuthorizationString() {
    const username = configuration.get().geoserver_read_username;
    const password = configuration.get().geoserver_read_password;

    return 'Basic ' + window.btoa(username + ':' + password);
}

function getExtent(wfsData, settings, uuid) {
    return wfsData?.features.find(feature => {
        return feature.properties[settings.geometryIdFieldName] === uuid;
    })?.bbox;
}

function generateGeometryId() {
    const newGeometryId = window.crypto.randomUUID();
    navigator.clipboard.writeText(newGeometryId);

    return newGeometryId;
}

export default {
    load
};
