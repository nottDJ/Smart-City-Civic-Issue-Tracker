'use strict';

const { Router } = require('express');
const jwt = require('jsonwebtoken');
const { query } = require('../db');
const { getReportsSortedByPriority } = require('../services/priorityScoring');

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_in_prod';

// ─── Auth Middleware ──────────────────────────────────────────────────────────
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ status: 'error', message: 'Access denied. No token provided.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ status: 'error', message: 'Invalid or expired token.' });
        req.user = user;
        next();
    });
}

// =============================================================================
// GET /api/officer/reports
// =============================================================================
// Returns actionable reports for the authenticated officer, filtered by their
// department (auto-injected from user record), ranked by AI priority score.
//
// Query params:
//   status        — filter by report status (e.g. 'pending', 'open', 'in_progress')
//   ward          — filter by ward number
//   page          — pagination page (default 1)
//   limit         — results per page (default 25, max 100)
// =============================================================================

router.get('/', authenticateToken, async (req, res, next) => {
    try {
        // Only officers and admins can access this endpoint
        if (!['officer', 'admin'].includes(req.user.role)) {
            return res.status(403).json({ status: 'error', message: 'Officer or admin access required.' });
        }

        const {
            status,
            ward,
            page = 1,
            limit = 25,
        } = req.query;

        // Sanitise pagination
        const safePage = Math.max(1, parseInt(page, 10) || 1);
        const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

        // Look up the officer's department_id from the database
        let department_id = undefined;
        if (req.user.role === 'officer') {
            const { rows: userRows } = await query(
                'SELECT department_id FROM users WHERE id = $1',
                [req.user.id]
            );
            if (userRows.length > 0 && userRows[0].department_id) {
                department_id = userRows[0].department_id;
            }
        }
        // Admins see all reports — no department filter

        const result = await getReportsSortedByPriority({
            status: status || undefined,
            department_id,
            ward_number: ward || undefined,
            page: safePage,
            limit: safeLimit,
        });

        return res.status(200).json({
            status: 'ok',
            count: result.reports.length,
            total: result.total,
            page: result.page,
            limit: result.limit,
            reports: result.reports,
        });
    } catch (err) {
        console.error('[OfficerReports] Error fetching priority queue:', err.message);
        next(err);
    }
});

module.exports = router;
