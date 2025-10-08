const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

async function recheck() {
    // 1. Get the product name from the command line
    const productName = process.argv[2];
    if (!productName) {
        console.error("Error: No product name provided to recheck.js");
        process.exit(1); // Exit with an error code
    }

    // 2. Construct the path to the potential cached file
    const sanitizedProductName = productName.replace(/\s+/g, '_');
    const filename = `comparison_results_${sanitizedProductName}.csv`;
    const filePath = path.join('comparison_results', filename);

    // 3. Check if the file exists
    if (!fs.existsSync(filePath)) {
        // If file NOT found, log to stderr (so it doesn't pollute stdout) and exit with an error code.
        // This signals to server.js that the cache was a "miss".
        console.error(`[CACHE MISS] No previous results found for "${productName}" at ${filePath}`);
        process.exit(1);
    }

    // 4. If the file IS found, read it and convert it to the required JSON format
    try {
        const results = await readCsv(filePath);

        // Construct the same output object structure as compare.js
        const output = {
            logs: [
                `✅ [CACHE HIT] Found and loaded previous results for "${productName}".`,
                `Source: ${filePath}`
            ],
            results: results
        };

        // Print the JSON to stdout and exit successfully.
        // This signals to server.js that the cache was a "hit".
        console.log(JSON.stringify(output, null, 2));
        process.exit(0);

    } catch (error) {
        console.error(`[CACHE ERROR] Error reading cached file ${filePath}: ${error.message}`);
        process.exit(1);
    }
}

// Helper function to read the CSV and map the headers to the correct JSON keys
function readCsv(filePath) {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
            // The CSV headers are like 'AMAZON_PRICE', but the JSON needs 'amazonPrice'.
            // This mapHeaders function converts them.
            .pipe(csv({
                mapHeaders: ({ header }) => {
                    switch (header.toLowerCase()) {
                        case 'title': return 'title';
                        case 'amazon_price': return 'amazonPrice';
                        case 'flipkart_price': return 'flipkartPrice';
                        case 'cheaper_on': return 'winner';
                        default: return null; // Ignore other columns
                    }
                },
                // The CSV stores prices as strings, let's make sure they are numbers in the JSON.
                mapValues: ({ header, value }) => {
                    if (header === 'amazonPrice' || header === 'flipkartPrice') {
                        const num = parseFloat(value);
                        return isNaN(num) ? null : num;
                    }
                    return value;
                }
            }))
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (error) => reject(error));
    });
}

// Run the main function
recheck();