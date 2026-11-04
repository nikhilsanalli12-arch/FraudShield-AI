import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, LogOut, CheckCircle2 } from 'lucide-react';
import Button from '../../components/common/Button';
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '../../components/common/Card';
import Badge from '../../components/common/Badge';

export default function AnalystDashboardPlaceholder() {
  const { user, profile, role, signOut } = useAuth();

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
      <div className="flex items-center justify-between pb-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">Analyst Command Center</h1>
              <Badge variant="purple" size="sm">
                Role: {role}
              </Badge>
            </div>
            <p className="text-xs text-slate-500">
              Verified Analyst Session: <span className="font-mono text-slate-700">{user?.email}</span>
            </p>
          </div>
        </div>

        <Button onClick={signOut} variant="secondary" size="sm" icon={LogOut}>
          Sign Out
        </Button>
      </div>

      <Card className="border-indigo-200 bg-indigo-50/10">
        <CardHeader>
          <CardTitle>Analyst Privilege Confirmed</CardTitle>
          <CardDescription>
            Milestone 2 authorization test harness. Multi-account fraud triage queues, entity network radar, and ML performance tools will be mounted in Milestone 3 & 11.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 rounded-xl bg-white border border-slate-200 text-xs space-y-2 font-mono text-slate-700">
            <div><strong>Analyst ID:</strong> {user?.id}</div>
            <div><strong>Official Email:</strong> {user?.email}</div>
            <div><strong>Access Level:</strong> High (Permitted for transaction graph investigation)</div>
            <div><strong>Verified Role:</strong> {role}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

