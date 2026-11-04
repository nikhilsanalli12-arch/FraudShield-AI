import React from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import Button from '../common/Button';

export default function RoleGate({ allowedRoles = [], children }) {
  const { role, loading } = useAuth();

  if (loading) {
    return null;
  }

  const effectiveRole = role || 'personal';

  if (!allowedRoles.includes(effectiveRole)) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6 bg-slate-50">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-card p-8 text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Access Restricted</h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              This area is restricted to authorized <strong>[{allowedRoles.join(', ')}]</strong> personnel. Your verified role is <strong>'{effectiveRole}'</strong>.
            </p>
          </div>
          <div className="pt-2">
            <Button to="/dashboard" variant="navy" icon={ArrowLeft} iconPosition="left" className="w-full">
              Return to Personal Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return children;
}

