// comparison-block/ matcher.js

// Load environment variables from .env file (e.g., HF_API_TOKEN)
require('dotenv').config();

// --- 1. THE MATCHER SWITCH ---
/**
 * Controls which semantic matching engine to use.
 * 'api'   - Uses the Hugging Face API (requires HF_API_TOKEN).
 * 'local' - Uses the on-device model via @xenova/transformers.
 */
const MATCHER_MODE = 'local'; // ('api' or 'local')
// -----------------------------


// --- 2. Imports & Cache ---

// Import both implementations
const { checkWithSemanticAPI } = require('./matcher-api.js');
const { checkWithLocalModel } = require('./matcher-own.js');

// This cache will store results from *either* the API or the local model.
const semanticCache = new Map();


/**
 * Dispatches to the correct semantic checker based on MATCHER_MODE.
 * This is the only function that 'matchProducts' needs to call.
 */
function checkSemanticSimilarity(titleA, titleB, config) {
    if (MATCHER_MODE === 'local') {
        // Use the locally-run model
        return checkWithLocalModel(titleA, titleB, config);
    }
    // Default to using the API
    return checkWithSemanticAPI(titleA, titleB, config);
}


// --- 3. Constants (Unchanged) ---

const COMMON_BRANDS = new Set([
    // Tech
    'apple', 'samsung', 'google', 'oneplus', 'xiaomi', 'redmi', 'oppo', 'vivo',
    'realme', 'motorola', 'nokia', 'sony', 'lg', 'asus', 'poco', 'boat',
    'jbl', 'sennheiser', 'bose', 'hp', 'dell', 'lenovo', 'acer', 'msi',
    'noise', 'fire-boltt', 'amazfit', 'garmin', 'fitbit', 'spigen', 'anker',
    'logitech', 'razer', 'corsair', 'whirlpool', 'panasonic', 'toshiba',
    'intel', 'amd', 'nvidia', 'gopro', 'dji', 'canon', 'nikon',
    // Cosmetics & General
    'l\'oreal', 'maybelline', 'revlon', 'nyx', 'lakme', 'mac', 'sugar',
    'himalaya', 'nivea', 'dove', 'olay', 'ponds', 'adidas', 'nike', 'puma'
]);
const STOP_WORDS = new Set(['the', 'new', 'a', 'an', 'for', 'with', 'of']);
const NUMBER_REGEX = /\b\d+(?:\.\d+)?\b/g;


// --- 4. Utility Functions (Unchanged) ---

const normalize = (str) => (str || '').toLowerCase().replace(/\s+/g, ' ').trim();

function extractBrand(title) {
    const titleLower = normalize(title);
    if (!titleLower) return null;
    for (const brand of COMMON_BRANDS) {
        const brandRegex = new RegExp(`\\b${brand.replace(/'/g, '\'')}\\b`);
        if (brandRegex.test(titleLower)) return brand;
    }
    const firstWord = titleLower.split(' ')[0];
    if (firstWord && !STOP_WORDS.has(firstWord) && firstWord.length > 2) {
        return firstWord;
    }
    return null;
}

/**
 * Extracts all numbers from two titles and checks for direct conflicts.
 */
function compareNumbers(titleA, titleB) {
    const numsA = new Set(titleA.match(NUMBER_REGEX) || []);
    const numsB = new Set(titleB.match(NUMBER_REGEX) || []);

    // If neither title has numbers, there's no conflict.
    if (numsA.size === 0 && numsB.size === 0) {
        return { match: true };
    }

    const uniqueToA = [...numsA].filter(n => !numsB.has(n));
    const uniqueToB = [...numsB].filter(n => !numsB.has(n));

    // **THE FIX IS HERE:**
    // We check for '||' (OR) instead of '&&' (AND).
    if (uniqueToA.length > 0 || uniqueToB.length > 0) {
        // Construct a clearer reason for logging
        const reasonParts = [];
        if (uniqueToA.length > 0) reasonParts.push(`A has [${uniqueToA.join(',')}]`);
        if (uniqueToB.length > 0) reasonParts.push(`B has [${uniqueToB.join(',')}]`);
        
        return {
            match: false,
            reason: `Numeric mismatch: ${reasonParts.join('; ')}`
        };
    }

    // If we're here, the sets of numbers are identical.
    return { match: true };
}

// --- 5. Core Matching Logic (Refactored) ---

/**
 * Compares two product objects (A and B) using a smart-check-first, filter-later strategy.
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
    
    // --- Check Cache First ---
    const [title1, title2] = [productA.title, productB.title].sort();
    const cacheKey = `${title1}||${title2}`;
    if (semanticCache.has(cacheKey)) {
        console.log(`[Matcher] Cache HIT for: "${productA.title}" vs "${productB.title}"`);
        return semanticCache.get(cacheKey);
    }
    
    console.log(`[Matcher] Cache MISS for: "${productA.title}" vs "${productB.title}"`);

    // --- Step 1: Fast Brand Rejection ---
    const brandA = normalize(productA.brand || extractBrand(productA.title));
    const brandB = normalize(productB.brand || extractBrand(productB.title));
    if (brandA && brandB && brandA !== brandB) {
        const brandMismatchResult = {
            ...baseResult,
            method: "brand",
            reason: `Brand mismatch: '${brandA}' vs '${brandB}'`
        };
        semanticCache.set(cacheKey, brandMismatchResult); // Cache the rejection
        return brandMismatchResult;
    }

    // --- Step 2: Call Semantic Matcher (The "Smart" Check) ---
    // This now calls our dispatcher function instead of the API directly.
    const semanticResult = await checkSemanticSimilarity(productA.title, productB.title, config);

    // If the matcher says NO, we trust it.
    if (!semanticResult.matched) {
        semanticCache.set(cacheKey, semanticResult); // Cache the "no"
        return semanticResult;
    }

    // --- Step 3: Veto Check (The "Dumb" but accurate spec check) ---
    // If the matcher says YES, we run our numeric check to catch spec conflicts.
    const numberResult = compareNumbers(productA.title, productB.title);

    if (!numberResult.match) {
        // Matcher said "yes," but numbers conflict. We override the matcher.
        const numericVetoResult = {
            ...baseResult,
            score: semanticResult.score, // Keep the score for info
            method: "numeric-veto",
            reason: numberResult.reason
        };
        semanticCache.set(cacheKey, numericVetoResult); // Cache the veto
        return numericVetoResult;
    }

    // --- Final Result ---
    // Matcher said "yes" and the numeric check passed. It's a match.
    semanticCache.set(cacheKey, semanticResult); // Cache the "yes"
    return semanticResult;
}

/**
 * --- OPTIMIZED (Unchanged from before) ---
 * Iterates a list of products in PARALLEL to find the best match.
 */
async function findBestMatch(productToMatch, productList, options = {}) {
    let bestMatch = null;
    let bestMatchResult = { score: -1, matched: false };

    // 1. Create an array of *promises*.
    const comparisonPromises = productList.map(candidateProduct =>
        matchProducts(productToMatch, candidateProduct, options)
            .then(result => ({
                candidate: candidateProduct,
                result: result
            }))
            .catch(error => ({
                candidate: candidateProduct,
                result: { matched: false, score: 0, reason: `Error: ${error.message}` }
            }))
    );

    // 2. Wait for ALL promises to settle (run in parallel)
    const allResults = await Promise.all(comparisonPromises);

    // 3. Now, just loop through the in-memory results (very fast)
    for (const { candidate, result } of allResults) {
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


// --- 6. Exports ---
module.exports = {
    matchProducts,
    findBestMatch
};