const { CheerioCrawler, RequestList, log } = require('crawlee');
const { createObjectCsvWriter } = require('csv-writer');
const fs = require('fs');
const path = require('path');
const selectors = require('./selectors.json').flipkart; // <-- CHANGE: Import selectors

// --- Helper function to save data to CSV --- (No changes here)
async function saveToCsv(data, searchTerm) {
    if (data.length === 0) {
        log.warning("No data was collected to save.");
        return;
    }
    const outputDir = 'flipkart_results';
    fs.mkdirSync(outputDir, { recursive: true });
    const filename = `scraped_flipkart_${searchTerm.replace(/\s+/g, '_')}.csv`;
    const filePath = path.join(outputDir, filename);

    const csvWriter = createObjectCsvWriter({
        path: filePath,
        header: [
            { id: 'title', title: 'TITLE' },
            { id: 'price', title: 'PRICE' },
            { id: 'link', title: 'LINK' },
        ],
        encoding: 'utf8',
    });
    try {
        await csvWriter.writeRecords(data);
        log.info(`✅ Success! Data for ${data.length} products saved to ${filePath}`);
    } catch (error) {
        log.error("Error writing to CSV:", error);
    }
}


// --- (REFACTORED) Helper to find title ---
function findTitle($) {
    let title;

    // Selector 1: h1 tag
    title = $(selectors.titleSelectors[0]).first().text().trim();
    if (title) return title;

    // Selector 2: meta tag
    title = $(selectors.titleSelectors[1]).attr('content');
    if (title) return title.trim();

    // Selector 3: title tag (as a final fallback)
    title = $(selectors.titleSelectors[2]).text().trim();
    if (title) return title;

    return null;
}

// --- (REFACTORED) Helper to find price ---
function findPrice($) {
    let price;

    // 1. Try the primary selectors from the JSON file
    price = $(selectors.priceSelectors[0]).first().text().trim();
    if (price) return price;

    price = $(selectors.priceSelectors[1]).first().text().trim();
    if (price) return price;

    price = $(selectors.priceSelectors[2]).attr('content');
    if (price) return `₹${price.trim()}`;

    // 2. (Reliable Fallback) Generic search that finds elements with a price but ignores discounts
    let priceElem = $('body').find('*').filter((_, el) => {
        const text = $(el).text();
        return /\₹[\d,]+/.test(text) && !/off/i.test(text);
    }).first();

    if (priceElem.length) {
        const matched = priceElem.text().match(/\₹[\d,]+/);
        if (matched) return matched[0].trim();
    }
    
    // 3. (Final Fallback) Check for data-attributes
    price = $('[data-price]').attr('data-price') || $('[price]').attr('price');
    if (price) return price.trim();
    
    return null;
}

// --- Main Scraper Logic ---
(async () => {
    const args = process.argv.slice(2);
    const productQuery = args[0] || 'mobile';
    const maxPages = parseInt(args[1], 10) || 3;

    const searchUrl = `https://www.flipkart.com/search?q=${encodeURIComponent(productQuery)}`;
    const requestList = await RequestList.open('flipkart-urls', [searchUrl]);
    
    const allProducts = [];
    let pagesCrawled = 0;

    log.info(`Starting crawl for "${productQuery}". Max pages: ${maxPages}`);

    const crawler = new CheerioCrawler({
        requestList,
        maxRequestsPerCrawl: 500,
        maxConcurrency: 5,
        requestHandlerTimeoutSecs: 60,

        async requestHandler({ request, $, enqueueLinks }) {
            const url = request.url;
            log.info(`Crawling: ${url}`);

            // A) If it's a SEARCH page
            if (url.includes('/search')) {
                pagesCrawled++;
                log.info(`Processing search page ${pagesCrawled}/${maxPages}...`);

                // Enqueue all product links found on this page
                await enqueueLinks({
                    selector: selectors.productLink, // <-- CHANGE
                    label: 'product',
                });

                // If we haven't reached our page limit, find and enqueue the NEXT page
                if (pagesCrawled < maxPages) {
                    const currentPageNumber = parseInt(new URL(url).searchParams.get('page'), 10) || 1;
                    const nextUrl = new URL(url);
                    nextUrl.searchParams.set('page', currentPageNumber + 1);
                    
                    log.info(`Enqueuing next search page: ${nextUrl.href}`);
                    await crawler.addRequests([nextUrl.href]);
                }
            }

            // B) If it's a PRODUCT page
            if (request.userData.label === 'product') {
                const title = findTitle($);
                const price = findPrice($);

                if (!title || !price) {
                    log.warning(`Missing title or price on ${url}, skipping.`);
                    return;
                }

                allProducts.push({
                    title,
                    price,
                    link: url,
                });
                log.info(`✅ Collected: ${title}`);
            }
        },

        async failedRequestHandler({ request }) {
            log.warning(`❌ Request failed: ${request.url}`);
        },
    });

    await crawler.run();

    log.info('Crawl finished. Saving data to CSV...');
    await saveToCsv(allProducts, productQuery);

})();