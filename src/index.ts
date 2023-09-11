import NodeCache from "node-cache"
import { checkDatasetExistence, queryFuseki } from "./functions"
import { QueryEngine } from "@comunica/query-sparql"
import jws from "jws"
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
  if (!query) {
    res.status(400).send("Query parameter is missing")
    return
  }

  let allAllowed: string[] = []
  for (const token of tokens ) {

    const {valid, payload} = await verify(token)
    if (!valid) { 
      res.status(400).send("Token is not valid")
      return
    }
    
    allAllowed= [...allAllowed, ...payload.allowed]
  }

  const allSources: any = myCache.get("sources") 

  const sources = allAllowed.filter(i => allSources.includes(i))
  const results: any = await doQuery(query, sources)
  res.status(200).send(JSON.parse(results))
}


async function doQuery(query, sources) {
  const result = await queryEngine.query(query, { sources })
  const { data } = await queryEngine.resultToString(result,'application/sparql-results+json')
  const results = await streamToString(data)
  return results
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
  const datasetId = process.env.PROJECT_DATASET!

  // get project endpoints
  const endpoints = await getConSolidProjectByIdLTBQ()

  // get all RDF resources in all endpoints
  const allResources = await getAllResources(endpoints)

  myCache.set("sources", Array.from(allResources))
  console.log(`Server listening at http://localhost:${port}`);
})

async function getAllResourcesAsync(endpoints) {
  const { authFetch, bearer } = await generateFetch(process.env.EMAIL, process.env.PASSWORD, process.env.IDP)

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

async function getAllResources(endpoints) {
  return ['http://localhost:3000/owner-duplex/614ce4e7-ddd1-4de7-a13e-ad16880ba013',
    'http://localhost:3000/architect-duplex/8ae668de-561f-4747-9470-b28de122e7e3',
    'http://localhost:3000/architect-duplex/a25e5164-a1ff-46d1-905c-b169a4517f2f',
    'http://localhost:3000/architect-duplex/f7429b75-79b9-488a-911f-df29139b81e6',
    'http://localhost:3000/fm-duplex/c0b2d7be-6669-46d4-b090-a879e8f18e48',
    'http://localhost:3000/fm-duplex/d22594b6-38d2-4a89-87fa-dd161c669f33',
    'http://localhost:3000/engineer-duplex/081acb08-f6cc-4198-98c1-79a9d5e030b4',
    'http://localhost:3000/engineer-duplex/bb6c6a2c-115f-4713-ae89-bf49301c1c33',
    'http://localhost:3000/engineer-duplex/c5628022-50b0-491b-ab75-0c4cd5da2992']
}