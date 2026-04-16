'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { testConnection, query } = require('./db');
const officerReportsRouter = require('./routes/officerReports');
const reportsRouter = require('./routes/reports');
const authRouter = require('./routes/auth');
const departmentsRouter = require('./routes/departments');
const adminRouter = require('./routes/admin');
const { seedDepartments } = require('./routes/departments');

// ─── App Setup ────────────────────────────────────────────────────────────────

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Core Middleware ──────────────────────────────────────────────────────────

app.use(helmet({
    // Allow the browser to load images served from /uploads
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Allow all origins temporarily for local network testing
app.use(cors({ origin: '*' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ─── Static Uploads ───────────────────────────────────────────────────────────
// Serve all files in backend/uploads/ at the /uploads URL path so the
// frontend can display submitted photos/videos using their media_url.
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * GET /api/health
 * DB-aware health check — useful for Docker HEALTHCHECK and uptime monitors.
 */
app.get('/api/health', async (req, res) => {
    try {
        const { rows } = await query(
            "SELECT NOW() AS db_time, PostGIS_Version() AS postgis_version"
        );
        return res.status(200).json({
            status: 'ok',
            server_time: new Date().toISOString(),
            db_time: rows[0].db_time,
            postgis_version: rows[0].postgis_version.split(' ')[0],
            environment: process.env.NODE_ENV || 'development',
        });
    } catch (err) {
        console.error('[Health] DB query failed:', err.message);
        return res.status(503).json({
            status: 'error',
            message: 'Database unreachable',
        });
    }
});

/**
 * GET /
 * Root route — quick sanity check.
 */
app.get('/', (req, res) => {
    res.json({
        project: 'Civic Issue Reporting System',
        version: '1.0.0',
        docs: '/api/health',
    });
});

// ─── Live Routes ─────────────────────────────────────────────────────────────

app.use('/api/officer/reports', officerReportsRouter);
app.use('/api/reports', reportsRouter);

// ─── Auth & User Management ─────────────────────────────────────────────────

app.use('/api/auth', authRouter);
const usersRouter = require('./routes/users');
app.use('/api/users', usersRouter);
app.use('/api/departments', departmentsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/heatmap', (req, res) => res.status(501).json({ message: 'Heatmap routes — coming soon' }));

// ─── 404 Handler ─────────────────────────────────────────────────────────────

app.use((req, res) => {
    res.status(404).json({ status: 'error', message: `Route not found: ${req.method} ${req.path}` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error('[Error]', err.stack || err.message);
    res.status(err.status || 500).json({
        status: 'error',
        message: err.message || 'Internal server error',
    });
});

// ─── Bootstrap ───────────────────────────────────────────────────────────────
// Only listen after confirming the DB connection. This makes failures explicit
// and prevents the app from accepting traffic with a broken DB.

const start = async () => {
    try {
        console.log('[Server] Testing database connection…');
        await testConnection();

        // Seed official departments into the database
        await seedDepartments();

        app.listen(PORT, () => {
            console.log(`\n┌─────────────────────────────────────────────────┐`);
            console.log(`│  🏙  Civic Issue Reporting System — Backend API  │`);
            console.log(`│  Listening on http://0.0.0.0:${PORT}               │`);
            console.log(`│  Environment : ${(process.env.NODE_ENV || 'development').padEnd(32)}│`);
            console.log(`│  Health check: http://127.0.0.1:${PORT}/api/health    │`);
            console.log(`└─────────────────────────────────────────────────┘\n`);
        });
    } catch (err) {
        console.error('[Server] Failed to start — could not reach database:');
        console.error(`         ${err.message}`);
        console.error('         Ensure the DB is running: docker-compose up -d db');
        process.exit(1);  // Non-zero exit so Docker/PM2 can restart the container
    }
};

start();
