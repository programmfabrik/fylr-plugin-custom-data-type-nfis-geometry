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
        const configuration = Core.configuration.get();
        if (!configuration.show_masterportal_context_menu_option) return [];

        const supportedObjectTypes = configuration.wfs_configuration.map(entry => entry.object_type);

        let objects;
        try {
            objects = collection.getObjects()
                .map(collectionObject => collectionObject.getObject())
                .filter(object => supportedObjectTypes.includes(object._objecttype));
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
                            configuration.wfs_geometry_id_field_name
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

        const fullObjects = await this.__fetchFullObjects(objects);

        for (let fullObject of fullObjects) {
            const geometryIds = this.__getGeometryIdsForObject(fullObject);
            
            for (let layerId of Object.keys(geometryIds)) {
                result[layerId] = result[layerId]
                    ? result[layerId].concat(geometryIds[layerId])
                    : geometryIds[layerId];
            }
        }

        return result;
    };

    Plugin.__getGeometryIdsForObject = function(object) {
        const fieldConfigurations = Core.configuration.getObjectConfiguration(object._objecttype)?.geometry_fields;
        if (!fieldConfigurations) return {};
    
        return fieldConfigurations.reduce((result, fieldConfiguration) => {
            const geometryIds = this.__getFieldValues(
                object[object._objecttype],
                fieldConfiguration.field_path.split('.').concat(['geometry_ids'])
            );
            const layerId = Core.masterportal.getVectorLayerId(object, fieldConfiguration);
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

    Plugin.__fetchFullObjects = async function(objects) {
        const url = ez5.session.data.instance.external_url + '/api/v1/search?access_token=' + ez5.session.data.access_token;

        const searchRequest = {
            search: [
                {
                    type: 'in',
                    bool: 'must',
                    fields: ['_uuid'],
                    in: objects.map(object => object._uuid)
                }
            ]
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(searchRequest)
        });

        if (!response.ok) throw JSON.stringify(await response.json());

        return (await response.json()).objects;
    };

    return CollectionPluginNFISGeometry;
})(CollectionPlugin);

ez5.session_ready(function() {
  return Collection.registerPlugin(new CollectionPluginNFISGeometry());
});
