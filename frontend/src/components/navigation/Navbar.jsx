import React, { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  ShieldCheck,
  Menu,
  X,
  ArrowRight,
  Layers,
  HelpCircle,
  Cpu,
  LogOut,
  User,
  LayoutDashboard,
} from 'lucide-react';
import Button from '../common/Button';
import Badge from '../common/Badge';
import { useAuth } from '../../context/AuthContext';

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { user, role, signOut, isConfigured } = useAuth();

  const navLinks = [
    { name: 'Features', path: '/features', icon: Layers },
    { name: 'How It Works', path: '/how-it-works', icon: HelpCircle },
    { name: 'Architecture', path: '/features#architecture', icon: Cpu },
  ];

  const isCurrent = (path) => {
    if (path.includes('#')) {
      return location.pathname + location.hash === path;
    }
    return location.pathname === path;
  };

  const getDashboardPath = () => {
    return '/dashboard';
  };

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200/80 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo: Navigates to user role dashboard when authenticated, or public landing page when unauthenticated */}
          <Link
            to={user ? getDashboardPath() : '/'}
            className="flex items-center gap-2.5 focus:outline-none group"
            aria-label={user ? 'Go to Dashboard' : 'FraudShield AI Home'}
            title={user ? 'Go to Dashboard' : 'FraudShield AI Home'}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-700 to-navy-950 flex items-center justify-center text-white shadow-md shadow-brand-700/20 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-6 h-6 text-brand-300" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-navy-950 flex items-center gap-1.5">
                FraudShield <span className="text-brand-600 font-extrabold">AI</span>
              </span>
              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold -mt-1">
                Financial Safety Platform
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = isCurrent(link.path);
              return (
                <NavLink
                  key={link.name}
                  to={link.path}
                  className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    active
                      ? 'text-brand-600 bg-brand-50/70 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <Icon className="w-4 h-4 text-slate-400" />
                  {link.name}
                </NavLink>
              );
            })}
          </nav>

          {/* Desktop Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <Badge variant={role === 'admin' ? 'navy' : role === 'analyst' ? 'purple' : 'brand'} size="sm" dot>
                  {role ? role.toUpperCase() : 'PERSONAL'}
                </Badge>
                <Button
                  to={getDashboardPath()}
                  variant="primary"
                  size="sm"
                  icon={LayoutDashboard}
                >
                  Dashboard
                </Button>
                <Button
                  onClick={signOut}
                  variant="ghost"
                  size="sm"
                  icon={LogOut}
                  title="Sign Out"
                >
                  Sign Out
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Button to="/login" variant="ghost" size="sm">
                  Sign In
                </Button>
                <Button
                  to="/register"
                  variant="navy"
                  size="sm"
                  icon={ArrowRight}
                  iconPosition="right"
                >
                  Get Protected
                </Button>
              </div>
            )}
          </div>

          {/* Mobile Menu Hamburger */}
          <div className="flex md:hidden items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              aria-label={mobileMenuOpen ? 'Close Menu' : 'Open Menu'}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 bg-white px-4 pt-3 pb-6 space-y-3 animate-in slide-in-from-top-2 duration-150">
          <div className="space-y-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = isCurrent(link.path);
              return (
                <Link
                  key={link.name}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2.5 rounded-lg text-base font-medium flex items-center gap-2.5 ${
                    active
                      ? 'text-brand-600 bg-brand-50 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-5 h-5 text-slate-400" />
                  {link.name}
                </Link>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-col gap-2.5">
            {user ? (
              <>
                <div className="flex items-center justify-between px-2 text-xs text-slate-600">
                  <span>Logged in as: {user.email}</span>
                  <Badge variant="brand" size="sm">
                    {role || 'personal'}
                  </Badge>
                </div>
                <Button
                  to={getDashboardPath()}
                  variant="primary"
                  className="w-full justify-center"
                  icon={LayoutDashboard}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Go to Dashboard
                </Button>
                <Button
                  variant="secondary"
                  className="w-full justify-center"
                  icon={LogOut}
                  onClick={() => {
                    signOut();
                    setMobileMenuOpen(false);
                  }}
                >
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Button
                  to="/login"
                  variant="secondary"
                  className="w-full justify-center"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sign In
                </Button>
                <Button
                  to="/register"
                  variant="navy"
                  className="w-full justify-center"
                  icon={ArrowRight}
                  iconPosition="right"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Get Protected
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
