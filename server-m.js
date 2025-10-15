// server-m.js

const express = require('express');
const { exec } = require('child_process');
const { MongoClient } = require('mongodb'); // Use the MongoDB driver

const app = express();
const PORT = 3000;

// --- MongoDB Connection Details ---
// This is the default connection string Compass uses
const MONGO_URL = 'mongodb://localhost:27017'; 
const DB_NAME = 'scraper_db_mongo';
const COLLECTION_NAME = 'scraper_cache';

app.use(express.static('public'));
app.use(express.json());

// --- Establish MongoDB Connection ---
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
    process.exit(1); // Exit if the database connection fails
  }
})();

// --- API Endpoint ---
app.post('/compare', async (req, res) => {
  const { productName, numPages, forceRefresh } = req.body;
  if (!productName || !numPages) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    // 1️⃣ Check cache, but only if `forceRefresh` is false
    if (!forceRefresh) {
      // Find one document where the 'query' field matches the productName
      const cachedDoc = await collection.findOne({ query: productName });
      
      if (cachedDoc) {
        console.log(`[SERVER] ✅ Cache HIT for "${productName}".`);
        const cachedData = cachedDoc.results; // Results are already a JS object
        
        // Add the timestamp from the DB to the response
        cachedData.scrapedOn = cachedDoc.last_updated; 
        cachedData.logs.unshift(`✅ [CACHE HIT] Found previous results for "${productName}".`);
        return res.json(cachedData);
      }
    }

    console.log(`[SERVER] 🟡 Cache MISS or REFRESH for "${productName}". Running live scrape.`);

    // 2️⃣ Run scraper script if no cache hit or if refresh is forced
    const command = `node compare.js "${productName}" ${numPages}`;
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
      // Use updateOne with upsert:true. This will update if a document with
      // the same 'query' exists, or insert a new one if it doesn't.
      await collection.updateOne(
        { query: productName }, // The filter to find the document
        { 
          $set: { // The fields to update or set
            results: jsonData, // Store the JSON object directly
            last_updated: new Date() // Set the timestamp
          } 
        },
        { upsert: true } // Option to insert if not found
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