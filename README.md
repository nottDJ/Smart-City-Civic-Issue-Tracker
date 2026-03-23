# Smart City Civic Issue Tracker

A full-stack, location-aware web application designed to bridge the gap between citizens and municipal authorities. This system allows citizens to report local infrastructure issues (e.g., potholes, streetlight outages) using mobile hardware sensors, while providing administrators with a real-time, spatial dashboard to triage and resolve issues based on community-driven priority algorithms.

## 🎓 Academic Focus & Architecture

This project was built to demonstrate proficiency in full-stack system design, spatial database management, and secure API integration. 

**Key Architectural Highlights:**
* **Spatial Data Handling:** Utilizes PostGIS to store and query exact geographic coordinates using GeoJSON and Well-Known Text (WKT) formats.
* **Hardware API Integration:** Leverages native mobile browser APIs (Geolocation and Camera) with a graceful degradation fallback to OpenStreetMap's Nominatim geocoding service if strict HTTPS security policies block sensor access.
* **Optimistic UI Updates:** Implements functional state updates in React to provide zero-latency feedback during network requests (e.g., the vouching system), complete with mathematical failsafes to prevent stale closures.
* **Role-Based Access Control (RBAC):** Secure JWT middleware ensures protected routes for both API endpoints and frontend React components, cleanly separating the Citizen and Admin experiences.

## 🛠️ Technology Stack

**Frontend**
* **React.js (Vite):** Core UI framework.
* **Tailwind CSS & Framer Motion:** Responsive styling and layout animations.
* **React-Leaflet:** Interactive map rendering for coordinate plotting.
* **React-Hot-Toast:** Non-blocking asynchronous state notifications.

**Backend**
* **Node.js & Express:** RESTful API architecture.
* **PostgreSQL & PostGIS:** Relational database with advanced spatial querying capabilities.
* **JSON Web Tokens (JWT) & bcrypt:** Stateless authentication and cryptographic password hashing.

## ✨ Core Features

### 👤 Citizen Portal
* **Secure Authentication:** Encrypted user registration and login.
* **Hardware-Linked Reporting:** Users can upload images directly from their device camera or gallery, while automatically appending precise GPS coordinates.
* **Manual Geocoding Fallback:** If auto-GPS fails, users can search for landmarks using an integrated OpenStreetMap text-search, which smoothly pans a mini-map to drop a physical pin.
* **Community Triage (Vouching):** Citizens can upvote local issues to organically surface the most critical infrastructure failures.
* **Impact Dashboard:** A personalized profile page tracking the lifecycle status (Pending, In Progress, Resolved) of a user's specific reports.

### 🏛️ Admin Command Center
* **Smart Routing:** Login flow automatically detects the user's role and bypasses the citizen portal to load the secure management dashboard.
* **Split-Screen Spatial Dashboard:** A dual-view interface featuring a Priority Inbox sorted strictly by community vouch counts, paired with a live, full-screen interactive map.
* **Real-Time Status Management:** Admins can patch database records (Pending -> Resolved), which instantly updates the map marker colors (Red -> Green) and synchronizes with the citizen's personal dashboard.

## 🚀 Local Development & Setup

### Prerequisites
* Node.js (v18+)
* PostgreSQL with the PostGIS extension installed.

### 1. Database Setup
Create a PostgreSQL database and initialize the tables for Users and Reports. Ensure the PostGIS extension is enabled:
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

### 2. Backend Setup
Navigate to the backend directory, install dependencies, and start the server.
Note: The server is explicitly bound to 0.0.0.0 to allow local network testing.

```bash
cd backend
npm install
npm run dev
```

### 3. Frontend Setup
Navigate to the frontend directory and start the Vite development server.
Note: Vite uses the --host flag to expose the application to mobile devices on the local Wi-Fi network.

```bash
cd frontend
npm install
npm run dev
```
