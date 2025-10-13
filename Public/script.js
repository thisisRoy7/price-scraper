// public/script.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Get all UI elements ---
    const form = document.getElementById('compare-form');
    const productNameInput = document.getElementById('product-name');
    const numPagesInput = document.getElementById('num-pages');
    const compareBtn = document.getElementById('compare-btn');
    const logOutput = document.getElementById('log-output');
    const loader = document.getElementById('loader');
    const resultsGrid = document.getElementById('results-grid');
    const cacheInfo = document.getElementById('cache-info');
    const cacheDate = document.getElementById('cache-date');
    const refreshBtn = document.getElementById('refresh-btn');
    const popularSearchesContainer = document.getElementById('popular-searches-container');

    // --- Main function to perform the comparison ---
    const performComparison = async (isRefresh = false) => {
        const productName = productNameInput.value;
        if (!productName) return; // Don't run if input is empty

        const numPages = numPagesInput.value;

        // 1. Reset UI for a new request
        logOutput.textContent = isRefresh ? 'Refreshing data...' : 'Preparing to scrape...';
        resultsGrid.innerHTML = '';
        cacheInfo.classList.add('hidden'); // Always hide cache info on new request
        loader.classList.remove('hidden');
        compareBtn.disabled = true;
        refreshBtn.disabled = true; // Disable refresh button too
        compareBtn.textContent = 'Comparing...';

        try {
            // 2. Fetch data from the server
            const response = await fetch('/compare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productName, numPages, forceRefresh: isRefresh }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'An error occurred on the server.');
            }

            // 3. Render logs and results
            logOutput.textContent = data.logs.join('\n');
            renderResults(data.results);
            
            // 4. Display cache info if available
            if (data.scrapedOn) {
                const date = new Date(data.scrapedOn);
                // Format date to be more readable, e.g., "Oct 25, 2025, 9:30:15 PM"
                cacheDate.textContent = date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
                cacheInfo.classList.remove('hidden');
            }

        } catch (error) {
            console.error('Fetch error:', error);
            logOutput.textContent = `An unexpected error occurred: ${error.message}`;
        } finally {
            // 5. Cleanup UI after request finishes
            loader.classList.add('hidden');
            compareBtn.disabled = false;
            refreshBtn.disabled = false;
            compareBtn.textContent = 'Compare Prices';
        }
    };

    // --- Helper function to render product cards ---
    function renderResults(results) {
        if (results && results.length > 0) {
            results.forEach(product => {
                resultsGrid.appendChild(createProductCard(product));
            });
        } else {
            resultsGrid.innerHTML = '<p>No matching products found to compare.</p>';
        }
    }

    // --- Event Listeners ---
    form.addEventListener('submit', (event) => {
        event.preventDefault(); 
        performComparison(false); // `false` because this is a new search
    });

    refreshBtn.addEventListener('click', () => {
        performComparison(true); // `true` to force a refresh
    });
    
    popularSearchesContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('popular-search-btn')) {
            productNameInput.value = event.target.textContent;
            form.requestSubmit(); // Automatically submit the form for the popular search
        }
    });

    // Helper function to create a product card element (no changes here)
    function createProductCard(product) {
        const cardElement = document.createElement('div');
        cardElement.className = 'product-card';
        const formatPrice = (price) => isNaN(price) || price === null ? 'N/A' : `₹${price.toLocaleString('en-IN')}`;
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
            </div>`;
        return cardElement;
    }
});