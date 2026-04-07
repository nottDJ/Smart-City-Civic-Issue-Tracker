const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const { query } = require('../db');

const router = express.Router();

const otpStore = new Map(); // Simple in-memory cache: Map<email|phone, { otp: string, expiresAt: number, verified: boolean }>

// Nodemailer config
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// Twilio config
const twilioClient = process.env.TWILIO_ACCOUNT_SID 
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_in_prod';
const JWT_EXPIRES_IN = '7d';

// =============================================================================
// POST /api/auth/send-otp
// =============================================================================
router.post('/send-otp', async (req, res, next) => {
    try {
        const { contact, type } = req.body;
        if (!contact || !type) return res.status(400).json({ status: 'error', message: 'Contact and type required.' });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 10 * 60 * 1000;
        otpStore.set(contact, { otp, expiresAt, verified: false });

        if (type === 'email') {
            if (process.env.SMTP_USER && process.env.SMTP_PASS) {
                await transporter.sendMail({
                    from: `"CivicReport" <${process.env.SMTP_USER}>`,
                    to: contact,
                    subject: 'Your CivicReport Verification Code',
                    text: `Your OTP is: ${otp}`
                });
            } else {
                console.log(`[Email OTP Fallback] Sent to ${contact}: ${otp}`);
            }
        } else if (type === 'mobile') {
            if (twilioClient && process.env.TWILIO_PHONE_NUMBER) {
                await twilioClient.messages.create({
                    body: `Your CivicReport OTP is: ${otp}`,
                    from: process.env.TWILIO_PHONE_NUMBER,
                    to: contact
                });
            } else {
                console.log(`[Mobile OTP Fallback] Sent to ${contact}: ${otp}`);
            }
        } else {
            return res.status(400).json({ status: 'error', message: 'Invalid type.' });
        }
        return res.status(200).json({ status: 'ok', message: `OTP sent successfully via ${type}.` });
    } catch (err) {
        console.error('[Auth] POST /send-otp error:', err.message);
        return res.status(500).json({ status: 'error', message: 'Failed to send OTP.' });
    }
});

// =============================================================================
// POST /api/auth/verify-otp
// =============================================================================
router.post('/verify-otp', async (req, res, next) => {
    try {
        const { contact, otp } = req.body;
        if (!contact || !otp) return res.status(400).json({ status: 'error', message: 'Contact and OTP required.' });

        const record = otpStore.get(contact);
        if (!record) return res.status(400).json({ status: 'error', message: 'No OTP requested for this contact.' });
        if (Date.now() > record.expiresAt) {
            otpStore.delete(contact);
            return res.status(400).json({ status: 'error', message: 'OTP expired.' });
        }
        if (record.otp !== otp) return res.status(400).json({ status: 'error', message: 'Invalid OTP.' });

        otpStore.set(contact, { ...record, verified: true });
        return res.status(200).json({ status: 'ok', message: 'OTP verified successfully.' });
    } catch (err) {
        console.error('[Auth] POST /verify-otp error:', err.message);
        next(err);
    }
});

// =============================================================================
// POST /api/auth/register
// =============================================================================
router.post('/register', async (req, res, next) => {
    try {
        const { full_name, email, password, phone, home_address, current_address, aadhaar_number } = req.body;

        if (!full_name || !email || !password || !phone || !aadhaar_number) {
            return res.status(400).json({ status: 'error', message: 'Required fields missing.' });
        }

        // OTP verification removed per user request

        // Check if email already exists
        const { rows: existingUsers } = await query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUsers.length > 0) {
            return res.status(400).json({ status: 'error', message: 'An account with this email already exists.' });
        }

        // Check if Aadhaar already exists
        const { rows: existingAadhaar } = await query('SELECT id FROM users WHERE aadhaar_number = $1', [aadhaar_number]);
        if (existingAadhaar.length > 0) {
            return res.status(400).json({ status: 'error', message: 'An account with this Aadhaar already exists.' });
        }

        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Insert into database
        const { rows } = await query(
            `INSERT INTO users (
                full_name, email, password_hash, role, 
                phone, home_address, current_address, aadhaar_number,
                is_email_verified, is_mobile_verified
            ) 
             VALUES ($1, $2, $3, 'citizen', $4, $5, $6, $7, true, true) 
             RETURNING id, full_name, email, role, created_at`,
            [full_name, email, passwordHash, phone, home_address, current_address, aadhaar_number]
        );

        // No OTP store to clear
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
