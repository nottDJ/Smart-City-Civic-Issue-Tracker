'use strict';

const { Pool } = require('pg');

// ─── Connection Pool ──────────────────────────────────────────────────────────
// pg.Pool manages a set of reusable connections and is safe for concurrent use.
const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT, 10) || 5432,
  user:     process.env.DB_USER     || 'civic_user',
  password: process.env.DB_PASSWORD || 'civic_password',
  database: process.env.DB_NAME     || 'civic_db',

  // Connection pool sizing — tune for prod
  max:              20,   // max connections in pool
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// Log connection errors that occur outside of query calls
pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Execute a parameterised query.
 * @param {string} text  - SQL query string (use $1, $2 … for params)
 * @param {Array}  params - Query parameter values
 * @returns {Promise<import('pg').QueryResult>}
 */
const query = (text, params) => pool.query(text, params);

/**
 * Acquire a dedicated client from the pool.
 * Caller MUST call client.release() when done.
 * Useful for multi-statement transactions.
 * @returns {Promise<import('pg').PoolClient>}
 */
const getClient = () => pool.connect();

/**
 * Test that the DB is reachable and PostGIS is available.
 * Called at server startup — throws on failure so the process exits early.
 */
const testConnection = async () => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      "SELECT NOW() AS now, PostGIS_Version() AS postgis_version"
    );
    const { now, postgis_version } = rows[0];
    console.log(`[DB] Connected  — server time: ${now}`);
    console.log(`[DB] PostGIS    — version: ${postgis_version.split(' ')[0]}`);
  } finally {
    client.release();
  }
};

module.exports = { query, getClient, pool, testConnection };
