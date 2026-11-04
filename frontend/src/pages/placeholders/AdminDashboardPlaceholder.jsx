import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, LogOut, Terminal } from 'lucide-react';
import Button from '../../components/common/Button';
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '../../components/common/Card';
import Badge from '../../components/common/Badge';

export default function AdminDashboardPlaceholder() {
  const { user, profile, role, signOut } = useAuth();

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
      <div className="flex items-center justify-between pb-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-navy-950 text-white flex items-center justify-center shadow-md">
            <Terminal className="w-6 h-6 text-brand-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">Administrator Console</h1>
              <Badge variant="navy" size="sm">
                Role: {role}
              </Badge>
            </div>
            <p className="text-xs text-slate-500">
              System Administrator Session: <span className="font-mono text-slate-700">{user?.email}</span>
            </p>
          </div>
        </div>

        <Button onClick={signOut} variant="secondary" size="sm" icon={LogOut}>
          Sign Out
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Platform Governance & Audit Harness</CardTitle>
          <CardDescription>
            Milestone 2 authorization test harness. User role provisioning, system audit logs, and model deployment switches will be mounted in Milestone 3 & 12.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2 font-mono text-slate-700">
            <div><strong>Administrator ID:</strong> {user?.id}</div>
            <div><strong>Email:</strong> {user?.email}</div>
            <div><strong>Access Scope:</strong> Global Administrator</div>
            <div><strong>Database Role:</strong> {role}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

