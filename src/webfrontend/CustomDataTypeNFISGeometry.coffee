class CustomDataTypeNFISGeometry extends CustomDataType
    getCustomDataTypeName: ->
        'custom:base.custom-data-type-nfis-geometry.nfis-geometry'

    getCustomDataTypeNameLocalized: ->
        $$('custom.data.type.nfis.geometry.name')

    isEmpty: (data, top_level_data, opts={}) ->
        if data[@name()]?.geometry_id
            false
        else
            true

    getCustomDataOptionsInDatamodelInfo: (custom_settings) ->
        []

    initData: (data) ->
        if not data[@name()]
            cdata = {}
            data[@name()] = cdata
        else
            cdata = data[@name()]

        if not cdata.geometry_id
            cdata.geometry_id = ''

        cdata

    renderFieldAsGroup: (data, top_level_data, opts) ->
        true

    supportsFacet: ->
        false

    renderEditorInput: (data, top_level_data, opts) ->
        cdata = @initData(data)

        editorRootElement = CUI.dom.div('nfis-geometry-editor')
        CUI.dom.append(editorRootElement, @__renderField(cdata, 'editor'))

        editorRootElement

    renderDetailOutput: (data, top_level_data, opts) ->
        cdata = @initData(data)

        if not @__isValidData(cdata)
            return new CUI.EmptyLabel(text: $$('custom.data.type.nfis.geometry.edit.no_data'))

        @__renderField(cdata, 'detail')

    getSaveData: (data, save_data, opts = {}) ->
        cdata = data[@name()]
        if @__isValidData(cdata)
            save_data[@name()] = (
                geometry_id: cdata.geometry_id
            )
        else
            save_data[@name()] = null

    __isValidData: (cdata) ->
        if not CUI.isPlainObject(cdata)
            return false
        if CUI.util.isEmpty(cdata.geometry_id?.trim())
            return false
        true

    __triggerFormChanged: (form) ->
        CUI.Events.trigger
            node: form
            type: 'editor-changed'

    __renderField: (cdata, mode) ->
        contentElement = CUI.dom.div('nfis-plugin-content')
        
        @__loadContent(contentElement, cdata, mode)

        contentElement

    __loadContent: (contentElement, cdata, mode) ->
        ```
        this.__loadWFSData(cdata.geometry_id)
            .then(
                wfsData => this.__renderContent(contentElement, cdata, mode, wfsData ? wfsData.totalFeatures : 0),
                error => console.error(error)
            );
        ```
        return

    __loadWFSData: (geometryId) ->
        ```
        promise = new Promise((resolve, reject) => {
            const wfsUrl = geometryId ? this.__getWfsUrl(geometryId) : undefined;
            if (!wfsUrl) return resolve(undefined);

            const xhr = new XMLHttpRequest();
            xhr.open('GET', wfsUrl);
            xhr.setRequestHeader('Authorization', this.__getAuthenticationString());
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
        return promise

    __renderContent: (contentElement, cdata, mode, totalFeatures) ->
        if mode == 'detail'
            @__renderDetailContent(contentElement, cdata.geometry_id, totalFeatures)
        else
            @__renderEditorContent(contentElement, cdata, totalFeatures)

    __renderDetailContent: (contentElement, geometryId, totalFeatures) ->
        if totalFeatures > 0
            @__renderMap(contentElement, geometryId)
            @__renderViewGeometryButton(contentElement, geometryId)

    __renderEditorContent: (contentElement, cdata, totalFeatures) ->
        if totalFeatures > 0
            @__renderMap(contentElement, cdata.geometry_id)
            @__renderEditorButtonsForExistingGeometry(contentElement, cdata)
        else
            @__renderEditorButtonsForMissingGeometry(contentElement, cdata)

        inputElement = @__createGeometryIdInput(cdata)
        formElement = @__createForm(cdata, [inputElement])
        CUI.dom.append(contentElement, formElement)

    __renderEditorButtonsForExistingGeometry: (contentElement, cdata) ->
        buttonBarElement = new CUI.Buttonbar
            buttons: [
                @__createEditGeometryButton(contentElement, cdata)
                @__createReplaceGeometryButton(contentElement, cdata)
                @__createRemoveGeometryButton(contentElement, cdata)
            ]

        CUI.dom.append(contentElement, buttonBarElement)

    __renderEditorButtonsForMissingGeometry: (contentElement, cdata) ->
        buttonBarElement = new CUI.Buttonbar
            buttons: [
                @__createCreateGeometryButton(contentElement, cdata)
                @__createLinkExistingGeometryButton(contentElement, cdata)
            ]
        
        CUI.dom.append(contentElement, buttonBarElement)

    __createGeometryIdInput: (cdata) ->
        new CUI.Input
            undo_and_changed_support: false
            name: 'geometry_id'
            class: 'nfis-geometry-id-input'
            onDataChanged: (data, field) =>
                cdata.geometry_id = data.geometry_id

    __createForm: (cdata, fields) ->
        formElement = new CUI.Form
            data: cdata
            maximize_horizontal: true
            fields: fields
            onDataChanged: =>
                @__triggerFormChanged(formElement)
        .start()

    __renderMap: (contentElement, geometryId) ->
        mapElement = CUI.dom.div('nfis-geometry-map')
        CUI.dom.append(contentElement, mapElement)
        @__initializeMap(mapElement, geometryId)

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

    __openEditGeometryModal: (contentElement, cdata) ->

        that = this
        modalDialog = new CUI.ConfirmationDialog
            title: $$('custom.data.type.nfis.geometry.editGeometry')
            text: $$('custom.data.type.nfis.geometry.edit.modal.text')
            cancel: false
            buttons: [
                text: $$('custom.data.type.nfis.geometry.modal.ok')
                primary: true
                onClick: =>
                    @__updateEditorContent(contentElement, cdata)
                    modalDialog.destroy()
            ]
        modalDialog.show()

    __setGeometryId: (contentElement, cdata, newGeometryId) ->
        ```
        promise = new Promise((resolve, reject) => {
            this.__loadWFSData(newGeometryId)
            .then((wfsData) => {
                if (wfsData.totalFeatures > 0) {
                    cdata.geometry_id = newGeometryId;
                    this.__updateEditorContentAfterChanges(contentElement, cdata, wfsData.totalFeatures);
                    resolve();
                } else {
                    reject();
                }
            }).catch(error => reject(error));
        });
        ```
        promise
    
    __removeGeometryId: (contentElement, cdata) ->
        cdata.geometry_id = ''
        @__updateEditorContentAfterChanges(contentElement, cdata, 0)

    __updateEditorContent: (contentElement, cdata) ->
        CUI.dom.removeChildren(contentElement)
        @.__loadContent(contentElement, cdata, 'editor')

    __updateEditorContentAfterChanges: (contentElement, cdata, totalFeatures) ->
        CUI.dom.removeChildren(contentElement);
        this.__renderContent(contentElement, cdata, 'editor', totalFeatures);
        this.__triggerFormChanged(CUI.dom.findElement(contentElement, '.cui-form'))

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

    __createEditGeometryButton: (contentElement, cdata) ->
        editGeometryButton = new CUI.Button
            text: $$('custom.data.type.nfis.geometry.editGeometry')
            icon_left: new CUI.Icon(class: 'fa-pencil')
            onClick: () =>
                @__editGeometry(contentElement, cdata)

    __createReplaceGeometryButton: (contentElement, cdata) ->
        label = $$('custom.data.type.nfis.geometry.replaceGeometry')
        new CUI.Button
            text: label
            icon_left: new CUI.Icon(class: 'fa-repeat')
            onClick: () =>
                @__openSetGeometryModal(contentElement, cdata, label)

    __createRemoveGeometryButton: (contentElement, cdata) ->
        new CUI.Button
            text: $$('custom.data.type.nfis.geometry.removeGeometry')
            icon_left: new CUI.Icon(class: 'fa-trash')
            onClick: () =>
                @__removeGeometryId(contentElement, cdata)

    __createGeometry: (contentElement, cdata) ->
        newGeometryId = window.crypto.randomUUID()
        navigator.clipboard.writeText(newGeometryId)
        window.open(@__getCreateGeometryUrl(), '_blank')
        @__openCreateGeometryModal(contentElement, cdata, newGeometryId)

    __editGeometry: (contentElement, cdata) ->
        window.open(@__getEditGeometryUrl(cdata.geometry_id), '_blank')
        @__openEditGeometryModal(contentElement, cdata)

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

    __renderViewGeometryButton: (contentElement, geometryId) ->
        showGeometryButton = new CUI.ButtonHref
            href: @__getViewGeometryUrl(geometryId)
            target: '_blank'
            icon_left: new CUI.Icon(class: 'fa-external-link')
            text: $$('custom.data.type.nfis.geometry.viewGeometry')

        CUI.dom.append(contentElement, showGeometryButton)

    __initializeMap: (mapElement, geometryId, delay = 0) ->
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

        const wfsUrl = this.__getWfsUrl(geometryId);
        const authenticationString = this.__getAuthenticationString();

        const vectorSource = new ol.source.Vector({
            format: new ol.format.GeoJSON(),
            loader: function(extent, resolution, projection, success, failure) {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', wfsUrl);
                xhr.setRequestHeader('Authorization', authenticationString);

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

        vectorSource.on('featuresloadend', () => {
            map.getView().fit(vectorSource.getExtent(), { padding: [20, 20, 20, 20] });
        });

        const rasterSource = new ol.source.TileWMS({
            url: 'https://sgx.geodatenzentrum.de/wms_basemapde',
            params: {
                LAYERS: 'de_basemapde_web_raster_farbe'
            },
            projection
        });

        const rasterLayer = new ol.layer.Tile({
            extent: projection.getExtent(),
            source: rasterSource
        });

        const vectorLayer = new ol.layer.Vector({
            source: vectorSource,
            style: {
                'stroke-width': 1.5,
                'stroke-color': 'black',
                'fill-color': 'rgba(100,100,100,0.25)'
            }
        });

        const map = new ol.Map({
            target: mapElement,
            layers: [rasterLayer, vectorLayer],
            view: new ol.View({
                projection,
                center: [561397, 5709705],
                maxZoom: 19,
                zoom: 7,
            })
        });
        ```
        return
    
    __getViewGeometryUrl: (geometryId) ->
        masterportalUrl = @__getBaseConfig().masterportal_url
        if !masterportalUrl
            return ''
        return masterportalUrl + '?api/highlightFeaturesByAttribute=1279&wfsId=1279&attributeName=fylr_id&attributeValue=' + geometryId + '&attributeQuery=isequal&zoomToGeometry=' + geometryId;

    __getEditGeometryUrl: (geometryId) ->
        masterportalUrl = @__getBaseConfig().masterportal_url
        if !masterportalUrl
            return ''
        return masterportalUrl + '?api/highlightFeaturesByAttribute=1279&wfsId=1279&attributeName=fylr_id&attributeValue=' + geometryId + '&attributeQuery=isequal&zoomToGeometry=' + geometryId + '&isinitopen=wfst';

    __getCreateGeometryUrl: () ->
        masterportalUrl = @__getBaseConfig().masterportal_url
        if !masterportalUrl
            return ''
        return masterportalUrl + '?isinitopen=wfst';

    __getWfsUrl: (geometryId) ->
        wfsUrl = @__getBaseConfig().wfs_url
        if !wfsUrl
            return ''
        wfsUrl += '/' if !wfsUrl.endsWith('/')
        ```
        const url = wfsUrl + '?service=WFS&' +
            'version=1.1.0&request=GetFeature&typename=nfis_wfs&' +
            'outputFormat=application/json&srsname=EPSG:25832&' +
            'cql_filter=fylr_id=\''+ geometryId + '\'';
        ```
        return url

    __getAuthenticationString: () ->
        username = @__getBaseConfig().geoserver_username
        password = @__getBaseConfig().geoserver_password
        return 'Basic ' + window.btoa(username + ':' + password)

    __getBaseConfig: () ->
        ez5.session.getBaseConfig('plugin', 'custom-data-type-nfis-geometry')['nfisGeoservices']

CustomDataType.register(CustomDataTypeNFISGeometry)
