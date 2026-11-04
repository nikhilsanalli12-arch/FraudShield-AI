import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PublicLayout from './layouts/PublicLayout';
import LandingPage from './pages/public/LandingPage';
import FeaturesPage from './pages/public/FeaturesPage';
import HowItWorksPage from './pages/public/HowItWorksPage';
import LoginPage from './pages/public/LoginPage';
import RegisterPage from './pages/public/RegisterPage';
import NotFoundPage from './pages/public/NotFoundPage';

// Route Guards
import ProtectedRoute from './components/auth/ProtectedRoute';
import RoleGate from './components/auth/RoleGate';

// Milestone 2 Protected Test Placeholders
import PersonalDashboardPlaceholder from './pages/placeholders/PersonalDashboardPlaceholder';
import AnalystDashboardPlaceholder from './pages/placeholders/AnalystDashboardPlaceholder';
import AdminDashboardPlaceholder from './pages/placeholders/AdminDashboardPlaceholder';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Pages Layout */}
          <Route path="/" element={<PublicLayout />}>
            <Route index element={<LandingPage />} />
            <Route path="features" element={<FeaturesPage />} />
            <Route path="how-it-works" element={<HowItWorksPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="404" element={<NotFoundPage />} />

            {/* Protected Routes (Milestone 2 Authorization Test Harness) */}
            <Route
              path="dashboard"
              element={
                <ProtectedRoute>
                  <PersonalDashboardPlaceholder />
                </ProtectedRoute>
              }
            />
            <Route
              path="analyst/dashboard"
              element={
                <ProtectedRoute>
                  <RoleGate allowedRoles={['analyst', 'admin']}>
                    <AnalystDashboardPlaceholder />
                  </RoleGate>
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/dashboard"
              element={
                <ProtectedRoute>
                  <RoleGate allowedRoles={['admin']}>
                    <AdminDashboardPlaceholder />
                  </RoleGate>
                </ProtectedRoute>
              }
            />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
