import NodeCache from "node-cache"
import { checkDatasetExistence, queryFuseki } from "./functions"
import { QueryEngine } from "@comunica/query-sparql"
import jws from "jws"
const N3 = require('n3')

const { DataFactory } = N3;
const prefixes = { 
  consolid: 'https://w3id.org/consolid#',
  dcterms: 'http://purl.org/dc/terms/',
  ls: "https://standards.iso.org/iso/21597/-1/ed-1/en/Linkset#",
  ct: "https://standards.iso.org/iso/21597/-1/ed-1/en/Container#",
  oa: "http://www.w3.org/ns/oa#",
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  refArch: "http://localhost:3000/architect-duplex/6d57703d-c4a7-4326-a657-8beec42e00e7#",
  refEng: "http://localhost:3000/engineer-duplex/922d5f1c-a225-4309-9a53-a19e0a49d777#"
}




const { translate } = require('sparqlalgebrajs');

const SparqlParser = require('sparqljs').Parser;
const sparqlParser = new SparqlParser();

const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const { extractWebId } = require("express-solid-auth-wrapper")
const { generateFetch } = require("./auth")
const { getConSolidProjectByIdLTBQ } = require('./functions/index')
const port = process.env.PORT

const app = express();
app.use(cors())
app.use(express.json());

var options = {
  inflate: true,
  limit: '100kb',
  type: 'application/sparql-update'
};

app.use(bodyParser.raw(options));
app.use(express.urlencoded({ limit: "5mb", extended: true }));
app.use(extractWebId)

export const queryEngine = new QueryEngine()
export const myCache = new NodeCache()

app.get('/', (req, res) => {
  res.send('app is running')
})

// dataset query
app.get("/project", async (req, res) => {
  res.status(200).send(process.env.CATALOGUE)
})
 


app.post("/sparql", queryController)

async function verify(token) { 
  const decoded = jws.decode(token)
  const payload = JSON.parse(decoded.payload) 
  const issuer = payload.issuer
  const publicKeyUrl = payload.publicKey
          const publicKey = await fetch(payload.publicKey).then(i => i.text())
          let valid = jws.verify(token, decoded.header.alg, publicKey)
          if (!publicKeyUrl.includes(issuer.replaceAll("/profile/card#me", ""))) {
            valid = false
          }
          return {valid, payload }
} 

async function queryController(req, res) { 
  const {query, tokens} = req.body
  console.log('query :>> ', query);
  if (!query) {
    res.status(400).send("Query parameter is missing")
    return
  }  

  if (!tokens) {
    res.status(400).send("Tokens parameter is missing")
    return
  }

  // try {
  //   sparqlParser.parse(query);
  // } catch (error) {
  //   res.status(400).send(error)
  //   return
  // }

  // let allAllowed: string[] = []
  // for (const token of tokens ) {

  //   const {valid, payload} = await verify(token)
  //   if (!valid) { 
  //     res.status(400).send("Token is not valid")
  //     return
  //   }
    
  //   allAllowed= [...allAllowed, ...payload.allowed]
  // }

  // console.log('allAllowed :>> ', allAllowed);
  const allSources: any = myCache.get("sources") 
 
  // const sources = allAllowed.filter(i => allSources.includes(i))
  console.log('query :>> ', query);
  console.log('allSources :>> ', allSources);
  const results: any = await doQuery(query, allSources)
  res.status(200).send(results)
}
 
async function doQuery(query, sources) { 
  try {
    const {type} = translate(query)
    let results 
    if (type !== "construct") {
      const result = await queryEngine.query(query, { sources })
      console.log('result :>> ', result);
      const { data } = await queryEngine.resultToString(result,'application/sparql-results+json')
      results = await streamToString(data)
    } else {
      const quadStream = await queryEngine.queryQuads(query, { sources })
      results = await resolveQuadStream(quadStream)
      console.log('results :>> ', results);
    } 
    return results 
  } catch (error) {
    return error
  }

}

function resolveQuadStream(quadStream) { 
  return new Promise((resolve, reject) => {
    const writer = new N3.Writer({ prefixes });
      const quads = []
      quadStream.on('data', (quad) => {
        console.log('quad :>> ', quad);
        writer.addQuad(quad) 
      });
      quadStream.on('end', (quad) => {
        writer.end((error, result) => resolve(result));
      });
      quadStream.on('error', (error) => {
          reject(error)
      });
  })
}


// pipe stream to string object
async function streamToString(stream) {
  const chunks: Buffer[] = []
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk: Buffer) => chunks.push(chunk))
    stream.on("error", reject)
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
  })
}



app.listen(port, async () => {
  const { authFetch, bearer } = await generateFetch(process.env.EMAIL, process.env.PASSWORD, process.env.IDP)

  await checkIfRegistered(authFetch)
  // get project endpoints
  const endpoints = await getConSolidProjectByIdLTBQ()
  // get all RDF resources in all endpoints
  const allResources = await getAllResources(endpoints, authFetch)
  myCache.set("sources", Array.from(allResources))

  console.log(`Server listening at http://localhost:${port}`);
})

async function checkIfRegistered(fetch) {
  const query = `
  prefix dcat: <http://www.w3.org/ns/dcat#>
  prefix dcterms: <http://purl.org/dc/terms/>
  ASK {
    <${process.env.CATALOGUE}> dcat:service <${process.env.URL}> .
    <${process.env.URL}> dcterms:conformsTo <https://www.w3.org/TR/sparql11-protocol/> ;
      dcat:endpointURL <${process.env.URL}> .
    
  }` 

  const myEngine = new QueryEngine()
  const result = await myEngine.queryBoolean(query, { sources: [process.env.CATALOGUE!], fetch })
  if (!result) {
    const registerQuery = `
    prefix dcat: <http://www.w3.org/ns/dcat#>
    prefix dcterms: <http://purl.org/dc/terms/>
    INSERT DATA {
      <${process.env.CATALOGUE}> dcat:service <${process.env.URL}> .
      <${process.env.URL}> dcterms:conformsTo <https://www.w3.org/TR/sparql11-protocol/> ;
        dcat:endpointURL <${process.env.URL}/sparql> .
    }`   

    await fetch(process.env.CATALOGUE!, { method: "PATCH", headers: { "Content-Type": "application/sparql-update" }, body: registerQuery }).catch(() => new Error("Could not register endpoint"))
  }
}

async function getAllResourcesAsync(endpoints, authFetch) {

  const allResources = new Set()
  for (const e of endpoints) {
    const activeProjectId = process.env.CATALOGUE!.split("/").pop()
    const datasetEndpoint = e.consolid + `project/${activeProjectId}/datasets`
    const metadata = await authFetch(datasetEndpoint, { method: "POST", headers: { "Content-Type": "application/json" } }).then(i => i.json()).catch(console.log)

    metadata.forEach(item => {
      allResources.add(item.dataset)
    })

    const body = {
      "distributionFilter": [
        {
          "predicate": "http://www.w3.org/ns/dcat#mediaType",
          "object": "https://www.iana.org/assignments/media-types/text/turtle"
        }
      ]
    }

    const ttlDatasets = await authFetch(datasetEndpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(i => i.json()).catch(console.log)
    ttlDatasets.forEach(item => {
      allResources.add(item.dataset)
    })
  }
  return allResources
}


async function getAllResources(endpoints, authFetch) {
  return [
    'http://localhost:3000/fm-ugent/411c43d6-dd9a-47c4-8412-e7793a9fd4ca',
    'http://localhost:3000/fm-ugent/097224bd-0173-4f86-bfca-7b1525276ff4',
    'http://localhost:3000/fm-ugent/ba0ccf6f-7010-4131-beb2-0a9c179c9a3c',
    'http://localhost:3000/fm-ugent/c86aa2e7-8c93-4bc9-a7fd-510b543def9e',
    'http://localhost:3000/b-b/803f25a8-218c-43e5-af96-0c37863b81ae',
    'http://localhost:3000/b-b/373c4e9c-9d84-4af3-99a6-321388f3e4f9',
    'http://localhost:3000/b-b/606895f3-5e44-44f1-bdf0-cbab341bb483',
    'http://localhost:3000/b-b/1dde8642-0ba8-419c-b3ff-62d5bb846754',
    'http://localhost:3000/b-b/c043eaf3-86b2-4aa9-aeb3-c188b8397feb',
    'http://localhost:3000/arcadis/99ac8c4a-c5df-4160-92c7-36a33e5576ac',
    'http://localhost:3000/arcadis/5c031dc3-94b6-4ed0-bc7c-3759b7ca6509',
    'http://localhost:3000/arcadis/1e74f80f-5251-4158-b028-3caff2fdf0d5',
    'http://localhost:3000/arcadis/1974f4d2-3ff8-4c34-9af9-2d02027346b1',
    'http://localhost:3000/arcadis/0a0f9298-8a4c-44c1-a1d1-49dba9446fa0',
    'http://localhost:3000/arcadis/3c2a172f-c694-4010-90c5-f71db1a313b1',
    'http://localhost:3000/arcadis/e25d94ef-672c-467e-942d-d2fdc8d12b70',
    'http://localhost:3000/arcadis/1122b438-6769-4ebc-a3d8-87d5a7137cc4',
    'http://localhost:3000/arcadis/887d89ad-3a7c-41a8-bd95-3621188da39b'
  ]
}