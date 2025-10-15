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
    
    const RIPPLE_DELAY = 400; // ms to delay task so animation can start

    // 3. Set up event listeners

    // The SUBMIT event now ONLY handles the logic, not the UI effect.
    elements.form.addEventListener('submit', (e) => {
        e.preventDefault();
        // Give the ripple animation a moment to play before starting the heavy task
        setTimeout(() => {
            performComparison(false, elements, renderResults);
        }, RIPPLE_DELAY);
    });

    // The CLICK on the compare button triggers the ripple.
    elements.compareBtn.addEventListener('click', triggerRipple);

    // The CLICK on the refresh button triggers both ripple and logic.
    elements.refreshBtn.addEventListener('click', () => {
        triggerRipple();
        // Give the ripple animation a moment to play before starting the heavy task
        setTimeout(() => {
            performComparison(true, elements, renderResults);
        }, RIPPLE_DELAY);
    });

    // The CLICK on a popular search button triggers the ripple and submits the form.
    elements.popularSearchesContainer.addEventListener('click', (e) => {
        const button = e.target.closest('.popular-search-btn');
        if (button) {
            triggerRipple(); // Trigger ripple on physical click
            elements.productNameInput.value = button.textContent;
            // This will trigger the 'submit' event listener on the form
            elements.form.requestSubmit(); 
        }
    });
});