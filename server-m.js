// server-m.js

const express = require('express');
// MODIFIED: Import 'spawn' instead of 'exec'
const { spawn } = require('child_process');
const { MongoClient } = require('mongodb'); // Use the MongoDB driver

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

// --- MODIFIED: Switched from exec to spawn ---
app.post('/compare', async (req, res) => {
  const { productName, numPages, forceRefresh } = req.body;
  if (!productName || !numPages) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    // 1️⃣ Check cache (no change here)
    if (!forceRefresh) {
      const cachedDoc = await collection.findOne({ query: productName });
      
      if (cachedDoc) {
        console.log(`[SERVER] ✅ Cache HIT for "${productName}".`);
        const cachedData = cachedDoc.results;
        cachedData.scrapedOn = cachedDoc.last_updated; 
        cachedData.logs.unshift(`✅ [CACHE HIT] Found previous results for "${productName}".`);
        return res.json(cachedData);
      }
    }

    console.log(`[SERVER] 🟡 Cache MISS or REFRESH for "${productName}". Running live scrape.`);

    // 2️⃣ Run scraper script using spawn
    // We use { shell: true } to allow the command to interpret quotes,
    // just like 'exec' did. This handles spaces in file paths.
    const command = `node "comparison-block/compare.js" "${productName}" ${numPages}`;
    console.log(`🚀 Spawning: ${command}`);
    
    // Use spawn instead of exec
    const child = spawn(command, { shell: true });

    let fullStdout = '';
    let fullStderr = '';

    // Listen to the stdout stream
    child.stdout.on('data', (data) => {
      fullStdout += data.toString();
    });

    // Listen to the stderr stream
    child.stderr.on('data', (data) => {
      fullStderr += data.toString();
    });

    // Handle errors in spawning the process itself
    child.on('error', (err) => {
        console.error('Failed to start child process:', err);
        return res.status(500).json({ error: `Failed to start scraper: ${err.message}` });
    });

    // Listen for the process to exit
    child.on('close', async (code) => {
      // 'code' is the exit code. 0 means success.
      if (code !== 0) {
        console.error(`Execution Error (Code ${code}):`, fullStderr);
        console.log('--- STDOUT (from error) ---');
        console.log(fullStdout); // Log what we got before it failed
        console.log('---------------------------');
        // Send the stderr, which is more likely to contain the *actual* error
        return res.status(500).json({ error: `Scraper error: ${fullStderr || 'Process exited with non-zero code.'}` });
      }

      // --- Process Succeeded (code === 0) ---
      
      let jsonData;
      try {
        // Your "parse last line" logic is perfect.
        // We just apply it to the *complete* stdout string.
        const lines = fullStdout.split('\n').filter(line => line.trim() !== '');
        const lastLine = lines.pop(); 

        if (!lastLine) {
          console.error('Scraper script gave no output.');
          return res.status(500).json({ error: 'Scraper script gave no output.' });
        }

        // 3. Parse *only* the last line
        jsonData = JSON.parse(lastLine);

      } catch (parseError) {
        console.error('JSON Parse Error:', parseError.message);
        console.log('--- FAILED STDOUT (Could not parse as JSON) ---');
        console.log(fullStdout); // This will show you exactly what the script outputted
        console.log('------------------------------------------------');
        return res.status(500).json({ error: 'Invalid JSON from scraper script' });
      }

      // 3️⃣ Store in MongoDB cache (no change here)
      try {
        await collection.updateOne(
          { query: productName },
          { 
            $set: {
              results: jsonData,
              last_updated: new Date()
            } 
          },
          { upsert: true }
        );
        console.log(`[SERVER] 💾 Scrape results for "${productName}" saved to cache.`);
        
        res.json(jsonData); // Send success response

      } catch (dbError) {
        console.error('MongoDB Caching Error:', dbError);
        // Still send the data to the user even if caching failed
        res.json(jsonData); 
      }
    });

  } catch (err) {
    console.error('Server Error:', err);
    res.status(500).json({ error: 'An internal server error occurred.' });
  }
});
// --- END OF MODIFIED BLOCK ---

app.listen(PORT, () => {
  console.log(`🎉 Server with MongoDB running at http://localhost:${PORT}`);
});