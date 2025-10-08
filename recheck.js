// recheck.js

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

async function recheck() {
    const productName = process.argv[2];
    if (!productName) {
        console.error("Error: No product name provided to recheck.js");
        process.exit(1);
    }

    const sanitizedProductName = productName.replace(/\s+/g, '_');
    const filename = `comparison_results_${sanitizedProductName}.csv`;
    const filePath = path.join('comparison_results', filename);

    if (!fs.existsSync(filePath)) {
        console.error(`[CACHE MISS] No previous results found for "${productName}" at ${filePath}`);
        process.exit(1);
    }

    try {
        const { results, scrapedOn } = await readCsvAndGetDate(filePath);

        // Construct the output object, now including the scrapedOn date
        const output = {
            logs: [
                `✅ [CACHE HIT] Found and loaded previous results for "${productName}".`,
                `Source: ${filePath}`
            ],
            results: results,
            scrapedOn: scrapedOn // --- CHANGE: ADDED THE DATE TO THE OUTPUT ---
        };

        console.log(JSON.stringify(output, null, 2));
        process.exit(0);

    } catch (error) {
        console.error(`[CACHE ERROR] Error reading cached file ${filePath}: ${error.message}`);
        process.exit(1);
    }
}

// --- CHANGE: MODIFIED HELPER FUNCTION TO EXTRACT THE DATE ---
function readCsvAndGetDate(filePath) {
    return new Promise((resolve, reject) => {
        const results = [];
        let scrapedOn = null;

        fs.createReadStream(filePath)
            .pipe(csv({
                mapHeaders: ({ header }) => {
                    switch (header.toLowerCase()) {
                        case 'title': return 'title';
                        case 'amazon_price': return 'amazonPrice';
                        case 'flipkart_price': return 'flipkartPrice';
                        case 'cheaper_on': return 'winner';
                        case 'scraped_on': return 'scrapedOn'; // Read the new column
                        default: return null;
                    }
                },
                mapValues: ({ header, value }) => {
                    if (header === 'amazonPrice' || header === 'flipkartPrice') {
                        const num = parseFloat(value);
                        return isNaN(num) ? null : num;
                    }
                    return value;
                }
            }))
            .on('data', (data) => {
                // Since the date is the same for all rows, we only need to capture it once.
                if (data.scrapedOn && !scrapedOn) {
                    scrapedOn = data.scrapedOn;
                }
                // We don't need the date in every single result object, so we can delete it.
                delete data.scrapedOn;
                results.push(data);
            })
            .on('end', () => resolve({ results, scrapedOn }))
            .on('error', (error) => reject(error));
    });
}

// Run the main function
recheck();