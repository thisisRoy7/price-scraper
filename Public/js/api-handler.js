// This will hold the interval for our "fake" progress bar
let progressInterval = null;

// This helper function manages the status display.
const updateStatus = (type, message, elements) => {
    // Destructure the new elements
    const { statusDisplay, statusIcon, statusText, loader, progressBarContainer, progressBarInner } = elements;
    const statusClasses = ['text-warning', 'text-success', 'text-danger'];
    
    // --- Reset general states ---
    statusDisplay.classList.remove(...statusClasses);
    statusIcon.innerHTML = '';
    loader.classList.add('hidden');
    statusText.classList.remove('text-text-secondary');

    // Clear any fake progress timer that might be running
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
    
    // --- Apply new state ---
    if (type === 'running') {
        statusDisplay.classList.add('text-warning');
        statusIcon.innerHTML = '<i class="ph-bold ph-gear-six animate-spin"></i>';
        statusText.textContent = message || 'Scraping data...';
        loader.classList.remove('hidden');

        // --- Start the "better fake" progress bar ---
        progressBarContainer.classList.remove('hidden');

        let progress = Math.random() * 2.7 + 1; // Start around 3–7%
        progressBarInner.style.width = `${progress}%`; // Start immediately

        progressInterval = setInterval(() => {
            if (progress < 90) { 
                // Random easing: 5%–12% of the remaining distance
                const easingFactor = Math.random() * 0.07 + 0.04;
                progress += (90 - progress) * easingFactor;

                // Cap to avoid overshoot
                if (progress > 90) progress = 90;

                progressBarInner.style.width = `${progress.toFixed(2)}%`;
            } else {
                progressBarInner.style.width = '90%';
            }
        }, Math.floor(Math.random() * 2265) + 620); // Interval: 500–800ms (slower, varied)

    } else if (type === 'success') {
        statusDisplay.classList.add('text-success');
        statusIcon.innerHTML = '<i class="ph-bold ph-check-circle"></i>';
        statusText.textContent = message || 'Comparison complete!';

        // --- Animate to 100% on success ---
        progressBarContainer.classList.remove('hidden'); // <-- SHOW
        progressBarInner.style.width = '100%';
        
        // Hide the bar after its transition animation (300ms) finishes
        setTimeout(() => {
            progressBarContainer.classList.add('hidden'); // <-- HIDE
            progressBarInner.style.width = '0%'; // <-- RESET
        }, 500); // 300ms transition + 200ms buffer

    } else if (type === 'error') {
        statusDisplay.classList.add('text-danger');
        statusIcon.innerHTML = '<i class="ph-bold ph-x-circle"></i>';
        statusText.textContent = `Error: ${message}`;
        progressBarContainer.classList.add('hidden'); // <-- HIDE
        progressBarInner.style.width = '0%'; // <-- RESET
        
    } else { // 'idle'
        statusText.classList.add('text-text-secondary');
        statusText.textContent = 'Awaiting comparison...';
        progressBarContainer.classList.add('hidden'); // <-- HIDE
        progressBarInner.style.width = '0%'; // <-- RESET
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