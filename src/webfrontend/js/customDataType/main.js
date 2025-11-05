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

    Plugin.isEmpty = function(data, topLevelData, opts={}) {
        if (opts.mode === 'expert') {
            return CUI.util.isEmpty(data[this.name()]?.trim());
        } else {
            return !data[this.name()]?.geometry_ids?.length;
        }
    }

    Plugin.getCustomDataOptionsInDatamodelInfo = function(custom_settings) {
        const tags = [];

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
        cdata.newly_drawn_geometry_ids = [];
        cdata.replaced_geometry_ids = {};

        return cdata;
    }

    Plugin.renderFieldAsGroup = function(data, topLevelData, opts) {
        return false;
    }

    Plugin.supportsFacet = function() {
        return false;
    }

    Plugin.renderEditorInput = function(data, topLevelData, opts) {
        const cdata = this.initData(data);

        contentElement = CUI.dom.div();
        ContentLoader.load(
            contentElement, cdata, this.__getObjectType(), this.__getFieldPath(),
            this.__isMultiSelect(), 'editor'
        );

        return contentElement;
    }

    Plugin.renderDetailOutput = function(data, topLevelData, opts) {
        const cdata = this.initData(data);

        if (!this.__isValidData(cdata)) {
            return new CUI.EmptyLabel({ text: $$('custom.data.type.nfis.geometry.edit.no_data') });
        }

        const contentElement = CUI.dom.div();
        ContentLoader.load(
            contentElement, cdata, this.__getObjectType(), this.__getFieldPath(),
            this.__isMultiSelect(), 'detail'
        );
        
        return contentElement;
    }

    Plugin.getSaveData = function(data, save_data, opts = {}) {
        const cdata = data[this.name()];
        if (this.__isValidData(cdata)) {
            const saveData = { geometry_ids: cdata.geometry_ids };
            if (cdata.newly_drawn_geometry_ids?.length) {
                saveData.newly_drawn_geometry_ids = cdata.newly_drawn_geometry_ids;
            }
            if (cdata.replaced_geometry_ids && Object.keys(cdata.replaced_geometry_ids).length) {
                saveData.replaced_geometry_ids = cdata.replaced_geometry_ids;
            }
            save_data[this.name()] = saveData;
        } else {
            save_data[this.name()] = null;
        }
    }

    Plugin.renderSearchInput = function(data, opts) {
        const inputElement = new CUI.Input({
            data: data,
            name: this.name(),
            placeholder: $$('custom.data.type.nfis.geometry.search.placeholder')
        });

        CUI.Events.listen({
            node: inputElement,
            type: 'data-changed',
            call: () => {
                CUI.Events.trigger({
                    node: inputElement,
                    type: 'search-input-change'
                });
            }
        });

        return inputElement.start();
    }

    Plugin.getSearchFilter = function(data, key = this.name()) {
        if (data[key + ':unset']) {
            return {
                type: 'in',
                bool: 'should',
                fields: [this.fullName() + '.geometry_ids'],
                in: [null],
                _unnest: true,
                _unset_filter: true
            };
        } else if (data[key + ':has_value']) {
            return this.getHasValueFilter(data, key);
        } else if (data[key]?.length) {
            return {
                type: 'match',
                bool: 'should',
                fields: [this.fullName() + '.geometry_ids'],
                string: data[key]
            };
        }
    }

    Plugin.getHasValueFilter = function(data, key = this.name()) {
        if (data[key + ':has_value']) {
            return {
                type: 'in',
                bool: 'should',
                fields: [this.fullName() + '.geometry_ids'],
                in: [null],
                bool: 'must_not',
                _unnest: true,
                _unset_filter: true
            };
        }
    }

    Plugin.getQueryFieldBadge = function(data) {
        const result = {
            name: this.nameLocalized()
        };

        if (data[this.name() + ':unset']) {
            result.value = $$('text.column.badge.without');
        } else if (data[this.name() + ':has_value']) {
            result.value = $$('field.search.badge.has_value');
        } else {
            result.value = data[this.name()];
        }

        return result;
    }

    Plugin.__isMultiSelect = function() {
        const customSchemaSettings = this.getCustomSchemaSettings();
        return customSchemaSettings.multi_select?.value === true;
    }

    Plugin.__getObjectType = function() {
        const path = this.path();
        return path.includes('.')
            ? path.slice(0, path.indexOf('.'))
            : path;
    }

    Plugin.__getFieldPath = function() {
        const path = this.path();
        return path.includes('.')
            ? path.slice(path.indexOf('.') + 1) + '.' + this.name()
            : this.name();
    }

    Plugin.__isValidData = function(cdata) {
        return CUI.isPlainObject(cdata);
    }

    return CustomDataTypeNFISGeometry;
})(CustomDataType);


CustomDataType.register(CustomDataTypeNFISGeometry);
