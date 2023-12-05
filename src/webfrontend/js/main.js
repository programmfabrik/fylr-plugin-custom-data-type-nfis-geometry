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
        ContentLoader.load(contentElement, cdata, this.__getSchemaSettings(), 'editor');

        return contentElement;
    }

    Plugin.renderDetailOutput = function(data, top_level_data, opts) {
        const cdata = this.initData(data);

        if (!this.__isValidData(cdata)) {
            return new CUI.EmptyLabel({ text: $$('custom.data.type.nfis.geometry.edit.no_data') });
        }

        const contentElement = CUI.dom.div();
        ContentLoader.load(contentElement, cdata, this.__getSchemaSettings(), 'detail');
        
        return contentElement;
    }

    Plugin.getSaveData = function(data, save_data, opts = {}) {
        const cdata = data[this.name()];
        if (this.__isValidData(cdata)) {
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
            sldFileUrl: customSchemaSettings.sld_file_url?.value,
            masterportalWfsId: customSchemaSettings.wfs_id?.value,
            multiSelect: customSchemaSettings.multi_select.value
        };
    }

    Plugin.__isValidData = function(cdata) {
        return CUI.isPlainObject(cdata);
    }

    return CustomDataTypeNFISGeometry;
})(CustomDataType);


CustomDataType.register(CustomDataTypeNFISGeometry);
