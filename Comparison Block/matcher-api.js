// matcher-api.js

/**
 * The Hugging Face Inference API URL for our chosen sentence-similarity model.
 */
const API_URL = "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2";

/**
 * Checks semantic similarity using the Hugging Face API.
 * @param {string} titleA - The first product title.
 * @param {string} titleB - The second product title.
 * @param {object} config - Configuration object containing the semanticThreshold.
 * @returns {Promise<object>} - A standard match result object.
 */
async function checkWithSemanticAPI(titleA, titleB, config) {
    const token = process.env.HF_API_TOKEN;

    if (!token) {
        console.error("[Matcher API] Error: HF_API_TOKEN is not set in your .env file.");
        return {
            matched: false,
            score: 0,
            method: "semantic",
            reason: "API key not configured."
        };
    }

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                inputs: {
                    source_sentence: titleA,
                    sentences: [titleB] // Compare the source against this list
                }
            })
        });

        if (!response.ok) {
            // Handle common "model is loading" error
            if (response.status === 503) {
                return {
                    matched: false,
                    score: 0,
                    method: "semantic",
                    reason: "API model is loading. Try again in a moment."
                };
            }
            throw new Error(`API request failed with status ${response.status}`);
        }

        const scores = await response.json();

        // The API returns an array of scores, one for each sentence we provided.
        // Since we only provided one, we take the first score.
        const score = scores[0];

        if (score >= config.semanticThreshold) {
            return {
                matched: true,
                score: score,
                method: "semantic",
                reason: `Semantic score ${score.toFixed(3)} >= threshold ${config.semanticThreshold}`
            };
        } else {
            return {
                matched: false,
                score: score,
                method: "semantic",
                reason: `Semantic score ${score.toFixed(3)} < threshold ${config.semanticThreshold}`
            };
        }

    } catch (error) {
        console.error("[Matcher API] Error calling Hugging Face:", error.message);
        return {
            matched: false,
            score: 0,
            method: "semantic",
            reason: `API call failed: ${error.message}`
        };
    }
}

module.exports = { checkWithSemanticAPI };