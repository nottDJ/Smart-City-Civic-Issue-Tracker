'use strict';

const path = require('path');
const fs = require('fs');
const { Router } = require('express');
const multer = require('multer');
const { query } = require('../db');
const jwt = require('jsonwebtoken');

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

// ─── Multer Storage Config ────────────────────────────────────────────────────
// Files land in backend/uploads/ with a timestamp prefix to avoid collisions.

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

// Ensure the directory exists at startup
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
        const ext = path.extname(file.originalname);
        cb(null, `${unique}${ext}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB cap
    fileFilter: (_req, file, cb) => {
        const allowed = /image|video|audio/;
        cb(null, allowed.test(file.mimetype));
    },
});

// =============================================================================
// POST /api/reports
// =============================================================================
// Creates a new civic issue report submitted by a citizen.
//
// Accepts multipart/form-data:
//   title         — string (required)
//   description   — string (optional)
//   category      — string (required)
//   lat           — float  (required)
//   lng           — float  (required)
//   media         — file   (optional – image / video / audio)
// =============================================================================

router.post('/', authenticateToken, upload.single('media'), async (req, res, next) => {
    try {
        const { title, description, category, lat, lng } = req.body;

        // ── Validation ────────────────────────────────────────────────────────
        const missingFields = [];
        if (!title || !title.trim()) missingFields.push('title');
        if (!category || !category.trim()) missingFields.push('category');
        if (lat === undefined || lat === '') missingFields.push('lat');
        if (lng === undefined || lng === '') missingFields.push('lng');

        if (missingFields.length) {
            return res.status(400).json({
                status: 'error',
                message: `Missing required fields: ${missingFields.join(', ')}`,
            });
        }

        const latNum = parseFloat(lat);
        const lngNum = parseFloat(lng);
        if (isNaN(latNum) || isNaN(lngNum)) {
            return res.status(400).json({ status: 'error', message: 'Invalid lat/lng values.' });
        }

        // ── Optional media path ───────────────────────────────────────────────
        // Store a relative URL (/uploads/<filename>) so the frontend can load it.
        const mediaUrl = req.file ? `/uploads/${req.file.filename}` : null;

        // ── INSERT into PostgreSQL via PostGIS ────────────────────────────────

        // Use authenticated user ID instead of dummy user
        const reported_by = req.user.id;

        const sql = `
            INSERT INTO reports
                (title, description, category, location, status, multimedia_urls, reported_by)
            VALUES
                ($1, $2, $3,
                 ST_SetSRID(ST_MakePoint($4, $5), 4326),
                 'pending',
                 $6, $7)
            RETURNING
                id,
                title,
                description,
                category,
                status,
                multimedia_urls,
                ST_AsGeoJSON(location)::json AS location,
                created_at;
        `;

        const mediaArray = mediaUrl ? [mediaUrl] : [];

        const { rows } = await query(sql, [
            title.trim(),
            description?.trim() || null,
            category.trim(),
            lngNum,   // PostGIS MakePoint takes (lng, lat) — X then Y
            latNum,
            mediaArray,
            reported_by,
        ]);

        return res.status(201).json({
            status: 'ok',
            message: 'Report submitted successfully.',
            report: {
                ...rows[0],
                media_url: rows[0].multimedia_urls?.[0] || null, // Keep frontend compat
            },
        });

    } catch (err) {
        console.error('[Reports] POST /api/reports error:', err.message);

        // Multer errors (file too large, wrong type)
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ status: 'error', message: 'File exceeds the 25 MB limit.' });
        }

        next(err);
    }
});

// =============================================================================
// GET /api/reports
// =============================================================================
// Lightweight public listing (most-recent first, limited to 50).
// No auth required for MVP — citizens can browse submitted reports.
// =============================================================================

router.get('/', async (req, res, next) => {
    try {
        const { category, status, limit = 50 } = req.query;
        const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

        const conditions = [];
        const params = [];

        if (category) { params.push(category); conditions.push(`category = $${params.length}`); }
        if (status) { params.push(status); conditions.push(`status   = $${params.length}`); }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        params.push(safeLimit);

        const sql = `
            SELECT
                id, title, description, category, status, multimedia_urls, vouch_count,
                ST_AsGeoJSON(location)::json AS location,
                created_at
            FROM reports
            ${where}
            ORDER BY created_at DESC
            LIMIT $${params.length};
        `;

        const { rows } = await query(sql, params);
        return res.status(200).json({ status: 'ok', count: rows.length, reports: rows });

    } catch (err) {
        console.error('[Reports] GET /api/reports error:', err.message);
        next(err);
    }
});

// =============================================================================
// GET /api/reports/me
// =============================================================================
// Fetches the reports submitted by the authenticated citizen.
// =============================================================================

router.get('/me', authenticateToken, async (req, res, next) => {
    try {
        const user_id = req.user.id;
        const sql = `
            SELECT
                id, title, description, category, status, multimedia_urls, vouch_count,
                ST_AsGeoJSON(location)::json AS location,
                created_at
            FROM reports
            WHERE reported_by = $1
            ORDER BY created_at DESC;
        `;
        const { rows } = await query(sql, [user_id]);
        return res.status(200).json({ status: 'ok', count: rows.length, reports: rows });
    } catch (err) {
        console.error('[Reports] GET /api/reports/me error:', err.message);
        next(err);
    }
});

// =============================================================================
// POST /api/reports/:id/vouch
// =============================================================================
// Lets a citizen vouch for (upvote) an existing report.
//
// Body (JSON):
//   user_id — UUID of the vouching user (MVP: provided by client)
//
// Responses:
//   201 { vouch_count }        — vouch recorded, returns new count
//   400 "Already vouched"      — composite PK violation (user already vouched)
//   400 "Missing user_id"      — body validation failure
//   404 "Report not found"     — no report with that id
// =============================================================================

router.post('/:id/vouch', authenticateToken, async (req, res, next) => {
    try {
        const { id: reportId } = req.params;
        const user_id = req.user.id;

        // Verify the report exists
        const { rows: reportRows } = await query(
            'SELECT id FROM reports WHERE id = $1',
            [reportId]
        );
        if (!reportRows.length) {
            return res.status(404).json({ status: 'error', message: 'Report not found.' });
        }

        // Insert into the vouch ledger — composite PK (report_id, user_id) prevents duplicates
        try {
            await query(
                'INSERT INTO report_vouches (report_id, user_id) VALUES ($1, $2)',
                [reportId, user_id]
            );
        } catch (insertErr) {
            // PostgreSQL unique/PK violation error code
            if (insertErr.code === '23505') {
                return res.status(400).json({ status: 'error', message: 'You have already vouched for this report.' });
            }
            throw insertErr;
        }

        // Atomically increment and return the new count
        const { rows } = await query(
            'UPDATE reports SET vouch_count = vouch_count + 1 WHERE id = $1 RETURNING vouch_count',
            [reportId]
        );

        return res.status(201).json({
            status: 'ok',
            message: 'Vouch recorded.',
            vouch_count: rows[0].vouch_count,
        });

    } catch (err) {
        console.error('[Reports] POST /api/reports/:id/vouch error:', err.message);
        next(err);
    }
});

// =============================================================================
// PATCH /api/reports/:id/status
// =============================================================================
// Allows administrators to update the status of a report.
// =============================================================================
router.patch('/:id/status', authenticateToken, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ status: 'error', message: 'Status is required.' });
        }

        const allowedStatuses = ['pending', 'in_progress', 'resolved', 'rejected'];
        if (!allowedStatuses.includes(status.toLowerCase())) {
            return res.status(400).json({ status: 'error', message: 'Invalid status.' });
        }

        const { rows } = await query(
            'UPDATE reports SET status = $1 WHERE id = $2 RETURNING *',
            [status.toLowerCase(), id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Report not found.' });
        }

        return res.status(200).json({
            status: 'ok',
            message: 'Status updated.',
            report: rows[0]
        });

    } catch (err) {
        console.error('[Reports] PATCH /api/reports/:id/status error:', err.message);
        next(err);
    }
});

// =============================================================================
// DELETE /api/reports/:id
// =============================================================================
// Allows administrators to delete a report.
// =============================================================================
router.delete('/:id', authenticateToken, async (req, res, next) => {
    try {
        const { id } = req.params;

        const { rows } = await query(
            'DELETE FROM reports WHERE id = $1 RETURNING *',
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Report not found.' });
        }

        return res.status(200).json({
            status: 'ok',
            message: 'Report deleted successfully.',
            report: rows[0]
        });

    } catch (err) {
        console.error('[Reports] DELETE /api/reports/:id error:', err.message);
        next(err);
    }
});

module.exports = router;