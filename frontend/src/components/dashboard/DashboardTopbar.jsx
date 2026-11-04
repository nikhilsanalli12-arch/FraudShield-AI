import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Menu, LogOut } from 'lucide-react';
import Button from '../common/Button';

export default function DashboardTopbar({ onOpenMobile }) {
  const { user, profile, role, signOut } = useAuth();
  const location = useLocation();

  const getBreadcrumbTitle = () => {
    const path = location.pathname;
    if (path.includes('/admin/dashboard')) return 'Platform Administration & System Health';
    if (path.includes('/analyst/dashboard')) return 'Financial Analyst Fraud Triage';
    return 'Personal Safety Portal';
  };

  const effectiveRole = role || profile?.role || 'personal';

  return (
    <header className="sticky top-0 z-20 h-16 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between">
      {/* Left: Mobile Toggle & Breadcrumb Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobile}
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 focus:outline-hidden"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate">
            {getBreadcrumbTitle()}
          </h1>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Supabase Auth Connected</span>
            </span>
          </div>
        </div>
      </div>

      {/* Right: User Information & Sign Out */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs">
          <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs">
            {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="text-left">
            <div className="font-semibold text-slate-800 leading-tight truncate max-w-[150px]">
              {profile?.full_name || user?.email?.split('@')[0] || 'User'}
            </div>
            <div className="text-[10px] text-slate-500 capitalize">
              Role: {effectiveRole}
            </div>
          </div>
        </div>

        <Button
          onClick={signOut}
          variant="secondary"
          size="sm"
          icon={LogOut}
          className="text-xs"
        >
          <span className="hidden sm:inline">Sign Out</span>
        </Button>
      </div>
    </header>
  );
}
