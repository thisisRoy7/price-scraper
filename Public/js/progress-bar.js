// Public/js/progress-bar.js

// This will hold the interval for our progress bar
let progressInterval = null;

/**
 * Manages the entire status display component, including text, icons, and the progress bar.
 * @param {string} type - The state to display ('running', 'success', 'error', 'idle').
 * @param {string} message - The text message to show.
 * @param {object} elements - An object containing all the DOM elements to update.
 */
export const updateStatus = (type, message, elements) => {
    // Destructure the elements
    // We now also need numPagesInput to calculate the speed
    const { statusDisplay, statusIcon, statusText, loader, progressBarContainer, progressBarInner, numPagesInput } = elements;
    const statusClasses = ['text-warning', 'text-success', 'text-danger'];
    
    // --- Reset general states ---
    statusDisplay.classList.remove(...statusClasses);
    statusIcon.innerHTML = '';
    loader.classList.add('hidden');
    statusText.classList.remove('text-text-secondary');

    // Clear any progress timer that might be running
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

        // --- Start the animated progress bar ---
        progressBarContainer.classList.remove('hidden');

        let progress = Math.random() * 2.7 + 1; // Start around 3–7%
        progressBarInner.style.width = `${progress}%`; // Start immediately

        // Get the number of pages, default to 1 if invalid
        const numPages = parseInt(numPagesInput.value, 10) || 1;

        // --- Calculate interval time ---
        // Slower base interval for a more realistic feel
        const baseMin = 800; // Base minimum wait time (in ms)
        const baseRange = 2000; // Base random range
        
        // The interval for each tick
        const randomInterval = Math.floor(Math.random() * baseRange) + baseMin;
        
        // Multiply the interval by the number of pages to make it slower
        const finalInterval = randomInterval * numPages;
        // --- End of new calculation ---

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
        }, finalInterval); // Use the new page-adjusted interval

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