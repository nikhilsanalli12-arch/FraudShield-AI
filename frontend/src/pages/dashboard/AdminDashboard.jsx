import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchAdminStats } from '../../services/adminTelemetry';
import {
  Server,
  Database,
  Users,
  Cpu,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import MetricWidget from '../../components/dashboard/MetricWidget';

export default function AdminDashboard() {
  const { session, user, role } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminStats(session?.access_token);
      setStats(res);
      if (!res.success && res.error) {
        setError(res.error);
      }
    } catch (err) {
      setError(err.message || 'Failed to load telemetry');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const formatUptime = (seconds) => {
    if (typeof seconds !== 'number') return 'Not available';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs}h ${mins}m ${secs}s`;
  };

  const usersCount = stats?.users?.total ?? 'Not available';
  const personalUsers = stats?.users?.roles?.personal ?? 'Not available';
  const analystUsers = stats?.users?.roles?.analyst ?? 'Not available';
  const adminUsers = stats?.users?.roles?.admin ?? 'Not available';

  const gatewayStatus = stats?.gateway?.status || (loading ? 'Checking...' : 'Offline / Unreachable');
  const databaseStatus = stats?.database?.status || (loading ? 'Checking...' : 'Unknown');

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              Platform Administration
            </h1>
            <Badge variant="danger" size="sm">
              Role: {role || 'admin'}
            </Badge>
          </div>
          <p className="text-xs text-slate-500">
            Privileged telemetry and database account statistics queried via backend server credentials.
          </p>
        </div>

        <Button
          size="sm"
          variant="secondary"
          icon={RefreshCw}
          onClick={loadStats}
          disabled={loading}
          className="text-xs self-start sm:self-auto"
        >
          {loading ? 'Refreshing...' : 'Refresh Telemetry'}
        </Button>
      </div>

      {/* Error Banner if Backend is Unreachable */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-xs text-rose-800">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Backend Communication Notice</div>
            <div className="mt-0.5">{error}. Displaying fallback telemetry values. Ensure backend gateway is running on port 5000.</div>
          </div>
        </div>
      )}

      {/* Telemetry Metric Cards (Actual values or 'Not available') */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricWidget
          title="Express API Gateway"
          value={gatewayStatus}
          subtitle={stats?.gateway?.uptimeSeconds ? `Uptime: ${formatUptime(stats.gateway.uptimeSeconds)}` : 'Node.js Gateway'}
          icon={Server}
          variant={gatewayStatus === 'healthy' ? 'success' : 'danger'}
        />
        <MetricWidget
          title="Supabase PostgreSQL"
          value={databaseStatus === 'connected' ? 'Connected' : databaseStatus}
          subtitle="Cloud Database Connection"
          icon={Database}
          variant={databaseStatus === 'connected' ? 'success' : 'warning'}
        />
        <MetricWidget
          title="Total Registered Profiles"
          value={usersCount.toString()}
          subtitle="Database count via backend"
          icon={Users}
          variant="default"
        />
        <MetricWidget
          title="System Health Score"
          value="Not available"
          subtitle="Telemetry pending (M12)"
          icon={Cpu}
          variant="default"
          isPending
        />
      </div>

      {/* User and Role Breakdown (Live Supabase profiles count via backend) */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold text-slate-900">
            Registered Account Distribution by Role
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Actual count of user profiles stored in the PostgreSQL database, queried server-side.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Personal Role */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                <span>Personal Users</span>
                <Badge variant="brand" size="sm">personal</Badge>
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {personalUsers.toString()}
              </div>
              <p className="text-[11px] text-slate-500">
                Public accounts with personal dashboard access
              </p>
            </div>

            {/* Analyst Role */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                <span>Financial Analysts</span>
                <Badge variant="warning" size="sm">analyst</Badge>
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {analystUsers.toString()}
              </div>
              <p className="text-[11px] text-slate-500">
                Authorized fraud triage & case investigators
              </p>
            </div>

            {/* Admin Role */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                <span>Platform Administrators</span>
                <Badge variant="danger" size="sm">admin</Badge>
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {adminUsers.toString()}
              </div>
              <p className="text-[11px] text-slate-500">
                System telemetry & privileged maintenance access
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Honest Audit Telemetry Overview */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Audit Stream & Security Telemetry
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Active administrator session context and subsystem readiness status.
              </CardDescription>
            </div>
            <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
              M12 AUDIT ENGINE PENDING
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2 font-mono text-slate-700">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-slate-200/80 pb-2">
                <span className="text-slate-500 font-sans font-bold">Subsystem</span>
                <span className="text-slate-500 font-sans font-bold">Integration Status</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <span>Machine Learning Inference Engine</span>
                <span className="text-amber-700 font-sans text-[11px]">Integration pending (Milestone 6)</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <span>Comprehensive Audit Log Stream</span>
                <span className="text-slate-500 font-sans text-[11px]">Integration pending (Milestone 12)</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <span>Network Latency Micro-Telemetry</span>
                <span className="text-slate-500 font-sans text-[11px]">Integration pending (Milestone 12)</span>
              </div>
            </div>

            {/* Current Active Session Telemetry */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
              <div className="font-sans font-bold text-slate-800 text-xs mb-1">
                Verified Active Admin Session:
              </div>
              <div className="font-mono text-slate-600 text-[11px]">
                <strong>Admin ID:</strong> {user?.id || 'Not available'}
              </div>
              <div className="font-mono text-slate-600 text-[11px]">
                <strong>Client Origin:</strong> {typeof window !== 'undefined' ? window.location.origin : 'Not available'}
              </div>
              <div className="font-mono text-slate-600 text-[11px]">
                <strong>Session Token Issued:</strong> {session?.issued_at ? new Date(session.issued_at * 1000).toLocaleString() : 'Not available'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
