//comparison-block/compare.js

// Import necessary Node.js modules
const { exec } = require('child_process');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
// Import the matcher function
const { findBestMatch } = require('./matcher.js');

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

        // --- File Paths ---

        const sanitizedProductName = productName.replace(/\s+/g, '_');
        const amazonFile = path.join(__dirname, '..', 'amazon_results', `scraped_amazon_${sanitizedProductName}.csv`);
        const flipkartFile = path.join(__dirname, '..', 'flipkart_results', `scraped_flipkart_${sanitizedProductName}.csv`);

        output.logs.push('  Starting scrapers for Amazon and Flipkart...');

        // --- Script Commands ---
        
        const amazonScraperPath = path.join(__dirname, '..', 'amazon-scraper.js');
        const flipkartScraperPath = path.join(__dirname, '..', 'flipkart-scraper.js');

        const amazonCommand = `node "${amazonScraperPath}" "${productName}" ${numPages}`;
        const flipkartCommand = `node "${flipkartScraperPath}" "${productName}" ${numPages}`;

        await Promise.all([
            runScript(amazonCommand),
            runScript(flipkartCommand)
        ]);

        output.logs.push('  Scrapers finished. Reading result files...');

        const amazonData = await readCsv(amazonFile);
        const flipkartData = await readCsv(flipkartFile);

        output.logs.push(`  Found ${amazonData.length} products on Amazon and ${flipkartData.length} products on Flipkart.`);

        let commonProductsFound = 0;
        for (const flipkartProduct of flipkartData) {
            const amazonMatch = await findBestMatch(flipkartProduct, amazonData);

            if (amazonMatch) {
                commonProductsFound++;
                
                // Get the actual matched product object from the 'item' property
                const matchedAmazonProduct = amazonMatch.item; 

                const flipkartPrice = parsePrice(flipkartProduct.price);
                // Get price from the matched product object
                const amazonPrice = parsePrice(matchedAmazonProduct.price); 
                                
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
                    
                    // Get link and image_url from the matched product object
                    amazonLink: matchedAmazonProduct.link,
                    flipkartImage: flipkartProduct.image_url,
                    amazonImage: matchedAmazonProduct.image_url 
                    
                });
            }
        }

        if (commonProductsFound === 0) {
            output.logs.push("\nCouldn't find any common products between the two sites based on their titles.");
        }

    } catch (error) {
        output.logs.push(`  An error occurred: ${error.message}`);
    } finally {
        // Print the single-line JSON output for the server
        console.log(JSON.stringify(output));
    }
}

// --- Helper Functions ---
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