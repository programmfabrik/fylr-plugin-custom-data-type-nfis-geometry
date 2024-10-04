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


export function load(contentElement, cdata, objectType, fieldPath, schemaSettings, mode) {

    getStyleObject(objectType, fieldPath).then(
        styleObject => {
            const settings = {
                schema: schemaSettings,
                styleObject
            };
            loadWFSData(settings, cdata.geometry_ids).then(
                wfsData => renderContent(
                    contentElement, cdata, settings, mode, wfsData ? wfsData.totalFeatures : 0
                ),
                error => console.error(error)
            );
        }, error => console.error(error)
    );
}

function getStyleObject(objectType, fieldPath) {
    const styleId = getStyleId(objectType, fieldPath);

    return new Promise((resolve, reject) => {
        if (!styleId) return reject('No style object ID provided in base configuration');

        ez5.api.search({
            json_data: {
                format: 'long',
                objecttypes: ['geostyle'],
                search: [{
                    type: 'in',
                    fields: ['_uuid'],
                    in: [styleId]
                }]
            }
        }).done(data => {
            if (data.error) {
                reject(data.error);
            } else if (data.objects.length !== 1) {
                reject('Style object not found');
            } else {
                resolve(data.objects[0].geostyle);
            }
        });
    });
}

function getStyleId(objectType, fieldPath) {
    return getBaseConfig().wfs_configuration.find(objectConfiguration => objectConfiguration.object_type === objectType)
        ?.geometry_fields.find(fieldConfiguraton => fieldConfiguraton.field_path === fieldPath)
        ?.style_uuid;
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

function renderContent(contentElement, cdata, settings, mode, totalFeatures, selectedGeometryId) {
    if (mode === 'detail') {
        renderDetailContent(contentElement, cdata, settings, totalFeatures);
    } else {
        renderEditorContent(contentElement, cdata, settings, totalFeatures, selectedGeometryId);
    }
}

function renderDetailContent(contentElement, cdata, settings, totalFeatures) {
    if (totalFeatures === 0) return;

    if (settings.schema.multiSelect || cdata.geometry_ids?.length > 1) {
        renderMap(
            contentElement, cdata, settings, false,
            renderViewGeometriesButton(contentElement, settings)
        );
    } else {
        renderMap(contentElement, cdata, settings, false);
        renderViewGeometryButton(contentElement, getGeometryId(cdata), settings);
    }
}

function renderEditorContent(contentElement, cdata, settings, totalFeatures, selectedGeometryId) {
    if (!settings.schema.multiSelect && cdata.geometry_ids?.length === 1) {
        selectedGeometryId = cdata.geometry_ids[0];
    }

    if (totalFeatures > 0) {
        renderMap(
            contentElement, cdata, settings,
            settings.schema.multiSelect || cdata.geometry_ids?.length > 1
        );
    }

    renderEditorButtons(contentElement, cdata, settings, selectedGeometryId);
}

function renderEditorButtons(contentElement, cdata, settings, selectedGeometryId) {
    const buttons = [];

    if (!selectedGeometryId) {
        if (isAddingGeometriesAllowed(cdata, settings)) {
            buttons.push(createCreateGeometryButton(contentElement, cdata, settings));
            buttons.push(createLinkExistingGeometryButton(contentElement, cdata, settings));
        }
    } else {
        buttons.push(createEditGeometryButton(contentElement, cdata, settings, selectedGeometryId));
        buttons.push(createRemoveGeometryButton(contentElement, cdata, settings, selectedGeometryId));
    }

    const buttonBarElement = new CUI.Buttonbar({ buttons: buttons });

    CUI.dom.append(contentElement, buttonBarElement);
}

function isAddingGeometriesAllowed(cdata, settings) {
    return settings.schema.multiSelect || !cdata.geometry_ids?.length
}

function renderViewGeometryButton(contentElement, geometryId, settings) {
    const showGeometryButton = new CUI.ButtonHref({
        href: getViewGeometryUrl(geometryId, settings),
        target: '_blank',
        icon_left: new CUI.Icon({ class: 'fa-external-link' }),
        text: $$('custom.data.type.nfis.geometry.viewGeometry')
    });

    CUI.dom.append(contentElement, showGeometryButton);
}

function renderViewGeometriesButton(contentElement, settings) {
    return (extent) => {
        const showGeometryButton = new CUI.ButtonHref({
            href: getViewGeometriesUrl(extent, settings),
            target: '_blank',
            icon_left: new CUI.Icon({ class: 'fa-external-link' }),
            text: $$('custom.data.type.nfis.geometry.viewGeometry')
        });

        CUI.dom.append(contentElement, showGeometryButton);
    };
}

function createEditGeometryButton(contentElement, cdata, settings, uuid) {
    return new CUI.Button({
        text: $$('custom.data.type.nfis.geometry.editGeometry'),
        icon_left: new CUI.Icon({ class: 'fa-pencil' }),
        onClick: () => editGeometry(contentElement, cdata, settings, uuid)
    });
}

function createRemoveGeometryButton(contentElement, cdata, settings, uuid) {
    return new CUI.Button({
        text: $$('custom.data.type.nfis.geometry.removeGeometry'),
        icon_left: new CUI.Icon({ class: 'fa-trash' }),
        onClick: () => removeGeometryId(contentElement, cdata, settings, uuid)
    });
}

function createCreateGeometryButton(contentElement, cdata, settings) {
    return new CUI.Button({
        text: $$('custom.data.type.nfis.geometry.createNewGeometry'),
        icon_left: new CUI.Icon({ class: 'fa-plus' }),
        onClick: () => createGeometry(contentElement, cdata, settings)
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

function editGeometry(contentElement, cdata, settings, uuid) {
    window.open(getEditGeometryUrl(uuid, settings), '_blank');
    openEditGeometryModal(contentElement, cdata, settings);
}

function createGeometry(contentElement, cdata, settings) {
    const newGeometryId = window.crypto.randomUUID();
    navigator.clipboard.writeText(newGeometryId);
    window.open(getCreateGeometryUrl(), '_blank');
    openCreateGeometryModal(contentElement, cdata, settings, newGeometryId);
};

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

function openCreateGeometryModal(contentElement, cdata, settings, newGeometryId, error) {
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
                setGeometryId(contentElement, cdata, settings, newGeometryId).then(
                    () => {},
                    error => {
                        if (error) console.error(error);
                        openCreateGeometryModal(
                            contentElement, cdata, settings, newGeometryId, true
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

function setGeometryId(contentElement, cdata, settings, newGeometryId) {
    return new Promise((resolve, reject) => {
        loadWFSData(settings, [newGeometryId]).then((wfsData) => {
            if (wfsData.totalFeatures > 0) {
                if (!cdata.geometry_ids.includes(newGeometryId)) {
                    cdata.geometry_ids = cdata.geometry_ids.concat([newGeometryId]);
                }
                applyChanges(
                    contentElement, cdata, settings, wfsData.totalFeatures,
                    settings.schema.multiSelect ? undefined : newGeometryId
                );
                resolve();
            } else {
                reject();
            }
        }).catch(error => reject(error));
    });
}

function removeGeometryId(contentElement, cdata, settings, uuid) {
    cdata.geometry_ids = cdata.geometry_ids.filter(geometryId => geometryId !== uuid);
    applyChanges(contentElement, cdata, settings, cdata.geometry_ids.length, undefined);
}

function reloadEditorContent(contentElement, cdata, settings, uuid) {
    CUI.dom.removeChildren(contentElement);
    load(contentElement, cdata, settings, 'editor', uuid);
}

function applyChanges(contentElement, cdata, settings, totalFeatures, selectedGeometryId) {
    CUI.dom.removeChildren(contentElement);
    renderContent(contentElement, cdata, settings, 'editor', totalFeatures, selectedGeometryId);
    notifyEditor(contentElement);
}

function rerenderEditorButtons(contentElement, cdata, settings, selectedGeometryId) {
    const buttonsBarElement = CUI.dom.findElement(contentElement, '.cui-buttonbar');
    CUI.dom.remove(buttonsBarElement);
    renderEditorButtons(contentElement, cdata, settings, selectedGeometryId);
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

function renderMap(contentElement, cdata, settings, allowSelection, onLoad) {
    const mapElement = CUI.dom.div('nfis-geometry-map');
    CUI.dom.append(contentElement, mapElement);
    CUI.dom.append(mapElement, createLegendButton(mapElement, settings.styleObject));

    initializeMap(contentElement, mapElement, cdata, settings, allowSelection, onLoad);
    
}

function createLegendButton(mapElement, styleObject) {
    const legendElement = createLegend(styleObject);
    CUI.dom.append(mapElement, legendElement);
    
    const legendButtonElement = CUI.dom.div('nfis-geometry-legend-button');
    legendButtonElement.onclick = () => toggleLegend(legendElement);
    CUI.dom.hideElement(legendElement);
    
    const legendButtonIconElement = CUI.dom.div('fa fa-map');
    CUI.dom.append(legendButtonElement, legendButtonIconElement);

    return legendButtonElement;
}

function createLegend(styleObject) {
    const legendElement = CUI.dom.div('nfis-geometry-legend');
    const legendImageElement = CUI.dom.img(
        'nfis-geometry-legend-image',
        {
            src: styleObject.legende[0].versions.original.url + '&access_token=' + ez5.session.token
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

function initializeMap(contentElement, mapElement, cdata, settings, allowSelection, onLoad) {
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

    getVectorStyle(settings.styleObject).then(vectorStyle => {
        map.setLayers([
            getRasterLayer(projection),
            getVectorLayer(map, cdata.geometry_ids, settings, vectorStyle, onLoad)
        ]);
    
        configureMouseWheelZoom(map);
        if (allowSelection) {
            configureGeometrySelection(map, contentElement, cdata, settings);
            configureCursor(map);
        }
    }).catch(error => console.error('Failed to parse SLD data:', error));
}

function getVectorStyle(styleObject) {
    return new Promise((resolve, reject) => {
        loadSLDFile(styleObject).then(sldData => {
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

function loadSLDFile(styleObject) {
    const url = styleObject.sld_datei[0].versions.original.url + '&access_token=' + ez5.session.token;
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

function getVectorLayer(map, geometryIds, settings, style, onLoad) {
    const wfsUrl = getWfsUrl(settings, geometryIds);
    const authorizationString = getAuthorizationString();
    const vectorSource = getVectorSource(wfsUrl, authorizationString, onLoad);

    vectorSource.on('featuresloadend', () => {
        const extent = vectorSource.getExtent();
        map.getView().fit(extent, { padding: [20, 20, 20, 20] });
        if (onLoad) onLoad(extent);
    });

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

function configureGeometrySelection(map, contentElement, cdata, settings) {
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
            ? event.selected[0].get('ouuid')
            : undefined;
        rerenderEditorButtons(contentElement, cdata, settings, selectedGeometryId);
    });
}

function configureCursor(map) {
    map.on('pointermove', event => {
        if (event.dragging) return;
        const mouseOverFeature = map.hasFeatureAtPixel(map.getEventPixel(event.originalEvent));
        map.getTargetElement().style.cursor = mouseOverFeature ? 'pointer' : 'default';
    });
}

function getViewGeometryUrl(geometryId, settings) {
    const masterportalUrl = getBaseConfig().masterportal_url;
    const wfsId = settings.schema.masterportalWfsId;
    if (!masterportalUrl || !wfsId) return '';
    
    return masterportalUrl + '?zoomToGeometry=' + geometryId;
}

function getViewGeometriesUrl(extent, settings) {
    const masterportalUrl = getBaseConfig().masterportal_url;
    const wfsId = settings.schema.masterportalWfsId;
    if (!masterportalUrl || !wfsId) return '';
    
    return masterportalUrl + '?zoomToExtent=' + extent.join(',');
}

function getEditGeometryUrl(geometryId, settings) {
    const masterportalUrl = getBaseConfig().masterportal_url;
    const wfsId = settings.schema.masterportalWfsId;
    if (!masterportalUrl || !wfsId) return '';
    
    return masterportalUrl + '?zoomToGeometry=' + geometryId + '&isinitopen=wfst';
}

function getCreateGeometryUrl() {
    const masterportalUrl = getBaseConfig().masterportal_url;
    if (!masterportalUrl) return '';
    
    return masterportalUrl + '?isinitopen=wfst';
}

function getWfsUrl(settings, geometryIds) {
    let baseUrl = settings.schema.wfsUrl;

    if (!baseUrl || !settings.schema.featureType) return '';
    if (!baseUrl.endsWith('/')) baseUrl += '/';

    return baseUrl
        + '?service=WFS&version=1.1.0&request=GetFeature&typename='
        + settings.schema.featureType
        + '&outputFormat=application/json&srsname=EPSG:25832&cql_filter=ouuid in ('
        + geometryIds.map(id => '\'' + id + '\'').join(',')
        + ')';
}

function getAuthorizationString() {
    const username = getBaseConfig().geoserver_username;
    const password = getBaseConfig().geoserver_password;

    return 'Basic ' + window.btoa(username + ':' + password);
}

function getBaseConfig() {
    return ez5.session.getBaseConfig('plugin', 'custom-data-type-nfis-geometry')['nfisGeoservices'];
}

function getGeometryId(cdata) {
    return cdata.geometry_ids.length > 0
        ? cdata.geometry_ids[0]
        : undefined;
}
