const axios = require('axios');

const PROJECT = '75c36018-6961-4d79-b8ab-ba6e14256140';
const API_KEY = 'sk-NDU5MjgxNmItMmY0ZC00YWMzLTkxMWEtZTQ2YTA5ZjI3Mjg2';
const REGION = 'bcbe5a';
const AUTH_TOKEN = API_KEY;

const BASE_URL_ROOT = `https://api-${REGION}.stack.tryrelevance.com/latest`;

async function testEndpoint(method, path, body = {}, authToken) {
    const url = `${BASE_URL_ROOT}${path}`;
    console.log(`Testing ${method} ${url} with Auth: ${authToken.substring(0, 10)}... ...`);
    try {
        const response = await axios({
            method: method,
            url: url,
            headers: { 'Authorization': authToken },
            data: body
        });
        console.log(`SUCCESS: ${method} ${url}`);
        console.log('Response keys:', Object.keys(response.data));
        return { data: response.data, authToken: authToken };
    } catch (error) {
        console.log(`FAILED: ${method} ${url} - Status: ${error.response ? error.response.status : error.message}`);
        if (error.response && error.response.data) {
             // console.log('Error data:', JSON.stringify(error.response.data).substring(0, 200));
        }
        return { data: null, authToken: null };
    }
}

async function runTests() {
    const authMethods = {
        'Project:Key': `${PROJECT}:${API_KEY}`,
        'API_Key_Only': API_KEY
    };

    let result = { data: null, authToken: null };

    for (const [authName, currentAuthToken] of Object.entries(authMethods)) {
        console.log(`\n--- Trying with Authorization: ${authName} ---`);

        // Try GET /knowledge/list (based on Python SDK client.knowledge.list_knowledge())
        if (!result.data) result = await testEndpoint('GET', '/knowledge/list', {}, currentAuthToken);
        
        if (result.data) break; // If data is found, break from auth method loop
    }

    if (result.data) {
        console.log('\n--- KNOWLEDGE SETS FOUND ---');
        // The API might return an object with a 'knowledge' key or directly an array
        const list = result.data.knowledge || result.data || []; 
        if (Array.isArray(list)) {
            list.forEach(d => console.log(JSON.stringify(d)));
            
            // Try to search the first one if it exists
            if (list.length > 0) {
                 const firstId = (typeof list[0] === 'object' && list[0].id) ? list[0].id : list[0]; // Assuming 'id' is the knowledge set ID
                 console.log(`\nAttempting to retrieve knowledge from ${firstId}...`);
                 // Based on client.knowledge.retrieve_knowledge(knowledge_set="my_dataset")
                 await testEndpoint('GET', `/knowledge/${firstId}/documents`, { page_size: 5 }, result.authToken); 
            }
        } else {
            console.log('Data is not an array:', list);
        }
    } else {
        console.log('\nAll attempts failed to find knowledge sets.');
    }
}


runTests(); // This line was missing.