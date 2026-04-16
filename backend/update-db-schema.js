/**
 * One-off migration script to bring the live database in sync with init.sql.
 *
 * What it does (all idempotent — safe to run more than once):
 *   1. Creates the `report_status` enum if missing (needed by audit_logs).
 *   2. Creates the `audit_logs` table.
 *   3. ALTERs `users`  — adds aadhaar, address, and verification columns.
 *   4. ALTERs `reports` — adds the `severity` column.
 *
 * Usage:
 *   cd backend
 *   node update-db-schema.js
 */

require('dotenv').config();          // loads backend/.env
const { pool } = require('./src/db');

async function run() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── 1. Ensure the report_status enum exists ─────────────────────────────
    console.log('⏳  Ensuring report_status enum exists …');
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE report_status AS ENUM (
          'pending', 'open', 'in_progress', 'resolved', 'rejected'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    console.log('✅  report_status enum OK');

    // ── 2. Ensure the issue_severity enum exists ────────────────────────────
    console.log('⏳  Ensuring issue_severity enum exists …');
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE issue_severity AS ENUM ('low', 'medium', 'high', 'critical');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    console.log('✅  issue_severity enum OK');

    // ── 3. Create audit_logs table ──────────────────────────────────────────
    console.log('⏳  Creating audit_logs table (if not exists) …');
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
        report_id       UUID            NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
        changed_by      UUID            NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
        old_status      report_status,
        new_status      report_status   NOT NULL,
        notes           TEXT,
        created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_report  ON audit_logs(report_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);`);
    console.log('✅  audit_logs table OK');

    // ── 4. ALTER users — add missing columns ────────────────────────────────
    console.log('⏳  Adding missing columns to users …');
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS aadhaar_number    VARCHAR(12) UNIQUE,
        ADD COLUMN IF NOT EXISTS home_address      TEXT,
        ADD COLUMN IF NOT EXISTS current_address   TEXT,
        ADD COLUMN IF NOT EXISTS is_email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_mobile_verified BOOLEAN NOT NULL DEFAULT FALSE;
    `);
    console.log('✅  users table OK');

    // ── 5. ALTER reports — add severity column ──────────────────────────────
    console.log('⏳  Adding severity column to reports …');
    await client.query(`
      ALTER TABLE reports
        ADD COLUMN IF NOT EXISTS severity VARCHAR(20) NOT NULL DEFAULT 'medium';
    `);
    console.log('✅  reports table OK');

    // ── 6. Ensure report_vouches table exists ───────────────────────────────
    console.log('⏳  Creating report_vouches table (if not exists) …');
    await client.query(`
      CREATE TABLE IF NOT EXISTS report_vouches (
        report_id   UUID        NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
        user_id     UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (report_id, user_id)
      );
    `);
    console.log('✅  report_vouches table OK');

    await client.query('COMMIT');
    console.log('\n🎉  All schema updates applied successfully!');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌  Migration failed — rolled back.\n', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
