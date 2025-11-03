// Public/js/ui-renderer.js

// This function creates a single product card
function createProductCard(product) {
    
    // ---
    // --- formatPrice handles the strings from the backend
    // ---
    const formatPrice = (price) => {
        if (typeof price === 'number') {
            return `₹${price.toLocaleString('en-IN')}`;
        }
        if (price === 'NOT_FOUND') {
            return 'Not Found'; 
        }
        if (price === 'OUT_OF_STOCK') {
            return 'Out of Stock';
        }
        return 'N/A'; // Fallback for null, undefined, etc.
    };
    // ---

    const cardElement = document.createElement('div');
    cardElement.className = 'flex flex-col md:flex-row md:items-start md:flex-wrap gap-4 py-6 border-b border-border-muted animate-fade-in opacity-0';

    // 1. Title (Full width)
    const title = document.createElement('h3');
    title.className = 'w-full md:basis-full text-base font-semibold text-text-primary leading-relaxed';
    title.textContent = product.title;
    
    // --- Image Container ---
    const imageContainer = document.createElement('div');
    imageContainer.className = 'w-full md:basis-24 flex justify-center md:justify-start'; 

    const imageWrapper = document.createElement('div');
    imageWrapper.className = 'w-24 h-24 rounded-md overflow-hidden flex-shrink-0 border-2 border-border-muted';
    
    const img = document.createElement('img');
    img.src = product.flipkartImage || product.amazonImage || 'placeholder.png'; // Added a fallback
    img.alt = product.title;
    img.className = 'w-full h-full object-cover'; 

    imageWrapper.appendChild(img);
    imageContainer.appendChild(imageWrapper);
    // --- End of Image Container ---


    // 3. Price Link Creator Function
    const createPriceLink = (platform, link, price, winner) => {
        const platformLower = platform.toLowerCase();
        const isWinner = winner === platform;
        
        // Don't make it a link if not found or no link
        const isClickable = link && price !== 'NOT_FOUND';
        const Tag = isClickable ? 'a' : 'div';
        
        const a = document.createElement(Tag);
        if (isClickable) {
            a.href = link;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.setAttribute('aria-label', `View ${product.title} on ${platform} for ${formatPrice(price)}`);
        }
        a.className = 'no-underline text-inherit w-full md:basis-[160px] group';

        const priceBox = document.createElement('div');
        let priceBoxClasses = `price-box relative max-w-[160px] w-full`;
        
        if (isClickable) {
            priceBoxClasses += ` hover:border-${platformLower}`;
        }

        if (isWinner) {
            priceBoxClasses += ` winner border-${platformLower}`;
        } else {
            priceBoxClasses += ' border-border-light';
        }

        // Add opacity if not available
        if (price === 'NOT_FOUND' || price === 'OUT_OF_STOCK') {
            priceBoxClasses += ' opacity-60';
        }
        // ---

        priceBox.className = priceBoxClasses;

        const platformName = document.createElement('div');
        platformName.className = 'text-xs font-medium text-text-secondary uppercase mb-1';
        platformName.textContent = platform;

        const priceText = document.createElement('div');
        
        // Adjust text size if not a price
        let priceTextClasses = 'font-bold text-text-primary';
        if (typeof price === 'number') {
            priceTextClasses += ` text-xl transition-colors group-hover:text-${platformLower}`;
        } else {
            priceTextClasses += ' text-base'; // Smaller text for "Not Found" / "Out of Stock"
        }
        // ---
        
        priceText.className = priceTextClasses;
        priceText.textContent = formatPrice(price);

        priceBox.append(platformName, priceText);
        a.appendChild(priceBox);
        return a;
    };

    // 4. Create Price Links
    const amazonLink = createPriceLink('Amazon', product.amazonLink, product.amazonPrice, product.winner);
    const flipkartLink = createPriceLink('Flipkart', product.flipkartLink, product.flipkartPrice, product.winner);

    // 5. Append all elements to the card
    cardElement.append(title, imageContainer, amazonLink, flipkartLink);
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