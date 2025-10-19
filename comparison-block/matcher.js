// Comparison matcher.js

// Load environment variables from .env file (e.g., HF_API_TOKEN)
require('dotenv').config(); 

const { WordTokenizer, JaccardIndex } = require('natural');
const { checkWithSemanticAPI } = require('./matcher-api.js');
const tokenizer = new WordTokenizer();

// --- 1. Constants & Configuration (Same as before) ---

const COMMON_BRANDS = new Set([
    'apple', 'samsung', 'google', 'oneplus', 'xiaomi', 'redmi', 'oppo', 'vivo',
    'realme', 'motorola', 'nokia', 'sony', 'lg', 'asus', 'poco', 'boat',
    'jbl', 'sennheiser', 'bose', 'hp', 'dell', 'lenovo', 'acer', 'msi',
    'noise', 'fire-boltt', 'amazfit', 'garmin', 'fitbit', 'spigen', 'anker',
    'logitech', 'razer', 'corsair', 'whirlpool', 'panasonic', 'toshiba',
    'intel', 'amd', 'nvidia', 'gopro', 'dji', 'canon', 'nikon'
]);
const STOP_WORDS = new Set(['the', 'new', 'a', 'an', 'for', 'with', 'of']);
const PARENTHETICAL_REGEX = /[\(\[\{].*?[\)\]\}]/g;
const FLUFF_WORDS_REGEX = /\b(with\s\w+|combo|edition|new|latest|special|limited|for|and|plus|pro|max|ultra|lite|se|fe|gb|tb|ram|model|color|edition|gen|generation)\b/gi;
const SPECIAL_CHARS_REGEX = /[^\p{L}\p{N}\s-]/gu;
const MODEL_NUMBER_PATTERNS = [
    /\b([A-Z]{2,}\s?-\s?[A-Z0-9]{3,})\b/i, // SM-G998B
    /\b(iPhone\s\d{1,2}|Galaxy\s[SZN]\d{1,2}|Pixel\s\d[a-z]?|Note\s\d{1,2})\b/i, // iPhone 14
    /\b([A-Z0-9]{3,}[-./]?[A-Z0-9]{3,})\b/i // G-998B
];

// --- 2. Utility Functions (Same as before) ---

const normalize = (str) => (str || '').toLowerCase().trim();

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

function extractModelNumber(title) {
    if (!title) return null;
    for (const pattern of MODEL_NUMBER_PATTERNS) {
        const match = title.match(pattern);
        if (match && match[0]) {
            return normalize(match[0]).replace(/\s/g, '');
        }
    }
    return null;
}

function cleanTitle(title) {
    if (!title) return '';
    let cleaned = title
        .replace(PARENTHETICAL_REGEX, '')
        .replace(FLUFF_WORDS_REGEX, '')
        .replace(SPECIAL_CHARS_REGEX, '')
        .replace(/\s+/g, ' ')
        .trim();
    return normalize(cleaned);
}


// --- 3. Core Matching Logic (Now with Hybrid API call) ---

/**
 * Compares two product objects (A and B) using a hierarchical strategy.
 *
 * @param {object} productA - First product { title, brand?, model_number? }
 * @param {object} productB - Second product { title, brand?, model_number? }
 * @param {object} [options] - Configuration options.
 * @param {number} [options.hardThreshold=0.8] - Jaccard score for an automatic "yes".
 * @param {number} [options.rejectThreshold=0.3] - Jaccard score for an automatic "no".
 * @param {number} [options.semanticThreshold=0.85] - API score for a semantic "yes".
 * @returns {Promise<object>} - The match result object.
 */
async function matchProducts(productA, productB, options = {}) {
    // Default thresholds for the hybrid approach
    const config = {
        hardThreshold: 0.8,     // Jaccard: auto-match
        rejectThreshold: 0.3,   // Jaccard: auto-reject
        semanticThreshold: 0.85, // API: semantic match
        ...options
    };

    const baseResult = { matched: false, score: 0, method: null, reason: "" };

    if (!productA?.title || !productB?.title) {
        return { ...baseResult, reason: "One or both products lack a title." };
    }

    // --- Step 1: Extract and Normalize Data ---
    const brandA = normalize(productA.brand || extractBrand(productA.title));
    const brandB = normalize(productB.brand || extractBrand(productB.title));
    const modelA = normalize(productA.model_number || extractModelNumber(productA.title));
    const modelB = normalize(productB.model_number || extractModelNumber(productB.title));

    // --- Step 2: Strict Matching (Brand + Model) ---
    if (brandA && brandB && brandA === brandB) {
        if (modelA && modelB && modelA === modelB) {
            return {
                matched: true,
                score: 1.0,
                method: "brand+model",
                reason: `Exact match on brand '${brandA}' and model '${modelA}'`
            };
        }
    }

    // --- Step 3: Hard Rejection (Brand Mismatch) ---
    if (brandA && brandB && brandA !== brandB) {
        return {
            ...baseResult,
            reason: `Brand mismatch: '${brandA}' vs '${brandB}'`
        };
    }

    // --- Step 4: Jaccard Similarity Filter ---
    const cleanTitleA = cleanTitle(productA.title);
    const cleanTitleB = cleanTitle(productB.title);
    const tokensA = tokenizer.tokenize(cleanTitleA);
    const tokensB = tokenizer.tokenize(cleanTitleB);

    if (tokensA.length === 0 || tokensB.length === 0) {
        return { ...baseResult, reason: "One or both titles had no tokens after cleaning." };
    }

    const jaccardScore = JaccardIndex(tokensA, tokensB);

    // Case 1: High similarity (auto-match)
    if (jaccardScore >= config.hardThreshold) {
        return {
            matched: true,
            score: jaccardScore,
            method: "jaccard",
            reason: `Jaccard score ${jaccardScore.toFixed(3)} >= hard threshold ${config.hardThreshold}`
        };
    }

    // Case 2: Low similarity (auto-reject)
    if (jaccardScore < config.rejectThreshold) {
        return {
            ...baseResult,
            score: jaccardScore,
            method: "jaccard",
            reason: `Jaccard score ${jaccardScore.toFixed(3)} < reject threshold ${config.rejectThreshold}`
        };
    }

    // --- Step 5: "Maybe" Zone - Call Semantic API ---
    // The Jaccard score is between rejectThreshold and hardThreshold.
    // We pass the *original* titles to the API for the best semantic context.
    console.log(`[Matcher] Jaccard score ${jaccardScore.toFixed(3)} is ambiguous. Calling API...`);
    
    // Pass the full config so the API knows what semanticThreshold to use
    return await checkWithSemanticAPI(productA.title, productB.title, config);
}

/**
 * Iterates a list of products to find the single best match for a target product.
 * NOTE: This function is now ASYNC.
 *
 * @param {object} productToMatch - The product you're looking for.
 * @param {object[]} productList - The list of products to search within.
 * @param {object} [options] - Configuration options (passed to matchProducts).
 * @returns {Promise<object | null>} - An object { item, result } or null if no match.
 */
async function findBestMatch(productToMatch, productList, options = {}) {
    let bestMatch = null;
    let bestMatchResult = { score: -1, matched: false };

    for (const candidateProduct of productList) {
        // Use 'await' since matchProducts is now async
        const matchResult = await matchProducts(productToMatch, candidateProduct, options);

        if (matchResult.matched && matchResult.score > bestMatchResult.score) {
            bestMatch = candidateProduct;
            bestMatchResult = matchResult;

            // Optimization: A perfect brand+model match is unbeatable.
            if (matchResult.method === 'brand+model') {
                break;
            }
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
    findBestMatch,
    cleanTitle,
    extractBrand,
    extractModelNumber
};