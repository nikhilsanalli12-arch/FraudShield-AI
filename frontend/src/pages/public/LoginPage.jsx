import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  Info,
  UserCheck,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import Button from '../../components/common/Button';
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '../../components/common/Card';
import Badge from '../../components/common/Badge';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const initialRole = searchParams.get('role') || 'personal';

  const [role, setRole] = useState(initialRole);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoNotice, setDemoNotice] = useState(null);

  const demoAccounts = {
    personal: {
      email: 'alex.morgan@fraudshield.demo',
      name: 'Alex Morgan (Personal User)',
      desc: 'Access personal transactions, link scanner, app auditor, and loan calculator.',
    },
    analyst: {
      email: 'sarah.chen@fraudshield.demo',
      name: 'Sarah Chen (Financial Analyst)',
      desc: 'Access fraud queue, multi-account graph radar, model metrics, and simulator.',
    },
    admin: {
      email: 'admin.ops@fraudshield.demo',
      name: 'DevOps Administrator',
      desc: 'Access audit logs, role management, model deployment versions, and system settings.',
    },
  };

  const handleQuickFill = (selectedRole) => {
    setRole(selectedRole);
    setEmail(demoAccounts[selectedRole].email);
    setPassword('DemoSafePass123!');
    setDemoNotice(`Loaded credentials for ${demoAccounts[selectedRole].name}`);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setDemoNotice(null);

    // Simulate demo authentication
    setTimeout(() => {
      setLoading(false);
      setDemoNotice(
        `[Demo Mode Verified] Authentication validated for ${role.toUpperCase()} role. Full Supabase Auth backend connects in Milestone 2.`
      );
    }, 700);
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-md w-full space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl bg-navy-950 flex items-center justify-center text-white shadow-md">
              <ShieldCheck className="w-6 h-6 text-brand-400" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-navy-950">
              FraudShield <span className="text-brand-600">AI</span>
            </span>
          </Link>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Sign in to your account
          </h2>
          <p className="text-xs text-slate-500">
            Select your role or try our one-click interactive demo accounts below.
          </p>
        </div>

        {/* Demo Mode Notice Banner */}
        <div className="p-3.5 rounded-xl bg-brand-50 border border-brand-200 text-xs text-brand-900 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-brand-700">
            <Sparkles className="w-4 h-4 text-brand-600" />
            Interactive Demo Mode Active
          </div>
          <p className="text-slate-600 leading-relaxed">
            Live Supabase Auth and database RLS are scheduled for <strong>Milestone 2</strong>. Use the demo quick-fill buttons below to preview role-based access.
          </p>
        </div>

        {/* Role Selector Tabs */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-200/70 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => handleQuickFill('personal')}
            className={`py-2 rounded-lg transition-all ${
              role === 'personal'
                ? 'bg-white text-navy-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Personal
          </button>
          <button
            type="button"
            onClick={() => handleQuickFill('analyst')}
            className={`py-2 rounded-lg transition-all ${
              role === 'analyst'
                ? 'bg-white text-navy-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Analyst
          </button>
          <button
            type="button"
            onClick={() => handleQuickFill('admin')}
            className={`py-2 rounded-lg transition-all ${
              role === 'admin'
                ? 'bg-white text-navy-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Admin
          </button>
        </div>

        {/* Login Card */}
        <Card className="shadow-card border-slate-200 p-6 sm:p-8 space-y-5">
          <div className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200/70">
            <span className="font-semibold text-slate-700 block mb-0.5">
              Active Role: {role.toUpperCase()}
            </span>
            {demoAccounts[role].desc}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Password
                </label>
                <span className="text-xs text-brand-600 hover:underline cursor-pointer">
                  Forgot password?
                </span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-9 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="navy"
              className="w-full justify-center shadow-md"
              loading={loading}
              icon={ArrowRight}
              iconPosition="right"
            >
              Sign In (Demo Preview)
            </Button>
          </form>

          {demoNotice && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{demoNotice}</span>
            </div>
          )}

          {/* Quick Demo Pre-Fill Action */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              One-Click Demo Fill:
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickFill('personal')}
                className="text-xs px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                Personal User
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('analyst')}
                className="text-xs px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                Analyst
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('admin')}
                className="text-xs px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                Admin
              </button>
            </div>
          </div>
        </Card>

        {/* Footer link to register */}
        <p className="text-center text-xs text-slate-500">
          Don't have an account?{' '}
          <Link to="/register" className="font-semibold text-brand-600 hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
