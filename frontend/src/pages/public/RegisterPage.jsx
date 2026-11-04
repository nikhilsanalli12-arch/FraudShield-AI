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
  AlertTriangle,
  Info,
} from 'lucide-react';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import { useAuth } from '../../context/AuthContext';

export default function RegisterPage() {
  const { signUp, isConfigured, missingConfigs } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!isConfigured) {
      setStatusMessage({
        type: 'error',
        text: `Supabase configuration missing (${missingConfigs.join(', ')}). Registration cannot proceed without an active Supabase project.`,
      });
      return;
    }

    if (password.length < 8) {
      setStatusMessage({
        type: 'error',
        text: 'Password must be at least 8 characters long for platform security.',
      });
      return;
    }

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

    try {
      // Role is hardcoded to 'personal' on database level by trigger
      const data = await signUp(email, password, fullName);
      setStatusMessage({
        type: 'success',
        text: data?.user?.identities?.length === 0
          ? 'An account with this email already exists. Please sign in.'
          : 'Registration successful! If email confirmation is enabled on your Supabase project, please check your email inbox to verify your account.',
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Registration failed. Please check your information and try again.',
      });
    } finally {
      setLoading(false);
    }
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
            Join the unified platform to secure your transactions and analyze financial risk.
          </p>
        </div>

        {/* Configuration Notice (If Supabase keys are not configured) */}
        {!isConfigured && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              Supabase Configuration Required
            </div>
            <p className="text-amber-700 leading-relaxed">
              Real registration is active. To enable account creation, configure the following variables in <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">frontend/.env</code>:
            </p>
            <ul className="list-disc list-inside font-mono text-[11px] text-amber-900 space-y-0.5 bg-amber-100/60 p-2 rounded">
              {missingConfigs.map((cfg) => (
                <li key={cfg}>{cfg}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Registration Card */}
        <Card className="shadow-card border-slate-200 p-6 sm:p-8 space-y-5">
          {/* Role Security Notice */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-800 block">Personal Role Provisioning</span>
              All public registrations are assigned the <strong className="text-slate-900">Personal User</strong> role by default. Financial Analyst and Administrator access is provisioned through strict institutional authorization processes.
            </div>
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
                    placeholder="Min. 8 characters"
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
                    placeholder="Repeat password"
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
                  I agree to the <span className="text-brand-600 hover:underline">Terms of Service</span> and{' '}
                  <span className="text-brand-600 hover:underline">Privacy Policy</span>.
                </span>
              </label>
            </div>

            <Button
              type="submit"
              variant="navy"
              className="w-full justify-center shadow-md mt-2"
              loading={loading}
              disabled={!isConfigured || loading}
              icon={ArrowRight}
              iconPosition="right"
            >
              Create Account
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
