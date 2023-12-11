# ConSolid RDF Aggregator

This ExpressJS server application is designed to load RDF resources in a federated [ConSolid](https://content.iospress.com/articles/semantic-web/sw233396) multi-model and enables querying them as if they were centralised. The application uses Node.js, ExpressJS, and Comunica for SPARQL query processing.

## Getting Started

This guide will walk you through setting up and running the server.

### Prerequisites

- Node.js and npm installed.

### Installation
Clone the repository and install dependencies:

```bash
git clone [repository_url]
cd [repository_directory]
npm install
```

### Setting the environment variables
The following environment variables are required: `CATALOGUE`, `PORT`, `EMAIL`, `PASSWORD`, `IDP`. The default .env file is located in the "/config" folder. In ConSolid, the Catalogue provides the starting point for discovering all resources in the federated project. It is an instance of dcat:Catalog and cs:Project. 

### Running the server
To start the server, run the following command:

```bash
npm run start
```

The server will run on http://localhost:[PORT] as defined in your environment variables. Before querying the project is possible, the server needs to load the resources from the Catalogue. This is done automatically when startup is initiated, but may take some time depending on the size of the project. When the server is ready, the following message will be displayed in the console:

```Server listening at http://localhost:[PORT]```

## Usage: SPARQL query endpoint
* description: SPARQL query endpoint for the federated project
* endpoint: "/sparql"
* method: POST	
* content-type: application/json
* body: JSON object with the following properties:
    * query: SPARQL query string
    * tokens: tokens that contain proof that the user is authenticated and authorized to access specific resources. These tokens can be obtained using the C[onSolid API](https://github.com/ConSolidProject/consolid-api)

### Notes
This is a prototype implementation of the ConSolid RDF Aggregator. It is not intended for production use. Live synchronisation with remote resources is not included, but will be added in future versions.
