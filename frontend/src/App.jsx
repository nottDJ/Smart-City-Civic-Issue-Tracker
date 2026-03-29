// frontend/src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import AuthPage from './pages/AuthPage';

import CitizenLayout from './layouts/CitizenLayout';
import OfficerLayout from './layouts/OfficerLayout';
import AdminLayout from './layouts/AdminLayout';

import ReportIssuePage from './pages/citizen/ReportIssuePage';
import ExploreIssuesPage from './pages/citizen/ExploreIssuesPage';
import ProfilePage from './pages/citizen/ProfilePage';
import OfficerDashboardPage from './pages/officer/OfficerDashboardPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';

// Protects routes by checking for a token and optionally verifying the user role
const ProtectedRoute = ({ children, allowedRoles }) => {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // If roles are specified and the user's role isn't included, punt them to login (or a 403 page)
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      <Routes>
        {/* Default redirect to Auth page */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* --- Authentication Routes --- */}
        <Route path="/login" element={<AuthPage />} />

        {/* --- Citizen Portal --- */}
        <Route path="/citizen" element={
          <ProtectedRoute allowedRoles={['citizen']}>
            <CitizenLayout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/citizen/report" replace />} />
          <Route path="report" element={<ReportIssuePage />} />
          <Route path="explore" element={<ExploreIssuesPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        {/* --- Officer Dashboard --- */}
        <Route path="/officer" element={
          <ProtectedRoute allowedRoles={['officer']}>
            <OfficerLayout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/officer/dashboard" replace />} />
          <Route path="dashboard" element={<OfficerDashboardPage />} />
        </Route>

        {/* --- Admin Dashboard --- */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminLayout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}