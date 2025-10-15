import { initVanta, triggerRipple } from './vanta-animation.js';
import { renderResults } from './ui-renderer.js';
import { performComparison } from './api-handler.js';

window.addEventListener('load', () => {
    // 1. Initialize the background effect
    initVanta();

    // 2. Cache all DOM elements for easy access
    const elements = {
        form: document.getElementById('compare-form'),
        productNameInput: document.getElementById('product-name'),
        numPagesInput: document.getElementById('num-pages'),
        compareBtn: document.getElementById('compare-btn'),
        loader: document.getElementById('loader'),
        resultsGrid: document.getElementById('results-grid'),
        cacheInfo: document.getElementById('cache-info'),
        cacheDate: document.getElementById('cache-date'),
        refreshBtn: document.getElementById('refresh-btn'),
        popularSearchesContainer: document.getElementById('popular-searches-container'),
        resultsHeader: document.getElementById('results-header'),
        statusDisplay: document.getElementById('status-display'),
        statusIcon: document.getElementById('status-icon'),
        statusText: document.getElementById('status-text'),
    };

    // 3. Set up event listeners
    elements.form.addEventListener('submit', (e) => {
        e.preventDefault();
        triggerRipple();
        // Call the imported function, passing the elements it needs and the renderer function
        performComparison(false, elements, renderResults);
    });

    elements.refreshBtn.addEventListener('click', () => {
        triggerRipple();
        performComparison(true, elements, renderResults);
    });

    elements.popularSearchesContainer.addEventListener('click', (e) => {
        const button = e.target.closest('.popular-search-btn');
        if (button) {
            triggerRipple();
            elements.productNameInput.value = button.textContent;
            // A modern way to trigger a form submission from code
            elements.form.requestSubmit();
        }
    });
});