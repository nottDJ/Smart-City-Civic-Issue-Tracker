const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('../db');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_in_prod';
const JWT_EXPIRES_IN = '7d';

// =============================================================================
// POST /api/auth/register
// =============================================================================
router.post('/register', async (req, res, next) => {
    try {
        const { full_name, email, password } = req.body;

        if (!full_name || !email || !password) {
            return res.status(400).json({ status: 'error', message: 'Name, email, and password are required.' });
        }

        // Check if email already exists
        const { rows: existingUsers } = await query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUsers.length > 0) {
            return res.status(400).json({ status: 'error', message: 'An account with this email already exists.' });
        }

        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Insert into database
        const { rows } = await query(
            `INSERT INTO users (full_name, email, password_hash, role) 
             VALUES ($1, $2, $3, 'citizen') 
             RETURNING id, full_name, email, role, created_at`,
            [full_name, email, passwordHash]
        );

        const newUser = rows[0];

        // Generate JWT
        const token = jwt.sign(
            { id: newUser.id, role: newUser.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        return res.status(201).json({
            status: 'ok',
            message: 'Registration successful',
            token,
            user: newUser
        });

    } catch (err) {
        console.error('[Auth] POST /register error:', err.message);
        next(err);
    }
});

// =============================================================================
// POST /api/auth/login
// =============================================================================
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ status: 'error', message: 'Email and password are required.' });
        }

        // Find user by email
        const { rows } = await query(
            'SELECT id, full_name, email, password_hash, role FROM users WHERE email = $1',
            [email]
        );

        if (rows.length === 0) {
            return res.status(401).json({ status: 'error', message: 'Invalid email or password.' });
        }

        const user = rows[0];

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ status: 'error', message: 'Invalid email or password.' });
        }

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, role: user.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        // Don't send the hash back to the client
        delete user.password_hash;

        return res.status(200).json({
            status: 'ok',
            message: 'Login successful',
            token,
            user
        });

    } catch (err) {
        console.error('[Auth] POST /login error:', err.message);
        next(err);
    }
});

module.exports = router;
