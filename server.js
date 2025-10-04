// Import necessary modules
const express = require('express');
const { exec } = require('child_process');
const path = require('path');

// Initialize the Express app
const app = express();
const PORT = 3000; // The port our server will run on

// --- Middleware ---
// This tells Express to serve the static files (HTML, CSS, JS) from the 'public' directory
app.use(express.static('public'));
// This allows Express to parse JSON formatted request bodies
app.use(express.json());

// --- API Endpoint ---
// This is the URL our front-end will send requests to
app.post('/compare', (req, res) => {
    // 1. Get product name and pages from the request body
    const { productName, numPages } = req.body;

    // 2. Basic input validation
    if (!productName || !numPages) {
        // Send a 400 Bad Request error if input is missing
        return res.status(400).send('Error: Product name and number of pages are required.');
    }

    // 3. Construct the command to run your original script
    // We wrap the product name in quotes to handle names with spaces
    const command = `node compare.js "${productName}" ${numPages}`;
    console.log(`🚀 Executing command: ${command}`);

    // 4. Run the script using Node's child_process module
    exec(command, (error, stdout, stderr) => {
        if (error) {
            // If the script exits with an error
            console.error(`Execution Error: ${stderr}`);
            // Send a 500 Internal Server Error with the error message
            return res.status(500).send(`An error occurred: ${stderr}`);
        }

        console.log(`✅ Command finished successfully.`);

        // 5. If successful, parse the script's JSON output and send it.
        try {
            const jsonData = JSON.parse(stdout);
            res.json(jsonData); // res.json() sends the object as a JSON response
        } catch (parseError) {
            console.error('JSON Parsing Error:', parseError);
            // If parsing fails, it's a server error. Send the raw output for debugging.
            res.status(500).send(`Failed to parse script output. Raw output: ${stdout}`);
        }
    });
});

// --- Start the Server ---
app.listen(PORT, () => {
    console.log(`🎉 Server is running! Open your browser at http://localhost:${PORT}`);
});