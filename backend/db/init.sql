-- =============================================================================
-- Civic Issue Reporting System — Database Initialisation Script
-- PostgreSQL 16 + PostGIS 3.4
-- =============================================================================
-- Tables created in dependency order:
--   1. departments
--   2. users
--   3. reports
-- =============================================================================

-- Enable PostGIS extension (pre-installed in the postgis/postgis image)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enable pg_crypto for gen_random_uuid() (available in PostgreSQL >= 13)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- ENUM TYPES
-- ─────────────────────────────────────────────────────────────────────────────

-- RBAC roles
CREATE TYPE user_role AS ENUM ('citizen', 'officer', 'admin');

-- Issue lifecycle statuses
CREATE TYPE report_status AS ENUM (
    'pending',       -- Just submitted, awaiting triage
    'open',          -- Acknowledged, routed to a department
    'in_progress',   -- Officer actively working on it
    'resolved',      -- Issue fixed / closed
    'rejected'       -- Duplicate, out-of-scope, or spam
);

-- Broad civic issue categories (maps to department routing)
CREATE TYPE issue_category AS ENUM (
    'pothole',
    'street_light',
    'garbage',
    'water_leak',
    'sewage',
    'illegal_construction',
    'encroachment',
    'noise_pollution',
    'tree_hazard',
    'other'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. DEPARTMENTS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS departments (
    id            SERIAL          PRIMARY KEY,
    name          VARCHAR(120)    NOT NULL UNIQUE,
    description   TEXT,
    email         VARCHAR(255),
    phone         VARCHAR(20),
    created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Seed with official municipal departments
INSERT INTO departments (name, description) VALUES
    ('Electricity',             'Electrical infrastructure, power outages, and street lighting'),
    ('Water & Sanitation',      'Water supply, leaks, pipe bursts, and sanitation services'),
    ('Roads & Highways',        'Roads, footpaths, potholes, and highway maintenance'),
    ('Solid Waste Management',  'Garbage collection, waste disposal, and recycling'),
    ('Public Safety',           'Public safety, law enforcement support, and emergency services'),
    ('Public Works',            'Roads, footpaths, potholes, drainage'),
    ('Street Lighting',         'Street lights and electrical infrastructure'),
    ('Water Supply',            'Water leaks, pipe bursts, water quality'),
    ('Sewage & Sanitation',     'Sewage overflow, blocked drains'),
    ('Town Planning',           'Illegal construction & encroachments'),
    ('Parks & Horticulture',    'Park maintenance, trees, green spaces'),
    ('General Administration',  'Other civic issues')
ON CONFLICT (name) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. USERS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    -- Identity
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name       VARCHAR(255)    NOT NULL,
    email           VARCHAR(255)    NOT NULL UNIQUE,
    password_hash   VARCHAR(255)    NOT NULL,
    phone           VARCHAR(20),

    -- KYC / Aadhaar
    aadhaar_number  VARCHAR(12)     UNIQUE,
    home_address    TEXT,
    current_address TEXT,

    -- RBAC
    role            user_role       NOT NULL DEFAULT 'citizen',

    -- Officer-specific: which department they belong to
    department_id   INTEGER         REFERENCES departments(id) ON DELETE SET NULL,

    -- Citizen-specific: their ward / locality
    ward_number     VARCHAR(20),
    city            VARCHAR(100)    DEFAULT 'Mumbai',
    state           VARCHAR(100)    DEFAULT 'Maharashtra',

    -- Account flags
    is_verified     BOOLEAN         NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    is_email_verified  BOOLEAN      NOT NULL DEFAULT FALSE,
    is_mobile_verified BOOLEAN      NOT NULL DEFAULT FALSE,

    -- Audit
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Fast lookup by email (login) and by role (admin queries)
CREATE INDEX IF NOT EXISTS idx_users_email       ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role        ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_department  ON users(department_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. REPORTS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reports (
    -- Identity
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    title               VARCHAR(255)    NOT NULL,
    description         TEXT,

    -- Classification
    category            issue_category  NOT NULL DEFAULT 'other',
    status              report_status   NOT NULL DEFAULT 'pending',
    severity            VARCHAR(20)     NOT NULL DEFAULT 'medium',

    -- AI Priority Queue score (higher = more urgent; computed by NLP service)
    priority_score      SMALLINT        NOT NULL DEFAULT 0 CHECK (priority_score BETWEEN 0 AND 100),

    -- ── PostGIS Location ────────────────────────────────────────────────────
    -- EPSG:4326 = WGS84 (standard GPS lat/lng)
    location            GEOMETRY(Point, 4326),   -- live GPS coordinates
    address_text        TEXT,                    -- human-readable address fallback
    ward_number         VARCHAR(20),
    city                VARCHAR(100),
    state               VARCHAR(100),

    -- ── Multimedia ──────────────────────────────────────────────────────────
    -- Array of URLs to images/videos stored in cloud storage (e.g. Cloudinary)
    multimedia_urls     TEXT[]          NOT NULL DEFAULT '{}',

    -- ── Vouching (duplicate suppression) ───────────────────────────────────
    vouch_count         INTEGER         NOT NULL DEFAULT 0 CHECK (vouch_count >= 0),

    -- ── Relationships ────────────────────────────────────────────────────────
    department_id       INTEGER         REFERENCES departments(id) ON DELETE SET NULL,
    reported_by         UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_to         UUID            REFERENCES users(id) ON DELETE SET NULL,

    -- ── Audit Timestamps ────────────────────────────────────────────────────
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    resolved_at         TIMESTAMPTZ
);

-- Spatial index — critical for heatmap ST_Within / ST_DWithin queries
CREATE INDEX IF NOT EXISTS idx_reports_location     ON reports USING GIST(location);

-- Standard indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_reports_status       ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_category     ON reports(category);
CREATE INDEX IF NOT EXISTS idx_reports_reported_by  ON reports(reported_by);
CREATE INDEX IF NOT EXISTS idx_reports_assigned_to  ON reports(assigned_to);
CREATE INDEX IF NOT EXISTS idx_reports_department   ON reports(department_id);
CREATE INDEX IF NOT EXISTS idx_reports_ward         ON reports(ward_number);
CREATE INDEX IF NOT EXISTS idx_reports_priority     ON reports(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_reports_created_at   ON reports(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGER: auto-update `updated_at` on row modification
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_reports_updated_at
    BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- VOUCH LEDGER (prevents a user from vouching the same report twice)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS report_vouches (
    report_id   UUID        NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (report_id, user_id)   -- composite PK enforces one-vouch-per-user
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AUDIT LOGS (tracks status changes for live issue tracking)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id       UUID            NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    changed_by      UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    old_status      report_status,
    new_status      report_status   NOT NULL,
    notes           TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_report ON audit_logs(report_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- =============================================================================
-- Schema initialised successfully!
-- =============================================================================
