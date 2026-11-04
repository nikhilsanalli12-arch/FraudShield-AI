import React, { useState } from 'react';
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
  Filter,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import DemoBadge from '../../components/dashboard/DemoBadge';
import MetricWidget from '../../components/dashboard/MetricWidget';
import InvestigationModal from '../../components/dashboard/InvestigationModal';
import {
  SYNTHETIC_DISCLAIMER,
  SYNTHETIC_ANALYST_QUEUE,
  SYNTHETIC_RISK_DISTRIBUTION,
  SYNTHETIC_7DAY_TREND,
} from '../../services/syntheticData';

export default function AnalystDashboard() {
  const [queueItems, setQueueItems] = useState(SYNTHETIC_ANALYST_QUEUE);
  const [selectedItem, setSelectedItem] = useState(null);
  const [filterSeverity, setFilterSeverity] = useState('all');

  const handleMarkReviewed = (id) => {
    setQueueItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: item.status === 'REVIEWED_IN_DEMO' ? 'PENDING_REVIEW' : 'REVIEWED_IN_DEMO',
            }
          : item
      )
    );
    if (selectedItem && selectedItem.id === id) {
      setSelectedItem((prev) =>
        prev
          ? {
              ...prev,
              status: prev.status === 'REVIEWED_IN_DEMO' ? 'PENDING_REVIEW' : 'REVIEWED_IN_DEMO',
            }
          : null
      );
    }
  };

  const filteredQueue = queueItems.filter((item) => {
    if (filterSeverity === 'all') return true;
    return item.severity === filterSeverity;
  });

  return (
    <div className="space-y-6">
      {/* High-Visibility Synthetic Demo Disclaimer Banner */}
      <div className="p-4 bg-amber-500/10 border border-amber-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900">
        <div className="flex items-start sm:items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
          <div className="text-xs">
            <span className="font-bold uppercase tracking-wider block sm:inline mr-2">
              Synthetic Demo Data Notice:
            </span>
            <span>
              All transactions, anomaly scores, and queues in this portal are synthetic demonstrations for UI workflow testing. Real-time stream parsing and machine learning inference will activate in Milestones 4–6 and 11.
            </span>
          </div>
        </div>
        <DemoBadge className="self-start sm:self-auto shrink-0" text="DEMO ENVIRONMENT" />
      </div>

      {/* Illustrative Demo Metrics (Clearly labeled as DEMO) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricWidget
          title="Sample Queue Volume"
          value={`${queueItems.length} Records`}
          subtitle="Simulated pending triage"
          icon={Activity}
          variant="warning"
          isDemo
        />
        <MetricWidget
          title="Sample Critical Flags"
          value={queueItems.filter((q) => q.severity === 'critical').length.toString()}
          subtitle="Scores above 90 (Demo)"
          icon={ShieldAlert}
          variant="danger"
          isDemo
        />
        <MetricWidget
          title="Reviewed in Demo"
          value={queueItems.filter((q) => q.status === 'REVIEWED_IN_DEMO').length.toString()}
          subtitle="Local session state"
          icon={CheckCircle2}
          variant="success"
          isDemo
        />
        <MetricWidget
          title="Live Fraud Pipeline"
          value="Pending"
          subtitle="Activates in Milestone 6"
          icon={Clock}
          variant="default"
          isPending
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
                <DemoBadge text="SYNTHETIC DEMO" />
              </div>
              <CardDescription className="text-xs text-slate-500">
                Demonstration triage items for testing investigation workflows. Financial intervention is strictly disabled.
              </CardDescription>
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-100 p-1 rounded-xl text-xs">
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
                Critical
              </button>
              <button
                onClick={() => setFilterSeverity('elevated')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  filterSeverity === 'elevated' ? 'bg-white shadow-xs text-amber-700' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Elevated
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Case ID</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Account ID</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3 text-center">Simulated Risk</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Investigation Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredQueue.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-3 font-mono font-semibold text-brand-600">
                      {item.id}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-500">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-700">
                      {item.accountId}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-800">
                      {item.category}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-slate-800">
                      ${item.amount.toFixed(2)}
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
                      {item.status === 'REVIEWED_IN_DEMO' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Reviewed
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          Pending
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
                  Sample categorization across low, moderate, elevated, and critical bands.
                </CardDescription>
              </div>
              <DemoBadge text="DEMO CHART" />
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
              Sample chart data for UI layout evaluation. Real histogram computed in Milestone 11.
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
                  Sample volume progression of normal vs flagged items over time.
                </CardDescription>
              </div>
              <DemoBadge text="DEMO CHART" />
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
      />
    </div>
  );
}

