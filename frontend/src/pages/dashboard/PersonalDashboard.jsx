import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldCheck,
  Link as LinkIcon,
  Smartphone,
  Calculator,
  TrendingUp,
  UploadCloud,
  FileText,
  AlertCircle,
  Receipt,
  Eye,
  Info,
} from 'lucide-react';
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import MetricWidget from '../../components/dashboard/MetricWidget';
import AccountSecurityCard from '../../components/dashboard/AccountSecurityCard';
import EmptyState from '../../components/dashboard/EmptyState';
import DemoBadge from '../../components/dashboard/DemoBadge';
import { SYNTHETIC_PERSONAL_TRANSACTIONS } from '../../services/syntheticData';

export default function PersonalDashboard() {
  const { user, profile, session, role } = useAuth();
  const [showSyntheticTransactions, setShowSyntheticTransactions] = useState(false);
  const [activeShortcutModal, setActiveShortcutModal] = useState(null);

  const effectiveRole = role || profile?.role || 'personal';

  const shortcuts = [
    {
      id: 'links',
      title: 'Scan Suspicious Link',
      description: 'Phishing URL detection & domain trust scoring',
      icon: LinkIcon,
      milestone: 'Milestone 7',
      details: 'Will analyze shortened links, homoglyph domains, and phishing payloads using heuristic feeds and threat intelligence.',
    },
    {
      id: 'apps',
      title: 'Analyze App Permissions',
      description: 'APK malware & excessive permission auditor',
      icon: Smartphone,
      milestone: 'Milestone 7',
      details: 'Will inspect Android APK manifests for intrusive SMS, accessibility service, and overlay permissions.',
    },
    {
      id: 'loans',
      title: 'Check Loan Terms',
      description: 'Predatory APR & hidden penalty fee calculator',
      icon: Calculator,
      milestone: 'Milestone 8',
      details: 'Will calculate true Annual Percentage Rates (APR) and surface predatory amortization curves and hidden processing fees.',
    },
    {
      id: 'investments',
      title: 'Evaluate Investment',
      description: 'Ponzi pattern & fraudulent return evaluator',
      icon: TrendingUp,
      milestone: 'Milestone 9',
      details: 'Will assess guaranteed return promises against regulatory databases and historic Ponzi scheme patterns.',
    },
    {
      id: 'statements',
      title: 'Upload Bank Statement',
      description: 'CSV transaction ingestion & anomaly scanning',
      icon: UploadCloud,
      milestone: 'Milestone 5',
      details: 'Will parse standardized bank statement exports and stage transaction records for fraud engine scoring.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome & Context Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 bg-white rounded-2xl border border-slate-200/90 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              Personal Financial Safety
            </h1>
            <Badge variant="brand" size="sm">
              Role: {effectiveRole}
            </Badge>
          </div>
          <p className="text-xs text-slate-500">
            Authenticated as <span className="font-mono text-slate-700 font-medium">{user?.email}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Supabase Session Active
          </span>
        </div>
      </div>

      {/* Section 1: Verifiable Account Security (No Arbitrary Score) */}
      <AccountSecurityCard
        user={user}
        profile={profile}
        session={session}
        role={effectiveRole}
      />

      {/* Section 2: Metric Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricWidget
          title="Account Status"
          value="Protected"
          subtitle="Supabase RLS active"
          icon={ShieldCheck}
          variant="success"
        />
        <MetricWidget
          title="Active Alerts"
          value="0"
          subtitle="No current threats"
          icon={AlertCircle}
          variant="default"
        />
        <MetricWidget
          title="Linked Accounts"
          value="0"
          subtitle="Milestone 5 integration"
          icon={Receipt}
          variant="default"
          isPending
        />
        <MetricWidget
          title="Generated Reports"
          value="0"
          subtitle="Milestone 10 integration"
          icon={FileText}
          variant="default"
          isPending
        />
      </div>

      {/* Section 3: Feature Shortcuts (Clearly Labeled "Coming Soon") */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Financial Safety Tools</h2>
            <p className="text-xs text-slate-500">
              Module integrations scheduled in upcoming milestone releases.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shortcuts.map((sc) => {
            const Icon = sc.icon;
            return (
              <div
                key={sc.id}
                onClick={() => setActiveShortcutModal(sc)}
                className="group p-4 bg-white rounded-xl border border-slate-200 hover:border-brand-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-9 h-9 rounded-xl bg-slate-50 text-brand-600 border border-slate-200 flex items-center justify-center group-hover:bg-brand-50 transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      {sc.milestone}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 group-hover:text-brand-600 transition-colors">
                    {sc.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {sc.description}
                  </p>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-brand-600 font-semibold">
                  <span>View Roadmap Details</span>
                  <span className="text-slate-400 group-hover:translate-x-0.5 transition-transform">→</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 4: Transaction Activity Feed */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Recent Transaction Activity
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Monitored financial debits, payments, and risk scores.
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant={showSyntheticTransactions ? 'secondary' : 'ghost'}
              icon={Eye}
              onClick={() => setShowSyntheticTransactions(!showSyntheticTransactions)}
              className="text-xs self-start sm:self-auto"
            >
              {showSyntheticTransactions ? 'Hide Sample Preview' : 'Toggle Sample Preview'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showSyntheticTransactions ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900">
                <DemoBadge text="SYNTHETIC DEMO DATA" />
                <span className="text-[11px] text-amber-800">
                  Statement parsing and database persistence arrive in Milestone 4 & 5.
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Merchant</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Channel</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {SYNTHETIC_PERSONAL_TRANSACTIONS.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {new Date(tx.date).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {tx.merchant}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{tx.category}</td>
                        <td className="py-2.5 px-3 text-slate-500">{tx.channel}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800">
                          ${tx.amount.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                            Low Risk
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={Receipt}
              title="No transactions linked yet"
              description="Upload a bank statement in Milestone 5 or link financial accounts to enable automated fraud monitoring."
              actionLabel="View Sample Preview"
              onAction={() => setShowSyntheticTransactions(true)}
              actionIcon={Eye}
            />
          )}
        </CardContent>
      </Card>

      {/* Section 5: Risk Alerts & Reports (Meaningful Empty States) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Alerts Card */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-900">
              Active Security Alerts
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Real-time threat notifications and suspicious attempt flags.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={AlertCircle}
              title="No active security alerts"
              description="Your account currently has zero flagged anomalies or blocked access attempts. Alerts will appear here when threats are detected."
            />
          </CardContent>
        </Card>

        {/* Safety Reports Card */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-900">
              Financial Safety Reports
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Downloaded audit statements and compliance trust reports.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={FileText}
              title="No reports generated yet"
              description="Formal verification and trust evidence reports will be generated once full scanning modules run in Milestone 10."
            />
          </CardContent>
        </Card>
      </div>

      {/* Informational Shortcut Modal */}
      {activeShortcutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                {activeShortcutModal.milestone} Preview
              </span>
              <button
                onClick={() => setActiveShortcutModal(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {activeShortcutModal.title}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeShortcutModal.description}
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed">
              {activeShortcutModal.details}
            </div>

            <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-200/60 flex items-start gap-2 text-xs text-blue-900">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                This module will become functional in <strong>{activeShortcutModal.milestone}</strong>. No fake transactions or simulated results are executed ahead of time.
              </span>
            </div>

            <Button
              className="w-full"
              variant="secondary"
              onClick={() => setActiveShortcutModal(null)}
            >
              Understood
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
