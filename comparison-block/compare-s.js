// comparison-block/compare-s.js

const { exec } = require('child_process');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

// --- CONFIGURATION ---
const MATCH_THRESHOLD = 0.5; // % match required

async function main() {
    const output = {
        logs: [],
        results: [],
        scrapedOn: new Date().toISOString()
    };

    try {
        const args = process.argv.slice(2);
        if (args.length < 1) {
            throw new Error('Please provide a specific product name.');
        }

        const rawQuery = args[0];
        const numPages = '1'; 

        output.logs.push(`🔍 Specific Search Strategy: "${rawQuery}"`);

        // --- 1. CLEAN QUERY FOR SCRAPERS ---
        const cleanQueryForScraping = rawQuery.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();

        const sanitizedName = cleanQueryForScraping.replace(/\s+/g, '_');
        const amazonFile = path.join(__dirname, '..', 'amazon_results', `scraped_amazon_${sanitizedName}.csv`);
        const flipkartFile = path.join(__dirname, '..', 'flipkart_results', `scraped_flipkart_${sanitizedName}.csv`);

        const amazonScript = path.join(__dirname, '..', 'amazon-scraper.js');
        const flipkartScript = path.join(__dirname, '..', 'flipkart-scraper.js');

        // --- 2. RUN SCRAPERS ---
        output.logs.push('  Spawning scrapers for Page 1...');

        await Promise.allSettled([
            runScraper(amazonScript, cleanQueryForScraping, numPages),
            runScraper(flipkartScript, cleanQueryForScraping, numPages)
        ]);

        // --- 3. READ DATA ---
        const amazonData = await readCsv(amazonFile);
        const flipkartData = await readCsv(flipkartFile);

        output.logs.push(`  Scraped: Amazon (${amazonData.length} items), Flipkart (${flipkartData.length} items).`);

        // --- 4. FIND BEST MATCHES ---
        const bestAmazon = findBestMatch(rawQuery, amazonData, 'Amazon', output.logs);
        const bestFlipkart = findBestMatch(rawQuery, flipkartData, 'Flipkart', output.logs);

        // --- 5. COMPILE RESULT ---
        const finalResult = {
            searchQuery: rawQuery,
            
            // Amazon Data
            amazonFound: !!bestAmazon,
            amazonTitle: bestAmazon ? bestAmazon.title : null,
            amazonPrice: bestAmazon ? parsePrice(bestAmazon.price) : 'NOT_FOUND',
            amazonLink: bestAmazon ? bestAmazon.link : null,
            amazonImage: bestAmazon ? bestAmazon.image_url : null,
            amazonMatchScore: bestAmazon ? `${(bestAmazon.score * 100).toFixed(0)}%` : '0%',

            // Flipkart Data
            flipkartFound: !!bestFlipkart,
            flipkartTitle: bestFlipkart ? bestFlipkart.title : null,
            flipkartPrice: bestFlipkart ? parsePrice(bestFlipkart.price) : 'NOT_FOUND',
            flipkartLink: bestFlipkart ? bestFlipkart.link : null,
            flipkartImage: bestFlipkart ? bestFlipkart.image_url : null,
            flipkartMatchScore: bestFlipkart ? `${(bestFlipkart.score * 100).toFixed(0)}%` : '0%',

            winner: 'N/A'
        };

        // --- 6. DETERMINE WINNER ---
        const aPrice = finalResult.amazonPrice;
        const fPrice = finalResult.flipkartPrice;
        const aValid = typeof aPrice === 'number';
        const fValid = typeof fPrice === 'number';

        if (aValid && fValid) {
            if (aPrice < fPrice) finalResult.winner = 'Amazon';
            else if (fPrice < aPrice) finalResult.winner = 'Flipkart';
            else finalResult.winner = 'Draw';
        } else if (aValid) {
            finalResult.winner = 'Amazon';
        } else if (fValid) {
            finalResult.winner = 'Flipkart';
        }

        output.results.push(finalResult);

    } catch (error) {
        output.logs.push(`  Critical Error: ${error.message}`);
    } finally {
        // --- FIX: Single line stringify for server-m.js compatibility ---
        console.log(JSON.stringify(output));
    }
}

// --- CORE MATCHING LOGIC ---

function findBestMatch(userQuery, productList, platformName, logs) {
    if (!productList || productList.length === 0) return null;

    let bestItem = null;
    let maxScore = 0;

    const queryTokens = tokenize(userQuery); 

    productList.forEach(product => {
        if (!product.title) return;
        const productTokens = tokenize(product.title);
        const score = calculateOverlap(queryTokens, productTokens);

        if (score > maxScore) {
            maxScore = score;
            bestItem = product;
        }
    });

    if (bestItem) {
        logs.push(`  [${platformName}] Best Match: "${bestItem.title.substring(0, 40)}..." (Score: ${(maxScore*100).toFixed(0)}%)`);
    } else {
        logs.push(`  [${platformName}] No products found in CSV.`);
    }

    if (maxScore >= MATCH_THRESHOLD) {
        return { ...bestItem, score: maxScore };
    }
    
    logs.push(`  [${platformName}] Match score (${(maxScore*100).toFixed(0)}%) below threshold.`);
    return null;
}

function tokenize(str) {
    if (!str) return [];
    return str
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
        .replace(/[^a-z0-9\s]/g, '') 
        .split(/\s+/) 
        .filter(w => w.length > 0); 
}

function calculateOverlap(queryTokens, titleTokens) {
    if (queryTokens.length === 0) return 0;
    const titleSet = new Set(titleTokens);
    let matchCount = 0;
    queryTokens.forEach(token => {
        if (titleSet.has(token)) matchCount++;
    });
    return matchCount / queryTokens.length;
}

// --- HELPER FUNCTIONS ---

function parsePrice(priceStr) {
    if (!priceStr) return 'NOT_FOUND';
    const clean = String(priceStr).replace(/[^0-9.]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? 'NOT_FOUND' : num;
}

function runScraper(scriptPath, query, pages) {
    return new Promise((resolve) => {
        const command = `node "${scriptPath}" "${query}" ${pages}`;
        exec(command, { maxBuffer: 1024 * 5000 }, (error, stdout, stderr) => {
            if (error) {
                resolve(null); 
            } else {
                resolve(stdout);
            }
        });
    });
}

function readCsv(filePath) {
    return new Promise((resolve) => {
        if (!fs.existsSync(filePath)) return resolve([]);
        const results = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => {
                const normalized = results.map(row => {
                    const newRow = {};
                    Object.keys(row).forEach(k => newRow[k.toLowerCase()] = row[k]);
                    return newRow;
                });
                resolve(normalized);
            })
            .on('error', () => resolve([]));
    });
}

main();