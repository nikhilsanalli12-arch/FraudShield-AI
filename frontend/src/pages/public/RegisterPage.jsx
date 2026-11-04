import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Building2,
} from 'lucide-react';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';

export default function RegisterPage() {
  const [role, setRole] = useState('personal');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [organization, setOrganization] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setStatusMessage({
        type: 'error',
        text: 'Passwords do not match. Please ensure both fields are identical.',
      });
      return;
    }

    if (!agreeTerms) {
      setStatusMessage({
        type: 'error',
        text: 'You must agree to the Terms of Service and Privacy Policy to register.',
      });
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    // Simulate demo registration
    setTimeout(() => {
      setLoading(false);
      setStatusMessage({
        type: 'success',
        text: `[Demo Mode] Registration flow simulated for ${fullName || 'Demo User'} (${role.toUpperCase()}). Supabase Auth and database profiles will be provisioned in Milestone 2.`,
      });
    }, 700);
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-lg w-full space-y-6">
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
            Create your account
          </h2>
          <p className="text-xs text-slate-500">
            Join the unified platform to secure your transactions and investigate risk indicators.
          </p>
        </div>

        {/* Demo Mode Notice */}
        <div className="p-3.5 rounded-xl bg-brand-50 border border-brand-200 text-xs text-brand-900 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-brand-700">
            <Sparkles className="w-4 h-4 text-brand-600" />
            Interactive Demo Registration
          </div>
          <p className="text-slate-600 leading-relaxed">
            Live registration, email verification, and database RLS profiles will be activated in <strong>Milestone 2</strong>.
          </p>
        </div>

        {/* Registration Card */}
        <Card className="shadow-card border-slate-200 p-6 sm:p-8 space-y-5">
          {/* Account Type Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Select Account Role
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole('personal')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  role === 'personal'
                    ? 'border-brand-500 bg-brand-50/70 ring-1 ring-brand-500'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <span className="block text-xs font-bold text-slate-900">
                  Personal User
                </span>
                <span className="block text-[11px] text-slate-500 mt-0.5">
                  Analyze personal statements, links, apps, and loans
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRole('analyst')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  role === 'analyst'
                    ? 'border-brand-500 bg-brand-50/70 ring-1 ring-brand-500'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="block text-xs font-bold text-slate-900">
                    Financial Analyst
                  </span>
                  <Badge variant="purple" size="sm">
                    Review
                  </Badge>
                </div>
                <span className="block text-[11px] text-slate-500 mt-0.5">
                  Fraud queue, entity radar & investigation management
                </span>
              </button>
            </div>
            {role === 'analyst' && (
              <p className="text-[11px] text-indigo-700 bg-indigo-50 p-2 rounded-lg border border-indigo-100">
                * Note: Financial Analyst accounts require institutional authorization and administrator verification before activation.
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Legal Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Alex Morgan"
                  className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
            </div>

            {role === 'analyst' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Financial Institution / Agency
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder="e.g. Apex Financial Risk Labs"
                    className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
              </div>
            )}

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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-8 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-8 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                  className="rounded text-brand-600 focus:ring-brand-500 h-4 w-4"
                />
                Show password
              </label>
            </div>

            <div className="pt-2">
              <label className="flex items-start gap-2.5 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="rounded text-brand-600 focus:ring-brand-500 h-4 w-4 mt-0.5"
                />
                <span>
                  I understand that FraudShield AI provides statistical risk indicators and deterministic checks, and I agree to the{' '}
                  <span className="text-brand-600 hover:underline">Terms of Service</span> and{' '}
                  <span className="text-brand-600 hover:underline">Privacy Policy</span>.
                </span>
              </label>
            </div>

            <Button
              type="submit"
              variant="navy"
              className="w-full justify-center shadow-md mt-2"
              loading={loading}
              icon={ArrowRight}
              iconPosition="right"
            >
              Create Account (Demo Preview)
            </Button>
          </form>

          {statusMessage && (
            <div
              className={`p-3.5 rounded-lg text-xs flex items-start gap-2 ${
                statusMessage.type === 'error'
                  ? 'bg-rose-50 border border-rose-200 text-rose-800'
                  : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              }`}
            >
              {statusMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}
        </Card>

        {/* Footer link to login */}
        <p className="text-center text-xs text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:underline">
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  );
}
