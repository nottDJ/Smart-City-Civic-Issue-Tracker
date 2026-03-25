# Product Requirements Document (PRD)
**Project Name:** Smart City Civic Issue Tracker  
**Project Type:** Full-stack, Location-Aware Progressive Web Application (PWA)  

## 1. Executive Summary

**Objective:**
The Smart City Civic Issue Tracker is a robust Progressive Web Application designed to crowdsource the discovery, prioritization, and resolution of municipal infrastructure issues. It provides an accessible, mobile-first interface for citizens to report hazards (with GPS and image verification), while furnishing city administrators with an AI-augmented, map-driven command center for dispatch and triage.

**Differentiation:**
Unlike legacy civic reporting utilities that rely on manual dispatching and chronological queues, this system integrates an AI Natural Language Processing (NLP) Severity Triage engine alongside a community-vouching protocol. This dual-layered prioritization ensures that critical issues (e.g., live wires, gas leaks) proactively surface to the top of the administrative queue, optimizing municipal resource allocation.

**Scope Boundaries:**
- *In Scope (MVP):* Secure JWT authentication (Role-based access), hardware-linked media uploads (Camera/Gallery), GPS extraction with Nominatim/Leaflet fallbacks, Community Vouching (Optimistic UI updates), NLP Severity Triage scoring, and an interactive React-Leaflet Admin Spatial Dashboard.
- *Out of Scope:* Compilation to Native iOS/Android binaries, integration with existing legacy municipal ERP systems, payment gateways, and real-time live tracking of municipal crews.

**Success Metrics:**
- **System Latency:** Map renders and spatial queries must execute sequentially in < 2.0s.
- **Reporting Friction:** Time-to-report for a citizen should average < 45 seconds from login to submission.
- **Triage Accuracy:** The AI engine should successfully flag predefined critical keywords 100% of the time, mapping to a severity score >= 8.

---

## 2. System Architecture

**High-Level Architecture:**
The application utilizes a decoupled, modern three-tier architecture (Client, API, Data).

```text
+-------------------------------------------------------------+
|                     CLIENT TIER (React/Vite)                |
|  +--------------------+               +------------------+  |
|  |   Citizen Portal   |               | Command Center   |  |
|  | - Hardware GPS/Cam |               | - Spatial Map    |  |
|  | - Vouching / UI    |               | - Priority Inbox |  |
|  +---------+----------+               +---------+--------+  |
|            |                                    |           |
+------------|------------------------------------|-----------+
             | HTTP/REST (JSON + JWT)             |
             v                                    v
+-------------------------------------------------------------+
|                  APPLICATION TIER (Node/Express)            |
|  +--------------------+               +------------------+  |
|  | Auth/JWT Router    |               | AI Triage Engine |  |
|  | User Controllers   |               | NLP Keyword Scans|  |
|  +---------+----------+               +---------+--------+  |
|            |                                    |           |
|            +---------+                +---------+           |
|                      |                |                     |
|                      v                v                     |
|                    Query Orchestration                      |
+-----------------------------+-------------------------------+
                              |
                              | SQL/WKT (Well-Known Text)
                              v
+-------------------------------------------------------------+
|                      DATA TIER (PostgreSQL)                 |
|                                                             |
|   +-------------------+              +------------------+   |
|   | Relational Tables |              | PostGIS Spatial  |   |
|   | Users/Reports     | <----------> | Geometry Columns |   |
|   |                   |              | (SRID 4326)      |   |
|   +-------------------+              +------------------+   |
+-------------------------------------------------------------+
```

**Data Flow Lifecycle:**
1. **Capture:** Mobile client captures image and Lat/Lng standard data.
2. **Transmission:** Client sends `FormData` (including JWT for auth) via POST to the Express API.
3. **Processing:** Express parses payload, executes the NLP Triage Engine on the description string, and calculates severity.
4. **Persistence:** Coordinates are formatted as GeoJSON/WKT and stored in the specialized PostGIS `geometry` column.
5. **Consumption:** Admin requests spatial data; PostGIS returns geographic clusters, which React-Leaflet plots dynamically.

---

## 3. Technical Stack

### 3.1 Core Technology Stack

| Component              | Technology                | Version    | Rationale                                                                                                                                                                  |
| :--------------------- | :------------------------ | :--------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend Framework** | React.js (Vite)           | 18.x       | Provides rapid Hot Module Replacement (HMR) during development and a highly optimized, minified production build pipeline.                                                 |
| **Styling & Motion**   | Tailwind CSS / Framer     | 3.x / 11.x | Utility-first CSS allows for rapid, mobile-responsive prototyping without external stylesheets. Framer provides premium micro-interactions.                                |
| **Spatial Mapping**    | React-Leaflet & Nominatim | 4.x        | Lightweight spatial rendering for the Admin UI. Nominatim provides open-source reverse geocoding without proprietary Google API lock-in or costs.                          |
| **Backend Framework**  | Node.js / Express.js      | 20.x / 4.x | Highly asynchronous event loop, ideal for handling concurrent I/O requests, JWT routing, and lightweight NLP processing.                                                   |
| **Primary Database**   | PostgreSQL                | 16.x       | Robust, ACID-compliant relational data storage for managing user schemas, RBAC roles, and report metadata securely.                                                        |
| **Spatial Engine**     | PostGIS                   | 3.4.x      | Essential database extension allowing for radius queries natively inside SQL via geometry data types (SRID 4326).                                                          |
| **Auth & Security**    | JWT & bcrypt              | 9.x / 5.x  | Industry standard for stateless, secure session management and irrevocable cryptographic password hashing (Work factor: 10).                                               |
| **Triage Engine**      | Custom Node.js NLP        | N/A        | Local, keyword-based severity algorithm ensuring rapid execution (<10ms) without external API latency or token costs.                                                      |

---

## 4. Core Engineering Workflows

**Mobile GPS Fallback Mechanism (Pseudocode):**
```javascript
// React Component: Geolocation handling
const requestLocation = async () => {
  if (!navigator.geolocation) {
    return activateMapFallback("Geolocation not supported by this browser.");
  }
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      // Success: Extract Lat/Lng
      setCoordinates({
        lat: position.coords.latitude,
        lng: position.coords.longitude
      });
      reverseGeocodeNominatim(position.coords.latitude, position.coords.longitude);
    },
    (error) => {
      // Failure: Permission denied or timeout
      console.warn("GPS Failed, initializing Leaflet Map Pin-Drop Fallback", error);
      activateMapFallback();
    },
    { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
  );
};
```

**JWT Role-Based Access Router (Express Middleware Pseudocode):**
```javascript
// Express Middleware: authorizeAdmin.js
const authorizeAdmin = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: "Access Denied" });

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    if (verified.role !== 'admin') {
      return res.status(403).json({ error: "Forbidden: Admin privileges required" });
    }
    req.user = verified; // Append decoded payload to Request
    next();
  } catch (err) {
    res.status(400).json({ error: "Invalid Token" });
  }
};
```

---

## 5. Intelligence Engine

**AI Severity Triage Algorithm (Pseudocode):**
```javascript
// Node.js Service: triageEngine.js
const SEVERITY_DICTIONARY = {
  "live wire": 10,  "gas leak": 10, "flooded": 9,
  "sinkhole": 8,    "spilled": 7,   "pothole": 5,
  "graffiti": 2,    "litter": 2
};

function calculateSeverityScore(description) {
  let baseScore = 1; // Default minimum severity
  const normalizedDesc = description.toLowerCase();
  
  // Iterate through dictionary to find critical keywords
  for (const [keyword, weight] of Object.entries(SEVERITY_DICTIONARY)) {
    if (normalizedDesc.includes(keyword)) {
      if (weight > baseScore) {
        baseScore = weight; 
      }
    }
  }
  return baseScore;
}
```

---

## 6. API Specifications

**Core Route 1: Submit Report**
- **Method:** `POST /api/reports`
- **Auth:** Required (Citizen or Admin)
- **Request Payload (JSON):**
  ```json
  {
    "title": "Sparking Lamp Post",
    "description": "Live wire exposed near the playground.",
    "latitude": 34.0522,
    "longitude": -118.2437,
    "image_url": "https://storage.provider.com/uuid.jpg"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "id": 104,
    "status": "pending",
    "ai_severity_score": 10,
    "message": "Report successfully generated and mapped."
  }
  ```

**Core Route 2: Vouch for Issue**
- **Method:** `PATCH /api/reports/:id/vouch`
- **Auth:** Required (Citizen)
- **Request:** (Empty body, ID in URL param)
- **Response (200 OK):**
  ```json
  {
    "report_id": 104,
    "new_vouch_count": 5
  }
  ```

**Core Route 3: Admin Status Patch**
- **Method:** `PATCH /api/admin/reports/:id/status`
- **Auth:** Required (ADMIN ONLY)
- **Request Payload (JSON):**
  ```json
  {
    "status": "in_progress"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "report_id": 104,
    "status": "in_progress",
    "updated_at": "2026-03-25T10:00:00Z"
  }
  ```

---

## 7. Data Architecture

**PostgreSQL & PostGIS Database Schema:**

```sql
-- Enable PostGIS Spatial Extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enumeration for Report Status
CREATE TYPE report_status AS ENUM ('pending', 'in_progress', 'resolved');
CREATE TYPE user_role AS ENUM ('citizen', 'admin');

-- Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'citizen',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reports Table
CREATE TABLE reports (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    location geometry(Point, 4326) NOT NULL, -- PostGIS Spatial Column (SRID 4326 for WGS84)
    image_url VARCHAR(255),
    status report_status DEFAULT 'pending',
    vouch_count INT DEFAULT 0,
    ai_severity_score INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Spatial Indexing for rapid radius mapping arrays
CREATE INDEX reports_location_idx ON reports USING GIST (location);
```

---

## 8. Security & Compliance

- **Authentication Protocol:** JSON Web Tokens (JWT) issued upon successful login, stored securely on the client side mapping directly into HTTP Authorization Bearer headers.
- **Data Protection at Rest:** Passwords salted and hashed utilizing `bcrypt` (work factor: 10). Plain-text passwords are never mathematically deducible or stored.
- **Endpoint Protection:** Express middleware acts as a gatekeeper, verifying the JWT signature sequence and checking the embedded `role` variable before routing to restricted Administrative controllers.
- **Input Sanitization:** Parameterized PostgreSQL queries are executed via Node `pg` layer to entirely prevent SQL Injection payloads.

