const express = require('express');
const { exec } = require('child_process');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.static('public'));
app.use(express.json());

app.post('/compare', (req, res) => {
    const { productName, numPages } = req.body;

    if (!productName || !numPages) {
        return res.status(400).json({ error: 'Product name and number of pages are required.' });
    }

    // --- NEW TWO-STEP LOGIC ---

    // Step 1: Run recheck.js to check for a cached result.
    const recheckCommand = `node recheck.js "${productName}"`;
    console.log(`[SERVER] Step 1: Checking cache with command: ${recheckCommand}`);

    exec(recheckCommand, (recheckError, recheckStdout, recheckStderr) => {
        // If recheckError is null, it means recheck.js exited with code 0 (SUCCESS).
        // This is a CACHE HIT.
        if (!recheckError) {
            console.log(`[SERVER] ✅ Cache HIT. Sending results from recheck.js.`);
            try {
                const jsonData = JSON.parse(recheckStdout);
                return res.json(jsonData);
            } catch (parseError) {
                console.error('[SERVER] Error parsing JSON from recheck.js:', parseError);
                return res.status(500).json({ error: 'Failed to parse cached data.' });
            }
        }

        // If recheckError exists, it means recheck.js exited with a non-zero code.
        // This is a CACHE MISS. Proceed to Step 2.
        console.log(`[SERVER] 🟡 Cache MISS. Proceeding to live scrape.`);
        console.log(`[SERVER] Step 2: Running live scrape with compare.js...`);

        // Step 2: Run the original compare.js script.
        const compareCommand = `node compare.js "${productName}" ${numPages}`;
        exec(compareCommand, (compareError, compareStdout, compareStderr) => {
            if (compareError) {
                console.error(`[SERVER] Error executing compare.js: ${compareStderr}`);
                return res.status(500).json({ error: `An error occurred during scraping: ${compareStderr}` });
            }

            console.log(`[SERVER] ✅ Live scrape successful. Sending results from compare.js.`);
            try {
                const jsonData = JSON.parse(compareStdout);
                return res.json(jsonData);
            } catch (parseError) {
                console.error('[SERVER] Error parsing JSON from compare.js:', parseError);
                return res.status(500).json({ error: 'Failed to parse live scrape data.' });
            }
        });
    });
});

app.listen(PORT, () => {
    console.log(`🎉 Server is running! Open your browser at http://localhost:${PORT}`);
});