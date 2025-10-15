// This helper function manages the status display.
const updateStatus = (type, message, elements) => {
    const { statusDisplay, statusIcon, statusText, loader } = elements;
    const statusClasses = ['text-warning', 'text-success', 'text-danger'];
    
    statusDisplay.classList.remove(...statusClasses);
    statusIcon.innerHTML = '';
    loader.classList.add('hidden');
    statusText.classList.remove('text-text-secondary');

    if (type === 'running') {
        statusDisplay.classList.add('text-warning');
        statusIcon.innerHTML = '<i class="ph-bold ph-gear-six animate-spin"></i>';
        statusText.textContent = message || 'Scraping data...';
        loader.classList.remove('hidden');
    } else if (type === 'success') {
        statusDisplay.classList.add('text-success');
        statusIcon.innerHTML = '<i class="ph-bold ph-check-circle"></i>';
        statusText.textContent = message || 'Comparison complete!';
    } else if (type === 'error') {
        statusDisplay.classList.add('text-danger');
        statusIcon.innerHTML = '<i class="ph-bold ph-x-circle"></i>';
        statusText.textContent = `Error: ${message}`;
    } else { // 'idle'
        statusText.classList.add('text-text-secondary');
        statusText.textContent = 'Awaiting comparison...';
    }
};

// EXPORT: The main function to perform the comparison.
export const performComparison = async (isRefresh, elements, renderResultsFunc) => {
    const { productNameInput, numPagesInput, resultsGrid, resultsHeader, cacheInfo, cacheDate, compareBtn, refreshBtn } = elements;
    
    const productName = productNameInput.value;
    if (!productName) return;
    
    // Reset UI
    resultsGrid.innerHTML = '';
    resultsHeader.classList.add('hidden');
    cacheInfo.classList.add('hidden');
    compareBtn.disabled = true;
    refreshBtn.disabled = true;
    compareBtn.textContent = 'Comparing...';
    updateStatus('running', isRefresh ? 'Refreshing data...' : 'Starting scrapers...', elements);

    try {
        const response = await fetch('/compare', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                productName,
                numPages: numPagesInput.value,
                forceRefresh: isRefresh
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