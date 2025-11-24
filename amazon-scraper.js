// amazon-scraper.js

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const selectors = require('./selectors.json').amazon; 

puppeteer.use(StealthPlugin());

// Helper function to add a random delay
function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}

// Helper to set up request interception
async function setupPageInterception(page) {
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    // Sometimes blocking CSS triggers bot detection on Amazon. 
    // If you see CAPTCHAs, comment out this 'if' block and just use req.continue()
    if (req.resourceType() === 'stylesheet' || req.resourceType() === 'font') {
      req.abort();
    } else {
      req.continue();
    }
  });
}

// Concurrent product scraper
async function scrapeProductsConcurrently(browser, productURLs, concurrency = 5) {
  const scrapedData = [];
  let index = 0;

  async function scrapeWorker() {
    while (index < productURLs.length) {
      const currentIndex = index++;
      const url = productURLs[currentIndex];
      let productPage;

      try {
        productPage = await browser.newPage();
        await productPage.setViewport({ width: 1440, height: 900 });
        // NOTE: We do NOT use interception on product pages to reduce bot detection risk
        // await setupPageInterception(productPage); 

        const titleSelector = selectors.productTitle;
        const priceSelector = selectors.productPrice;
        const imageSelector = selectors.productImage;

        await productPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        let isOutOfStock = false;
        try {
            const pageContent = await productPage.$eval('body', el => el.innerText.toLowerCase());
            const outOfStockKeywords = ['out of stock', 'currently unavailable'];
            isOutOfStock = outOfStockKeywords.some(keyword => pageContent.includes(keyword));
            
            if (isOutOfStock) {
                console.log(`   -> Stock Alert: Product is Out of Stock.`);
            }
        } catch (e) {
            console.log(`   -> Warning: Could not check stock status.`);
        }

        const title = await productPage.$eval(titleSelector, el => el.innerText.trim())
          .catch(() => 'N/A');

        let price = 'N/A';
        if (isOutOfStock) {
            price = 'N/A';
        } else {
            price = await productPage.$eval(priceSelector, el => el.innerText.trim())
              .then(p => `₹${p.replace(/[,.]/g, '')}`) 
              .catch(() => 'N/A');
        }
        
        let image = await productPage.$eval(imageSelector, el => el.src)
          .catch(() => 'N/A');

        scrapedData.push({ title, price, image, link: url });
        console.log(`   -> Scraped: ${title.substring(0, 40)}... (Price: ${price})`);

        await delay(Math.floor(Math.random() * 2000) + 1000); 
      } catch (err) {
        console.log(`   -> Failed for ${url.substring(0, 30)}... Error: ${err.message}`);
      } finally {
        if (productPage) {
          await productPage.close();
        }
      }
    }
  }

  const workers = [];
  for (let i = 0; i < concurrency; i++) workers.push(scrapeWorker());
  await Promise.all(workers);

  return scrapedData;
}

// Main scraper function
async function scrapeAmazon(searchTerm, maxPages) {
  let browser;
  let allScrapedData = [];

  console.log(`Starting the scraper for "${searchTerm}" on Amazon...`);

  try {
    browser = await puppeteer.launch({
      headless: true, 
      args: [
        '--start-maximized',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ],
      executablePath: puppeteer.executablePath()
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    
    // Step 1: Navigate and search
    console.log('Step 1: Navigating and searching...');
    await page.goto('https://www.amazon.in', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await delay(2000);

    // Check if we hit a CAPTCHA immediately
    const isCaptcha = await page.$('input#captchacharacters');
    if (isCaptcha) {
        console.log("❌ CAPTCHA DETECTED! Please solve it manually in the browser window.");
        await page.waitForNavigation({ timeout: 120000 }); // Give you 2 mins to solve
    }

    try {
        await page.waitForSelector(selectors.searchInput, { timeout: 10000 });
        await page.type(selectors.searchInput, searchTerm, { delay: 100 });
        await page.click(selectors.searchButton);
        await page.waitForNavigation({ waitUntil: 'domcontentloaded' });
    } catch (e) {
        console.log("⚠️ Search input not found. You might be on a bot detection page.");
    }

    // Step 2: Loop through pages
    for (let currentPage = 1; currentPage <= maxPages; currentPage++) {
      console.log(`\nScraping Page ${currentPage} of ${maxPages}...`);

      // Increase timeout for slow connections
      try {
          await page.waitForSelector(selectors.searchResultsContainer, { timeout: 15000 });
      } catch (e) {
          console.log("❌ Could not find search results container. Amazon might have blocked the request or changed layout.");
          break;
      }
      
      await page.evaluate(() => { window.scrollBy(0, window.innerHeight); });
      await delay(2000);

      console.log('Collecting product links...');
      
      // --- DEBUG: Count raw headings first ---
      const rawHeadingsCount = await page.$$eval(selectors.productHeadings, els => els.length);
      console.log(`   -> Debug: Found ${rawHeadingsCount} raw heading elements.`);

      const productURLs = await page.$$eval(
        selectors.productHeadings,
        (headings) => {
          const links = headings.map(h => {
            // --- Robust Container Selection ---
            // 1. Try specific data attribute
            let productCard = h.closest('[data-component-type="s-search-result"]');
            // 2. Fallback to generic class if specific one fails
            if (!productCard) productCard = h.closest('.s-result-item');
            
            if (!productCard) return null; 

            // Sponsored Check
            const sponsoredSpan = productCard.querySelector('span[data-component-type="s-sponsored-label"]');
            const sponsoredText = Array.from(productCard.querySelectorAll('span'))
                                       .some(span => span.textContent.trim() === 'Sponsored');
            
            if (sponsoredSpan || sponsoredText) {
              return null;
            }

            // Get Link
            const anchor = h.closest('a');
            return anchor ? anchor.href : null;
          });

          return links
            .filter(href => href && href.includes('/dp/')) 
            .map(href => (href.startsWith('http') ? href : `https://www.amazon.in${href}`));
        }
      );

      console.log(`   -> Found ${productURLs.length} valid (non-sponsored) product links.`);

      if (productURLs.length > 0) {
        const scrapedData = await scrapeProductsConcurrently(browser, productURLs, 5);
        allScrapedData = allScrapedData.concat(scrapedData);
      }

      // Check for Next button
      if (currentPage < maxPages) {
        const nextButton = await page.$(selectors.nextPageButton);
        if (nextButton) {
          console.log('Navigating to next page...');
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
            nextButton.click()
          ]);
          await delay(3000);
        } else {
          console.log('No "Next" button found. Finished.');
          break;
        }
      }
    }

    return allScrapedData;

  } catch (error) {
    console.error("❌ A critical error occurred:", error);
    return allScrapedData;
  } finally {
    if (browser) {
      await browser.close();
      console.log("\nBrowser closed.");
    }
  }
}

// Save data to CSV
async function saveToCsv(data, searchTerm) {
  // --- Create directory if it doesn't exist (safety check) ---
  const outputDir = path.join(__dirname, 'amazon_results'); 
  if (!fs.existsSync(outputDir)){
      fs.mkdirSync(outputDir, { recursive: true });
  }

  const filename = `scraped_amazon_${searchTerm.replace(/\s+/g, '_')}.csv`;
  const filePath = path.join(outputDir, filename);

  console.log(`Attempting to save CSV to: ${filePath}`);

  const csvWriter = createCsvWriter({
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
    console.log(`✅ Success! Data saved to ${filePath}`);
  } catch (error) {
    console.error("❌ Error writing to CSV:", error);
  }
}

// Main execution
(async () => {
  const args = process.argv.slice(2);

  if (args.length !== 2) {
    console.error('Usage: node amazon-scraper.js "<Search Term>" <NumberOfPages>');
    process.exit(1);
  }

  const [SEARCH_TERM, MAX_PAGES_STR] = args;
  const MAX_PAGES = parseInt(MAX_PAGES_STR, 10);

  const scrapedData = await scrapeAmazon(SEARCH_TERM, MAX_PAGES);

  // --- Even if length is 0, we log clearly why ---
  if (scrapedData.length > 0) {
    console.log("\n--- FINAL SCRAPED DATA ---");
    // console.table(scrapedData); // Optional: Comment out if table is too huge
    await saveToCsv(scrapedData, SEARCH_TERM);
  } else {
    console.log("\n❌ No data was scraped.");
    console.log("   Possible reasons: Amazon CAPTCHA, Selector mismatch, or 0 search results.");
    // We do NOT save an empty CSV, as that breaks the reader script.
  }
})();