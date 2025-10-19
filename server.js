// server.js

const express = require('express');
const { exec } = require('child_process');
const mysql = require('mysql2/promise');

const app = express();
const PORT = 3000;

app.use(express.static('public'));
app.use(express.json());

let db;
(async () => {
  try {
    db = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'BlueTiger!82Wave', // ⚠️ Remember to set your password!
      database: 'scraper_db'
    });
    console.log('✅ Connected to MySQL');
  } catch (err) {
    console.error('❌ MySQL connection failed:', err);
  }
})();

app.post('/compare', async (req, res) => {
  const { productName, numPages, forceRefresh } = req.body;
  if (!productName || !numPages) return res.status(400).json({ error: 'Missing parameters' });

  try {
    // 1️⃣ Check cache, but only if `forceRefresh` is false
    if (!forceRefresh) {
      const [rows] = await db.execute(
        'SELECT results, last_updated FROM scraper_cache WHERE query = ?', 
        [productName]
      );
      
      if (rows.length > 0) {
        console.log(`[SERVER] ✅ Cache HIT for "${productName}".`);
        const cachedData = rows[0].results;
        cachedData.scrapedOn = rows[0].last_updated; 
        cachedData.logs.unshift(`✅ [CACHE HIT] Found previous results for "${productName}".`);
        return res.json(cachedData);
      }
    }

    console.log(`[SERVER] 🟡 Cache MISS or REFRESH for "${productName}". Running live scrape.`);

    // 2️⃣ Run scraper script
    // ---
    // --- CHANGE: Updated path to point inside "comparison-block" ---
    // ---
    // Using quotes to handle the space in the folder name
    const command = `node "comparison-block/compare.js" "${productName}" ${numPages}`;
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

      // 3️⃣ Store in cache
      await db.execute(
        `INSERT INTO scraper_cache (query, results) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE results = VALUES(results), last_updated = CURRENT_TIMESTAMP`,
        [productName, JSON.stringify(jsonData)]
      );
      console.log(`[SERVER] 💾 Scrape results for "${productName}" saved to cache.`);

      res.json(jsonData);
    });

  } catch (err) {
    console.error('Server Error:', err);
    res.status(500).json({ error: 'An internal server error occurred.' });
  }
});

// ... (rest of your /cache endpoints) ...

app.listen(PORT, () => {
  console.log(`🎉 Server running at http://localhost:${PORT}`);
});