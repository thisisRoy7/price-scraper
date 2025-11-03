// server-m.js

const express = require('express');
const { spawn } = require('child_process');
const { MongoClient } = require('mongodb'); 

const app = express();
const PORT = 3000;

const MONGO_URL = 'mongodb://localhost:27017'; 
const DB_NAME = 'scraper_db_mongo';
const COLLECTION_NAME = 'scraper_cache';

app.use(express.static('public'));
app.use(express.json());

let db;
let collection;
(async () => {
    try {
        const client = await MongoClient.connect(MONGO_URL);
        db = client.db(DB_NAME);
        collection = db.collection(COLLECTION_NAME);
        console.log(`✅ Connected to MongoDB at ${MONGO_URL}`);
    } catch (err) {
        console.error('❌ MongoDB connection failed:', err);
        process.exit(1);
    }
})();

app.post('/compare', async (req, res) => {
    // MODIFIED: Destructure searchType, defaulting to 'general'
    const { productName, numPages, forceRefresh, searchType = 'general' } = req.body;
    if (!productName || !numPages) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    // MODIFIED: Create a composite cache key
    const cacheKey = `${productName}_${searchType}`;

    try {
        // 1️⃣ Check cache
        if (!forceRefresh) {
            // MODIFIED: Use the composite cacheKey
            const cachedDoc = await collection.findOne({ query: cacheKey });
            
            if (cachedDoc) {
                // MODIFIED: Update log message
                console.log(`[SERVER] ✅ Cache HIT for "${cacheKey}".`);
                const cachedData = cachedDoc.results;
                cachedData.scrapedOn = cachedDoc.last_updated; 
                cachedData.logs.unshift(`✅ [CACHE HIT] Found previous results for "${productName}" (${searchType}).`);
                return res.json(cachedData);
            }
        }

        // MODIFIED: Update log message
        console.log(`[SERVER] 🟡 Cache MISS or REFRESH for "${cacheKey}". Running live scrape.`);

        // 2️⃣ Run scraper script using spawn

        // MODIFIED: Choose script based on searchType
        const scriptToRun = searchType === 'specific' 
            ? 'compare-s.js' 
            : 'compare.js';

        // MODIFIED: Use the scriptToRun variable
        const command = `node "comparison-block/${scriptToRun}" "${productName}" ${numPages}`;
        console.log(`🚀 Spawning: ${command}`);
        
        const child = spawn(command, { shell: true });

        let fullStdout = '';
        let fullStderr = '';

        child.stdout.on('data', (data) => {
            fullStdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            fullStderr += data.toString();
        });

        child.on('error', (err) => {
            console.error('Failed to start child process:', err);
            return res.status(500).json({ error: `Failed to start scraper: ${err.message}` });
        });

        child.on('close', async (code) => {
            if (code !== 0) {
                console.error(`Execution Error (Code ${code}):`, fullStderr);
                console.log('--- STDOUT (from error) ---');
                console.log(fullStdout); 
                console.log('---------------------------');
                return res.status(500).json({ error: `Scraper error: ${fullStderr || 'Process exited with non-zero code.'}` });
            }

            let jsonData;
            try {
                const lines = fullStdout.split('\n').filter(line => line.trim() !== '');
                const lastLine = lines.pop(); 

                if (!lastLine) {
                    console.error('Scraper script gave no output.');
                    return res.status(500).json({ error: 'Scraper script gave no output.' });
                }

                jsonData = JSON.parse(lastLine);

            } catch (parseError) {
                console.error('JSON Parse Error:', parseError.message);
                console.log('--- FAILED STDOUT (Could not parse as JSON) ---');
                console.log(fullStdout);
                console.log('------------------------------------------------');
                return res.status(500).json({ error: 'Invalid JSON from scraper script' });
            }

            // 3️⃣ Store in MongoDB cache
            try {
                await collection.updateOne(
                    // MODIFIED: Use composite cacheKey
                    { query: cacheKey },
                    { 
                        $set: {
                            results: jsonData,
                            last_updated: new Date()
                        } 
                    },
                    { upsert: true }
                );
                // MODIFIED: Update log message
                console.log(`[SERVER] 💾 Scrape results for "${cacheKey}" saved to cache.`);
                
                res.json(jsonData); 

            } catch (dbError) {
                console.error('MongoDB Caching Error:', dbError);
                res.json(jsonData); 
            }
        });

    } catch (err) {
        console.error('Server Error:', err);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

app.listen(PORT, () => {
    console.log(`🎉 Server with MongoDB running at http://localhost:${PORT}`);
});