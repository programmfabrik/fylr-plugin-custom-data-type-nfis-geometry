const info = process.argv.length >= 3
    ? JSON.parse(process.argv[2])
    : {};

let input = '';

process.stdin.on('data', d => {
    try {
        input += d.toString();
    } catch (e) {
        console.error(`Could not read input into string: ${e.message}`, e.stack);
        process.exit(1);
    }
});

process.stdin.on('end', async () => {
    const result = await handleRequest();
    console.log(JSON.stringify(result, null, 2));
});

async function handleRequest() {
    const requestData = JSON.parse(input);

    const geometryIds = requestData.geometryIds;
    const objectUuid = requestData.objectUuid;

    if (!geometryIds?.length) return { error: 'geometryIds not provided in request body' };

    try {
        return {
            result: !(await isLinkedByOtherObjects(getPluginConfiguration(), geometryIds, objectUuid))
        };
    } catch (err) {
        return { error: err.toString() };
    }
}

async function isLinkedByOtherObjects(configuration, geometryIds, uuid) {
    const geometryFieldPaths = getGeometryFieldPaths(configuration);
    const url = info.api_url + '/api/v1/search?access_token=' + info.api_user_access_token;
    const searchRequest = {
        search: geometryIds.map(geometryId => {
            return {
                type: 'match',
                bool: 'should',
                fields: geometryFieldPaths,
                string: geometryId
            };
        })
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(searchRequest)
    });

    if (!response.ok) throw JSON.stringify(await response.json());

    const result = await response.json();
    return result.objects.length > 1
        || (result.objects.length === 1 && (!uuid || result.objects[0]._uuid !== uuid));
}

function getGeometryFieldPaths(configuration) {
    const fieldPaths = [];

    for (let wfsConfiguration of configuration.wfs_configuration) {
        const objectType = wfsConfiguration.object_type;
        for (let geometryFieldPath of wfsConfiguration.geometry_fields) {
            fieldPaths.push(objectType + '.' + geometryFieldPath.field_path + '.geometry_ids');
        }
    }

    return fieldPaths;
}

function getPluginConfiguration() {
    return info.config.plugin['custom-data-type-nfis-geometry'].config.nfisGeoservices;
}
