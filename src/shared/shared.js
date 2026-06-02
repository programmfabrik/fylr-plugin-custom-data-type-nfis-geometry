// These functions are used by:
//      server/sendDataToGeoserver.js
//      webfrontend/js/core/map.js
//      webfrontend/js/core/masterportal.js

function getValues(rootObject, configuration) {
    const object = rootObject[rootObject._objecttype] ?? rootObject;

    const values = {
        uuid: rootObject._uuid,
        objectType: rootObject._objecttype,
        tagIds: rootObject._tags ? rootObject._tags.map(tag => tag._id) : [],
        poolName: getPoolName(object, configuration)
    };

    return configuration.values.reduce((result, valueDefinition) => {
        result[valueDefinition.name] = executeCustomFunction(object, result, valueDefinition.function);
        return result;
    }, values);
}

function getPoolName(object, configuration) {
    if (!object._pool) return undefined;

    const poolNames = getPoolNames(configuration);
    for (let entry of object._pool._path) {
        const poolName = entry.pool.name?.['de-DE'];
        if (poolNames.includes(poolName)) return poolName;
    }

    return object._pool.pool?.name?.['de-DE'];
}

function getPoolNames(configuration) {
    return configuration.pool_names?.map(entry => {
        return entry.pool_name;
    }) ?? [];
}

function executeCustomFunction(object, values, functionDefinition) {
    const customFunction = new Function('object', 'values', functionDefinition);
    return customFunction(object, values);
}
