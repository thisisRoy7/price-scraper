let vantaEffect = null;

// An object to hold different easing functions, which control the "feel" of the animation.
const Easing = {
    // Starts fast, then slows down. Good for a quick burst.
    easeOutCubic: t => 1 - Math.pow(1 - t, 3),
    // Starts fast, but slows down much more dramatically at the end. Perfect for a gentle finish.
    easeOutQuint: t => 1 - Math.pow(1 - t, 5)
};

// The NEW animation engine. It uses requestAnimationFrame for maximum smoothness.
const animateVantaProperty = (property, start, end, duration, easingFunc) => {
    if (!vantaEffect) return;

    let startTime = null;
    const range = end - start;

    // The "step" function is called by the browser on every frame.
    const step = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const elapsedTime = timestamp - startTime;
        
        // Calculate progress from 0.0 to 1.0
        const progress = Math.min(elapsedTime / duration, 1);

        // Apply the chosen easing function to the progress
        const easedProgress = easingFunc(progress);
        const value = start + range * easedProgress;

        // Update the vanta effect
        vantaEffect.setOptions({ [property]: value });

        // If the animation isn't finished, request the next frame
        if (progress < 1) {
            requestAnimationFrame(step);
        }
    };

    // Start the animation loop
    requestAnimationFrame(step);
};

const triggerRipple = () => {
    if (vantaEffect) {
        // --- All your settings are here for easy tweaking! ---
        const baseHeight = 7.00;
        const peakHeight = 9.00;  // CHANGED: Lower peak for a smaller, subtler swell
        const baseSpeed = 0.75;
        const peakSpeed = 1.0;  

        const swellDuration = 800;
        const calmDuration = 6000;   // CHANGED: Increased for a very long, gentle return
        // --- End of settings ---

        // --- Phase 1: The wave swells up (sharp) ---
        animateVantaProperty('waveHeight', baseHeight, peakHeight, swellDuration, Easing.easeOutCubic);
        animateVantaProperty('waveSpeed', baseSpeed, peakSpeed, swellDuration, Easing.easeOutCubic);

        // --- Phase 2: The wave calms down (gentle) ---
        setTimeout(() => {
            animateVantaProperty('waveHeight', peakHeight, baseHeight, calmDuration, Easing.easeOutQuint);
            animateVantaProperty('waveSpeed', peakSpeed, baseSpeed, calmDuration, Easing.easeOutQuint);
        }, swellDuration);
    }
};

window.addEventListener('load', () => {
    // This is your initial Vanta.js setup script
    vantaEffect = VANTA.WAVES({
    el: "#vanta-bg",
    mouseControls: false,
    touchControls: false,
    gyroControls: false,
    minHeight: 200.00,
    minWidth: 200.00,
    scale: 1.00,
    scaleMobile: 1.00,
    color: 0x6b7c85, // The hex code for your 'primary' color
    
    // --- KEY PROPERTIES FOR SUBTLE MOTION ---

    // Set the default height of the waves.
    waveHeight: 7.00, 
    
    // This is the most important setting for constant motion.
    // Any value > 0 creates movement. A small value like this is very subtle.
    waveSpeed: 1,
    
    // Zooming out slightly can make the waves feel larger and calmer.
    zoom: 1.90
    });
    vantaEffect.resize();

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

    const updateStatus = (type, message = '') => {
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
        } else {
            statusText.classList.add('text-text-secondary');
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

    form.addEventListener('submit', (e) => { 
        e.preventDefault(); 
        triggerRipple();
        performComparison(false); 
    });
    refreshBtn.addEventListener('click', () => {
        triggerRipple();
        performComparison(true);
    });
    popularSearchesContainer.addEventListener('click', (e) => {
        const button = e.target.closest('.popular-search-btn');
        if (button) {
            triggerRipple();
            productNameInput.value = button.textContent;
            form.requestSubmit();
        }
    });

    function createProductCard(product) {
        const formatPrice = (price) => isNaN(price) || price === null ? 'N/A' : `₹${price.toLocaleString('en-IN')}`;

        const cardElement = document.createElement('div');
        // 👇 CHANGE: Using hover:scale-105 for better compatibility
        cardElement.className = 'grid grid-cols-1 md:grid-cols-5 items-center gap-4 py-6 border-b border-border-muted animate-fade-in opacity-0 transition-transform duration-300 hover:scale-105';

        const title = document.createElement('h3');
        title.className = 'col-span-1 md:col-span-3 text-base font-semibold text-text-primary leading-relaxed';
        title.textContent = product.title;
        cardElement.appendChild(title);

        const createPriceLink = (platform, link, price, winner) => {
            const platformLower = platform.toLowerCase();
            const isWinner = winner === platform;

            const a = document.createElement('a');
            a.href = link;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.className = 'no-underline text-inherit block col-span-1 group';
            a.setAttribute('aria-label', `View ${product.title} on ${platform} for ${formatPrice(price)}`);

            const priceBox = document.createElement('div');
            // This now correctly uses hover:border-[platform] because of the safelist
            let priceBoxClasses = `price-box relative hover:border-${platformLower}`;
            if (isWinner) {
                priceBoxClasses += ` winner border-${platformLower}`;
            } else {
                priceBoxClasses += ' border-border-light';
            }
            priceBox.className = priceBoxClasses;

            const platformName = document.createElement('div');
            platformName.className = 'text-xs font-medium text-text-secondary uppercase mb-1';
            platformName.textContent = platform;

            const priceText = document.createElement('div');
            // This now correctly uses group-hover:text-[platform] because of the safelist
            priceText.className = `text-xl font-bold text-text-primary transition-colors group-hover:text-${platformLower}`;
            priceText.textContent = formatPrice(price);

            priceBox.append(platformName, priceText);
            a.appendChild(priceBox);
            return a;
        };

        const amazonLink = createPriceLink('Amazon', product.amazonLink, product.amazonPrice, product.winner);
        const flipkartLink = createPriceLink('Flipkart', product.flipkartLink, product.flipkartPrice, product.winner);

        cardElement.append(amazonLink, flipkartLink);
        return cardElement;
    }
});