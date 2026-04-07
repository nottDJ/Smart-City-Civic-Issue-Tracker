/**
 * Standalone test for the AI classification service.
 * 
 * Run from the backend directory:
 *   node test-ai.js
 */
'use strict';

require('dotenv').config();
const fs = require('fs');
const { classifyIssue } = require('./src/services/aiClassification');

async function main() {
    const log = [];
    log.push('=== AI Classification Test ===');
    log.push('GEMINI_API_KEY: ' + (process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.slice(0, 10) + '...' : 'MISSING'));
    log.push('Time: ' + new Date().toISOString());
    log.push('');

    const testCases = [
        { title: 'Sparking wires', description: 'Live power cable in water near the children\'s park' },
        { title: 'Massive pothole on MG Road', description: 'A 3-foot deep pothole is causing accidents near the bus stop' },
        { title: 'Garbage not collected for 5 days', description: 'The garbage bin at sector 4 junction is overflowing' },
    ];

    for (const tc of testCases) {
        log.push('--- Test: "' + tc.title + '" ---');
        const start = Date.now();
        const result = await classifyIssue(tc.title, tc.description);
        log.push('  Result: ' + JSON.stringify(result));
        log.push('  Time: ' + (Date.now() - start) + 'ms');
        log.push('');
    }

    log.push('=== Done ===');
    
    const output = log.join('\n');
    fs.writeFileSync('test-ai-result.txt', output, 'utf8');
    
    // Also print to console
    console.log(output);
}

main().catch(err => {
    console.error('Top-level error:', err);
    process.exit(1);
});
