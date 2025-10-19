//flipkart-scraper.js

const { CheerioCrawler, RequestList, log } = require('crawlee');
const { createObjectCsvWriter } = require('csv-writer');
const fs = require('fs');
const path = require('path');
const selectors = require('./selectors.json').flipkart; // <-- Already reads from JSON

// --- Helper function to save data to CSV ---
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
            { id: 'image', title: 'IMAGE_URL' },
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


// --- Helper to find title ---
function findTitle($) {
    let title;
    for (const selector of selectors.titleSelectors) {
        if (selector.startsWith('meta')) {
            title = $(selector).attr('content');
        } else {
            title = $(selector).first().text().trim();
        }
        if (title) return title.trim();
    }
    return null;
}

// --- Helper to find price ---
function findPrice($) {
    let price;
    for (const selector of selectors.priceSelectors) {
        if (selector.startsWith('meta')) {
            price = $(selector).attr('content');
            if (price) return `₹${price.trim()}`;
        } else {
            price = $(selector).first().text().trim();
        }
        if (price) return price;
    }
    
    // Fallback logic (remains useful)
    let priceElem = $('body').find('*').filter((_, el) => {
        const text = $(el).text();
        return /\₹[\d,]+/.test(text) && !/off/i.test(text);
    }).first();

    if (priceElem.length) {
        const matched = priceElem.text().match(/\₹[\d,]+/);
        if (matched) return matched[0].trim();
    }
    
    return null;
}

// --- Helper to find image ---
function findImage($) {
    let image;
    if (!selectors.imageSelectors) {
        log.warning("`imageSelectors` not found in selectors.json. Skipping image scrape.");
        return 'N/A';
    }

    for (const selector of selectors.imageSelectors) {
        if (selector.startsWith('meta')) {
            image = $(selector).attr('content');
        } else {
            image = $(selector).first().attr('src');
        }
        if (image) return image.trim();
    }
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
                
                // --- UPDATED: Manually check for sponsored links ---
                log.info('Manually filtering for non-sponsored product links...');
                const linksToEnqueue = [];
                const baseUrl = new URL(url).origin;

                // Use the selector for the link provided in selectors.json
                $(selectors.productLink).each((index, el) => {
                    const linkElement = $(el);
                    
                    // Find the closest common ancestor that represents a product card.
                    // Flipkart's structure is volatile. We check a few common ones.
                    const productCard = linkElement.closest('._1AtVbE') || linkElement.closest('._4ddWXP') || linkElement.closest('div[data-id]');
                    
                    let isSponsored = false;
                    if (productCard.length > 0) {
                        // Check for the specific "Sponsored" tag class
                        const sponsoredTag = productCard.find('._3Sdu8D'); 
                        if (sponsoredTag.length > 0) {
                            isSponsored = true;
                        }
                    }

                    // If no sponsored tag was found, add the link
                    if (!isSponsored) {
                        const href = linkElement.attr('href');
                        if (href) {
                            const absoluteUrl = new URL(href, baseUrl).href;
                            linksToEnqueue.push({ url: absoluteUrl, userData: { label: 'product' } });
                        }
                    } else {
                        log.debug(`Skipping sponsored link: ${linkElement.attr('href')}`);
                    }
                });

                // Add all valid, non-sponsored links to the queue
                if (linksToEnqueue.length > 0) {
                    log.info(`Enqueuing ${linksToEnqueue.length} non-sponsored product links.`);
                    await crawler.addRequests(linksToEnqueue);
                } else {
                    log.info('No non-sponsored product links found to enqueue.');
                }
                // --- END: Updated Logic ---


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
                // --- NEW: Check for Out of Stock ---
                const pageContent = $('body').text().toLowerCase();
                const outOfStockKeywords = ['out of stock', 'currently unavailable', 'sold out'];
                const isOutOfStock = outOfStockKeywords.some(keyword => pageContent.includes(keyword));
                // --- END: Out of Stock Check ---

                const title = findTitle($);

                // --- UPDATED: Price Logic ---
                let price;
                if (isOutOfStock) {
                    price = 'N/A';
                    log.info(`   -> Stock Alert: Product is Out of Stock. Price set to N/A.`);
                } else {
                    price = findPrice($);
                }
                // --- END: Updated Price Logic ---

                const image = findImage($); 

                if (!title || !price || !image) {
                    log.warning(`Missing title, price, or image on ${url}, skipping.`);
                    return;
                }

                allProducts.push({
                    title,
                    price,
                    image, 
                    link: url,
                });
                log.info(`✅ Collected: ${title.substring(0, 50)}... (Price: ${price})`);
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