import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldCheck,
  Shield,
  Activity,
  Server,
  X,
  UserCheck,
} from 'lucide-react';
import Badge from '../common/Badge';

export default function DashboardSidebar({ isMobileOpen, onCloseMobile }) {
  const { role, user, profile } = useAuth();
  const effectiveRole = role || profile?.role || 'personal';

  // Navigation items strictly filtered by the database-verified role
  const navItems = [
    {
      name: 'Personal Safety',
      path: '/dashboard',
      icon: Shield,
      allowedRoles: ['personal', 'analyst', 'admin'],
      exact: true,
    },
    {
      name: 'Analyst Triage',
      path: '/analyst/dashboard',
      icon: Activity,
      allowedRoles: ['analyst', 'admin'],
    },
    {
      name: 'Platform Health',
      path: '/admin/dashboard',
      icon: Server,
      allowedRoles: ['admin'],
    },
  ];

  const visibleNavItems = navItems.filter((item) =>
    item.allowedRoles.includes(effectiveRole)
  );

  const sidebarContent = (
    <div className="h-full flex flex-col justify-between p-4 bg-white border-r border-slate-200">
      {/* Brand & Mobile Close */}
      <div>
        <div className="flex items-center justify-between pb-5 mb-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-navy-950 text-white flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-sm tracking-tight">FraudShield AI</span>
              <span className="block text-[10px] text-slate-400 font-medium">FINANCIAL SAFETY</span>
            </div>
          </div>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Section */}
        <div className="space-y-1">
          <div className="px-3 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Workspace
          </div>
          <nav className="space-y-1">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.exact}
                  onClick={onCloseMobile}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-brand-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>

      {/* User Verified Role Chip (Bottom of Sidebar) */}
      <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5 text-brand-600" />
            Role Access
          </span>
          <Badge
            variant={
              effectiveRole === 'admin'
                ? 'danger'
                : effectiveRole === 'analyst'
                ? 'warning'
                : 'brand'
            }
            size="sm"
          >
            {effectiveRole}
          </Badge>
        </div>
        <p className="text-[11px] text-slate-500 truncate" title={user?.email || ''}>
          {user?.email || 'Authenticated User'}
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer with Backdrop */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          {/* Drawer */}
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
