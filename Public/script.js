document.addEventListener('DOMContentLoaded', () => {
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
    const statusDisplay = document.getElementById('status-display');
    const statusIcon = document.getElementById('status-icon');
    const statusText = document.getElementById('status-text');

    // 👇 CHANGE: This function now uses Phosphor Icons instead of emojis
    const updateStatus = (type, message = '') => {
        statusDisplay.classList.remove('status-running', 'status-success', 'status-error');
        loader.classList.add('hidden');

        if (type === 'running') {
            statusDisplay.classList.add('status-running');
            // Using the spinning gear icon
            statusIcon.innerHTML = '<i class="ph-bold ph-gear-six animate-spin"></i>';
            statusText.textContent = message || 'Scraping data...';
            // We no longer need the separate loader div, but we'll keep the logic for it just in case.
            loader.classList.remove('hidden'); 
        } else if (type === 'success') {
            statusDisplay.classList.add('status-success');
            // Using the check-circle icon
            statusIcon.innerHTML = '<i class="ph-bold ph-check-circle"></i>';
            statusText.textContent = message || 'Comparison complete!';
        } else if (type === 'error') {
            statusDisplay.classList.add('status-error');
            // Using the x-circle icon
            statusIcon.innerHTML = '<i class="ph-bold ph-x-circle"></i>';
            statusText.textContent = `Error: ${message}`;
        } else { // idle
            statusIcon.innerHTML = '';
            statusText.textContent = 'Awaiting comparison...';
        }
    };

    const performComparison = async (isRefresh = false) => {
        const productName = productNameInput.value;
        if (!productName) return;
        const numPages = numPagesInput.value;
        resultsGrid.innerHTML = '';
        resultsHeader.classList.add('hidden');
        cacheInfo.classList.add('hidden');
        compareBtn.disabled = true;
        refreshBtn.disabled = true;
        compareBtn.textContent = 'Comparing...';
        updateStatus('running', isRefresh ? 'Refreshing data...' : 'Starting scrapers...');
        try {
            const response = await fetch('/compare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productName, numPages, forceRefresh: isRefresh }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'An error occurred on the server.');
            }
            renderResults(data.results);
            const finalLog = data.logs[data.logs.length - 1] || '';
            if (finalLog.includes('Found')) {
                updateStatus('success', `Success! ${finalLog.substring(finalLog.indexOf('Found'))}`);
            } else if (finalLog.includes('Couldn\'t find')) {
                updateStatus('success', 'No common products found to compare.');
            } else {
                updateStatus('success', 'Comparison complete!');
            }
            if (data.scrapedOn) {
                const date = new Date(data.scrapedOn);
                cacheDate.textContent = date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
                cacheInfo.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Fetch error:', error);
            updateStatus('error', error.message);
        } finally {
            loader.classList.add('hidden');
            compareBtn.disabled = false;
            refreshBtn.disabled = false;
            compareBtn.textContent = 'Compare Prices';
        }
    };

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

    form.addEventListener('submit', (e) => { e.preventDefault(); performComparison(false); });
    refreshBtn.addEventListener('click', () => performComparison(true));
    popularSearchesContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('popular-search-btn')) {
            productNameInput.value = e.target.textContent;
            form.requestSubmit();
        }
    });

    function createProductCard(product) {
        const cardElement = document.createElement('div');
        
        cardElement.className = 'grid grid-cols-1 md:grid-cols-5 items-center gap-4 p-4 border-b border-border-muted/50 animate-fade-in opacity-0';
        
        const formatPrice = (price) => isNaN(price) || price === null ? 'N/A' : `₹${price.toLocaleString('en-IN')}`;
        const amazonWinnerClass = product.winner === 'Amazon' ? 'winner' : '';
        const flipkartWinnerClass = product.winner === 'Flipkart' ? 'winner' : '';

        const amazonInitialClass = 'bg-amazon-orange/5 border-amazon-orange/20';
        const flipkartInitialClass = 'bg-flipkart-blue/5 border-flipkart-blue/20';
        
        cardElement.innerHTML = `
            <h3 class="md:col-span-3 text-base font-semibold leading-relaxed">${product.title}</h3>
            
            <div class="md:col-span-2 grid grid-cols-2 gap-4">
                <a href="${product.amazonLink}" target="_blank" rel="noopener noreferrer" class="no-underline text-inherit block">
                    <div class="price-box amazon-box ${amazonInitialClass} ${amazonWinnerClass}">
                        <div class="text-xs font-medium text-text-secondary uppercase mb-1">Amazon</div>
                        <div class="text-xl font-semibold">${formatPrice(product.amazonPrice)}</div>
                    </div>
                </a>
                <a href="${product.flipkartLink}" target="_blank" rel="noopener noreferrer" class="no-underline text-inherit block">
                    <div class="price-box flipkart-box ${flipkartInitialClass} ${flipkartWinnerClass}">
                        <div class="text-xs font-medium text-text-secondary uppercase mb-1">Flipkart</div>
                        <div class="text-xl font-semibold">${formatPrice(product.flipkartPrice)}</div>
                    </div>
                </a>
            </div>`;
            
        return cardElement;
    }
});