const QueryEngineLTBQ = require('@comunica/query-sparql-link-traversal').QueryEngine;
const fetch = require('cross-fetch');

export async function getConSolidProjectByIdLTBQ() {
    const query = `
    prefix consolid: <https://w3id.org/consolid#> 
    prefix dcat: <http://www.w3.org/ns/dcat#>
    SELECT * WHERE { 
        <${process.env.CATALOGUE!}> a consolid:Project ; 
            dcat:dataset* ?dataset .
        ?dataset a consolid:Project .}`

    const myEngine = new QueryEngineLTBQ()
    const bindingsStream = await myEngine.queryBindings(query, {
        sources: [process.env.CATALOGUE],
        lenient: true
    })
    const bindings = await bindingsStream.toArray();
    const pod = process.env.WEBID!
    const project: any = []
    for (const binding of bindings) {
        let projectUrl = binding.get('dataset')!.value
        let accessPoint, webId

        if (!projectUrl.includes(pod)) {
            webId = splitUrl(projectUrl).root + "profile/card#me"
            accessPoint = false
        } else {
            projectUrl = process.env.CATALOGUE!
            webId = pod + "profile/card#me"
            accessPoint = true
        }
        const { sparql, consolid } = await getSatellites(webId)

        project.push({ projectUrl, sparql, consolid, accessPoint, webId })
    }
    myEngine.invalidateHttpCache()
    return project
}

export async function queryFuseki(query, endpoint) {

    let urlencoded = new URLSearchParams();
    urlencoded.append("query", query)
    const requestOptions = {
        method: 'POST',
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Basic ${Buffer.from(process.env.SPARQL_STORE_USERNAME + ":" + process.env.SPARQL_STORE_PW).toString('base64')}`
        },
        body: urlencoded,
    };

    const results = await fetch(endpoint, requestOptions)
    return results
}

export async function checkDatasetExistence(dataset) {
    const requestOptions = {
        method: 'HEAD',
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Basic ${Buffer.from(process.env.SPARQL_STORE_USERNAME + ":" + process.env.SPARQL_STORE_PW).toString('base64')}`
        },
    };

    const results = await fetch(process.env.SPARQL_STORE_ENDPOINT + dataset, requestOptions)
    return results.status
}

function splitUrl(url: string) {
    const root = url.substring(0, url.lastIndexOf('/') + 1)
    const id = url.substring(url.lastIndexOf('/') + 1)
    return { root, id }
}



async function getSatellites(webId: string) {
    const me = await fetch(webId, { headers: { "Accept": "application/ld+json" } }).then(res => res.json()).then(i => i.filter(i => i["@id"] === webId))
    const sparql = me[0]["https://w3id.org/consolid#hasSparqlSatellite"][0]["@id"]
    const consolid = me[0]["https://w3id.org/consolid#hasConSolidSatellite"][0]["@id"]
    return { sparql, consolid }
}