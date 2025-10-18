// Comparison Block/matcher.js

// This helper function intelligently extracts the brand from a title.
const extractBrand = (title) => {
    // A larger, more comprehensive set of common brands. Using a Set is fast.
    const COMMON_BRANDS = new Set([
        'apple', 'samsung', 'google', 'oneplus', 'xiaomi', 'redmi', 'oppo', 'vivo',
        'realme', 'motorola', 'nokia', 'sony', 'lg', 'asus', 'poco', 'boat',
        'jbl', 'sennheiser', 'bose', 'hp', 'dell', 'lenovo', 'acer', 'msi',
        'noise', 'fire-boltt', 'amazfit', 'garmin', 'fitbit', 'spigen', 'anker'
    ]);
    
    const titleLower = title.toLowerCase();

    // 1. First, try to find a known brand from our list.
    for (const brand of COMMON_BRANDS) {
        if (titleLower.includes(brand)) {
            return brand;
        }
    }
    
    // 2. If no known brand is found, fall back to assuming the first word is the brand.
    const firstWord = titleLower.split(' ')[0];
    // Avoid common non-brand words like 'the', 'new', etc.
    const stopWords = new Set(['the', 'new', 'a', 'an', 'for']);
    if (firstWord && !stopWords.has(firstWord)) {
        return firstWord;
    }

    return null; // Could not determine a brand.
};

async function findMatchingProduct(productToMatch, productList) {
    // --- Main Logic ---
    const Fuse = (await import('fuse.js')).default;

    // Use our helper to get the brand from the product we're trying to match.
    const productBrand = extractBrand(productToMatch.title);

    // If we can't determine a brand, we can't reliably find a match.
    if (!productBrand) {
        console.error(`Could not determine a brand for "${productToMatch.title}", skipping match.`);
        return null;
    }

    const options = {
        keys: ['title'],
        includeScore: true,
        threshold: 0.6, // We can be a bit more lenient since the brand is now required.
        ignoreLocation: true,
    };

    const fuse = new Fuse(productList, options);

    // Use Fuse.js's powerful extended search to enforce our logic:
    // The matched product's title MUST include the brand AND should be similar to the original title.
    const results = fuse.search({
        $and: [
            { title: `=${productBrand}` }, // Use exact match for the brand token
            { title: productToMatch.title }
        ]
    });

    if (results.length > 0) {
        console.error(`Match found for [${productBrand}] "${productToMatch.title}": "${results[0].item.title}" with score: ${results[0].score}`);
        return results[0].item;
    }

    return null;
}

// Export the function to be used in compare.js
module.exports = { findMatchingProduct };