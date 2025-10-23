// comparison-block/ matcher.js

// Load environment variables from .env file (e.g., HF_API_TOKEN)
require('dotenv').config();

// Only import the API checker
const { checkWithSemanticAPI } = require('./matcher-api.js');

// --- NEW: A simple in-memory cache for API results ---
// This prevents re-calling the API for the same pair
const apiCache = new Map();


// --- 1. Constants (Same as before) ---

const COMMON_BRANDS = new Set([
    'apple', 'samsung', 'google', 'oneplus', 'xiaomi', 'redmi', 'oppo', 'vivo',
    'realme', 'motorola', 'nokia', 'sony', 'lg', 'asus', 'poco', 'boat',
    'jbl', 'sennheiser', 'bose', 'hp', 'dell', 'lenovo', 'acer', 'msi',
    'noise', 'fire-boltt', 'amazfit', 'garmin', 'fitbit', 'spigen', 'anker',
    'logitech', 'razer', 'corsair', 'whirlpool', 'panasonic', 'toshiba',
    'intel', 'amd', 'nvidia', 'gopro', 'dji', 'canon', 'nikon'
]);
const STOP_WORDS = new Set(['the', 'new', 'a', 'an', 'for', 'with', 'of']);
const RAM_REGEX = /\b(\d{1,3})\s*(?:g|gb)\s*ram\b/gi;
const STORAGE_REGEX = /\b(\d{2,4})\s*(?:g|gb)\b|\b(\d{1,2})\s*(?:t|tb)\b/gi;
const PROCESSOR_REGEX = /\b(snapdragon(?:[\s-][\w\d]+){0,3}|a\d{2}\s*bionic|intel\s*i[3579](?:[\s-][\d\w]+){0,3}|ryzen\s*[3579](?:[\s-][\d\w]+){0,3}|apple\s*m[1-3](?:[\s-]\w+){0,2})\b/gi;


// --- 2. Utility Functions (Brand & Spec Extraction - Unchanged) ---

const normalize = (str) => (str || '').toLowerCase().replace(/\s+/g, ' ').trim();

function extractBrand(title) {
    const titleLower = normalize(title);
    if (!titleLower) return null;
    for (const brand of COMMON_BRANDS) {
        const brandRegex = new RegExp(`\\b${brand}\\b`);
        if (brandRegex.test(titleLower)) return brand;
    }
    const firstWord = titleLower.split(' ')[0];
    if (firstWord && !STOP_WORDS.has(firstWord) && firstWord.length > 2) {
        return firstWord;
    }
    return null;
}

function extractSpecs(title) {
    const specs = {};
    const lowerTitle = normalize(title);
    
    try {
        const ramMatch = lowerTitle.match(RAM_REGEX);
        if (ramMatch) {
            specs.ram = normalize(ramMatch[0]).match(/\d+/)[0];
        }

        const storageMatches = lowerTitle.match(STORAGE_REGEX);
        if (storageMatches) {
            for (let matchStr of storageMatches) {
                matchStr = normalize(matchStr);
                if (specs.ram && (matchStr === `${specs.ram}gb` || matchStr === `${specs.ram}g`)) {
                    continue;
                }
                let normalizedStorage;
                if (matchStr.includes('tb') || matchStr.includes('t')) {
                    normalizedStorage = parseInt(matchStr) * 1024;
                } else {
                    normalizedStorage = parseInt(matchStr);
                }
                specs.storage = String(normalizedStorage);
                break;
            }
        }

        const processorMatch = lowerTitle.match(PROCESSOR_REGEX);
        if (processorMatch) {
            specs.processor = normalize(processorMatch[0]);
        }
    } catch (e) {
        console.error(`[Matcher] Regex extraction failed for title: "${title}"`, e.message);
    }
    return specs;
}

function compareSpecs(specsA, specsB) {
    const keys = ['ram', 'storage', 'processor'];
    for (const key of keys) {
        const valA = specsA[key];
        const valB = specsB[key];
        if (valA && valB && valA !== valB) {
            return {
                match: false,
                reason: `Specification mismatch on '${key}': '${valA}' vs '${valB}'`
            };
        }
    }
    return { match: true };
}


// --- 3. Core Matching Logic (Now with Caching) ---

/**
 * Compares two product objects (A and B) using a filter-then-API strategy.
 */
async function matchProducts(productA, productB, options = {}) {
    const config = {
        semanticThreshold: 0.85,
        ...options
    };

    const baseResult = { matched: false, score: 0, method: null, reason: "" };

    if (!productA?.title || !productB?.title) {
        return { ...baseResult, reason: "One or both products lack a title." };
    }

    // --- Case 1: Brand Mismatch (Fast, no cache) ---
    const brandA = normalize(productA.brand || extractBrand(productA.title));
    const brandB = normalize(productB.brand || extractBrand(productB.title));
    if (brandA && brandB && brandA !== brandB) {
        return {
            ...baseResult,
            method: "brand",
            reason: `Brand mismatch: '${brandA}' vs '${brandB}'`
        };
    }

    // --- Case 2: Spec Mismatch (Fast, no cache) ---
    const specsA = extractSpecs(productA.title);
    const specsB = extractSpecs(productB.title);
    const specResult = compareSpecs(specsA, specsB);
    if (!specResult.match) {
        return {
            ...baseResult,
            method: "specs",
            reason: specResult.reason
        };
    }

    // --- Case 3: Call API (Slow, check cache first) ---
    
    // Create a unique key for this pair. Order doesn't matter.
    const [title1, title2] = [productA.title, productB.title].sort();
    const cacheKey = `${title1}||${title2}`;

    // NEW: Check cache before calling API
    if (apiCache.has(cacheKey)) {
        console.log(`[Matcher] Cache HIT for: "${productA.title}" vs "${productB.title}"`);
        return apiCache.get(cacheKey);
    }
    
    console.log(`[Matcher] Cache MISS. Calling API for: "${productA.title}" vs "${productB.title}"`);
    
    // Call the API
    const apiResult = await checkWithSemanticAPI(productA.title, productB.title, config);

    // NEW: Store result in cache
    apiCache.set(cacheKey, apiResult);
    
    return apiResult;
}

/**
 * --- HEAVILY OPTIMIZED ---
 * Iterates a list of products in PARALLEL to find the best match.
 */
async function findBestMatch(productToMatch, productList, options = {}) {
    let bestMatch = null;
    let bestMatchResult = { score: -1, matched: false };

    // 1. Create an array of *promises*. Each promise resolves
    //    to an object containing the candidate and its match result.
    const comparisonPromises = productList.map(candidateProduct =>
        matchProducts(productToMatch, candidateProduct, options)
            .then(result => ({
                candidate: candidateProduct,
                result: result
            }))
            .catch(error => ({
                // Handle potential errors for a single comparison
                candidate: candidateProduct,
                result: { matched: false, score: 0, reason: `Error: ${error.message}` }
            }))
    );

    // 2. Wait for ALL promises to settle (run in parallel)
    const allResults = await Promise.all(comparisonPromises);

    // 3. Now, just loop through the in-memory results (very fast)
    for (const { candidate, result } of allResults) {
        // Find the highest score *that is also a match*
        if (result.matched && result.score > bestMatchResult.score) {
            bestMatch = candidate;
            bestMatchResult = result;
        }
    }

    if (bestMatch) {
        console.log(`[Matcher] Best match found for "${productToMatch.title}"`);
        console.log(`[Matcher] -> Match: "${bestMatch.title}"`);
        console.log(`[Matcher] -> Details:`, bestMatchResult);
        return { item: bestMatch, result: bestMatchResult };
    } else {
        console.log(`[Matcher] No match found for "${productToMatch.title}"`);
        return null;
    }
}


// --- 4. Exports ---
module.exports = {
    matchProducts,
    findBestMatch
};