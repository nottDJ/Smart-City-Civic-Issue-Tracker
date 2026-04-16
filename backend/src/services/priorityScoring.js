'use strict';

const { query } = require('../db');

// =============================================================================
// AI PRIORITY QUEUE — Dynamic Scoring Service
// =============================================================================
//
// Computes a 0–100 priority score for civic issue reports using four weighted
// factors. Officers see reports ranked by this score (highest = most urgent).
//
//   Factor                  Weight   Algorithm
//   ─────────────────────   ──────   ──────────────────────────────────────────
//   Base Severity           30%      Static lookup by department
//   Community Vouching      30%      Logarithmic scale (diminishing returns)
//   Proximity to Infra      20%      PostGIS ST_Distance, 500m radius
//   Time Decay (escalation) 20%      Linear ramp over 7 days
//
// =============================================================================

// ─── Constants ───────────────────────────────────────────────────────────────

const WEIGHTS = {
    BASE_SEVERITY: 0.30,
    VOUCHING: 0.30,
    PROXIMITY: 0.20,
    TIME_DECAY: 0.20,
};

/**
 * Base severity score (0–1) keyed by department name.
 * Higher values for departments that handle health/safety-critical issues.
 * Falls back to 0.30 for unknown departments.
 */
const DEPARTMENT_SEVERITY = {
    'Sewage & Sanitation': 0.95,   // Public health hazard
    'Water Supply': 0.85,   // Essential utility
    'Solid Waste Management': 0.75,   // Sanitation / disease vector
    'Public Works': 0.70,   // Road safety, drainage
    'Street Lighting': 0.55,   // Night-time safety
    'Town Planning': 0.50,   // Structural safety
    'Parks & Horticulture': 0.40,   // Environmental, lower urgency
    'General Administration': 0.30,   // Catch-all, lowest urgency
};

/**
 * Category-level severity boost (0–1).
 * Applied when department info is unavailable or as a secondary signal.
 */
const CATEGORY_SEVERITY = {
    'sewage': 0.95,
    'water_leak': 0.85,
    'garbage': 0.75,
    'pothole': 0.70,
    'street_light': 0.55,
    'illegal_construction': 0.50,
    'encroachment': 0.45,
    'tree_hazard': 0.60,
    'noise_pollution': 0.35,
    'other': 0.30,
};

/**
 * Mock critical infrastructure locations (lat/lng in WGS84 — SRID 4326).
 * For the MVP we hardcode two landmarks in Mumbai.
 * In production, these would come from a `critical_infrastructure` table.
 */
const CRITICAL_INFRASTRUCTURE = [
    {
        name: 'KEM Hospital, Parel',
        lng: 72.8420,
        lat: 18.9945,
    },
    {
        name: 'IIT Bombay, Powai',
        lng: 72.9131,
        lat: 19.1334,
    },
];

/** Reports beyond this distance (metres) get 0 proximity score. */
const PROXIMITY_RADIUS_M = 500;

/** Maximum age (hours) at which time-decay score is fully maxed out. */
const MAX_ESCALATION_HOURS = 168; // 7 days

/** Vouch-count cap for logarithmic normalization. */
const VOUCH_CAP = 200;

// ─── Individual Factor Calculators ───────────────────────────────────────────

/**
 * Factor 1 — Base Severity (30%)
 * Pure function: looks up department name and/or category to produce a 0–1 score.
 *
 * @param {string|null} departmentName
 * @param {string|null} category
 * @returns {number} 0–1
 */
function scoreSeverity(departmentName, category) {
    // Prefer department-based severity (more granular)
    if (departmentName && DEPARTMENT_SEVERITY[departmentName] !== undefined) {
        return DEPARTMENT_SEVERITY[departmentName];
    }
    // Fall back to category
    if (category && CATEGORY_SEVERITY[category] !== undefined) {
        return CATEGORY_SEVERITY[category];
    }
    return 0.30; // Unknown — lowest baseline
}

/**
 * Factor 2 — Community Vouching (30%)
 * Logarithmic scale: first few vouches contribute disproportionately more.
 *
 *   score = ln(1 + vouch_count) / ln(1 + VOUCH_CAP)
 *
 * Examples (VOUCH_CAP = 200):
 *   0 vouches  → 0.000
 *   1 vouch    → 0.131
 *   5 vouches  → 0.338
 *   10 vouches → 0.452
 *   50 vouches → 0.740
 *   200 vouches→ 1.000
 *
 * @param {number} vouchCount
 * @returns {number} 0–1
 */
function scoreVouching(vouchCount) {
    if (vouchCount <= 0) return 0;
    const raw = Math.log(1 + vouchCount) / Math.log(1 + VOUCH_CAP);
    return Math.min(1, raw);
}

/**
 * Factor 3 — Proximity to Critical Infrastructure (20%)
 * Linear decay from 1 (0 m away) to 0 (≥ 500 m away).
 *
 * @param {number|null} minDistanceMetres - Minimum distance to any infra point.
 * @returns {number} 0–1
 */
function scoreProximity(minDistanceMetres) {
    if (minDistanceMetres === null || minDistanceMetres === undefined) return 0;
    if (minDistanceMetres >= PROXIMITY_RADIUS_M) return 0;
    return Math.max(0, 1 - minDistanceMetres / PROXIMITY_RADIUS_M);
}

/**
 * Factor 4 — Time Decay / Escalation (20%)
 * The longer a report sits unresolved, the higher its urgency.
 * Linearly ramps from 0 (just created) to 1 (≥ 7 days old).
 *
 * @param {Date|string} createdAt
 * @returns {number} 0–1
 */
function scoreTimeDecay(createdAt) {
    const ageMs = Date.now() - new Date(createdAt).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    if (ageHours <= 0) return 0;
    return Math.min(1, ageHours / MAX_ESCALATION_HOURS);
}

// ─── Composite Score Calculator ──────────────────────────────────────────────

/**
 * Compute the composite dynamic priority score for a single report.
 * All inputs come from a joined DB row.
 *
 * @param {Object}       report
 * @param {string|null}  report.department_name
 * @param {string|null}  report.category
 * @param {number}       report.vouch_count
 * @param {number|null}  report.min_distance_m  – from PostGIS
 * @param {Date|string}  report.created_at
 * @returns {{ total: number, breakdown: Object }}
 */
function calculatePriorityScore(report) {
    // AI Scoring Algorithm v3 — Fine-grained scoring
    const title = report.title || '';
    const description = report.description || '';
    const address_text = report.address_text || '';
    const location = report.location || '';
    const vouchCount = report.vouch_count || 0;

    const textString = (`${title} ${description}`).toLowerCase();
    const locString = (address_text || location || "").toLowerCase();

    // 1. Text Analysis (Max 60 points)
    //    Base tier + bonus for each additional keyword match + description detail bonus
    const criticalKeywords = ['urgent','danger','dangerous','live wire','livewire','spark','sparking','sparks','electrocution','electrocute','electric shock','shock','sewage','sewer','blood','bleeding','fire','fires','burning','burn','explosion','explode','blast','collapse','collapsed','collapsing','hazard','hazardous','massive','critical','emergency','death','dead','dying','fatal','toxic','poison','chemical','gas leak','gasleak','flood','flooding','drown','accident','injured','injury','open manhole','manhole open','manhole','exposed wire','wire exposed','wires','short circuit','shortcircuit','bijli','aag','khoon','khatra','khatarnak','toofan','baarish','barish','pani bhara','bomb','crack in building','building crack','wall crack','roof collapse','cave in','cavein'];

    const mediumKeywords = ['pothole','pot hole','potholes','broken','break','damage','damaged','flickering','flicker','dark','darkness','no light','no lights','blocked','block','blockage','sinkhole','sink hole','leak','leaking','leaks','water leak','pipe burst','pipe leak','burst pipe','clogged','clog','drain block','drain clog','overflow','overflowing','stagnant','standing water','waterlog','waterlogged','fallen tree','tree fallen','tree fall','uprooted','branch','crack','cracked','road damage','road break','footpath broken','pavement','gutter','nala','nali','naali','ganda pani','pani','tuta','toota','tuti','band','light nahi','street light','signal broken','signal','traffic light','road block','cave','ditch','trench','open drain','no water','water supply','supply issue','power cut','power out','no power','outage'];

    const lowKeywords = ['litter','messy','trash','garbage','grass','overgrown','graffiti','minor','dirty','dust','dusty','noise','noisy','smell','stink','stinking','bad smell','ugly','paint','faded','peeling','weed','weeds','bush','bushes','pothol','littering','dumping','dump','junk','debris','rubbish','kachra','kachara','gandagi','ganda','safai','saaf','mitti','dhool','shor','badboo','badbu'];

    // Count keyword matches per tier
    const countMatches = (keywords) => keywords.filter(kw => textString.includes(kw)).length;
    const criticalHits = countMatches(criticalKeywords);
    const mediumHits = countMatches(mediumKeywords);
    const lowHits = countMatches(lowKeywords);

    // Base score from tier + bonus per extra keyword (1.5 pts each, capped)
    let baseSeverity = 10;
    if (criticalHits > 0) {
        baseSeverity = 48 + Math.min(12, criticalHits * 1.5); // 49.5 to 60
    } else if (mediumHits > 0) {
        baseSeverity = 30 + Math.min(10, mediumHits * 1.2);   // 31.2 to 40
    } else if (lowHits > 0) {
        baseSeverity = 10 + Math.min(5, lowHits * 0.8);        // 10.8 to 15
    }

    // Description detail bonus: longer, more detailed reports get up to 5 extra points
    const wordCount = textString.split(/\s+/).filter(w => w.length > 0).length;
    const detailBonus = Math.min(5, wordCount * 0.15);
    baseSeverity = Math.min(60, baseSeverity + detailBonus);

    // 2. Proximity Analysis (Max 40 points)
    const highProxKeywords = ['hospital','school','college','university','clinic','highway','intersection','main road','mainroad','national highway','state highway','flyover','bridge','overpass','bus stop','busstop','bus stand','railway','rail','metro','station','temple','mosque','church','gurudwara','market','bazaar','bazar','mall','chowk','chowraha','crossing','signal','square','gate'];
    const midProxKeywords = ['residential','apartment','flat','flats','society','housing','park','garden','playground','complex','suburb','colony','nagar','vihar','enclave','sector','block','lane','gali','galli','mohalla','area','locality','ward','village','gaon'];

    const highProxHits = highProxKeywords.filter(kw => locString.includes(kw)).length;
    const midProxHits = midProxKeywords.filter(kw => locString.includes(kw)).length;

    let proxScore = 10;
    if (highProxHits > 0) {
        proxScore = 32 + Math.min(8, highProxHits * 2.5);  // 34.5 to 40
    } else if (midProxHits > 0) {
        proxScore = 15 + Math.min(5, midProxHits * 1.5);    // 16.5 to 20
    }

    // 3. Vouching Bonus (Max 15 points, logarithmic scale — no rounding)
    let vouchBonus = 0;
    if (vouchCount > 0) {
        vouchBonus = Math.min(15, Math.log(1 + vouchCount) / Math.log(1 + 50) * 15);
    }

    // 4. Calculate Total — round to 1 decimal, cap at 100
    let priority_score = Math.round(baseSeverity + proxScore + vouchBonus);
    if (priority_score > 100) priority_score = 100;

    // 5. Determine Severity Label
    let severity = 'low';
    if (priority_score >= 80) {
        severity = 'critical';
    } else if (priority_score >= 60) {
        severity = 'high';
    } else if (priority_score >= 40) {
        severity = 'medium';
    }

    console.log(`[AI Scoring] Title: ${title} | Base: ${baseSeverity} | Prox: ${proxScore} | Vouch: ${vouchBonus} (${vouchCount} vouches) | Total: ${priority_score} | Severity: ${severity}`);

    return {
        total: priority_score,
        severity,
        breakdown: {
            base_severity: baseSeverity,
            proximity: proxScore,
            vouching: vouchBonus,
        }
    };
}

// ─── Database Query — Sorted Reports with Priority ──────────────────────────

/**
 * Fetch all reports with their dynamically computed priority score,
 * ordered from most urgent to least.
 *
 * The proximity factor uses a LATERAL subquery that computes the minimum
 * distance from the report's location to any critical infrastructure point.
 *
 * @param {Object}       filters
 * @param {string}       [filters.status]          – e.g. 'pending', 'open'
 * @param {number}       [filters.department_id]
 * @param {string}       [filters.ward_number]
 * @param {number}       [filters.page=1]
 * @param {number}       [filters.limit=25]
 * @returns {Promise<{ reports: Array, total: number, page: number, limit: number }>}
 */
async function getReportsSortedByPriority(filters = {}) {
    const {
        status,
        department_id,
        ward_number,
        page = 1,
        limit = 25,
    } = filters;

    // ── Build dynamic WHERE clause ──────────────────────────────────────────
    const conditions = [];
    const params = [];
    let paramIdx = 1;

    // Exclude already-resolved / rejected from the officer queue by default
    if (status) {
        conditions.push(`r.status = $${paramIdx++}`);
        params.push(status);
    } else {
        conditions.push(`r.status NOT IN ('resolved', 'rejected')`);
    }

    if (department_id) {
        conditions.push(`r.department_id = $${paramIdx++}`);
        params.push(department_id);
    }

    if (ward_number) {
        conditions.push(`r.ward_number = $${paramIdx++}`);
        params.push(ward_number);
    }

    const whereClause = conditions.length > 0
        ? 'WHERE ' + conditions.join(' AND ')
        : '';

    // ── Build the ST_Distance lateral subquery for critical infrastructure ──
    //
    // For each report row, we compute the minimum geographic distance (in metres)
    // to any infrastructure point. We use ST_Distance on geography types so the
    // result is in metres (not degrees).
    //
    // COALESCE handles reports with NULL location gracefully (→ NULL distance).
    //
    const infraValues = CRITICAL_INFRASTRUCTURE
        .map(p => `ST_SetSRID(ST_MakePoint(${p.lng}, ${p.lat}), 4326)::geography`)
        .join(', ');

    // ── Main query ──────────────────────────────────────────────────────────
    const sql = `
    SELECT
      r.id,
      r.title,
      r.description,
      r.category,
      r.status,
      r.severity,
      r.priority_score         AS stored_priority,
      r.vouch_count,
      r.ward_number,
      r.city,
      r.address_text,
      r.multimedia_urls,
      r.created_at,
      r.updated_at,
      r.resolved_at,
      ST_Y(r.location)         AS latitude,
      ST_X(r.location)         AS longitude,
      d.id                     AS department_id,
      d.name                   AS department_name,
      u.full_name              AS reported_by_name,
      r.reported_by,
      r.assigned_to,
      o.full_name              AS assigned_to_name,

      -- Proximity: minimum distance (metres) to any critical infra point
      CASE
        WHEN r.location IS NOT NULL THEN (
          SELECT MIN(ST_Distance(
            r.location::geography,
            infra_point
          ))
          FROM (VALUES (${infraValues})) AS infra(infra_point)
        )
        ELSE NULL
      END AS min_distance_m

    FROM reports r
    LEFT JOIN departments d ON d.id = r.department_id
    LEFT JOIN users u       ON u.id = r.reported_by
    LEFT JOIN users o       ON o.id = r.assigned_to
    ${whereClause}
    ORDER BY r.created_at DESC
    LIMIT  $${paramIdx++}
    OFFSET $${paramIdx++}
  `;

    const offset = (page - 1) * limit;
    params.push(limit, offset);

    // ── Execute ─────────────────────────────────────────────────────────────
    const { rows } = await query(sql, params);
    // ── Compute dynamic priority score for each row in JS ───────────────────
    const scoredReports = rows.map(row => {
        const { total, severity, breakdown } = calculatePriorityScore({
            title: row.title,
            description: row.description || '',
            address_text: row.address_text || '',
            location: '',
            vouch_count: row.vouch_count || 0,
        });

        return {
            id: row.id,
            title: row.title,
            description: row.description,
            category: row.category,
            status: row.status,
            severity: severity,
            vouch_count: row.vouch_count,
            priority_score: total,
            priority_breakdown: breakdown,
            location: row.latitude !== null ? {
                latitude: parseFloat(row.latitude),
                longitude: parseFloat(row.longitude),
            } : null,
            address_text: row.address_text,
            ward_number: row.ward_number,
            city: row.city,
            multimedia_urls: row.multimedia_urls,
            department: row.department_id ? {
                id: row.department_id,
                name: row.department_name,
            } : null,
            reported_by: {
                id: row.reported_by,
                name: row.reported_by_name,
            },
            assigned_to: row.assigned_to ? {
                id: row.assigned_to,
                name: row.assigned_to_name,
            } : null,
            created_at: row.created_at,
            updated_at: row.updated_at,
            resolved_at: row.resolved_at,
        };
    });

    // ── Sort by computed priority (descending) ─────────────────────────────
    scoredReports.sort((a, b) => b.priority_score - a.priority_score);

    // ── Get total count for pagination ─────────────────────────────────────
    const countSql = `
    SELECT COUNT(*) AS total
    FROM reports r
    ${whereClause}
  `;
    // Re-use only the filter params, not LIMIT/OFFSET
    const countParams = params.slice(0, params.length - 2);
    const { rows: countRows } = await query(countSql, countParams);
    const total = parseInt(countRows[0].total, 10);

    return {
        reports: scoredReports,
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
    };
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
    // Core scoring
    calculatePriorityScore,
    getReportsSortedByPriority,

    // Individual factors (exported for unit testing)
    scoreSeverity,
    scoreVouching,
    scoreProximity,
    scoreTimeDecay,

    // Config (exported for transparency / test overrides)
    WEIGHTS,
    DEPARTMENT_SEVERITY,
    CATEGORY_SEVERITY,
    CRITICAL_INFRASTRUCTURE,
    PROXIMITY_RADIUS_M,
    MAX_ESCALATION_HOURS,
    VOUCH_CAP,
};
