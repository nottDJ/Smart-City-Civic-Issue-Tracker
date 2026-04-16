'use strict';

const path = require('path');
const fs = require('fs');
const { Router } = require('express');
const multer = require('multer');
const { query } = require('../db');
const jwt = require('jsonwebtoken');
const { classifyIssue } = require('../services/aiClassification');
const { calculatePriorityScore } = require('../services/priorityScoring');

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

// ─── Smart Category Assignment ────────────────────────────────────────────────
// Uses AI department + keyword analysis of title/description for accuracy.
function classifyCategory(department, title, description) {
    const text = (`${title || ''} ${description || ''}`).toLowerCase();

    // Keyword → category mapping (checked first for precision)
    const KEYWORD_RULES = [
        { pattern: /(pothole|pot hole|road damage|road crack|road break|footpath|pavement|speed bump)/, category: 'pothole' },
        { pattern: /(street light|streetlight|lamp post|light pole|flickering light|dark street|no light|light out|bulb)/, category: 'street_light' },
        { pattern: /(garbage|trash|litter|waste|rubbish|kachra|dump|debris|dustbin|bin overflow)/, category: 'garbage' },
        { pattern: /(water leak|pipe burst|pipe leak|water supply|no water|tap|water main|water line|water break|water tanker)/, category: 'water_leak' },
        { pattern: /(sewage|sewer|drain|drainage|manhole|nala|naali|gutter|clogged drain|overflow drain|ganda pani|sewerage)/, category: 'sewage' },
        { pattern: /(illegal construction|encroachment|unauthorized|building violation|zoning)/, category: 'illegal_construction' },
        { pattern: /(tree|branch|fallen tree|uprooted|overgrown|bush|shrub|park damage|garden)/, category: 'tree_hazard' },
        { pattern: /(noise|noise pollution|loud|honking|loudspeaker|music)/, category: 'noise_pollution' },
        { pattern: /(encroach|footpath block|vendor|illegal parking|hawker)/, category: 'encroachment' },
    ];

    for (const rule of KEYWORD_RULES) {
        if (rule.pattern.test(text)) return rule.category;
    }

    // Fallback: department-based default
    const DEPT_DEFAULTS = {
        'Public Works': 'pothole',
        'Street Lighting': 'street_light',
        'Solid Waste Management': 'garbage',
        'Water Supply': 'water_leak',
        'Sewage & Sanitation': 'sewage',
        'Town Planning': 'illegal_construction',
        'Parks & Horticulture': 'tree_hazard',
        'General Administration': 'other',
    };

    return DEPT_DEFAULTS[department] || 'other';
}

// =============================================================================
// POST /api/reports
// =============================================================================
// Creates a new civic issue report submitted by a citizen.
// AI auto-classifies the department and severity from title + description.
//
// Accepts multipart/form-data:
//   title         — string (required)
//   description   — string (optional)
//   lat           — float  (required)
//   lng           — float  (required)
//   media         — file   (optional – image / video / audio)
// =============================================================================

router.post('/', authenticateToken, upload.single('media'), async (req, res, next) => {
    try {
        const { title, description, lat, lng, address_text } = req.body;

        // ── Validation ────────────────────────────────────────────────────────
        const missingFields = [];
        if (!title || !title.trim()) missingFields.push('title');
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

        // ── AI Classification ─────────────────────────────────────────────────
        console.log('[Reports] 🤖 Running AI classification…');
        const classification = await classifyIssue(title.trim(), description?.trim());
        console.log('[Reports] AI result:', JSON.stringify(classification));

        // Calculate Priority Score and Severity locally
        const { total: calcScore, severity: calcSeverity } = calculatePriorityScore({
            title: title.trim(),
            description: description?.trim() || '',
            address_text: address_text?.trim() || '',
            location: '',
            vouch_count: 0,
        });

        // Look up department_id from the AI's department string
        const { rows: deptRows } = await query(
            'SELECT id FROM departments WHERE name = $1',
            [classification.department]
        );
        const department_id = deptRows.length > 0 ? deptRows[0].id : null;

        // Map AI department to the closest DB category enum
        const category = classifyCategory(classification.department, title.trim(), description?.trim());

        // ── Optional media path ───────────────────────────────────────────────
        const mediaUrl = req.file ? `/uploads/${req.file.filename}` : null;

        // ── INSERT into PostgreSQL via PostGIS ────────────────────────────────
        const reported_by = req.user.id;

        const sql = `
            INSERT INTO reports
                (title, description, category, severity, priority_score, department_id,
                 location, status, multimedia_urls, reported_by, address_text)
            VALUES
                ($1, $2, $3, $4, $11, $5,
                 ST_SetSRID(ST_MakePoint($6, $7), 4326),
                 'pending',
                 $8, $9, $10)
            RETURNING
                id, title, description, category, severity, priority_score, department_id, status,
                multimedia_urls, address_text,
                ST_AsGeoJSON(location)::json AS location,
                created_at;
        `;

        const mediaArray = mediaUrl ? [mediaUrl] : [];

        const { rows } = await query(sql, [
            title.trim(),
            description?.trim() || null,
            category,
            calcSeverity, // use our calculated severity
            department_id,
            lngNum,   // PostGIS MakePoint takes (lng, lat) — X then Y
            latNum,
            mediaArray,
            reported_by,
            address_text?.trim() || null,
            calcScore
        ]);

        // Attach the human-readable department name to the response
        const report = {
            ...rows[0],
            media_url: rows[0].multimedia_urls?.[0] || null,
            ai_department: classification.department,
            ai_severity: calcSeverity,
        };

        return res.status(201).json({
            status: 'ok',
            message: 'Report submitted and classified by AI.',
            report,
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
// Now includes severity and department info.
// =============================================================================

router.get('/', async (req, res, next) => {
    try {
        const { category, status, severity, limit = 50 } = req.query;
        const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

        const conditions = [];
        const params = [];

        if (category) { params.push(category); conditions.push(`r.category = $${params.length}`); }
        if (status)   { params.push(status);   conditions.push(`r.status   = $${params.length}`); }
        if (severity) { params.push(severity); conditions.push(`r.severity = $${params.length}`); }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        params.push(safeLimit);

        const sql = `
            SELECT
                r.id, r.title, r.description, r.category, r.status,
                r.severity, r.priority_score, r.department_id, d.name AS department_name,
                r.multimedia_urls, r.vouch_count, r.address_text,
                ST_AsGeoJSON(r.location)::json AS location,
                r.created_at
            FROM reports r
            LEFT JOIN departments d ON r.department_id = d.id
            ${where}
            ORDER BY r.created_at DESC
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
                r.id, r.title, r.description, r.category, r.status,
                r.severity, r.department_id, d.name AS department_name,
                r.multimedia_urls, r.vouch_count, r.address_text,
                ST_AsGeoJSON(r.location)::json AS location,
                r.created_at
            FROM reports r
            LEFT JOIN departments d ON r.department_id = d.id
            WHERE r.reported_by = $1
            ORDER BY r.created_at DESC;
        `;
        const { rows } = await query(sql, [user_id]);
        return res.status(200).json({ status: 'ok', count: rows.length, reports: rows });
    } catch (err) {
        console.error('[Reports] GET /api/reports/me error:', err.message);
        next(err);
    }
});

// =============================================================================
// GET /api/reports/my-vouches
// =============================================================================
// Fetches reports the authenticated user has vouched for (but didn't create).
// =============================================================================

router.get('/my-vouches', authenticateToken, async (req, res, next) => {
    try {
        const user_id = req.user.id;
        const sql = `
            SELECT
                r.id, r.title, r.description, r.category, r.status,
                r.severity, r.department_id, d.name AS department_name,
                r.multimedia_urls, r.vouch_count, r.address_text,
                ST_AsGeoJSON(r.location)::json AS location,
                r.created_at,
                rv.created_at AS vouched_at
            FROM report_vouches rv
            JOIN reports r ON r.id = rv.report_id
            LEFT JOIN departments d ON r.department_id = d.id
            WHERE rv.user_id = $1
            ORDER BY rv.created_at DESC;
        `;
        const { rows } = await query(sql, [user_id]);
        return res.status(200).json({ status: 'ok', count: rows.length, reports: rows });
    } catch (err) {
        console.error('[Reports] GET /api/reports/my-vouches error:', err.message);
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
        // Only admins and officers can change status
        if (!['admin', 'officer'].includes(req.user.role)) {
            return res.status(403).json({ status: 'error', message: 'Only officers and admins can update report status.' });
        }

        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ status: 'error', message: 'Status is required.' });
        }

        const allowedStatuses = ['pending', 'in_progress', 'resolved', 'rejected'];
        if (!allowedStatuses.includes(status.toLowerCase())) {
            return res.status(400).json({ status: 'error', message: 'Invalid status.' });
        }

        // Fetch current status for audit log
        const { rows: currentRows } = await query('SELECT status FROM reports WHERE id = $1', [id]);
        if (currentRows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Report not found.' });
        }
        const oldStatus = currentRows[0].status;

        // Update with resolved_at timestamp if resolving
        const resolvedClause = status.toLowerCase() === 'resolved' ? ', resolved_at = NOW()' : '';
        const { rows } = await query(
            `UPDATE reports SET status = $1${resolvedClause} WHERE id = $2 RETURNING *`,
            [status.toLowerCase(), id]
        );

        // Write audit log
        await query(
            'INSERT INTO audit_logs (report_id, changed_by, old_status, new_status) VALUES ($1, $2, $3, $4)',
            [id, req.user.id, oldStatus, status.toLowerCase()]
        );

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