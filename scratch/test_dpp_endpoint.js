
const fetch = require('node-fetch');

async function test() {
    try {
        const response = await fetch('http://localhost:3000/api/assessments/dpps');
        console.log('Status:', response.status);
        const data = await response.json();
        console.log('Data:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error:', e.message);
    }
}

test();
