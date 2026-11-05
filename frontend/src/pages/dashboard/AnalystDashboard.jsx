import React, { useState, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
  CartesianGrid,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  FileSearch,
  CheckCircle2,
  Clock,
  ShieldAlert,
  RefreshCw,
  FolderCheck,
} from 'lucide-react';
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import DemoBadge from '../../components/dashboard/DemoBadge';
import MetricWidget from '../../components/dashboard/MetricWidget';
import InvestigationModal from '../../components/dashboard/InvestigationModal';
import { useAuth } from '../../context/AuthContext';
import { getAnalystCases, updateAnalystCase } from '../../services/transactionApi';
import {
  SYNTHETIC_RISK_DISTRIBUTION,
  SYNTHETIC_7DAY_TREND,
} from '../../services/syntheticData';

export default function AnalystDashboard() {
  const { session } = useAuth();
  const [queueItems, setQueueItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Fetch real investigation cases from backend API
  const fetchCases = useCallback(async () => {
    if (!session?.access_token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await getAnalystCases(session.access_token);
      if (res && res.success && Array.isArray(res.data)) {
        // Map database records into unified dashboard queue item structure
        const formatted = res.data.map((c) => {
          const tx = c.transaction || {};
          const fa = c.assessment || {};
          const riskScore = typeof fa.risk_score === 'number'
            ? fa.risk_score
            : (c.priority === 'urgent' ? 95 : 75);

          const severity = (fa.risk_level === 'critical' || c.priority === 'urgent' || riskScore >= 90)
            ? 'critical'
            : 'elevated';

          const indicators = (Array.isArray(fa.heuristic_reasons) && fa.heuristic_reasons.length > 0)
            ? fa.heuristic_reasons
            : (c.metadata?.heuristic_summary ? [c.metadata.heuristic_summary] : ['Automated high-risk scoring trigger']);

          const rawAmount = tx.amount != null ? tx.amount : 0;
          const parsedAmount = typeof rawAmount === 'number' ? rawAmount : (parseFloat(rawAmount) || 0);

          return {
            id: c.id,
            rawCase: c,
            timestamp: c.opened_at || tx.transaction_date || new Date().toISOString(),
            accountId: c.user_email || (c.user_id ? `usr_${c.user_id.slice(0, 8)}` : 'Unknown Account'),
            userEmail: c.user_email,
            userName: c.user_name,
            category: tx.category
              ? `${tx.category.toUpperCase()} — ${tx.merchant_name || 'Direct Transfer'}`
              : 'Suspicious Transaction',
            merchantName: tx.merchant_name || 'N/A',
            amount: parsedAmount,
            currency: tx.currency || 'USD',
            riskScore,
            severity,
            status: c.status || 'open',
            priority: c.priority || 'medium',
            indicators,
            simulatedTelemetry: {
              clientIp: '192.168.1.1 (Scrubbed)',
              deviceFingerprint: tx.payment_method_last4 ? `Card ending •••• ${tx.payment_method_last4}` : 'Verified Web Session',
              userAgent: tx.source ? `Source: ${tx.source}` : 'Web Portal v1.0',
              anomalyConfidence: `${riskScore}%`,
            },
          };
        });
        setQueueItems(formatted);
      } else {
        setQueueItems([]);
      }
    } catch (err) {
      console.error('Failed to load analyst cases:', err);
      setError(err.message || 'Unable to connect to live investigation cases.');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  // Update real investigation case status via backend API
  const handleMarkReviewed = async (id, targetStatus) => {
    const nextStatus = targetStatus || 'resolved';
    setIsActionLoading(true);

    try {
      if (session?.access_token) {
        await updateAnalystCase(session.access_token, id, { status: nextStatus });
      }

      setQueueItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                status: nextStatus,
              }
            : item
        )
      );

      if (selectedItem && selectedItem.id === id) {
        setSelectedItem((prev) =>
          prev
            ? {
                ...prev,
                status: nextStatus,
              }
            : null
        );
      }
    } catch (err) {
      console.error('Failed to update case status:', err);
      alert(`Failed to update case: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const filteredQueue = queueItems.filter((item) => {
    if (filterSeverity === 'all') return true;
    return item.severity === filterSeverity;
  });

  const criticalCount = queueItems.filter((q) => q.severity === 'critical').length;
  const resolvedCount = queueItems.filter((q) => q.status === 'resolved' || q.status === 'closed').length;

  return (
    <div className="space-y-6">
      {/* High-Visibility Synthetic Demo Notice Banner for UI charts and layout */}
      <div className="p-4 bg-amber-500/10 border border-amber-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900">
        <div className="flex items-start sm:items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
          <div className="text-xs">
            <span className="font-bold uppercase tracking-wider block sm:inline mr-2">
              Synthetic Demo Data Notice:
            </span>
            <span>
              The triage queue below is connected live to PostgreSQL investigation cases and deterministic fraud assessments. Time-series charts and ML clustering display synthetic demonstration data until Milestone 11.
            </span>
          </div>
        </div>
        <DemoBadge className="self-start sm:self-auto shrink-0" text="DEMO ENVIRONMENT" />
      </div>

      {/* Real Queue Metrics Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricWidget
          title="Active Queue Volume"
          value={loading ? '...' : `${queueItems.length} Records`}
          subtitle="Real Supabase investigation cases"
          icon={Activity}
          variant="warning"
        />
        <MetricWidget
          title="Critical Flags"
          value={loading ? '...' : criticalCount.toString()}
          subtitle="Scores >= 90 or urgent priority"
          icon={ShieldAlert}
          variant="danger"
        />
        <MetricWidget
          title="Resolved Cases"
          value={loading ? '...' : resolvedCount.toString()}
          subtitle="Analyst reviewed & closed"
          icon={CheckCircle2}
          variant="success"
        />
        <MetricWidget
          title="Live Fraud Pipeline"
          value="Connected"
          subtitle="Deterministic Engine v1.0"
          icon={Clock}
          variant="default"
        />
      </div>

      {/* Suspicious Transaction Triage Queue */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold text-slate-900">
                  Suspicious Transaction Triage Queue
                </CardTitle>
                <Badge variant="neutral" size="sm">
                  LIVE DATABASE
                </Badge>
              </div>
              <CardDescription className="text-xs text-slate-500">
                Active investigation cases auto-created from high and critical risk fraud assessments.
              </CardDescription>
            </div>

            {/* Filter and Refresh Controls */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs">
                <button
                  onClick={() => setFilterSeverity('all')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    filterSeverity === 'all' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  All ({queueItems.length})
                </button>
                <button
                  onClick={() => setFilterSeverity('critical')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    filterSeverity === 'critical' ? 'bg-white shadow-xs text-rose-700' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Critical ({criticalCount})
                </button>
                <button
                  onClick={() => setFilterSeverity('elevated')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    filterSeverity === 'elevated' ? 'bg-white shadow-xs text-amber-700' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Elevated ({queueItems.length - criticalCount})
                </button>
              </div>

              <Button
                size="sm"
                variant="secondary"
                icon={RefreshCw}
                onClick={fetchCases}
                disabled={loading}
                title="Refresh Triage Queue"
              >
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Error State */}
          {error && (
            <div className="p-4 mb-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  <strong>Error loading queue:</strong> {error}
                </span>
              </div>
              <Button size="sm" variant="secondary" onClick={fetchCases}>
                Retry
              </Button>
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <Activity className="w-6 h-6 animate-spin mx-auto text-brand-600 mb-2" />
              <p className="text-xs font-medium">Retrieving investigation cases from Supabase...</p>
            </div>
          ) : filteredQueue.length === 0 ? (
            /* Empty State */
            <div className="py-12 px-4 text-center">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-emerald-200/60 shadow-xs">
                <FolderCheck className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                {filterSeverity === 'all' ? 'Triage Queue Clear' : `No ${filterSeverity} Cases`}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                {filterSeverity === 'all'
                  ? 'There are currently no high-risk transactions requiring analyst intervention. Automated monitoring is active.'
                  : `No cases match the "${filterSeverity}" filter. Switch back to "All" to inspect other records.`}
              </p>
              <Button size="sm" variant="secondary" onClick={fetchCases} icon={RefreshCw}>
                Refresh Cases
              </Button>
            </div>
          ) : (
            /* Table with Real Cases */
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Case ID</th>
                    <th className="py-2.5 px-3">Opened At</th>
                    <th className="py-2.5 px-3">Account / User</th>
                    <th className="py-2.5 px-3">Category & Merchant</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3 text-center">Assessed Risk</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Investigation Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredQueue.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-3 font-mono font-semibold text-brand-600">
                        {item.id.length > 12 ? `${item.id.slice(0, 8)}...` : item.id}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-500 whitespace-nowrap">
                        {new Date(item.timestamp).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        {new Date(item.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-700 truncate max-w-[140px]" title={item.accountId}>
                        {item.accountId}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-800">
                        {item.category}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-slate-800 whitespace-nowrap">
                        ${item.amount.toFixed(2)} {item.currency}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Badge
                          variant={item.severity === 'critical' ? 'danger' : 'warning'}
                          size="sm"
                        >
                          {item.riskScore}/100
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {item.status === 'resolved' || item.status === 'closed' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Resolved
                          </span>
                        ) : item.status === 'in_review' ? (
                          <span className="inline-flex items-center text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                            In Review
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            Open
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={FileSearch}
                          onClick={() => setSelectedItem(item)}
                          className="text-xs"
                        >
                          Inspect Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Visualizations Section (Recharts) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Distribution Chart */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-slate-900">
                  Illustrative Risk Distribution
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Categorization across low, moderate, elevated, and critical bands.
                </CardDescription>
              </div>
              <DemoBadge text="SYNTHETIC DEMO DATA" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={SYNTHETIC_RISK_DISTRIBUTION} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="band" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 text-center">
              Sample chart data for UI evaluation. Live histogram computed in Milestone 11.
            </p>
          </CardContent>
        </Card>

        {/* 7-Day Trend Chart */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-slate-900">
                  Illustrative 7-Day Flag Velocity
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Volume progression of normal vs flagged items over time.
                </CardDescription>
              </div>
              <DemoBadge text="SYNTHETIC DEMO DATA" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={SYNTHETIC_7DAY_TREND} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="flaggedColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="flaggedAlerts"
                    stroke="#EF4444"
                    fillOpacity={1}
                    fill="url(#flaggedColor)"
                    name="Flagged (Sample)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 text-center">
              Sample velocity curves. Live time-series streaming will connect in Milestone 11.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Investigation Details Modal */}
      <InvestigationModal
        item={selectedItem}
        isOpen={Boolean(selectedItem)}
        onClose={() => setSelectedItem(null)}
        onMarkReviewed={handleMarkReviewed}
        isUpdating={isActionLoading}
      />
    </div>
  );
}
