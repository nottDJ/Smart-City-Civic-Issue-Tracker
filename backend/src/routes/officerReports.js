'use strict';

const { Router } = require('express');
const { getReportsSortedByPriority } = require('../services/priorityScoring');

const router = Router();

// =============================================================================
// GET /api/officer/reports
// =============================================================================
// Returns all actionable reports ranked by the AI priority score (descending).
//
// Query params:
//   status        — filter by report status (e.g. 'pending', 'open', 'in_progress')
//   department_id — filter by department ID
//   ward          — filter by ward number
//   page          — pagination page (default 1)
//   limit         — results per page (default 25, max 100)
// =============================================================================

router.get('/', async (req, res, next) => {
    try {
        const {
            status,
            department_id,
            ward,
            page = 1,
            limit = 25,
        } = req.query;

        // Sanitise pagination
        const safePage = Math.max(1, parseInt(page, 10) || 1);
        const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

        const result = await getReportsSortedByPriority({
            status: status || undefined,
            department_id: department_id ? parseInt(department_id, 10) : undefined,
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
