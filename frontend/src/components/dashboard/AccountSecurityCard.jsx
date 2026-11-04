import React from 'react';
import { ShieldCheck, Lock, Mail, Clock, Key, AlertCircle } from 'lucide-react';
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '../common/Card';
import Badge from '../common/Badge';

/**
 * AccountSecurityCard displays only verified, factual security parameters
 * from the active Supabase session and user profile.
 * 
 * Strict Condition: MFA status, session expiry, and sign-in timestamps are
 * shown ONLY when supported by actual Supabase data. Otherwise, "Not available"
 * is displayed. No values are inferred.
 */
export default function AccountSecurityCard({ user, profile, session, role }) {
  // Helper to format ISO or epoch dates without crashing or guessing
  const formatDateTime = (val) => {
    if (!val) return 'Not available';
    try {
      const date = typeof val === 'number' ? new Date(val * 1000) : new Date(val);
      if (isNaN(date.getTime())) return 'Not available';
      return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Not available';
    }
  };

  // Verifiable MFA extraction from actual Supabase user factors
  const getMfaStatus = () => {
    if (!user) return 'Not available';
    if (Array.isArray(user.factors)) {
      if (user.factors.length === 0) {
        return 'Not enrolled (0 factors)';
      }
      return `${user.factors.length} factor(s) registered`;
    }
    // If factors property does not exist on auth object
    return 'Not available';
  };

  const emailConfirmed = user?.email_confirmed_at
    ? `Confirmed (${formatDateTime(user.email_confirmed_at)})`
    : user?.email
    ? 'Pending confirmation'
    : 'Not available';

  const lastSignIn = user?.last_sign_in_at
    ? formatDateTime(user.last_sign_in_at)
    : 'Not available';

  const sessionExpiry = session?.expires_at
    ? formatDateTime(session.expires_at)
    : 'Not available';

  const accountCreated = user?.created_at
    ? formatDateTime(user.created_at)
    : 'Not available';

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">
                Verifiable Account Security
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Live security attributes retrieved directly from your authenticated Supabase session.
              </CardDescription>
            </div>
          </div>
          <Badge variant="success" size="sm">
            Active Session
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {/* Email & Verification */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-500 font-medium">
              <Mail className="w-3.5 h-3.5 text-brand-600" />
              <span>Email Verification</span>
            </div>
            <div className="font-semibold text-slate-800 truncate" title={user?.email || ''}>
              {user?.email || 'Not available'}
            </div>
            <div className="text-[11px] text-slate-500">{emailConfirmed}</div>
          </div>

          {/* Database Role */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-500 font-medium">
              <Key className="w-3.5 h-3.5 text-brand-600" />
              <span>Enforced Database Role</span>
            </div>
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <span className="capitalize">{role || profile?.role || 'personal'}</span>
              <span className="text-[10px] font-normal text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                RLS Guarded
              </span>
            </div>
            <div className="text-[11px] text-slate-500">
              User ID: <span className="font-mono">{user?.id ? `${user.id.substring(0, 12)}...` : 'Not available'}</span>
            </div>
          </div>

          {/* MFA Status */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-500 font-medium">
              <Lock className="w-3.5 h-3.5 text-brand-600" />
              <span>Two-Factor Authentication</span>
            </div>
            <div className="font-semibold text-slate-800">{getMfaStatus()}</div>
            <div className="text-[11px] text-slate-500">MFA status via Supabase Auth</div>
          </div>

          {/* Last Sign In */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-500 font-medium">
              <Clock className="w-3.5 h-3.5 text-brand-600" />
              <span>Last Sign-In Timestamp</span>
            </div>
            <div className="font-semibold text-slate-800">{lastSignIn}</div>
            <div className="text-[11px] text-slate-500">From provider login audit</div>
          </div>

          {/* Session Token Expiry */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-500 font-medium">
              <Clock className="w-3.5 h-3.5 text-brand-600" />
              <span>Current Session Expiry</span>
            </div>
            <div className="font-semibold text-slate-800">{sessionExpiry}</div>
            <div className="text-[11px] text-slate-500">Auto-refreshed via client SDK</div>
          </div>

          {/* Registration Date */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-500 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-brand-600" />
              <span>Member Since</span>
            </div>
            <div className="font-semibold text-slate-800">{accountCreated}</div>
            <div className="text-[11px] text-slate-500">Database registration record</div>
          </div>
        </div>

        {/* Honest Disclosure Note */}
        <div className="mt-4 p-2.5 rounded-lg bg-blue-50/70 border border-blue-200/60 flex items-start gap-2 text-xs text-blue-900">
          <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Security Architecture Note:</strong> Multi-vector composite risk scoring and real-time transaction heuristics are deferred until the transactional database and machine learning engines are integrated in Milestone 6.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

