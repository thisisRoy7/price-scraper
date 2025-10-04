document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('compare-form');
    const productNameInput = document.getElementById('product-name');
    const numPagesInput = document.getElementById('num-pages');
    const compareBtn = document.getElementById('compare-btn');
    const logOutput = document.getElementById('log-output');
    const loader = document.getElementById('loader');
    const resultsGrid = document.getElementById('results-grid');

    form.addEventListener('submit', async (event) => {
        event.preventDefault(); 

        const productName = productNameInput.value;
        const numPages = numPagesInput.value;

        // --- UI Reset ---
        logOutput.textContent = 'Preparing to scrape...';
        resultsGrid.innerHTML = ''; // Clear previous results
        loader.classList.remove('hidden');
        compareBtn.disabled = true;
        compareBtn.textContent = 'Comparing...';

        try {
            // Fetch JSON data instead of text
            const response = await fetch('/compare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productName, numPages }),
            });

            const data = await response.json();

            if (!response.ok) {
                // Handle server-side errors which might not be in our JSON format
                throw new Error(data.message || 'An error occurred on the server.');
            }

            // --- Render Logs and Results ---
            logOutput.textContent = data.logs.join('\n');

            if (data.results && data.results.length > 0) {
                data.results.forEach(product => {
                    const card = createProductCard(product);
                    resultsGrid.appendChild(card);
                });
            } else {
                resultsGrid.innerHTML = '<p>No matching products found to compare.</p>';
            }

        } catch (error) {
            console.error('Fetch error:', error);
            logOutput.textContent = `An unexpected error occurred: ${error.message}`;
        } finally {
            // --- UI Cleanup ---
            loader.classList.add('hidden');
            compareBtn.disabled = false;
            compareBtn.textContent = 'Compare Prices';
        }
    });

    // Helper function to create a product card element
    function createProductCard(product) {
        const cardElement = document.createElement('div');
        cardElement.className = 'product-card';

        const formatPrice = (price) => {
            if (isNaN(price) || price === null) {
                return 'N/A';
            }
            return `₹${price.toLocaleString('en-IN')}`;
        };

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
            </div>
        `;
        return cardElement;
    }
});