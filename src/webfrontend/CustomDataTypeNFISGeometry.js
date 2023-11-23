var CustomDataTypeNFISGeometry;
var extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };
var hasProp = {}.hasOwnProperty;

CustomDataTypeNFISGeometry = (function(superClass) {
	extend(CustomDataTypeNFISGeometry, superClass);

	function CustomDataTypeNFISGeometry() {
		return CustomDataTypeNFISGeometry.__super__.constructor.apply(this, arguments);
	}

    const Plugin = CustomDataTypeNFISGeometry.prototype;

    Plugin.getCustomDataTypeName = function() {
        return 'custom:base.custom-data-type-nfis-geometry.nfis-geometry';
    }

    Plugin.getCustomDataTypeNameLocalized = function() {
        return $$('custom.data.type.nfis.geometry.name');
    }

    Plugin.isEmpty = function(data, top_level_data, opts={}) {
        if (data[this.name()]?.geometry_ids?.length) {
            return false;
        } else {
            return true;
        }
    }

    Plugin.getCustomDataOptionsInDatamodelInfo = function(custom_settings) {
        const tags = [];

        if (custom_settings.wfs_id?.value) {
            tags.push($$('custom.data.type.nfis.geometry.wfsId') + ': ' + custom_settings.wfs_id.value);
        } else {
            tags.push($$('custom.data.type.nfis.geometry.wfsId.none'));
        }

        if (custom_settings.wfs_url?.value) {
            tags.push($$('custom.data.type.nfis.geometry.wfsUrl') + ': ' + custom_settings.wfs_url.value);
        } else {
            tags.push($$('custom.data.type.nfis.geometry.wfsUrl.none'));
        }
            
        if (custom_settings.wfs_feature_type?.value) {
            tags.push($$('custom.data.type.nfis.geometry.wfsFeatureType') + ': ' + custom_settings.wfs_feature_type.value);
        } else {
            tags.push($$('custom.data.type.nfis.geometry.wfsFeatureType.none'));
        }

        if (custom_settings.multi_select?.value) {
            tags.push($$('custom.data.type.nfis.geometry.multiSelect.yes'));
        } else {
            tags.push($$('custom.data.type.nfis.geometry.multiSelect.no'));
        }

        return tags;
    }

    Plugin.initData = function(data) {
        let cdata;

        if (!data[this.name()]) {
            cdata = {};
            data[this.name()] = cdata;
        } else {
            cdata = data[this.name()];
        }

        if (!cdata.geometry_ids) cdata.geometry_ids = [];

        return cdata;
    }

    Plugin.renderFieldAsGroup = function(data, top_level_data, opts) {
        return true;
    }

    Plugin.supportsFacet = function() {
        return false;
    }

    Plugin.renderEditorInput = function(data, top_level_data, opts) {
        const cdata = this.initData(data);

        contentElement = CUI.dom.div();
        loadContent(contentElement, cdata, this.__getSchemaSettings(), 'editor');

        return contentElement;
    }

    Plugin.renderDetailOutput = function(data, top_level_data, opts) {
        const cdata = this.initData(data);

        if (!isValidData(cdata)) {
            return new CUI.EmptyLabel({ text: $$('custom.data.type.nfis.geometry.edit.no_data') });
        }

        const contentElement = CUI.dom.div();
        loadContent(contentElement, cdata, this.__getSchemaSettings(), 'detail');
        
        return contentElement;
    }

    Plugin.getSaveData = function(data, save_data, opts = {}) {
        const cdata = data[this.name()];
        if (isValidData(cdata)) {
            save_data[this.name()] = {
                geometry_ids: cdata.geometry_ids
            };
        } else {
            save_data[this.name()] = null;
        }
    }

    Plugin.__getSchemaSettings = function() {
        const customSchemaSettings = this.getCustomSchemaSettings();
        return {
            wfsUrl: customSchemaSettings.wfs_url?.value,
            featureType: customSchemaSettings.wfs_feature_type?.value,
            masterportalWfsId: customSchemaSettings.wfs_id?.value,
            multiSelect: customSchemaSettings.multi_select.value
        };
    }

    return CustomDataTypeNFISGeometry;
})(CustomDataType);

function isValidData(cdata) {
    return CUI.isPlainObject(cdata);
}

function loadContent(contentElement, cdata, schemaSettings, mode) {
    loadWFSData(schemaSettings, cdata.geometry_ids).then(
        wfsData => renderContent(
            contentElement, cdata, schemaSettings, mode, wfsData ? wfsData.totalFeatures : 0
        ),
        error => console.error(error)
    );
}

function loadWFSData(schemaSettings, geometryIds) {
    return new Promise((resolve, reject) => {
        const wfsUrl = geometryIds?.length ? getWfsUrl(schemaSettings, geometryIds) : undefined;
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

function renderContent(contentElement, cdata, schemaSettings, mode, totalFeatures, selectedGeometryId) {

    if (mode === 'detail') {
        renderDetailContent(contentElement, cdata, schemaSettings, totalFeatures);
    } else {
        renderEditorContent(contentElement, cdata, schemaSettings, totalFeatures, selectedGeometryId);
    }
}

function renderDetailContent(contentElement, cdata, schemaSettings, totalFeatures) {
    if (totalFeatures === 0) return;

    if (schemaSettings.multiSelect) {
        renderMap(contentElement, cdata, schemaSettings, false, renderViewGeometriesButton(contentElement, schemaSettings));
    } else {
        renderMap(contentElement, cdata, schemaSettings, false);
        renderViewGeometryButton(contentElement, getGeometryId(cdata), schemaSettings);
    }
}

function renderEditorContent(contentElement, cdata, schemaSettings, totalFeatures, selectedGeometryId) {
    if (!schemaSettings.multiSelect && cdata.geometry_ids?.length > 0) {
        selectedGeometryId = cdata.geometry_ids[0];
    }

    if (totalFeatures > 0) {
        renderMap(contentElement, cdata, schemaSettings, schemaSettings.multiSelect);
    }

    renderEditorButtons(contentElement, cdata, schemaSettings, selectedGeometryId);

    const optionsElement = createGeometryIdsOptions(cdata);
    const formElement = createForm(cdata, [optionsElement]);
    CUI.dom.append(contentElement, formElement);
}

function renderEditorButtons(contentElement, cdata, schemaSettings, selectedGeometryId) {
    const buttons = [];

    if (!selectedGeometryId) {
        buttons.push(createCreateGeometryButton(contentElement, cdata, schemaSettings));
        buttons.push(createLinkExistingGeometryButton(contentElement, cdata, schemaSettings));
    } else {
        buttons.push(createEditGeometryButton(contentElement, cdata, schemaSettings, selectedGeometryId));
        buttons.push(createRemoveGeometryButton(contentElement, cdata, schemaSettings, selectedGeometryId));
    }

    const buttonBarElement = new CUI.Buttonbar({ buttons: buttons });

    CUI.dom.append(contentElement, buttonBarElement);
}

function renderViewGeometryButton(contentElement, geometryId, schemaSettings) {
    const showGeometryButton = new CUI.ButtonHref({
        href: getViewGeometryUrl(geometryId, schemaSettings),
        target: '_blank',
        icon_left: new CUI.Icon({ class: 'fa-external-link' }),
        text: $$('custom.data.type.nfis.geometry.viewGeometry')
    });

    CUI.dom.append(contentElement, showGeometryButton);
}

function renderViewGeometriesButton(contentElement, schemaSettings) {
    return (extent) => {
        const showGeometryButton = new CUI.ButtonHref({
            href: getViewGeometriesUrl(extent, schemaSettings),
            target: '_blank',
            icon_left: new CUI.Icon({ class: 'fa-external-link' }),
            text: $$('custom.data.type.nfis.geometry.viewGeometry')
        });

        CUI.dom.append(contentElement, showGeometryButton);
    };
}

function createEditGeometryButton(contentElement, cdata, schemaSettings, uuid) {
    return new CUI.Button({
        text: $$('custom.data.type.nfis.geometry.editGeometry'),
        icon_left: new CUI.Icon({ class: 'fa-pencil' }),
        onClick: () => editGeometry(contentElement, cdata, schemaSettings, uuid)
    });
}

function createRemoveGeometryButton(contentElement, cdata, schemaSettings, uuid) {
    return new CUI.Button({
        text: $$('custom.data.type.nfis.geometry.removeGeometry'),
        icon_left: new CUI.Icon({ class: 'fa-trash' }),
        onClick: () => removeGeometryId(contentElement, cdata, schemaSettings, uuid)
    });
}

function createCreateGeometryButton(contentElement, cdata, schemaSettings) {
    return new CUI.Button({
        text: $$('custom.data.type.nfis.geometry.createNewGeometry'),
        icon_left: new CUI.Icon({ class: 'fa-plus' }),
        onClick: () => createGeometry(contentElement, cdata, schemaSettings)
    });
}

function createLinkExistingGeometryButton(contentElement, cdata, schemaSettings) {
    const label = $$('custom.data.type.nfis.geometry.linkExistingGeometry');
    return new CUI.Button({
        text: label,
        icon_left: new CUI.Icon({ class: 'fa-link' }),
        onClick: () => openSetGeometryModal(contentElement, cdata, schemaSettings, label)
    });
}

function createGeometryIdsOptions(cdata) {
    const options = cdata.geometry_ids.map(geometryId => {
        return { value: geometryId, text: geometryId };
    });

    return new CUI.Options({
        name: 'geometry_ids',
        class: 'nfis-geometry-ids-options',
        options: options
    });
}

function createForm(cdata, fields) {
    return new CUI.Form({
        data: cdata,
        maximize_horizontal: true,
        fields: fields
    }).start();
}

function editGeometry(contentElement, cdata, schemaSettings, uuid) {
    window.open(getEditGeometryUrl(uuid, schemaSettings), '_blank');
    openEditGeometryModal(contentElement, cdata, schemaSettings);
}

function createGeometry(contentElement, cdata, schemaSettings) {
    const newGeometryId = window.crypto.randomUUID();
    navigator.clipboard.writeText(newGeometryId);
    window.open(getCreateGeometryUrl(), '_blank');
    openCreateGeometryModal(contentElement, cdata, schemaSettings, newGeometryId);
};

function openEditGeometryModal(contentElement, cdata, schemaSettings) {
    const modalDialog = new CUI.ConfirmationDialog({
        title: $$('custom.data.type.nfis.geometry.edit.modal.title'),
        text: $$('custom.data.type.nfis.geometry.edit.modal.text'),
        cancel: false,
        buttons: [{
            text: $$('custom.data.type.nfis.geometry.modal.ok'),
            primary: true,
            onClick: () => {
                reloadEditorContent(contentElement, cdata, schemaSettings);
                modalDialog.destroy();
            }
        }]
    });
    
    return modalDialog.show();
}

function openCreateGeometryModal(contentElement, cdata, schemaSettings, newGeometryId, error) {
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
                setGeometryId(contentElement, cdata, schemaSettings, newGeometryId).then(
                    () => {},
                    error => {
                        if (error) console.error(error);
                        openCreateGeometryModal(
                            contentElement, cdata, schemaSettings, newGeometryId, true
                        );
                    }
                );
                modalDialog.destroy();
            }
        }]
    });
    
    return modalDialog.show();
}

function openSetGeometryModal(contentElement, cdata, schemaSettings, title, error) {
    let text = $$('custom.data.type.nfis.geometry.set.modal.text');
    if (error) text = $$('custom.data.type.nfis.geometry.set.modal.error.notFound') + '\n\n' + text;

    CUI.prompt({
        title,
        text,
        min_length: 36
    }).done(geometryId => {
        setGeometryId(contentElement, cdata, schemaSettings, geometryId).then(
            () => {},
            error => {
                if (error) console.error(error);
                openSetGeometryModal(contentElement, cdata, schemaSettings, title, true);
            }
        );
    });
}

function setGeometryId(contentElement, cdata, schemaSettings, newGeometryId) {
    return new Promise((resolve, reject) => {
        loadWFSData(schemaSettings, [newGeometryId]).then((wfsData) => {
            if (wfsData.totalFeatures > 0) {
                cdata.geometry_ids = cdata.geometry_ids.concat([newGeometryId]);
                applyChanges(contentElement, cdata, schemaSettings, wfsData.totalFeatures, newGeometryId);
                resolve();
            } else {
                reject();
            }
        }).catch(error => reject(error));
    });
}

function removeGeometryId(contentElement, cdata, schemaSettings, uuid) {
    cdata.geometry_ids = cdata.geometry_ids.filter(geometryId => geometryId !== uuid);
    applyChanges(contentElement, cdata, schemaSettings, cdata.geometry_ids.length, undefined);
}

function reloadEditorContent(contentElement, cdata, schemaSettings, uuid) {
    CUI.dom.removeChildren(contentElement);
    loadContent(contentElement, cdata, schemaSettings, 'editor', uuid);
}

function applyChanges(contentElement, cdata, schemaSettings, totalFeatures, selectedGeometryId) {
    CUI.dom.removeChildren(contentElement);
    renderContent(contentElement, cdata, schemaSettings, 'editor', totalFeatures, selectedGeometryId);
    triggerFormChanged(CUI.dom.findElement(contentElement, '.cui-form'));
}

function rerenderEditorButtons(contentElement, cdata, schemaSettings, selectedGeometryId) {
    const buttonsBarElement = CUI.dom.findElement(contentElement, '.cui-buttonbar');
    CUI.dom.remove(buttonsBarElement);
    renderEditorButtons(contentElement, cdata, schemaSettings, selectedGeometryId);
}

function triggerFormChanged(form) {
    CUI.Events.trigger({
        node: form,
        type: 'editor-changed'
    });
}

function renderMap(contentElement, cdata, schemaSettings, allowSelection, onLoad) {
    const mapElement = CUI.dom.div('nfis-geometry-map');
    CUI.dom.append(contentElement, mapElement);
    initializeMap(contentElement, mapElement, cdata, schemaSettings, allowSelection, onLoad);
}

function initializeMap(contentElement, mapElement, cdata, schemaSettings, allowSelection, onLoad) {
    const projection = getMapProjection();
    const map = new ol.Map({
        target: mapElement,
        view: new ol.View({
            projection,
            center: [561397, 5709705],
            maxZoom: 19,
            zoom: 7,
        }),
        interactions: ol.interaction.defaults.defaults({ mouseWheelZoom: false })
    });

    map.setLayers([
        getRasterLayer(projection),
        getVectorLayer(map, cdata.geometry_ids, schemaSettings, onLoad)
    ]);

    configureMouseWheelZoom(map);
    if (allowSelection) {
        configureGeometrySelection(map, contentElement, cdata, schemaSettings);
        configureCursor(map);
    }
}

function getMapProjection() {
    const epsg = 'EPSG:25832';
    proj4.defs(epsg, '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs');
    ol.proj.proj4.register(proj4);

    return ol.proj.get(
        new ol.proj.Projection({
            code: epsg,
            units: 'm',
            extent: [120000, 5661139.2, 1378291.2, 6500000]
        })
    );
}

function getRasterLayer(projection) {
    return new ol.layer.Tile({
        extent: projection.getExtent(),
        source: getRasterSource(projection)
    });
}

function getRasterSource(projection) {
    return new ol.source.TileWMS({
        url: 'https://sgx.geodatenzentrum.de/wms_basemapde',
        params: {
            LAYERS: 'de_basemapde_web_raster_farbe'
        },
        projection
    });
}

function getVectorLayer(map, geometryIds, schemaSettings, onLoad) {
    const wfsUrl = getWfsUrl(schemaSettings, geometryIds);
    const authorizationString = getAuthorizationString();
    const vectorSource = getVectorSource(wfsUrl, authorizationString, onLoad);

    vectorSource.on('featuresloadend', () => {
        const extent = vectorSource.getExtent();
        map.getView().fit(extent, { padding: [20, 20, 20, 20] });
        if (onLoad) onLoad(extent);
    });

    return new ol.layer.Vector({
        source: vectorSource,
        style: new ol.style.Style({
            stroke: new ol.style.Stroke({
                width: 1.5,
                color: 'black'
            }),
            fill: new ol.style.Fill({
                color: 'rgba(100,100,100,0.25)'
            })
        })
    });
}

function getVectorSource(wfsUrl, authorizationString) {
    const vectorSource = new ol.source.Vector({
        format: new ol.format.GeoJSON(),
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
        strategy: ol.loadingstrategy.all,
    });

    return vectorSource;
}

function configureMouseWheelZoom(map) {
    const mouseWheelInteraction = new ol.interaction.MouseWheelZoom();
    map.addInteraction(mouseWheelInteraction);
    map.on('wheel', event => {
        mouseWheelInteraction.setActive(
            ol.events.condition.shiftKeyOnly(event) || ol.events.condition.platformModifierKeyOnly(event)
        );
    });
}

function configureGeometrySelection(map, contentElement, cdata, schemaSettings) {
    const select = new ol.interaction.Select({
        condition: ol.events.condition.click,
        style: new ol.style.Style({
            stroke: new ol.style.Stroke({
                width: 1.5,
                color: 'white'
            }),
            fill: new ol.style.Fill({
                color: 'rgba(255,255,255,0.25)'
            })
        })
    });

    map.addInteraction(select);
    select.on('select', event => {
        const selectedGeometryId = event.selected.length > 0
            ? event.selected[0].get('ouuid')
            : undefined;
        rerenderEditorButtons(contentElement, cdata, schemaSettings, selectedGeometryId);
    });
}

function configureCursor(map) {
    map.on('pointermove', event => {
        if (event.dragging) return;
        const mouseOverFeature = map.hasFeatureAtPixel(map.getEventPixel(event.originalEvent));
        map.getTargetElement().style.cursor = mouseOverFeature ? 'pointer' : 'default';
    });
}

function getViewGeometryUrl(geometryId, schemaSettings) {
    const masterportalUrl = getBaseConfig().masterportal_url;
    const wfsId = schemaSettings.masterportalWfsId;
    if (!masterportalUrl || !wfsId) return '';
    
    return masterportalUrl + '?zoomToGeometry=' + geometryId;
}

function getViewGeometriesUrl(extent, schemaSettings) {
    const masterportalUrl = getBaseConfig().masterportal_url;
    const wfsId = schemaSettings.masterportalWfsId;
    if (!masterportalUrl || !wfsId) return '';
    
    return masterportalUrl + '?zoomToExtent=' + extent.join(',');
}

function getEditGeometryUrl(geometryId, schemaSettings) {
    const masterportalUrl = getBaseConfig().masterportal_url;
    const wfsId = schemaSettings.masterportalWfsId;
    if (!masterportalUrl || !wfsId) return '';
    
    return masterportalUrl + '?zoomToGeometry=' + geometryId + '&isinitopen=wfst';
}

function getCreateGeometryUrl() {
    const masterportalUrl = getBaseConfig().masterportal_url;
    if (!masterportalUrl) return '';
    
    return masterportalUrl + '?isinitopen=wfst';
}

function getWfsUrl(schemaSettings, geometryIds) {
    let baseUrl = schemaSettings.wfsUrl;

    if (!baseUrl || !schemaSettings.featureType) return '';
    if (!baseUrl.endsWith('/')) baseUrl += '/';

    return baseUrl
        + '?service=WFS&version=1.1.0&request=GetFeature&typename='
        + schemaSettings.featureType
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

CustomDataType.register(CustomDataTypeNFISGeometry);
