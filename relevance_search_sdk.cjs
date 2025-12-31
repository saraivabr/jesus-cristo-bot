const { Client } = require('@relevanceai/sdk');

const PROJECT = '75c36018-6961-4d79-b8ab-ba6e14256140';
const API_KEY = 'sk-NDU5MjgxNmItMmY0ZC00YWMzLTkxMmYtZTQ2YTA5ZjI3Mjg2';
const REGION = 'bcbe5a';

(async () => {
    try {
        const client = new Client({
            project: PROJECT,
            api_key: API_KEY,
            region: REGION
        });
        
        console.log("Client created.");
        
        // Try to find a method to list datasets. 
        // Common names: listDatasets, datasets.list
        // Let's just print keys of client to see structure.
        console.log("Client baseURL:", client.baseURL);
        
        // If there is a 'datasets' property, check its keys
        if (client.datasets) {
            console.log("client.datasets keys:", Object.keys(client.datasets));
        }

        // Try to list datasets if method exists
        if (client.listDatasets) {
            const datasets = await client.listDatasets();
            console.log("Datasets found via listDatasets:", datasets);
        } else if (client.datasets && client.datasets.list) {
            const datasets = await client.datasets.list();
            console.log("Datasets found via client.datasets.list:", datasets);
        }

    } catch (e) {
        console.error("Error:", e);
    }
})();
