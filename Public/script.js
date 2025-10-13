document.addEventListener('DOMContentLoaded', () => {
    // --- Get all UI elements ---
    const form = document.getElementById('compare-form');
    const productNameInput = document.getElementById('product-name');
    const numPagesInput = document.getElementById('num-pages');
    const compareBtn = document.getElementById('compare-btn');
    const loader = document.getElementById('loader');
    const resultsGrid = document.getElementById('results-grid');
    const cacheInfo = document.getElementById('cache-info');
    const cacheDate = document.getElementById('cache-date');
    const refreshBtn = document.getElementById('refresh-btn');
    const popularSearchesContainer = document.getElementById('popular-searches-container');
    const resultsHeader = document.getElementById('results-header');
    
    // 👇 CHANGE: Get new status display elements
    const statusDisplay = document.getElementById('status-display');
    const statusIcon = document.getElementById('status-icon');
    const statusText = document.getElementById('status-text');

    // 👇 CHANGE: New helper function to translate logs into UI status
    const updateStatus = (type, message = '') => {
        statusDisplay.classList.remove('status-running', 'status-success', 'status-error');
        loader.classList.add('hidden');

        if (type === 'running') {
            statusDisplay.classList.add('status-running');
            statusIcon.innerHTML = '⚙️';
            statusText.textContent = message || 'Scraping data...';
            loader.classList.remove('hidden');
        } else if (type === 'success') {
            statusDisplay.classList.add('status-success');
            statusIcon.innerHTML = '✅';
            statusText.textContent = message || 'Comparison complete!';
        } else if (type === 'error') {
            statusDisplay.classList.add('status-error');
            statusIcon.innerHTML = '❌';
            statusText.textContent = `Error: ${message}`;
        } else { // idle
            statusIcon.innerHTML = '';
            statusText.textContent = 'Awaiting comparison...';
        }
    };

    // --- Main function to perform the comparison ---
    const performComparison = async (isRefresh = false) => {
        const productName = productNameInput.value;
        if (!productName) return;

        const numPages = numPagesInput.value;

        // 1. Reset UI for a new request
        resultsGrid.innerHTML = '';
        resultsHeader.classList.add('hidden');
        cacheInfo.classList.add('hidden');
        compareBtn.disabled = true;
        refreshBtn.disabled = true;
        compareBtn.textContent = 'Comparing...';
        updateStatus('running', isRefresh ? 'Refreshing data...' : 'Starting scrapers...');

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

            // 3. Render results and update status based on logs
            renderResults(data.results);
            const finalLog = data.logs[data.logs.length - 1] || '';
            if (finalLog.includes('Found')) {
                updateStatus('success', `Success! ${finalLog.substring(finalLog.indexOf('Found'))}`);
            } else if (finalLog.includes('Couldn\'t find')) {
                 updateStatus('success', 'No common products found to compare.');
            } else {
                 updateStatus('success', 'Comparison complete!');
            }
            
            // 4. Display cache info if available
            if (data.scrapedOn) {
                const date = new Date(data.scrapedOn);
                cacheDate.textContent = date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
                cacheInfo.classList.remove('hidden');
            }

        } catch (error) {
            console.error('Fetch error:', error);
            updateStatus('error', error.message);
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
            resultsHeader.classList.remove('hidden');
            results.forEach(product => {
                resultsGrid.appendChild(createProductCard(product));
            });
        } else {
            resultsHeader.classList.add('hidden');
        }
    }

    // --- Event Listeners ---
    form.addEventListener('submit', (event) => {
        event.preventDefault(); 
        performComparison(false);
    });

    refreshBtn.addEventListener('click', () => {
        performComparison(true);
    });
    
    popularSearchesContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('popular-search-btn')) {
            productNameInput.value = event.target.textContent;
            form.requestSubmit();
        }
    });

    // --- Helper function to create a product card element ---
    function createProductCard(product) {
        const cardElement = document.createElement('div');
        cardElement.className = 'product-card';
        
        const formatPrice = (price) => isNaN(price) || price === null ? 'N/A' : `₹${price.toLocaleString('en-IN')}`;
        const amazonWinnerClass = product.winner === 'Amazon' ? 'winner' : '';
        const flipkartWinnerClass = product.winner === 'Flipkart' ? 'winner' : '';
        
        // 👇 CHANGE: Added 'amazon-box' and 'flipkart-box' classes for specific hover styles
        cardElement.innerHTML = `
            <h3 class="title">${product.title}</h3>
            <div class="prices">
                <a href="${product.amazonLink}" target="_blank" rel="noopener noreferrer" class="store-link">
                    <div class="price-box amazon-box ${amazonWinnerClass}">
                        <div class="store">Amazon</div>
                        <div class="price">${formatPrice(product.amazonPrice)}</div>
                    </div>
                </a>
                <a href="${product.flipkartLink}" target="_blank" rel="noopener noreferrer" class="store-link">
                    <div class="price-box flipkart-box ${flipkartWinnerClass}">
                        <div class="store">Flipkart</div>
                        <div class="price">${formatPrice(product.flipkartPrice)}</div>
                    </div>
                </a>
            </div>`;
            
        return cardElement;
    }
});