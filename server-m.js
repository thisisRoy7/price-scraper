// server-m.js

const express = require('express');
const { spawn } = require('child_process');
const { MongoClient } = require('mongodb');
const path = require('path'); 

const app = express();
const PORT = 3000;

// CONNECTION SETTINGS
const MONGO_URL = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'scraper_db_mongo';
const COLLECTION_NAME = 'scraper_cache';

app.use(express.static('public'));
app.use(express.json());

let db = null;
let collection = null;

// --- Database Connection (Fail-Safe) ---
(async () => {
    try {
        const client = await MongoClient.connect(MONGO_URL, { serverSelectionTimeoutMS: 2000 });
        db = client.db(DB_NAME);
        collection = db.collection(COLLECTION_NAME);
        console.log(`Connected to MongoDB at ${MONGO_URL}`);
    } catch (err) {
        console.log('WARNING: MongoDB connection failed or MongoDB is not installed.');
        console.log('The application will run in "No-Cache Mode".');
    }
})();

app.post('/compare', async (req, res) => {
    const { productName, numPages, forceRefresh, searchType = 'general' } = req.body;
    
    if (!productName || !numPages) {
        return res.status(400).json({ error: 'Missing parameters' });
    }
    
    const safeProductName = productName.trim().toLowerCase().replace(/\s+/g, '-');
    const cacheKey = `${safeProductName}__${searchType}`;

    try {
        // 1️⃣ Check cache (Only if DB is connected)
        if (collection && !forceRefresh) {
            try {
                const cachedDoc = await collection.findOne({ query: cacheKey });
                if (cachedDoc) {
                    console.log(`[SERVER] Cache HIT for "${cacheKey}".`);
                    const cachedData = cachedDoc.results;
                    cachedData.scrapedOn = cachedDoc.last_updated;
                    cachedData.logs.unshift(` [CACHE HIT] Found previous results for "${productName}" (${searchType}).`);
                    return res.json(cachedData);
                }
            } catch (cacheErr) {
                console.error("Cache read error (ignoring):", cacheErr.message);
            }
        }

        console.log(`[SERVER]  Cache MISS or REFRESH for "${cacheKey}". Running live scrape.`);

        // 2️⃣ Run scraper script using spawn
        const scriptToRun = searchType === 'specific' 
            ? 'compare-s.js' 
            : 'compare.js';

        // Robust path handling
        const scriptPath = path.join(__dirname, 'comparison-block', scriptToRun);
        const nodeExecutable = process.execPath;

        // NOTE: We still pass the ORIGINAL 'productName' (with spaces) to the scraper
        // so it types the correct thing into the Amazon search bar.
        const command = `"${nodeExecutable}" "${scriptPath}" "${productName}" ${numPages}`;
        
        console.log(`  Spawning: ${command}`);

        const child = spawn(command, { shell: true, windowsHide: true });

        let fullStdout = '';
        let fullStderr = '';

        child.stdout.on('data', (data) => { fullStdout += data.toString(); });
        child.stderr.on('data', (data) => { fullStderr += data.toString(); });

        child.on('error', (err) => {
            console.error('Failed to start child process:', err);
            return res.status(500).json({ error: `Failed to start scraper: ${err.message}` });
        });

        child.on('close', async (code) => {
            if (code !== 0) {
                console.error(`Execution Error (Code ${code}):`, fullStderr);
                console.log('--- STDOUT (from error) ---');
                console.log(fullStdout);
                return res.status(500).json({ error: `Scraper error: ${fullStderr || 'Process exited with non-zero code.'}` });
            }

            let jsonData;
            try {
                const lines = fullStdout.split('\n').filter(line => line.trim() !== '');
                const lastLine = lines.pop();
                if (!lastLine) throw new Error('No output');
                jsonData = JSON.parse(lastLine);
            } catch (parseError) {
                console.error('JSON Parse Error:', parseError.message);
                console.log(fullStdout);
                return res.status(500).json({ error: 'Invalid JSON from scraper script' });
            }

            // 3️⃣ Store in MongoDB cache (using the NEW safer cacheKey)
            if (collection) {
                try {
                    await collection.updateOne(
                        { query: cacheKey },
                        {
                            $set: {
                                results: jsonData,
                                last_updated: new Date()
                            }
                        },
                        { upsert: true }
                    );
                    console.log(`[SERVER] Scrape results for "${cacheKey}" saved to cache.`);
                } catch (dbError) {
                    console.error('MongoDB Caching Error:', dbError.message);
                }
            }

            res.json(jsonData);
        });

    } catch (err) {
        console.error('Server Error:', err);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

app.listen(PORT, () => {
    console.log(` Server running at http://localhost:${PORT}`);
});