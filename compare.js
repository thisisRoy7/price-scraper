// Import necessary Node.js modules
const { exec } = require('child_process'); // To run other scripts
const fs = require('fs'); // To interact with the file system
const csv = require('csv-parser'); // To parse CSV files

// --- Main Function ---
async function main() {
    // 1. GET USER INPUT from command line
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.error('❌ Error: Please provide a product name and the number of pages.');
        console.log('Usage: node compare.js "product name" pages');
        console.log('Example: node compare.js "iphone 15 pro" 2');
        return; // Exit if input is invalid
    }

    const productName = args[0];
    const numPages = args[1];
    
    // Define file paths based on your naming convention
    const sanitizedProductName = productName.replace(/\s+/g, '_');
    const amazonFile = `scraped_amazon_${sanitizedProductName}.csv`;
    const flipkartFile = `scraped_flipkart_${sanitizedProductName}.csv`;

    try {
        // 2. RUN THE SCRAPER SCRIPTS IN PARALLEL
        console.log('🚀 Starting scrapers for Amazon and Flipkart...');
        
        const amazonCommand = `node amazon-scraper.js "${productName}" ${numPages}`;
        const flipkartCommand = `node flipkart-scraper.js "${productName}" ${numPages}`;

        await Promise.all([
            runScript(amazonCommand),
            runScript(flipkartCommand)
        ]);

        console.log('✅ Scrapers finished. Reading result files...');

        // 3. READ THE GENERATED CSV FILES
        const amazonData = await readCsv(amazonFile);
        const flipkartData = await readCsv(flipkartFile);

        console.log(`📊 Found ${amazonData.length} products on Amazon and ${flipkartData.length} products on Flipkart.`);
        console.log('\n--- PRICE COMPARISON ---');

        // 4. COMPARE THE DATA
        let commonProductsFound = 0;
        for (const flipkartProduct of flipkartData) {
            // For each Flipkart product, try to find a matching one on Amazon
            const amazonMatch = findMatchingProduct(flipkartProduct, amazonData);

            if (amazonMatch) {
                commonProductsFound++;
                
                // Clean and convert prices to numbers for comparison
                const flipkartPrice = parsePrice(flipkartProduct.price);
                const amazonPrice = parsePrice(amazonMatch.price);

                console.log(`\n🔵 Product: ${flipkartProduct.title}`);
                
                // Compare the numeric prices and log the result
                if (flipkartPrice < amazonPrice) {
                    console.log(`   ✅ Cheaper on Flipkart: ₹${flipkartPrice} (vs. Amazon: ₹${amazonPrice})`);
                } else if (amazonPrice < flipkartPrice) {
                    console.log(`   ✅ Cheaper on Amazon: ₹${amazonPrice} (vs. Flipkart: ₹${flipkartPrice})`);
                } else {
                    console.log(`   🤝 Same Price on both sites: ₹${amazonPrice}`);
                }
            }
        }
        
        if(commonProductsFound === 0) {
            console.log("\nCouldn't find any common products between the two sites based on their titles.");
        }

    } catch (error) {
        console.error('An error occurred during the process:', error);
    }
}

// --- Helper Functions ---

/**
 * Runs a shell command (like your node scrapers) and returns a promise.
 * @param {string} command - The command to execute.
 */
function runScript(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing command: ${command}`, stderr);
                return reject(error);
            }
            resolve(stdout);
        });
    });
}

/**
 * Reads and parses a CSV file into an array of objects.
 * @param {string} filePath - The path to the CSV file.
 */
function readCsv(filePath) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(filePath)) {
            return reject(`Error: File not found at ${filePath}`);
        }
        const results = [];
        fs.createReadStream(filePath)
            // 👇 THIS IS THE ONLY LINE THAT CHANGED
            .pipe(csv({ mapHeaders: ({ header }) => header.toLowerCase() }))
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (error) => reject(error));
    });
}

/**
 * Parses a price string (e.g., "₹58,999") into a number (58999).
 * @param {string} priceStr - The price string from the CSV.
 */
function parsePrice(priceStr) {
    if (typeof priceStr !== 'string') return 0;
    return parseFloat(priceStr.replace(/[^0-9.]/g, ''));
}

/**
 * A more flexible function that finds a matching product by calculating a "match score".
 * It ignores common words and checks if a high percentage of important keywords match.
 * @param {object} productToMatch - The product we are looking for (from Flipkart).
 * @param {Array<object>} productList - The list of products to search within (from Amazon).
 */
function findMatchingProduct(productToMatch, productList) {
    // Expanded list of words to ignore.
    const stopWords = new Set([
        'a', 'an', 'the', 'in', 'on', 'with', 'for', 'of', 'by', 'at',
        'is', 'are', 'was', 'were', 'and', 'or', 'but', 'if', 'new', 'edition',
        'gb', 'ram', 'storage', 'snapdragon', 'ai', 'camera', 'with', 'gen'
    ]);

    // Generate keywords from the Flipkart title.
    const keywords = productToMatch.title
        .toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove punctuation.
        .split(/\s+/) // Split into words.
        .filter(word => word && !stopWords.has(word)); // Remove empty strings and stop words.

    if (keywords.length === 0) {
        return null;
    }

    // Find the best match in the Amazon list.
    let bestMatch = null;
    let highestScore = 0;

    for (const product of productList) {
        const otherTitle = product.title.toLowerCase();
        let matchCount = 0;

        // Count how many keywords are present in the Amazon title.
        for (const keyword of keywords) {
            if (otherTitle.includes(keyword)) {
                matchCount++;
            }
        }

        // Calculate the match score as a percentage.
        const score = matchCount / keywords.length;

        // If this product has a higher score than any we've seen before, it's our new best match.
        if (score > highestScore) {
            highestScore = score;
            bestMatch = product;
        }
    }

    // Only return a match if the score is above a certain threshold (e.g., 75%).
    // This prevents matching "Samsung Galaxy S24" with a screen protector.
    if (highestScore > 0.75) {
        return bestMatch;
    }

    return null; // No sufficiently good match found.
}


// --- Run the main function ---
main();