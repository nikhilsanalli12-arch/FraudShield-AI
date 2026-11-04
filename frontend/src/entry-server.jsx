import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

// Layouts
import PublicLayout from './layouts/PublicLayout';
import DashboardLayout from './layouts/DashboardLayout';

// Public Pages
import LandingPage from './pages/public/LandingPage';
import FeaturesPage from './pages/public/FeaturesPage';
import HowItWorksPage from './pages/public/HowItWorksPage';
import LoginPage from './pages/public/LoginPage';
import RegisterPage from './pages/public/RegisterPage';
import NotFoundPage from './pages/public/NotFoundPage';

// Route Guards
import ProtectedRoute from './components/auth/ProtectedRoute';
import RoleGate from './components/auth/RoleGate';

// Milestone 3 Production Dashboards
import PersonalDashboard from './pages/dashboard/PersonalDashboard';
import AnalystDashboard from './pages/dashboard/AnalystDashboard';
import AdminDashboard from './pages/dashboard/AdminDashboard';

export function render(url) {
  return renderToString(
    <AuthProvider>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          {/* Public Pages Layout */}
          <Route path="/" element={<PublicLayout />}>
            <Route index element={<LandingPage />} />
            <Route path="features" element={<FeaturesPage />} />
            <Route path="how-it-works" element={<HowItWorksPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="404" element={<NotFoundPage />} />
          </Route>

          {/* Authenticated Dashboard Layout */}
          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<PersonalDashboard />} />
            <Route
              path="analyst/dashboard"
              element={
                <RoleGate allowedRoles={['analyst', 'admin']}>
                  <AnalystDashboard />
                </RoleGate>
              }
            />
            <Route
              path="admin/dashboard"
              element={
                <RoleGate allowedRoles={['admin']}>
                  <AdminDashboard />
                </RoleGate>
              }
            />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}
