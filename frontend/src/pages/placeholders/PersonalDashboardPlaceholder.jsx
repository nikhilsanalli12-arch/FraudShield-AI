import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, LogOut, User, CheckCircle2 } from 'lucide-react';
import Button from '../../components/common/Button';
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '../../components/common/Card';
import Badge from '../../components/common/Badge';

export default function PersonalDashboardPlaceholder() {
  const { user, profile, role, signOut } = useAuth();

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
      <div className="flex items-center justify-between pb-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center shadow-md">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">Personal Safety Portal</h1>
              <Badge variant="brand" size="sm">
                Role: {role || 'personal'}
              </Badge>
            </div>
            <p className="text-xs text-slate-500">
              Authorized session active for: <span className="font-mono text-slate-700">{user?.email}</span>
            </p>
          </div>
        </div>

        <Button onClick={signOut} variant="secondary" size="sm" icon={LogOut}>
          Sign Out
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Authentication Verified</CardTitle>
          <CardDescription>
            Milestone 2 authorization test harness. Full personal dashboard modules (transactions, links, apps, loans) will be mounted in Milestone 3+.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2 font-mono text-slate-700">
            <div><strong>User ID:</strong> {user?.id}</div>
            <div><strong>Email:</strong> {user?.email}</div>
            <div><strong>Full Name:</strong> {profile?.full_name || 'Not provided'}</div>
            <div><strong>Database Role:</strong> {role || 'personal'}</div>
            <div><strong>Account Created:</strong> {user?.created_at || 'Just now'}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
