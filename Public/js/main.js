// Public/js/main.js

import { initVanta } from './vanta-animation.js';
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
        searchTypeInput: document.getElementById('search-type'),
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
        progressBarContainer: document.getElementById('progress-bar-container'),
        progressBarInner: document.getElementById('progress-bar-inner'),
    };

    // 3. Set up event listeners

    // The SUBMIT event now directly triggers the comparison.
    elements.form.addEventListener('submit', (e) => {
        e.preventDefault();
        // Ripple logic and delay removed
        performComparison(false, elements, renderResults);
    });

    // The CLICK on the compare button no longer needs its own listener
    // (it just triggers the form 'submit' event).

    // The CLICK on the refresh button triggers the logic directly.
    elements.refreshBtn.addEventListener('click', () => {
        // Ripple logic and delay removed
        performComparison(true, elements, renderResults);
    });

    // The CLICK on a popular search button submits the form.
    elements.popularSearchesContainer.addEventListener('click', (e) => {
        const button = e.target.closest('.popular-search-btn');
        if (button) {
            // Ripple logic removed
            elements.productNameInput.value = button.textContent;
            // This will trigger the 'submit' event listener on the form
            elements.form.requestSubmit();
        }
    });
});