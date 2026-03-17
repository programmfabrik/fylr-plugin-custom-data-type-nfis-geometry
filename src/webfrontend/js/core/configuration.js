function get() {
    return ez5.session.getBaseConfig('plugin', 'custom-data-type-nfis-geometry')['nfisGeoservices'];
}

function getFieldConfiguration(objectType, fieldPath) {
    return get().wfs_configuration.find(objectConfiguration => objectConfiguration.object_type === objectType)
        ?.geometry_fields.find(fieldConfiguraton => fieldConfiguraton.field_path === fieldPath);
}

export default {
    get,
    getFieldConfiguration
};
