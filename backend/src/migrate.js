require('dotenv').config({ path: '../.env' });
const { query } = require('./db');

async function runMigrations() {
    try {
        console.log("Running migrations...");
        
        // 1. users table
        await query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS home_address TEXT,
            ADD COLUMN IF NOT EXISTS current_address TEXT,
            ADD COLUMN IF NOT EXISTS aadhaar_number VARCHAR(12) UNIQUE CHECK (aadhaar_number ~ '^[0-9]{12}$'),
            ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS is_mobile_verified BOOLEAN NOT NULL DEFAULT FALSE;
        `);
        console.log("✅ Users table updated.");

        // 2. Enum type and reports table
        // We first try to create the enum type (catching the error if it already exists, as IF NOT EXISTS for ENUMS works differently without plpgsql in some older versions, but PostgreSQL 16 supports IF NOT EXISTS)
        await query(`
            DO $$ BEGIN
                CREATE TYPE issue_severity AS ENUM ('low', 'medium', 'high', 'critical');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await query(`
            ALTER TABLE reports
            ADD COLUMN IF NOT EXISTS severity issue_severity DEFAULT 'medium',
            ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'web';
        `);
        console.log("✅ Reports table updated.");

        console.log("All migrations completed successfully.");
        process.exit(0);

    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

runMigrations();
