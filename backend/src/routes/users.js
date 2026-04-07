'use strict';

const { Router } = require('express');
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

function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ status: 'error', message: 'Admin access required.' });
    }
    next();
}

// =============================================================================
// GET /api/users
// =============================================================================
// Fetches all users on the platform. Accessible only to admins.
// =============================================================================
router.get('/', authenticateToken, requireAdmin, async (req, res, next) => {
    try {
        const sql = `
            SELECT id, full_name, email, role, is_active, created_at
            FROM users
            ORDER BY created_at DESC;
        `;
        const { rows } = await query(sql);
        return res.status(200).json({ status: 'ok', count: rows.length, users: rows });
    } catch (err) {
        console.error('[Users] GET /api/users error:', err.message);
        next(err);
    }
});

// =============================================================================
// PATCH /api/users/:id/block
// =============================================================================
// Toggles the is_active status of a user. Accessible only to admins.
// =============================================================================
router.patch('/:id/block', authenticateToken, requireAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;

        // Prevent an admin from blocking themselves
        if (id === req.user.id) {
            return res.status(400).json({ status: 'error', message: 'You cannot block yourself.' });
        }

        // Standard toggle: if is_active is true, make it false, and vice versa.
        const sql = `
            UPDATE users 
            SET is_active = NOT is_active 
            WHERE id = $1 
            RETURNING id, full_name, email, role, is_active;
        `;
        const { rows } = await query(sql, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'User not found.' });
        }

        const actionWord = rows[0].is_active ? 'unblocked' : 'blocked';

        return res.status(200).json({
            status: 'ok',
            message: `User successfully ${actionWord}.`,
            user: rows[0]
        });

    } catch (err) {
        console.error('[Users] PATCH /api/users/:id/block error:', err.message);
        next(err);
    }
});

// =============================================================================
// DELETE /api/users/:id
// =============================================================================
// Permanently deletes a user. Cascades to delete their reports & vouches.
// =============================================================================
router.delete('/:id', authenticateToken, requireAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;

        // Prevent an admin from deleting themselves
        if (id === req.user.id) {
            return res.status(400).json({ status: 'error', message: 'You cannot delete your own account.' });
        }

        const sql = `
            DELETE FROM users 
            WHERE id = $1 
            RETURNING id, full_name, email;
        `;
        const { rows } = await query(sql, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'User not found.' });
        }

        return res.status(200).json({
            status: 'ok',
            message: 'User permanently deleted.',
            deletedUser: rows[0]
        });

    } catch (err) {
        console.error('[Users] DELETE /api/users/:id error:', err.message);
        next(err);
    }
});

module.exports = router;
