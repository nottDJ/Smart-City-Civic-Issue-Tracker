# Project Context Document

## 1. Project Overview
**Smart City Civic Issue Tracker** is a full-stack, location-aware web application designed to bridge the gap between citizens and municipal authorities. 
Citizens can report local infrastructure issues (e.g., potholes, streetlight outages) using mobile hardware sensors (GPS/Camera) with a graceful degradation fallback to OSM Nominatim. Administrators and municipal officers triage and resolve these issues via a real-time, spatial dashboard powered by a community-driven priority algorithm.

**Core Tech Stack**:
- **Frontend**: React.js (Vite), Tailwind CSS, Framer Motion, React-Leaflet, React-Router.
- **Backend**: Node.js, Express.js.
- **Database**: PostgreSQL with the PostGIS extension for spatial queries.
- **Other Utilities**: JWT + bcrypt (Authentication), Multer (Image Uploads).

## 2. Current Status
- **Fully Built & Functioning**:
  - Secure Authentication portal with Role-Based Access Control (RBAC) routing Citizens, Officers, and Admins to their respective dashboards.
  - Hardware-linked issue reporting (GPS/Camera) with manual map-search fallback.
  - Dynamic backend URL configuration to ensure seamless local network deployment.
  - Real-time community vouching system leveraging optimistic UI updates with mathematical failsafes to prevent stale closures.
  - Interactive spatial dashboards visualizing issue density and status via color-coded map markers.
  - "My Impact" Profile page for citizens monitoring the lifecycle (Pending -> Resolved) of their reports.
- **Partially Implemented / In-Progress**:
  - Omnichannel database expansions to store `severity`, `source`, and citizen identity fields (`Aadhaar`) in preparation for voice-assisted reports (via an n8n-powered voice agent).
- **Pending Tasks**:
  - Full backend and frontend integration of the upcoming n8n AI agent.
  - Production deployment (e.g. AWS/Vercel) and heavy load-testing for spatial querying endpoints.

## 3. File Structure
Below is a tree representation of the codebase, highlighting only the crucial structural layers:

```text
/
├── frontend/
│   ├── package.json          - Frontend dependencies and build scripts (Vite/React)
│   └── src/
│       ├── App.jsx           - Main component routing and global providers
│       ├── config.js         - Dynamic backend URL detection for local testing
│       ├── index.css         - Global Tailwind CSS variables and styling
│       ├── layouts/          - Shared layout wrappers for route protection (CitizenLayout, AdminLayout, etc)
│       └── pages/            - View components separated by RBAC
│           ├── AuthPage.jsx  - Multi-role login and registration entry point
│           ├── admin/        - Admin routing (AdminDashboardPage.jsx)
│           ├── citizen/      - Citizen views (ExploreIssuesPage, ProfilePage, ReportIssuePage)
│           └── officer/      - Officer management views (OfficerDashboardPage.jsx)
├── backend/
│   ├── package.json          - Backend API dependencies (Express, pg, jsonwebtoken)
│   ├── db/
│   │   └── init.sql          - Core PostgreSQL + PostGIS schema, ENUMs, and seed data
│   ├── src/
│   │   ├── server.js         - Main Express application entry and middleware configuration
│   │   ├── routes/           - REST API endpoints (auth.js, reports.js, officerReports.js)
│   │   └── services/         - Shared business logic (e.g., priorityScoring.js NLP engine)
│   └── uploads/              - Transient local storage folder for multipart form image uploads
├── README.md                 - Developer setup and overview definitions
└── PRD.md                    - Academic-grade theoretical Product Requirements Document
```

## 4. Architecture & Data
The frontend communicates with a RESTful Express node via a dynamic `BACKEND_URL` config script. All non-public endpoints use strict JWT enforcement. Standard data queries heavily utilize the raw `pg` driver to construct PostGIS methods natively without an ORM abstraction getting in the way.

**Core Database Entities (PostgreSQL)**:
- **`departments`**: Determines logic routing (e.g., Public Works, Solid Waste Management).
- **`users`**: Distinguishes Citizens, Officers, and Admins via a custom `ENUM`. Tied directly to department IDs if the user is an officer.
- **`reports`**: The crux of the DB. Heavily uses **`GEOMETRY(Point, 4326)`** to map exact WGS84 coordinates. Includes AI priority tracking (`priority_score`) and multimedia arrays. Indexed via GIST.
- **`report_vouches`**: A distinct ledger mapping composite primary keys (report_id, user_id) to strictly enforce the "one-vouch-per-user" rule.

**Critical Flow**:
A citizen submits a report -> GPS data converts to WKT geometry -> backend computes a `priority_score` -> map triggers instant render. As a community vouches for an issue, optimistic UI instantly updates the score client-side, circumventing latency while the backend validates the ledger securely.

## 5. Recent Context
Recent agentic development across this workspace has focused on fortifying the platform and building out advanced admin functionality, including:
- **Omnichannel Preparation:** Expanding DB structures to support a tri-dashboard ecosystem and integrating Aadhaar/Phone identities for upcoming voice-agent support.
- **UI & Experience:** Refactored frontend config to dynamically detect the backend server IP. Resolved complex React "stale closure" bugs causing negative integers during rapid optimistic fetching. 
- **Admin Intelligence:** Implemented split-screen map navigation alongside smart priority sorting so Admins can visually assess geographic crisis clusters. Finished the personalized "My Impact" dashboard for citizens. 
