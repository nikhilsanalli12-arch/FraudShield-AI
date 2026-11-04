import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader2, ShieldCheck } from 'lucide-react';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-700 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-navy-950 flex items-center justify-center text-white shadow-md">
          <ShieldCheck className="w-7 h-7 text-brand-400" />
        </div>
        <div className="flex items-center gap-2 text-sm font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
          <span>Verifying security session...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    // Preserve attempted URL location for post-login redirection
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
