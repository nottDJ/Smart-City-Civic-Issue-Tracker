'use strict';

const { Router } = require('express');
const { query } = require('../db');

const router = Router();

// ─── Official Department Seed List ────────────────────────────────────────────
// These are inserted on server boot if they don't already exist.
const OFFICIAL_DEPARTMENTS = [
    { name: 'Electricity',              description: 'Electrical infrastructure, power outages, and street lighting' },
    { name: 'Water & Sanitation',       description: 'Water supply, leaks, pipe bursts, and sanitation services' },
    { name: 'Roads & Highways',         description: 'Roads, footpaths, potholes, and highway maintenance' },
    { name: 'Solid Waste Management',   description: 'Garbage collection, waste disposal, and recycling' },
    { name: 'Public Safety',            description: 'Public safety, law enforcement support, and emergency services' },
];

/**
 * Seed official departments into the database.
 * Uses ON CONFLICT (name) DO NOTHING so it is safe to call repeatedly.
 * Called once at import-time from server.js bootstrap.
 */
async function seedDepartments() {
    try {
        const values = OFFICIAL_DEPARTMENTS.map(
            (d, i) => `($${i * 2 + 1}, $${i * 2 + 2})`
        ).join(', ');

        const params = OFFICIAL_DEPARTMENTS.flatMap(d => [d.name, d.description]);

        await query(
            `INSERT INTO departments (name, description) VALUES ${values} ON CONFLICT (name) DO NOTHING`,
            params
        );

        console.log('[Departments] Official departments seeded successfully.');
    } catch (err) {
        console.error('[Departments] Failed to seed departments:', err.message);
    }
}

// =============================================================================
// GET /api/departments
// =============================================================================
// Public route — returns all departments for frontend dropdowns.
// =============================================================================
router.get('/', async (req, res, next) => {
    try {
        const { rows } = await query(
            'SELECT id, name, description FROM departments ORDER BY name ASC'
        );
        return res.status(200).json({ status: 'ok', departments: rows });
    } catch (err) {
        console.error('[Departments] GET /api/departments error:', err.message);
        next(err);
    }
});

module.exports = router;
module.exports.seedDepartments = seedDepartments;
