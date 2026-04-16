'use strict';

const { Router } = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('../db');

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

function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ status: 'error', message: 'Admin access required.' });
    }
    next();
}

// =============================================================================
// POST /api/admin/officers
// =============================================================================
// Creates a new officer account. Admin-only.
// Accepts: full_name, email, password, department_id
// Forces role to 'officer' — prevents privilege escalation.
// =============================================================================
router.post('/officers', authenticateToken, requireAdmin, async (req, res, next) => {
    try {
        const { full_name, email, password, department_id } = req.body;

        // ── Validation ──────────────────────────────────────────────────────
        if (!full_name || !email || !password || !department_id) {
            return res.status(400).json({
                status: 'error',
                message: 'All fields are required: full_name, email, password, department_id.'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid email format.'
            });
        }

        // Enforce minimum password length
        if (password.length < 6) {
            return res.status(400).json({
                status: 'error',
                message: 'Password must be at least 6 characters long.'
            });
        }

        // ── Check for duplicate email ───────────────────────────────────────
        const { rows: existing } = await query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );
        if (existing.length > 0) {
            return res.status(409).json({
                status: 'error',
                message: 'An account with this email already exists.'
            });
        }

        // ── Verify department exists ────────────────────────────────────────
        const { rows: deptRows } = await query(
            'SELECT id, name FROM departments WHERE id = $1',
            [department_id]
        );
        if (deptRows.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid department_id. Department does not exist.'
            });
        }

        // ── Hash password securely ──────────────────────────────────────────
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // ── Insert officer — role is HARDCODED to 'officer' ─────────────────
        const { rows } = await query(
            `INSERT INTO users (full_name, email, password_hash, role, department_id, is_verified, is_active)
             VALUES ($1, $2, $3, 'officer', $4, TRUE, TRUE)
             RETURNING id, full_name, email, role, department_id, created_at`,
            [full_name, email, passwordHash, department_id]
        );

        const newOfficer = rows[0];
        newOfficer.department_name = deptRows[0].name;

        console.log(`[Admin] Officer created: ${newOfficer.email} → Dept: ${newOfficer.department_name}`);

        return res.status(201).json({
            status: 'ok',
            message: `Officer "${full_name}" created successfully and assigned to ${newOfficer.department_name}.`,
            officer: newOfficer
        });

    } catch (err) {
        console.error('[Admin] POST /api/admin/officers error:', err.message);
        next(err);
    }
});

module.exports = router;
