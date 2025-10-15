// compare.js

// Import necessary Node.js modules
const { exec } = require('child_process');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

async function main() {
    const output = {
        logs: [],
        results: [],
        // --- CHANGE: Add a top-level timestamp ---
        scrapedOn: new Date().toISOString() 
    };
    let productName = '';

    try {
        const args = process.argv.slice(2);
        if (args.length < 2) {
            throw new Error('Please provide a product name and the number of pages.');
        }

        productName = args[0];
        const numPages = args[1];
        
        const sanitizedProductName = productName.replace(/\s+/g, '_');
        const amazonFile = path.join('amazon_results', `scraped_amazon_${sanitizedProductName}.csv`);
        const flipkartFile = path.join('flipkart_results', `scraped_flipkart_${sanitizedProductName}.csv`);
        
        output.logs.push('🚀 Starting scrapers for Amazon and Flipkart...');
        
        const amazonCommand = `node amazon-scraper.js "${productName}" ${numPages}`;
        const flipkartCommand = `node flipkart-scraper.js "${productName}" ${numPages}`;

        await Promise.all([
            runScript(amazonCommand),
            runScript(flipkartCommand)
        ]);

        output.logs.push('✅ Scrapers finished. Reading result files...');

        const amazonData = await readCsv(amazonFile);
        const flipkartData = await readCsv(flipkartFile);

        output.logs.push(`📊 Found ${amazonData.length} products on Amazon and ${flipkartData.length} products on Flipkart.`);

        let commonProductsFound = 0;
        for (const flipkartProduct of flipkartData) {
            const amazonMatch = await findMatchingProduct(flipkartProduct, amazonData);

            if (amazonMatch) {
                commonProductsFound++;
                
                const flipkartPrice = parsePrice(flipkartProduct.price);
                const amazonPrice = parsePrice(amazonMatch.price);
                let winner = 'Same Price';
                if (!isNaN(flipkartPrice) && !isNaN(amazonPrice)) {
                    if (flipkartPrice < amazonPrice) winner = 'Flipkart';
                    else if (amazonPrice < flipkartPrice) winner = 'Amazon';
                }
                
                output.results.push({
                    title: flipkartProduct.title,
                    flipkartPrice: flipkartPrice,
                    amazonPrice: amazonPrice,
                    winner: winner,
                    flipkartLink: flipkartProduct.link, // Add Flipkart's link
                    amazonLink: amazonMatch.link       // Add Amazon's link
                });
            }
        }
        
        if (commonProductsFound === 0) {
            output.logs.push("\nCouldn't find any common products between the two sites based on their titles.");
        }

    } catch (error) {
        output.logs.push(`❌ An error occurred: ${error.message}`);
    } finally {
        // This is crucial: print the final object with logs, results, AND the timestamp
        console.log(JSON.stringify(output, null, 2));
    }
}

// --- Helper Functions (No changes needed below) ---
function runScript(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) return reject(new Error(stderr));
            resolve(stdout);
        });
    });
}

// ✅ New, corrected version for compare.js
function readCsv(filePath) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(filePath)) {
            return reject(new Error(`File not found at ${filePath}. Scraper might have failed.`));
        }
        const results = [];
        fs.createReadStream(filePath)
            .pipe(csv()) // We will process headers manually, which is more reliable.
            .on('data', (data) => results.push(data))
            .on('end', () => {
                // Manually convert all keys in each row to lowercase.
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

function parsePrice(priceStr) {
    if (typeof priceStr !== 'string') return NaN;
    const number = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
    return isNaN(number) ? NaN : number;
}

async function findMatchingProduct(productToMatch, productList) {
    // This helper function intelligently extracts the brand from a title.
    const extractBrand = (title) => {
        // A larger, more comprehensive set of common brands. Using a Set is fast.
        const COMMON_BRANDS = new Set([
            'apple', 'samsung', 'google', 'oneplus', 'xiaomi', 'redmi', 'oppo', 'vivo',
            'realme', 'motorola', 'nokia', 'sony', 'lg', 'asus', 'poco', 'boat',
            'jbl', 'sennheiser', 'bose', 'hp', 'dell', 'lenovo', 'acer', 'msi',
            'noise', 'fire-boltt', 'amazfit', 'garmin', 'fitbit', 'spigen', 'anker'
        ]);
        
        const titleLower = title.toLowerCase();

        // 1. First, try to find a known brand from our list.
        for (const brand of COMMON_BRANDS) {
            if (titleLower.includes(brand)) {
                return brand;
            }
        }
        
        // 2. If no known brand is found, fall back to assuming the first word is the brand.
        const firstWord = titleLower.split(' ')[0];
        // Avoid common non-brand words like 'the', 'new', etc.
        const stopWords = new Set(['the', 'new', 'a', 'an', 'for']);
        if (firstWord && !stopWords.has(firstWord)) {
            return firstWord;
        }

        return null; // Could not determine a brand.
    };

    // --- Main Logic ---

    const Fuse = (await import('fuse.js')).default;

    // Use our helper to get the brand from the product we're trying to match.
    const productBrand = extractBrand(productToMatch.title);

    // If we can't determine a brand, we can't reliably find a match.
    if (!productBrand) {
        console.error(`Could not determine a brand for "${productToMatch.title}", skipping match.`);
        return null;
    }

    const options = {
        keys: ['title'],
        includeScore: true,
        threshold: 0.6, // We can be a bit more lenient since the brand is now required.
        ignoreLocation: true,
    };

    const fuse = new Fuse(productList, options);

    // Use Fuse.js's powerful extended search to enforce our logic:
    // The matched product's title MUST include the brand AND should be similar to the original title.
    const results = fuse.search({
        $and: [
            { title: `=${productBrand}` }, // Use exact match for the brand token
            { title: productToMatch.title }
        ]
    });

    if (results.length > 0) {
        console.error(`Match found for [${productBrand}] "${productToMatch.title}": "${results[0].item.title}" with score: ${results[0].score}`);
        return results[0].item;
    }

    return null;
}

main();