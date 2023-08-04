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

		fields = []
		fields.push
			type: CUI.Input
			undo_and_changed_support: false
			form:
				label: $$('custom.data.type.nfis.geometry.geometry_id.label')
			placeholder: $$('custom.data.type.nfis.geometry.geometry_id.placeholder')
			name: 'geometry_id'
			onDataChanged: (data, field) =>
				cdata.geometry_id = data.geometry_id

		formElement = new CUI.Form
			data: cdata
			maximize_horizontal: true
			fields: fields
			onDataChanged: =>
				@__triggerFormChanged(form)
		.start()

		editorRootElement = CUI.dom.div('nfis-geometry-editor')
		CUI.dom.append(editorRootElement, formElement)
		CUI.dom.append(editorRootElement, @__renderField(cdata.geometry_id, 'editor'))

		editorRootElement

	renderDetailOutput: (data, top_level_data, opts) ->
		cdata = @initData(data)

		if not @__isValidData(cdata)
			return new CUI.EmptyLabel(text: $$('custom.data.type.nfis.geometry.edit.no_data'))

		@__renderField(cdata.geometry_id, 'detail')

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

	__renderField: (geometryId, mode) ->
        contentElement = CUI.dom.div('nfis-plugin-content')
        
        @__loadContent(contentElement, geometryId, mode)

        contentElement

    __loadContent: (contentElement, geometryId, mode) ->
        ```
        const wfsUrl = geometryId ? this.__getWfsUrl(geometryId) : undefined;
        if (!wfsUrl) return this.__renderContent(contentElement, geometryId, mode, 0)

        const xhr = new XMLHttpRequest();
        xhr.open('GET', wfsUrl);
        xhr.setRequestHeader('Authorization', this.__getAuthenticationString());
        xhr.onload = () => {
            if (xhr.status == 200) {
                const data = JSON.parse(xhr.responseText);
                this.__renderContent(contentElement, geometryId, mode, data.totalFeatures);
            } else {
                console.error('Failed to load data from WFS service');
            }
        };
        xhr.onerror = error => {
            console.error(error);
        };
        xhr.send();
        ```
        return

    __renderContent: (contentElement, geometryId, mode, totalFeatures) ->
        ```
        if (totalFeatures > 0) {
            this.__renderMap(contentElement, geometryId);
            if (mode === 'detail') {
                this.__renderViewGeometriesButton(contentElement, geometryId);
            } else if (mode === 'editor') {
                this.__renderEditGeometriesButton(contentElement, geometryId);
            }
        } else if (mode === 'editor') {
            this.__renderCreateGeometriesButton(contentElement);
        }

        ```
        return

    __renderMap: (contentElement, geometryId) ->
        mapElement = CUI.dom.div('nfis-geometry-map')
        CUI.dom.append(contentElement, mapElement)
        @__initializeMap(mapElement, geometryId)

    __renderCreateGeometriesButton: (contentElement) ->
        createGeometriesButton = new CUI.ButtonHref
            id: 'create-geometries-button'
            href: @__getCreateGeometriesUrl()
            target: '_blank'
            icon_left: new CUI.Icon(class: 'fa-external-link')
            text: $$('custom.data.type.nfis.geometry.createGeometries')

        CUI.dom.append(contentElement, createGeometriesButton)

    __renderEditGeometriesButton: (contentElement, geometryId) ->
        editGeometriesButton = new CUI.ButtonHref
            id: 'edit-geometries-button'
            href: @__getEditGeometriesUrl(geometryId)
            target: '_blank'
            icon_left: new CUI.Icon(class: 'fa-external-link')
            text: $$('custom.data.type.nfis.geometry.editGeometries')

        CUI.dom.append(contentElement, editGeometriesButton)

    __renderViewGeometriesButton: (contentElement, geometryId) ->
        showGeometriesButton = new CUI.ButtonHref
            id: 'view-geometries-button'
            href: @__getViewGeometriesUrl(geometryId)
            target: '_blank'
            icon_left: new CUI.Icon(class: 'fa-external-link')
            text: $$('custom.data.type.nfis.geometry.viewGeometries')

        CUI.dom.append(contentElement, showGeometriesButton)

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
			map.getView().fit(vectorSource.getExtent());
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
    
    __getViewGeometriesUrl: (geometryId) ->
        masterportalUrl = @__getBaseConfig().masterportal_url
        if !masterportalUrl
            return ''
        return masterportalUrl + '?api/highlightFeaturesByAttribute=1279&wfsId=1279&attributeName=fylr_id&attributeValue=' + geometryId + '&attributeQuery=isequal&zoomToGeometry=' + geometryId;

    __getEditGeometriesUrl: (geometryId) ->
        masterportalUrl = @__getBaseConfig().masterportal_url
        if !masterportalUrl
            return ''
        return masterportalUrl + '?api/highlightFeaturesByAttribute=1279&wfsId=1279&attributeName=fylr_id&attributeValue=' + geometryId + '&attributeQuery=isequal&zoomToGeometry=' + geometryId + '&isinitopen=wfst';

    __getCreateGeometriesUrl: () ->
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
