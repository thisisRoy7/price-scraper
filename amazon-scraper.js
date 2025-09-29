/**
 * HOW TO RUN THIS SCRIPT:
 * 1. Make sure you have installed the required packages:
 * npm install puppeteer-extra puppeteer-extra-plugin-stealth csv-writer
 * 2. Run from your terminal with command-line arguments:
 * node amazon_scraper.js "<Search Term>" <NumberOfPages>
 * 3. Example (scrapes the first 2 pages):
 * node amazon_scraper.js "mechanical keyboard" 2
 * 4. The output will be saved to a file like "scraped_amazon_mechanical_keyboard.csv".
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

puppeteer.use(StealthPlugin());

// A helper function to add a random delay.
function delay(time) {
  return new Promise(function(resolve) { 
    setTimeout(resolve, time)
  });
}

async function scrapeAmazon(searchTerm, maxPages) {
  let browser;
  const scrapedData = [];

  console.log(`Starting the scraper for "${searchTerm}" on Amazon...`);

  try {
    browser = await puppeteer.launch({
      headless: 'new', // Set to false to watch the browser in action.
      args: ['--start-maximized']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // === STEP 1: Mimic human navigation (using your provided method) ===
    console.log('Step 1: Navigating and searching...');
    
    await page.goto('https://www.amazon.in', { waitUntil: 'domcontentloaded' });
    await delay(Math.random() * 2000 + 1000);

    const searchInputSelector = '#twotabsearchtextbox';
    await page.waitForSelector(searchInputSelector);
    await page.type(searchInputSelector, searchTerm, { delay: 150 });

    const searchButtonSelector = '#nav-search-submit-button';
    await page.hover(searchButtonSelector);
    await page.click(searchButtonSelector);

    await page.waitForNavigation({ waitUntil: 'domcontentloaded' });

    // === STEP 2: Loop through pages and scrape data ===
    for (let currentPage = 1; currentPage <= maxPages; currentPage++) {
      console.log(`\nScraping Page ${currentPage} of ${maxPages}...`);

      await page.waitForSelector('[data-component-type="s-search-results"]', { timeout: 20000 });
      await page.evaluate(() => { window.scrollBy(0, window.innerHeight * Math.random()); });
      await delay(1000);

      // Collect all product links from the current page (using your provided selector)
      console.log('Collecting product links...');
      const productURLs = await page.$$eval(
        'div[data-component-type="s-search-result"] h2',
        (headings) => {
          const links = headings.map(h => h.closest('a')?.href);
          return links.filter(href => href && href.includes('/dp/'));
        }
      );
      console.log(`Found ${productURLs.length} product links on this page.`);

      // Visit each link and scrape its data
      console.log('Visiting each link to scrape product details...');
      for (const url of productURLs) {
        console.log(`\nNavigating to product page: ${url.substring(0, 60)}...`);
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded' });
          
          const titleSelector = '#productTitle';
          await page.waitForSelector(titleSelector, { timeout: 10000 });
          const title = await page.$eval(titleSelector, el => el.innerText.trim());

          let price = 'N/A';
          try {
            const priceSelector = 'span.a-price-whole';
            await page.waitForSelector(priceSelector, { timeout: 5000 }); // Shorter timeout for price
            const priceText = await page.$eval(priceSelector, el => el.innerText.trim());
            price = `₹${priceText.replace(/[,.]/g, '')}`;
          } catch (priceError) {
            console.log(`   -> Could not find price for "${title.substring(0, 40)}...". Setting to N/A.`);
          }
          
          scrapedData.push({ title, price, link: url });
          console.log(`   -> Scraped: ${title.substring(0, 40)}...`);

        } catch (err) {
          console.error(`   -> Failed to scrape data from ${url.substring(0, 60)}... Error: ${err.message}`);
        }
        
        await delay(Math.floor(Math.random() * 2500) + 1500);
      }

      // Go to the next page if not the last page in the loop
      if (currentPage < maxPages) {
        const nextButtonSelector = 'a.s-pagination-item.s-pagination-next';
        const nextButton = await page.$(nextButtonSelector);
        
        if (nextButton) {
          console.log('\nNavigating to the next page...');
          await Promise.all([
              page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
              nextButton.click()
          ]);
          await delay(Math.random() * 2000 + 1000);
        } else {
          console.log('No "Next" button found. Reached the last page.');
          break;
        }
      }
    }
    
    return scrapedData;
    
  } catch (error) {
    console.error("A critical error occurred:", error);
    return scrapedData;
  } finally {
    if (browser) {
      await browser.close();
      console.log("\nBrowser closed.");
    }
  }
}

// Function to save data to a CSV file
async function saveToCsv(data, searchTerm) {
  if (data.length === 0) {
    console.log("No data to save.");
    return;
  }
  const filename = `scraped_amazon_${searchTerm.replace(/\s+/g, '_')}.csv`;
  const csvWriter = createCsvWriter({
    path: filename,
    header: [
      { id: 'title', title: 'TITLE' },
      { id: 'price', title: 'PRICE' },
      { id: 'link', title: 'LINK' },
    ],
    encoding: 'utf8',
  });
  try {
    await csvWriter.writeRecords(data);
    console.log(`\nSuccess! Data saved to ${filename}`);
  } catch (error) {
    console.error("Error writing to CSV:", error);
  }
}

// Main execution block
(async () => {
  const args = process.argv.slice(2); 

  if (args.length !== 2) {
    console.error('Incorrect number of arguments!');
    console.log('Usage: node amazon_scraper.js "<Search Term>" <NumberOfPages>');
    process.exit(1); 
  }

  const [SEARCH_TERM, MAX_PAGES_STR] = args;
  const MAX_PAGES = parseInt(MAX_PAGES_STR, 10);

  if (isNaN(MAX_PAGES) || MAX_PAGES < 1) {
    console.error('Error: Number of pages must be a positive number.');
    process.exit(1);
  }

  const scrapedData = await scrapeAmazon(SEARCH_TERM, MAX_PAGES);

  if (scrapedData.length > 0) {
    console.log("\n--- FINAL SCRAPED DATA ---");
    console.table(scrapedData);
    await saveToCsv(scrapedData, SEARCH_TERM);
  } else {
    console.log("\nNo data was scraped. The bot was likely blocked or no products were found.");
  }
})();