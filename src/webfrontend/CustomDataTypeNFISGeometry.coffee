class CustomDataTypeNFISGeometry extends CustomDataType
    getCustomDataTypeName: ->
        'custom:base.custom-data-type-nfis-geometry.nfis-geometry'

    getCustomDataTypeNameLocalized: ->
        $$('custom.data.type.nfis.geometry.name')

    isEmpty: (data, top_level_data, opts={}) ->
        if data[@name()]?.geometry_ids?.length
            false
        else
            true

    getCustomDataOptionsInDatamodelInfo: (custom_settings) ->
        tags = []

        if custom_settings.wfs_id?.value
            tags.push $$('custom.data.type.nfis.geometry.wfsId') + ': ' + custom_settings.wfs_id.value
        else
            tags.push $$('custom.data.type.nfis.geometry.wfsId.none')

        if custom_settings.wfs_url?.value
            tags.push $$('custom.data.type.nfis.geometry.wfsUrl') + ': ' + custom_settings.wfs_url.value
        else
            tags.push $$('custom.data.type.nfis.geometry.wfsUrl.none')

        if custom_settings.multi_select?.value
            tags.push $$('custom.data.type.nfis.geometry.multiSelect.yes')
        else
            tags.push $$('custom.data.type.nfis.geometry.multiSelect.no')

        tags

    initData: (data) ->
        if not data[@name()]
            cdata = {}
            data[@name()] = cdata
        else
            cdata = data[@name()]

        if not cdata.geometry_ids
            cdata.geometry_ids = []

        cdata

    renderFieldAsGroup: (data, top_level_data, opts) ->
        true

    supportsFacet: ->
        false

    renderEditorInput: (data, top_level_data, opts) ->
        cdata = @initData(data)

        contentElement = CUI.dom.div()
        @__loadContent(contentElement, cdata, 'editor')

        contentElement

    renderDetailOutput: (data, top_level_data, opts) ->
        cdata = @initData(data)

        if not @__isValidData(cdata)
            return new CUI.EmptyLabel(text: $$('custom.data.type.nfis.geometry.edit.no_data'))

        contentElement = CUI.dom.div()
        @__loadContent(contentElement, cdata, 'detail')
        
        contentElement

    getSaveData: (data, save_data, opts = {}) ->
        cdata = data[@name()]
        if @__isValidData(cdata)
            save_data[@name()] = (
                geometry_ids: cdata.geometry_ids
            )
        else
            save_data[@name()] = null

    __isValidData: (cdata) ->
        if not CUI.isPlainObject(cdata)
            return false
        true

    __loadContent: (contentElement, cdata, mode) ->
        ```
        this.__loadWFSData(cdata.geometry_ids)
            .then(
                wfsData => this.__renderContent(contentElement, cdata, mode, wfsData ? wfsData.totalFeatures : 0),
                error => console.error(error)
            );
        ```
        return

    __loadWFSData: (geometryIds) ->
        ```
        promise = new Promise((resolve, reject) => {
            const wfsUrl = geometryIds?.length ? this.__getWfsUrl(geometryIds) : undefined;
            if (!wfsUrl) return resolve(undefined);

            const xhr = new XMLHttpRequest();
            xhr.open('GET', wfsUrl);
            xhr.setRequestHeader('Authorization', this.__getAuthorizationString());
            xhr.onload = () => {
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
        ```
        promise

    __renderContent: (contentElement, cdata, mode, totalFeatures, selectedGeometryId) ->
        multiSelect = @getCustomSchemaSettings().multi_select?.value

        if mode == 'detail'
            @__renderDetailContent(contentElement, cdata, totalFeatures, multiSelect)
        else
            @__renderEditorContent(contentElement, cdata, totalFeatures, selectedGeometryId, multiSelect)

    __renderDetailContent: (contentElement, cdata, totalFeatures, multiSelect) ->
        if totalFeatures > 0
            if multiSelect
                @__renderMap(contentElement, cdata, totalFeatures, undefined, false, @__renderViewGeometriesButton(contentElement))
            else
                @__renderMap(contentElement, cdata, totalFeatures, undefined, false)
                @__renderViewGeometryButton(contentElement, @__getGeometryId(cdata))

    __renderEditorContent: (contentElement, cdata, totalFeatures, selectedGeometryId, multiSelect) ->
        if !multiSelect and cdata.geometry_ids?.length > 0
            selectedGeometryId = cdata.geometry_ids[0]

        if totalFeatures > 0
            @__renderMap(contentElement, cdata, totalFeatures, selectedGeometryId, multiSelect)

        @__renderEditorButtons(contentElement, cdata, multiSelect, selectedGeometryId)

        optionsElement = @__createGeometryIdsOptions(cdata)
        formElement = @__createForm(cdata, [optionsElement])
        CUI.dom.append(contentElement, formElement)

    __renderEditorButtons: (contentElement, cdata, multiSelect, selectedGeometryId) ->
        buttons = []
        if !selectedGeometryId
            buttons.push @__createCreateGeometryButton(contentElement, cdata)
            buttons.push @__createLinkExistingGeometryButton(contentElement, cdata)
        else
            buttons.push @__createEditGeometryButton(contentElement, cdata, selectedGeometryId)
            buttons.push @__createRemoveGeometryButton(contentElement, cdata, selectedGeometryId)

        buttonBarElement = new CUI.Buttonbar
            buttons: buttons

        CUI.dom.append(contentElement, buttonBarElement)

     __renderViewGeometryButton: (contentElement, geometryId) ->
        showGeometryButton = new CUI.ButtonHref
            href: @__getViewGeometryUrl(geometryId)
            target: '_blank'
            icon_left: new CUI.Icon(class: 'fa-external-link')
            text: $$('custom.data.type.nfis.geometry.viewGeometry')

        CUI.dom.append(contentElement, showGeometryButton)

    __renderViewGeometriesButton: (contentElement) ->
        that = @
        return (extent) -> 
            showGeometryButton = new CUI.ButtonHref
                href: that.__getViewGeometriesUrl(extent)
                target: '_blank'
                icon_left: new CUI.Icon(class: 'fa-external-link')
                text: $$('custom.data.type.nfis.geometry.viewGeometry')

            CUI.dom.append(contentElement, showGeometryButton)

    __createEditGeometryButton: (contentElement, cdata, uuid) ->
        editGeometryButton = new CUI.Button
            text: $$('custom.data.type.nfis.geometry.editGeometry')
            icon_left: new CUI.Icon(class: 'fa-pencil')
            onClick: () =>
                @__editGeometry(contentElement, cdata, uuid)

    __createRemoveGeometryButton: (contentElement, cdata, uuid) ->
        new CUI.Button
            text: $$('custom.data.type.nfis.geometry.removeGeometry')
            icon_left: new CUI.Icon(class: 'fa-trash')
            onClick: () =>
                @__removeGeometryId(contentElement, cdata, uuid)

    __createCreateGeometryButton: (contentElement, cdata) ->
        new CUI.Button
            text: $$('custom.data.type.nfis.geometry.createNewGeometry')
            icon_left: new CUI.Icon(class: 'fa-plus')
            onClick: () =>
                @__createGeometry(contentElement, cdata)    

    __createLinkExistingGeometryButton: (contentElement, cdata) ->
        label = $$('custom.data.type.nfis.geometry.linkExistingGeometry')
        new CUI.Button
            text: label
            icon_left: new CUI.Icon(class: 'fa-link')
            onClick: () =>
                @__openSetGeometryModal(contentElement, cdata, label)

    __createGeometryIdsOptions: (cdata) ->
        options = []
        for geometryId in cdata.geometry_ids
            do (geometryId) ->
                options.push
                    value: geometryId
                    text: geometryId

        new CUI.Options
            name: 'geometry_ids'
            class: 'nfis-geometry-ids-options'
            options: options

    __createForm: (cdata, fields) ->
        formElement = new CUI.Form
            data: cdata
            maximize_horizontal: true
            fields: fields
        .start()

    __editGeometry: (contentElement, cdata, uuid) ->
        window.open(@__getEditGeometryUrl(uuid), '_blank')
        @__openEditGeometryModal(contentElement, cdata)

    __createGeometry: (contentElement, cdata) ->
        newGeometryId = window.crypto.randomUUID()
        navigator.clipboard.writeText(newGeometryId)
        window.open(@__getCreateGeometryUrl(), '_blank')
        @__openCreateGeometryModal(contentElement, cdata, newGeometryId)

    __openEditGeometryModal: (contentElement, cdata) ->
        that = this
        modalDialog = new CUI.ConfirmationDialog
            title: $$('custom.data.type.nfis.geometry.edit.modal.title')
            text: $$('custom.data.type.nfis.geometry.edit.modal.text')
            cancel: false
            buttons: [
                text: $$('custom.data.type.nfis.geometry.modal.ok')
                primary: true
                onClick: =>
                    @__reloadEditorContent(contentElement, cdata)
                    modalDialog.destroy()
            ]
        modalDialog.show()

    __openCreateGeometryModal: (contentElement, cdata, newGeometryId, error) ->
        text = ''
        if error
            text += $$('custom.data.type.nfis.geometry.create.modal.error.notFound') + '\n\n'
        text += $$('custom.data.type.nfis.geometry.create.modal.text.1') + '\n\n' + newGeometryId + '\n\n' + $$('custom.data.type.nfis.geometry.create.modal.text.2') 

        that = this
        modalDialog = new CUI.ConfirmationDialog
            title: $$('custom.data.type.nfis.geometry.createNewGeometry')
            text: text
            cancel: false
            buttons: [
                text: $$('custom.data.type.nfis.geometry.modal.cancel')
                onClick: =>
                    modalDialog.destroy()
            ,
                text: $$('custom.data.type.nfis.geometry.modal.ok')
                primary: true
                onClick: =>
                    ```
                    that.__setGeometryId(contentElement, cdata, newGeometryId).then(
                        () => {},
                        error => {
                            if (error) console.error(error);
                            that.__openCreateGeometryModal(contentElement, cdata, newGeometryId, true);
                        }
                    );
                    ```
                    modalDialog.destroy()
            ]
        modalDialog.show()

    __openSetGeometryModal: (contentElement, cdata, title, error) ->
        text = $$('custom.data.type.nfis.geometry.set.modal.text')
        if error
            text = $$('custom.data.type.nfis.geometry.set.modal.error.notFound') + '\n\n' + text

        ```
        CUI.prompt({
            title,
            text,
            min_length: 36
        }).done(geometryId => {
            this.__setGeometryId(contentElement, cdata, geometryId).then(
                () => {},
                error => {
                    if (error) console.error(error);
                    this.__openSetGeometryModal(contentElement, cdata, title, true);
                }
            );
        });
        ```   
        return

    __setGeometryId: (contentElement, cdata, newGeometryId) ->
        ```
        promise = new Promise((resolve, reject) => {
            this.__loadWFSData([newGeometryId])
            .then((wfsData) => {
                if (wfsData.totalFeatures > 0) {
                    cdata.geometry_ids = cdata.geometry_ids.concat([newGeometryId]);
                    this.__applyChanges(contentElement, cdata, wfsData.totalFeatures, newGeometryId);
                    resolve();
                } else {
                    reject();
                }
            }).catch(error => reject(error));
        });
        ```
        promise
    
    __removeGeometryId: (contentElement, cdata, uuid) ->
        ```
        cdata.geometry_ids = cdata.geometry_ids.filter(geometryId => geometryId !== uuid);
        ```
        @__applyChanges(contentElement, cdata, cdata.geometry_ids.length, undefined)

    __reloadEditorContent: (contentElement, cdata, uuid) ->
        CUI.dom.removeChildren(contentElement)
        @__loadContent(contentElement, cdata, 'editor', uuid)

    __applyChanges: (contentElement, cdata, totalFeatures, selectedGeometryId) ->
        CUI.dom.removeChildren(contentElement);
        @__renderContent(contentElement, cdata, 'editor', totalFeatures, selectedGeometryId);
        @__triggerFormChanged(CUI.dom.findElement(contentElement, '.cui-form'))

    __rerenderEditorButtons: (contentElement, cdata, multiSelect, selectedGeometryId) ->
        buttonsBarElement = CUI.dom.findElement(contentElement, '.cui-buttonbar')
        CUI.dom.remove(buttonsBarElement)
        @__renderEditorButtons(contentElement, cdata, multiSelect, selectedGeometryId)

    __triggerFormChanged: (form) ->
        CUI.Events.trigger
            node: form
            type: 'editor-changed'

    __renderMap: (contentElement, cdata, totalFeatures, selectedGeometryId, allowSelection, onLoad) ->
        mapElement = CUI.dom.div('nfis-geometry-map')
        CUI.dom.append(contentElement, mapElement)
        @__initializeMap(contentElement, mapElement, cdata, totalFeatures, selectedGeometryId, allowSelection, onLoad)

    __initializeMap: (contentElement, mapElement, cdata, totalFeatures, selectedGeometryId, allowSelection, onLoad) ->
        ```
        const projection = this.__getMapProjection()

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
            this.__getRasterLayer(projection),
            this.__getVectorLayer(map, cdata.geometry_ids, selectedGeometryId, onLoad)
        ]);

        this.__configureMouseWheelZoom(map);
        if (allowSelection) {
            this.__configureGeometrySelection(map, contentElement, cdata, totalFeatures);
            this.__configureCursor(map);
        }
        ```
        return

    __getMapProjection: () ->
        ```
        const epsg = 'EPSG:25832';
        proj4.defs(epsg, '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs');
        ol.proj.proj4.register(proj4);

        const projection = ol.proj.get(
            new ol.proj.Projection({
                code: epsg,
                units: 'm',
                extent: [120000, 5661139.2, 1378291.2, 6500000]
            })
        );
        ```
        return projection

    __getRasterLayer: (projection) ->
        new ol.layer.Tile
            extent: projection.getExtent()
            source: @.__getRasterSource(projection)

    __getRasterSource: (projection) ->
        new ol.source.TileWMS
            url: 'https://sgx.geodatenzentrum.de/wms_basemapde'
            params:
                LAYERS: 'de_basemapde_web_raster_farbe'
            projection

    __getVectorLayer: (map, geometryIds, selectedGeometryId, onLoad) ->
        ```
        const wfsUrl = this.__getWfsUrl(geometryIds);
        const authorizationString = this.__getAuthorizationString();
        const vectorSource = this.__getVectorSource(wfsUrl, authorizationString, onLoad)

        vectorSource.on('featuresloadend', () => {
            const extent = vectorSource.getExtent();
            map.getView().fit(extent, { padding: [20, 20, 20, 20] });
            if (onLoad) onLoad(extent);
        });

        const vectorLayer = new ol.layer.Vector({
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
        ```
        vectorLayer

    __getVectorSource: (wfsUrl, authorizationString) ->
        ```
        const vectorSource = new ol.source.Vector({
            format: new ol.format.GeoJSON(),
            loader: function(extent, resolution, projection, success, failure) {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', wfsUrl);
                xhr.setRequestHeader('Authorization', authorizationString);

                const onError = () => {
                    vectorSource.removeLoadedExtent(extent);
                    failure();
                }

                xhr.onerror = onError;
                xhr.onload = () => {
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
        ```
        vectorSource

    __configureMouseWheelZoom: (map) ->
        ```
        const mouseWheelInteraction = new ol.interaction.MouseWheelZoom();
        map.addInteraction(mouseWheelInteraction);
        map.on('wheel', event => {
            mouseWheelInteraction.setActive(
                ol.events.condition.shiftKeyOnly(event) || ol.events.condition.platformModifierKeyOnly(event)
            );
        });
        ```
        return

    __configureGeometrySelection: (map, contentElement, cdata, totalFeatures) ->
        ```
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
            this.__rerenderEditorButtons(contentElement, cdata, true, selectedGeometryId);
        });
        ```
        return

    __configureCursor: (map) ->
        ```
        map.on('pointermove', event => {
            if (event.dragging) return;
            const mouseOverFeature = map.hasFeatureAtPixel(map.getEventPixel(event.originalEvent));
            map.getTargetElement().style.cursor = mouseOverFeature ? 'pointer' : 'default';
        });
        ```
        return

    __getViewGeometryUrl: (geometryId) ->
        masterportalUrl = @__getBaseConfig().masterportal_url
        wfsId = @getCustomSchemaSettings().wfs_id?.value
        if !masterportalUrl or !wfsId
            return ''
        masterportalUrl + '?zoomToGeometry=' + geometryId;

    __getViewGeometriesUrl: (extent) ->
        masterportalUrl = @__getBaseConfig().masterportal_url
        wfsId = @getCustomSchemaSettings().wfs_id?.value
        if !masterportalUrl or !wfsId
            return ''
        masterportalUrl + '?zoomToExtent=' + extent.join(',')

    __getEditGeometryUrl: (geometryId) ->
        masterportalUrl = @__getBaseConfig().masterportal_url
        wfsId = @getCustomSchemaSettings().wfs_id?.value
        if !masterportalUrl or !wfsId
            return ''
        masterportalUrl + '?zoomToGeometry=' + geometryId + '&isinitopen=wfst';

    __getCreateGeometryUrl: () ->
        masterportalUrl = @__getBaseConfig().masterportal_url
        if !masterportalUrl
            return ''
        masterportalUrl + '?isinitopen=wfst';

    __getWfsUrl: (geometryIds) ->
        ```
        let wfsBaseUrl = this.getCustomSchemaSettings().wfs_url?.value;
        if (!wfsBaseUrl) return '';
        if (!wfsBaseUrl.endsWith('/')) wfsBaseUrl += '/' ;
        const wfsUrl = wfsBaseUrl
            + '?service=WFS&version=1.1.0&request=GetFeature&typename=nfis_wfs&outputFormat=application/json&srsname=EPSG:25832&cql_filter=ouuid in ('
            + geometryIds.map(id => '\'' + id + '\'').join(',')
            + ')';
        ```
        wfsUrl

    __getAuthorizationString: () ->
        username = @__getBaseConfig().geoserver_username
        password = @__getBaseConfig().geoserver_password
        'Basic ' + window.btoa(username + ':' + password)

    __getBaseConfig: () ->
        ez5.session.getBaseConfig('plugin', 'custom-data-type-nfis-geometry')['nfisGeoservices']

    __getGeometryId: (cdata) ->
        if cdata.geometry_ids.length > 0 then cdata.geometry_ids[0] else undefined

CustomDataType.register(CustomDataTypeNFISGeometry)
