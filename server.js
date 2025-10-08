const express = require('express');
const { exec } = require('child_process');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.static('public'));
app.use(express.json());

app.post('/compare', (req, res) => {
    const { productName, numPages, forceRefresh } = req.body;

    if (!productName || !numPages) {
        return res.status(400).json({ error: 'Product name and number of pages are required.' });
    }

    // --- CHANGE: WRAP THE MAIN LOGIC IN A FUNCTION ---
    const runLiveScrape = () => {
        console.log(`[SERVER] Running live scrape with compare.js...`);
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
    };

    // --- CHANGE: CHECK FOR `forceRefresh` FLAG ---
    if (forceRefresh) {
        console.log('[SERVER] 🔵 Force refresh requested. Bypassing cache.');
        runLiveScrape();
        return; // Stop execution here
    }

    // Original logic: Check cache first
    const recheckCommand = `node recheck.js "${productName}"`;
    console.log(`[SERVER] Checking cache with command: ${recheckCommand}`);

    exec(recheckCommand, (recheckError, recheckStdout, recheckStderr) => {
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
        
        console.log(`[SERVER] 🟡 Cache MISS. Proceeding to live scrape.`);
        runLiveScrape();
    });
});

app.listen(PORT, () => {
    console.log(`🎉 Server is running! Open your browser at http://localhost:${PORT}`);
});