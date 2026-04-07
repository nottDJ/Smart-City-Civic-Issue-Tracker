'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');

// ─── Gemini Client ───────────────────────────────────────────────────────────
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error('[AI Classification] GEMINI_API_KEY is not set in .env — all classifications will use fallback values.');
}
const genAI = new GoogleGenerativeAI(apiKey || 'missing-key');

// Department names must EXACTLY match what's seeded in the database (init.sql)
const VALID_DEPARTMENTS = [
    'Public Works',
    'Street Lighting',
    'Solid Waste Management',
    'Water Supply',
    'Sewage & Sanitation',
    'Town Planning',
    'Parks & Horticulture',
    'General Administration',
];

const SYSTEM_PROMPT = `You are a municipal dispatch AI for an Indian smart city civic issue tracker. 
Your job is to analyze a citizen's reported issue and classify it.

You MUST respond with ONLY a raw JSON object — no markdown, no backticks, no explanation.

The JSON must have exactly these two keys:
1. "department" — one of the following exact department names:
   - "Public Works"
   - "Street Lighting"
   - "Solid Waste Management"
   - "Water Supply"
   - "Sewage & Sanitation"
   - "Town Planning"
   - "Parks & Horticulture"
   - "General Administration"

2. "severity" — one of: "critical", "high", "medium", "low"

Severity guidelines (YOU MUST FOLLOW THIS STRICTLY):
- "critical": Immediate danger to life, major infrastructure collapse, large water main burst, gas leak. CRITICAL OVERRIDE: If there is ANY mention of live electricity, sparking wires, or electricity near water, it MUST be "critical".
- "high": Significant inconvenience or safety risk affecting many people — large potholes on busy roads, broken traffic signals, overflowing sewage.
- "medium": Moderate issues affecting daily life — uncollected garbage dumps, dead animals, minor water leaks, damaged footpaths.
- "low": Minor or cosmetic issues — flickering streetlights, faded road markings, overgrown shrubs, noise complaints.

Example input: "Major pothole on MG Road causing accidents"
Example output: {"department":"Public Works","severity":"high"}

Example input: "Exposed electrical wires hanging from a broken pole near the school"
Example output: {"department":"Street Lighting","severity":"critical"}`;

/**
 * Sleep helper for retry backoff
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Classify a civic issue using Gemini AI.
 * Includes retry logic for rate-limit (429) errors.
 * 
 * @param {string} title       — The issue title
 * @param {string} description — The issue description (can be empty)
 * @returns {Promise<{ department: string, severity: string }>}
 */
async function classifyIssue(title, description) {
    const userPrompt = `Issue Title: ${title}\nDescription: ${description || 'No description provided.'}`;
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

            const result = await model.generateContent({
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: SYSTEM_PROMPT + '\n\nClassify the following issue:\n\n' + userPrompt }]
                    }
                ],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 150,
                },
            });

            const responseText = result.response.text().trim();
            console.log('[AI Classification] Raw response:', responseText);

            // Parse JSON — strip markdown code fences if the model wraps them
            const cleaned = responseText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
            const parsed = JSON.parse(cleaned);

            // Validate department against EXACT database names
            if (!VALID_DEPARTMENTS.includes(parsed.department)) {
                console.warn(`[AI Classification] Unknown department "${parsed.department}", falling back to General Administration.`);
                parsed.department = 'General Administration';
            }

            // Validate severity
            const validSeverities = ['critical', 'high', 'medium', 'low'];
            const severity = (parsed.severity || '').toLowerCase();
            if (!validSeverities.includes(severity)) {
                console.warn(`[AI Classification] Unknown severity "${parsed.severity}", falling back to medium.`);
                parsed.severity = 'medium';
            } else {
                parsed.severity = severity;
            }

            return parsed;

        } catch (err) {
            const isRateLimit = err.status === 429 || (err.message && err.message.includes('429'));

            // ─── FULL ERROR LOGGING ───────────────────────────────────────────
            console.error(`[AI Classification] Attempt ${attempt}/${MAX_RETRIES} FAILED:`);
            console.error('  Error:', err.message);
            if (err.status) console.error('  HTTP Status:', err.status);
            if (err.errorDetails) console.error('  Details:', JSON.stringify(err.errorDetails, null, 2));

            // If rate-limited and we have retries left, wait and try again
            if (isRateLimit && attempt < MAX_RETRIES) {
                const waitSec = attempt * 10; // 10s, 20s
                console.log(`[AI Classification] Rate limited — waiting ${waitSec}s before retry…`);
                await sleep(waitSec * 1000);
                continue;
            }

            // Final attempt failed or non-retriable error
            console.error('[AI Classification] All retries exhausted or non-retriable error. Using fallback.');

            // Graceful fallback — never block a citizen's report
            return {
                department: 'General Administration',
                severity: 'medium',
            };
        }
    }
}

module.exports = { classifyIssue };