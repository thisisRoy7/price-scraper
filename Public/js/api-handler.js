// Public/js/api-handler.js

// Import the UI status manager
import { updateStatus } from './progress-bar.js';

/**
 * Performs the main API comparison call.
 * @param {boolean} isRefresh - Whether to force a new scrape.
 * @param {object} elements - An object containing all the DOM elements.
 * @param {function} renderResultsFunc - The function to call to render the results grid.
 */
export const performComparison = async (isRefresh, elements, renderResultsFunc) => {
    // MODIFIED: Destructured searchTypeInput
    const { productNameInput, numPagesInput, searchTypeInput, resultsGrid, resultsHeader, cacheInfo, cacheDate, compareBtn, refreshBtn } = elements;
    
    const productName = productNameInput.value;
    if (!productName) return;

    // MODIFIED: Read all values from inputs
    const numPages = numPagesInput.value;
    const searchType = searchTypeInput.value;
    
    // Reset UI
    resultsGrid.innerHTML = '';
    resultsHeader.classList.add('hidden');
    cacheInfo.classList.add('hidden');
    compareBtn.disabled = true;
    refreshBtn.disabled = true;
    compareBtn.textContent = 'Comparing...';
    
    // Use the imported status updater
    updateStatus('running', isRefresh ? 'Refreshing data...' : 'Starting scrapers...', elements);

    try {
        const response = await fetch('/compare', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                productName,
                numPages: numPages,         // Use the variable
                forceRefresh: isRefresh,
                searchType: searchType      // MODIFIED: Added searchType to the request
            }),
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'An error occurred on the server.');
        }
        
        // Use the passed-in function to render results
        renderResultsFunc(data.results, resultsGrid, resultsHeader);
        
        // Update status based on logs
        const finalLog = data.logs[data.logs.length - 1] || '';
        if (finalLog.includes('Found')) {
            updateStatus('success', `Success! ${finalLog.substring(finalLog.indexOf('Found'))}`, elements);
        } else if (finalLog.includes('Couldn\'t find')) {
            updateStatus('success', 'No common products found to compare.', elements);
        } else {
            updateStatus('success', 'Comparison complete!', elements);
        }

        // Display cache info if available
        if (data.scrapedOn) {
            const date = new Date(data.scrapedOn);
            cacheDate.textContent = date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
            cacheInfo.classList.remove('hidden');
        }

    } catch (error) {
        console.error('Fetch error:', error);
        updateStatus('error', error.message, elements);
    } finally {
        elements.loader.classList.add('hidden');
        compareBtn.disabled = false;
        refreshBtn.disabled = false;
        compareBtn.textContent = 'Compare';
    }
};