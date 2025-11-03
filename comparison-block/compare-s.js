// comparison-block/compare-s.js
// This is the "Keyword" (Strict) version.
// It uses a one-sided keyword match: all input keywords must be in the product title.
// VERSION 9: Fixes the regex syntax error from V8.

// Import necessary Node.js modules
const { exec } = require('child_process');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

// ---
// --- Keyword Matching Logic ---
// ---

const STOP_WORDS = new Set([
    'a', 'an', 'and', 'the', 'in', 'on', 'for', 'of', 'with', 'to', 'is', 'it',
    'be', 'as', 'at', 'by', 'up', 'out', 'so', 'or'
]);

/**
 * Normalizes and extracts all important keywords from a string.
 * @param {string} str The string to process.
 * @returns {Set<string>} A Set of keywords.
 */
function normalizeAndExtractKeywords(str) {
    if (typeof str !== 'string') return new Set();

    let normalized = str.toLowerCase();

    // 1. Remove accents (e.g., Lakmé -> lakme)
    normalized = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // 2. Standardize all units (g, gm, gram, ml)
    normalized = normalized.replace(/(\d+)\s*(grams|gram|gm|g)\b/g, '$1g');
    normalized = normalized.replace(/(\d+)\s*(milliliters|milliliter|ml)\b/g, '$1ml');
    
    // 3. Remove all standardized units
    normalized = normalized.replace(/(\d+)(g|ml)\b/g, ' ');

    // 4. ---
    //    --- THIS IS THE FIX ---
    //    --- The previous version had /[^a-z0-9\+]/g, which is a syntax error.
    //    --- The '+' sign does NOT need to be escaped inside [].
    //    ---
    normalized = normalized.replace(/[^a-z0-9+]/g, ' ');

    // 5. Split into words, filter stop words and empty strings
    const keywords = normalized.split(/\s+/)
        .filter(word => word && !STOP_WORDS.has(word));

    return new Set(keywords);
}

/**
 * Checks if a product title contains all keywords from an input title.
 * @param {string} inputTitle The user's search query.
 * @param {string} productTitle The title from Amazon/Flipkart.
 * @returns {boolean} True if all input keywords are in the product title.
 */
function isKeywordMatch(inputTitle, productTitle) {
    const inputKeywords = normalizeAndExtractKeywords(inputTitle);
    const productKeywords = normalizeAndExtractKeywords(productTitle);

    if (inputKeywords.size === 0) return false;

    // "one-sided" check: all input keywords must be in product keywords
    for (const keyword of inputKeywords) {
        if (!productKeywords.has(keyword)) {
            // Uncomment to debug
            // if (productTitle.toLowerCase().includes('lakme')) {
            //    console.log(`!!! MISMATCH: Product is missing keyword: '${keyword}'`);
            // }
            return false; // A keyword is missing
        }
    }
    return true; // All keywords were found
}

/**
 * Parses the price string.
 * Returns a number, or a special string for non-numeric prices.
 * @param {string} priceStr 
 * @returns {number | 'OUT_OF_STOCK'}
 */
function parsePrice(priceStr) {
    if (typeof priceStr !== 'string' || priceStr.trim() === '') {
        return 'OUT_OF_STOCK';
    }
    const numbers = priceStr.replace(/[^0-9.]/g, '');
    if (numbers === '') {
        return 'OUT_OF_STOCK';
    }
    const number = parseFloat(numbers);
    return isNaN(number) ? 'OUT_OF_STOCK' : number;
}


// ---
// --- Main Script Execution ---
// ---

async function main() {
    const output = {
        logs: [],
        results: [],
        scrapedOn: new Date().toISOString()
    };
    let productName = '';

    try {
        const args = process.argv.slice(2);
        if (args.length < 1) {
            throw new Error('Please provide a product name.');
        }

        productName = args[0];
        const numPages = '1'; // Always scrape only the first page

        const sanitizedProductName = productName.replace(/\s+/g, '_');
        const amazonFile = path.join(__dirname, '..', 'amazon_results', `scraped_amazon_${sanitizedProductName}.csv`);
        const flipkartFile = path.join(__dirname, '..', 'flipkart_results', `scraped_flipkart_${sanitizedProductName}.csv`);

        output.logs.push('🚀 Starting scrapers for Amazon and Flipkart (Page 1 Only)...');

        const amazonScraperPath = path.join(__dirname, '..', 'amazon-scraper.js');
        const flipkartScraperPath = path.join(__dirname, '..', 'flipkart-scraper.js');

        const amazonCommand = `node "${amazonScraperPath}" "${productName}" ${numPages}`;
        const flipkartCommand = `node "${flipkartScraperPath}" "${productName}" ${numPages}`;

        await Promise.all([
            runScript(amazonCommand),
            runScript(flipkartCommand)
        ]);

        output.logs.push('✅ Scrapers finished. Reading result files...');

        const amazonData = await readCsv(amazonFile);
        const flipkartData = await readCsv(flipkartFile);

        output.logs.push(`📊 Found ${amazonData.length} products on Amazon and ${flipkartData.length} products on Flipkart from page 1.`);
        
        output.logs.push(`🔍 Searching for strict keyword match for: "${productName}"...`);

        // Find the *first* product that matches all keywords
        const amazonMatch = amazonData.find(product => isKeywordMatch(productName, product.title));
        const flipkartMatch = flipkartData.find(product => isKeywordMatch(productName, product.title));
        
        let amazonPrice, flipkartPrice;
        let amazonTitle, flipkartTitle, amazonLink, flipkartLink, amazonImage, flipkartImage;

        // --- Amazon Logic ---
        if (!amazonMatch) {
            amazonPrice = 'NOT_FOUND';
            amazonTitle = null;
            amazonLink = null;
            amazonImage = null;
            output.logs.push('❌ No strict match found on Amazon.');
        } else {
            amazonPrice = parsePrice(amazonMatch.price); // '123' or 'OUT_OF_STOCK'
            amazonTitle = amazonMatch.title;
            amazonLink = amazonMatch.link;
            amazonImage = amazonMatch.image_url;
            output.logs.push('✅ Strict match found on Amazon.');

            // Handle failed scrape (no link AND no price)
            if ((!amazonLink || amazonLink.trim() === '') && amazonPrice === 'OUT_OF_STOCK') {
                amazonPrice = 'NOT_FOUND';
                output.logs.push('⚠️ Amazon match had no price/link, marking as NOT_FOUND.');
            }
        }

        // --- Flipkart Logic ---
        if (!flipkartMatch) {
            flipkartPrice = 'NOT_FOUND';
            flipkartTitle = null;
            flipkartLink = null;
            flipkartImage = null;
            output.logs.push('❌ No strict match found on Flipkart.');
        } else {
            flipkartPrice = parsePrice(flipkartMatch.price); // '123' or 'OUT_OF_STOCK'
            flipkartTitle = flipkartMatch.title;
            flipkartLink = flipkartMatch.link;
            flipkartImage = flipkartMatch.image_url;
            output.logs.push('✅ Strict match found on Flipkart.');

            // Handle failed scrape (no link AND no price)
            if ((!flipkartLink || flipkartLink.trim() === '') && flipkartPrice === 'OUT_OF_STOCK') {
                flipkartPrice = 'NOT_FOUND';
                output.logs.push('⚠️ Flipkart match had no price/link, marking as NOT_FOUND.');
            }
        }

        // --- Winner Logic ---
        let winner = 'N/A';
        const aPriceNum = typeof amazonPrice === 'number';
        const fPriceNum = typeof flipkartPrice === 'number';
        
        if (fPriceNum && aPriceNum) {
            if (flipkartPrice < amazonPrice) winner = 'Flipkart';
            else if (amazonPrice < flipkartPrice) winner = 'Amazon';
            else winner = 'Same Price';
        } else if (fPriceNum) {
            winner = 'Flipkart';
        } else if (aPriceNum) {
            winner = 'Amazon';
        }
        
        // --- Output Logic ---
        output.results.push({
            title: flipkartTitle || amazonTitle || productName,
            flipkartPrice: flipkartPrice,
            amazonPrice: amazonPrice,
            winner: winner,
            flipkartLink: flipkartLink,
            amazonLink: amazonLink,
            flipkartImage: flipkartImage || amazonImage,
            amazonImage: amazonImage || flipkartImage
        });

    } catch (error) {
        output.logs.push(`❌ An error occurred: ${error.message}`);
    } finally {
        console.log(JSON.stringify(output));
    }
}

// --- Helper Functions (Unchanged) ---
function runScript(command) {
    return new Promise((resolve, reject) => {
        exec(command, { maxBuffer: 1024 * 5000 }, (error, stdout, stderr) => {
            if (error) {
                return reject(new Error(`Error: ${error.message}\nStderr: ${stderr}\nStdout: ${stdout}`));
            }
            resolve(stdout);
        });
    });
}

function readCsv(filePath) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(filePath)) {
            return resolve([]); // Not an error, just no file
        }
        const results = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => {
                const lowercasedResults = results.map(row => {
                    const newRow = {};
                    for (const key in row) {
                        newRow[key.toLowerCase()] = row[key];
                    }
                    return newRow;
                });
                resolve(lowercasedResults);
            })
            .on('error', (error) => reject(error));
    });
}

main();