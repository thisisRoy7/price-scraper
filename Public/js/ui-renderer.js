function createProductCard(product) {
    const formatPrice = (price) => isNaN(price) || price === null ? 'N/A' : `₹${price.toLocaleString('en-IN')}`;

    const cardElement = document.createElement('div');
    cardElement.className = 'flex flex-col md:flex-row md:items-start md:flex-wrap gap-4 py-6 border-b border-border-muted animate-fade-in opacity-0';

    const title = document.createElement('h3');
    title.className = 'w-full md:basis-full text-base font-semibold text-text-primary leading-relaxed';
    title.textContent = product.title;
    cardElement.appendChild(title);

    const createPriceLink = (platform, link, price, winner) => {
        const platformLower = platform.toLowerCase();
        const isWinner = winner === platform;

        const a = document.createElement('a');
        a.href = link;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'no-underline text-inherit w-full md:basis-[160px] group';
        a.setAttribute('aria-label', `View ${product.title} on ${platform} for ${formatPrice(price)}`);

        const priceBox = document.createElement('div');
        let priceBoxClasses = `price-box relative hover:border-${platformLower} max-w-[160px] w-full`;
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

// EXPORT: This function takes the data and DOM elements to render the results.
export function renderResults(results, resultsGrid, resultsHeader) {
    resultsGrid.innerHTML = ''; // Clear previous results
    if (results && results.length > 0) {
        resultsHeader.classList.remove('hidden');
        results.forEach(product => {
            resultsGrid.appendChild(createProductCard(product));
        });
    } else {
        resultsHeader.classList.add('hidden');
    }
}