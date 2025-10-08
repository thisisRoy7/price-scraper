// public/script.js

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('compare-form');
    const productNameInput = document.getElementById('product-name');
    const numPagesInput = document.getElementById('num-pages');
    const compareBtn = document.getElementById('compare-btn');
    const logOutput = document.getElementById('log-output');
    const loader = document.getElementById('loader');
    const resultsGrid = document.getElementById('results-grid');
    
    // --- CHANGE: ADDED NEW ELEMENT SELECTORS ---
    const cacheInfo = document.getElementById('cache-info');
    const cacheDate = document.getElementById('cache-date');
    const refreshBtn = document.getElementById('refresh-btn');

    // --- CHANGE: CREATE A REUSABLE FETCH FUNCTION ---
    const performComparison = async (isRefresh = false) => {
        const productName = productNameInput.value;
        const numPages = numPagesInput.value;

        // UI Reset
        logOutput.textContent = isRefresh ? 'Refreshing data...' : 'Preparing to scrape...';
        resultsGrid.innerHTML = '';
        cacheInfo.classList.add('hidden'); // Always hide cache info on new request
        loader.classList.remove('hidden');
        compareBtn.disabled = true;
        compareBtn.textContent = 'Comparing...';

        try {
            const response = await fetch('/compare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Add `forceRefresh` flag if it's a refresh action
                body: JSON.stringify({ productName, numPages, forceRefresh: isRefresh }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'An error occurred on the server.');
            }

            // Render Logs and Results
            logOutput.textContent = data.logs.join('\n');
            renderResults(data.results);
            
            // --- CHANGE: HANDLE CACHE INFO DISPLAY ---
            if (data.scrapedOn) {
                const date = new Date(data.scrapedOn);
                cacheDate.textContent = date.toLocaleString();
                cacheInfo.classList.remove('hidden');
            }

        } catch (error) {
            console.error('Fetch error:', error);
            logOutput.textContent = `An unexpected error occurred: ${error.message}`;
        } finally {
            // UI Cleanup
            loader.classList.add('hidden');
            compareBtn.disabled = false;
            compareBtn.textContent = 'Compare Prices';
        }
    };

    // --- CHANGE: EXTRACTED RESULT RENDERING TO A FUNCTION ---
    function renderResults(results) {
        if (results && results.length > 0) {
            results.forEach(product => {
                const card = createProductCard(product);
                resultsGrid.appendChild(card);
            });
        } else {
            resultsGrid.innerHTML = '<p>No matching products found to compare.</p>';
        }
    }
    
    // Initial form submission
    form.addEventListener('submit', async (event) => {
        event.preventDefault(); 
        performComparison(false); // `false` because this is not a refresh
    });

    // --- CHANGE: ADDED EVENT LISTENER FOR THE REFRESH BUTTON ---
    refreshBtn.addEventListener('click', () => {
        performComparison(true); // `true` to trigger a forced refresh
    });

    // Helper function to create a product card element (no changes here)
    function createProductCard(product) {
        const cardElement = document.createElement('div');
        cardElement.className = 'product-card';

        const formatPrice = (price) => {
            if (isNaN(price) || price === null) {
                return 'N/A';
            }
            return `₹${price.toLocaleString('en-IN')}`;
        };

        const amazonWinnerClass = product.winner === 'Amazon' ? 'winner' : '';
        const flipkartWinnerClass = product.winner === 'Flipkart' ? 'winner' : '';

        cardElement.innerHTML = `
            <h3 class="title">${product.title}</h3>
            <div class="prices">
                <div class="price-box ${amazonWinnerClass}">
                    <div class="store">Amazon</div>
                    <div class="price">${formatPrice(product.amazonPrice)}</div>
                </div>
                <div class="price-box ${flipkartWinnerClass}">
                    <div class="store">Flipkart</div>
                    <div class="price">${formatPrice(product.flipkartPrice)}</div>
                </div>
            </div>
        `;
        return cardElement;
    }
});