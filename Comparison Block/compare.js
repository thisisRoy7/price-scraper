// Comparison Block/compare.js

// Import necessary Node.js modules
const { exec } = require('child_process');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
// Import the matcher function
const { findMatchingProduct } = require('./matcher.js');

async function main() {
    const output = {
        logs: [],
        results: [],
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
        
        // ---
        // --- THIS IS THE CHANGE ---
        // --- Paths now go UP one level ('..') from "Comparison Block"
        // ---
        const sanitizedProductName = productName.replace(/\s+/g, '_');
        const amazonFile = path.join('..', 'amazon_results', `scraped_amazon_${sanitizedProductName}.csv`);
        const flipkartFile = path.join('..', 'flipkart_results', `scraped_flipkart_${sanitizedProductName}.csv`);
        
        output.logs.push('🚀 Starting scrapers for Amazon and Flipkart...');
        
        // Paths to scrapers also go UP one level
        const amazonCommand = `node ../amazon-scraper.js "${productName}" ${numPages}`;
        const flipkartCommand = `node ../flipkart-scraper.js "${productName}" ${numPages}`;

        await Promise.all([
            runScript(amazonCommand),
            runScript(flipkartCommand)
        ]);

        output.logs.push('✅ Scrapers finished. Reading result files...');

        // ---
        // --- These lines now use the corrected paths defined above ---
        // ---
        const amazonData = await readCsv(amazonFile);
        const flipkartData = await readCsv(flipkartFile);

        output.logs.push(`📊 Found ${amazonData.length} products on Amazon and ${flipkartData.length} products on Flipkart.`);

        let commonProductsFound = 0;
        for (const flipkartProduct of flipkartData) {
            // Use the imported function
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
                    flipkartLink: flipkartProduct.link,
                    amazonLink: amazonMatch.link 
                });
            }
        }
        
        if (commonProductsFound === 0) {
            output.logs.push("\nCouldn't find any common products between the two sites based on their titles.");
        }

    } catch (error) {
        output.logs.push(`❌ An error occurred: ${error.message}`);
    } finally {
        console.log(JSON.stringify(output, null, 2));
    }
}

// --- Helper Functions ---
function runScript(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) return reject(new Error(stderr));
            resolve(stdout);
        });
    });
}

function readCsv(filePath) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(filePath)) {
            // This error message is now very helpful for debugging path issues
            return reject(new Error(`File not found at ${filePath}. Scraper might have failed.`));
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

function parsePrice(priceStr) {
    if (typeof priceStr !== 'string') return NaN;
    const number = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
    return isNaN(number) ? NaN : number;
}

main();