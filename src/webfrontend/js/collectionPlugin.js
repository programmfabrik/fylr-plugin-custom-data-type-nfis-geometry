var CollectionPluginNFISGeometry;
var extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };
var hasProp = {}.hasOwnProperty;

CollectionPluginNFISGeometry = (function(superClass) {
    extend(CollectionPluginNFISGeometry, superClass);

    function CollectionPluginNFISGeometry() {
        return CollectionPluginNFISGeometry.__super__.constructor.apply(this, arguments);
    }

    const Plugin = CollectionPluginNFISGeometry.prototype;

    Plugin.getCurrentTools = function(collection) {
        let objects;
        try {
            objects = collection.getObjects().map(collectionObject => collectionObject.getObject());
        } catch (err) {
            console.warn('Get Objects failed', err);
        }

        if (!objects?.length) return [];

        const masterportalButton = new ToolboxTool({
            group: collection.getToolGroup(),
            name: 'masterportal-button',
            sort: 'I:1',
            text: $$('custom.data.type.nfis.geometry.viewGeometry'),
            icon: new CUI.Icon({ class: 'fa-external-link' }),
            favorite: true,
            run: (function(_this) {
                return function() {
                    _this.__getGeometryIds(objects).then(geometryIds => {
                        return Core.masterportal.getFilterGeometriesUrl(
                            geometryIds,
                            Core.configuration.get().wfs_geometry_id_field_name
                        );
                    }).then(masterportalUrl => {
                        window.open(masterportalUrl, '_blank');
                    })
                };
            })(this)
        });

        return [masterportalButton];
    };

    Plugin.__getGeometryIds = async function(objects) {
        const result = {};

        for (let object of objects) {
            const objectType = object._objecttype;
            const fullObject = await this.__fetchObject(objectType, object._mask, object[objectType]._id);
            if (!fullObject) continue;

            const geometryIds = this.__getGeometryIdsForObject(fullObject);
            
            for (let layerId of Object.keys(geometryIds)) {
                result[layerId] = result[layerId]
                    ? result[layerId].concat(geometryIds[layerId])
                    : geometryIds[layerId];
            }
        }

        return result;
    };

    Plugin.__fetchObject = async function(objectType, mask, id) {
        const url = ez5.session.data.instance.external_url + '/api/v1/db/' + objectType + '/' + mask + '/' + id
            + '?access_token=' + ez5.session.data.access_token;

        try {
            const response = await fetch(url, { method: 'GET' });
            const result = await response.json();
            return result[0];
        } catch (err) {
            console.error(err);
            return undefined;
        }
    }

    Plugin.__getGeometryIdsForObject = function(object) {
        const fieldConfigurations = Core.configuration.getObjectConfiguration(object._objecttype)?.geometry_fields;
        if (!fieldConfigurations) return {};
    
        return fieldConfigurations.reduce((result, fieldConfiguration) => {
            const geometryIds = this.__getFieldValues(
                object[object._objecttype],
                fieldConfiguration.field_path.split('.').concat(['geometry_ids'])
            );
            const layerId = Core.masterportal.getVectorLayerId(fieldConfiguration);
            if (geometryIds?.length && layerId) {
                if (!result[layerId]) result[layerId] = [];
                result[layerId] = result[layerId].concat(geometryIds);
            }
            return result;
        }, {});
    };

    Plugin.__getFieldValues = function(objectData, pathSegments) {
        const fieldName = pathSegments.shift();
        const field = objectData[fieldName];
        if (field === undefined || field === null) return [];

        if (pathSegments.length === 0) {
            return field;
        } else if (Array.isArray(field)) {
            return field.reduce((result, entry) => {
                const fieldValues = this.__getFieldValues(entry, pathSegments.slice());
                return fieldValues
                    ? result.concat(fieldValues)
                    : result;
            }, []);
        } else {
            return this.__getFieldValues(field, pathSegments);
        }
    };

    return CollectionPluginNFISGeometry;
})(CollectionPlugin);

ez5.session_ready(function() {
  return Collection.registerPlugin(new CollectionPluginNFISGeometry());
});
