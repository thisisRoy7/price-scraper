// server-m.js

const express = require('express');
const { exec } = require('child_process');
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

app.post('/compare', async (req, res) => {
  const { productName, numPages, forceRefresh } = req.body;
  if (!productName || !numPages) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    // 1️⃣ Check cache, but only if `forceRefresh` is false
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

    // 2️⃣ Run scraper script if no cache hit or if refresh is forced
    // ---
    // --- CHANGE: Updated path to point inside "Comparison Block" ---
    // ---
    // Using quotes to handle the space in the folder name
    const command = `node "Comparison Block/compare.js" "${productName}" ${numPages}`;
    console.log(`🚀 Running: ${command}`);

    exec(command, async (error, stdout, stderr) => {
      if (error) {
        console.error('Execution Error:', stderr);
        return res.status(500).json({ error: `Scraper error: ${stderr}` });
      }

      let jsonData;
      try {
        jsonData = JSON.parse(stdout);
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError, stdout);
        return res.status(500).json({ error: 'Invalid JSON from scraper script' });
      }

      // 3️⃣ Store in MongoDB cache
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

      res.json(jsonData);
    });

  } catch (err) {
    console.error('Server Error:', err);
    res.status(500).json({ error: 'An internal server error occurred.' });
  }
});

app.listen(PORT, () => {
  console.log(`🎉 Server with MongoDB running at http://localhost:${PORT}`);
});