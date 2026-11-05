import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldCheck,
  ShieldAlert,
  CreditCard,
  UploadCloud,
  FileText,
  AlertCircle,
  Receipt,
  Eye,
  PlusCircle,
  RefreshCw,
  Loader2,
  Download,
  Shield,
  ArrowLeft,
  LayoutDashboard,
} from 'lucide-react';
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import MetricWidget from '../../components/dashboard/MetricWidget';
import AccountSecurityCard from '../../components/dashboard/AccountSecurityCard';
import EmptyState from '../../components/dashboard/EmptyState';
import ManualTransactionModal from '../../components/dashboard/ManualTransactionModal';
import CsvImportModal from '../../components/dashboard/CsvImportModal';
import TransactionDetailModal from '../../components/dashboard/TransactionDetailModal';
import { getTransactionHistory, downloadSampleCsv } from '../../services/transactionApi';

export default function TransactionsPage() {
  const [searchParams] = useSearchParams();
  const { user, profile, session, role } = useAuth();
  const [activeTab, setActiveTab] = useState('transactions'); // 'transactions' | 'security'

  // Live transaction state
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });

  // Modals state
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  const effectiveRole = role || profile?.role || 'personal';

  // Automatically open CSV modal if navigated with ?action=import
  useEffect(() => {
    if (searchParams.get('action') === 'import') {
      setIsCsvModalOpen(true);
    }
  }, [searchParams]);

  // Fetch live transaction history from backend
  const fetchTransactions = useCallback(
    async (isBackground = false) => {
      if (!session?.access_token) {
        setLoading(false);
        return;
      }

      if (isBackground) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const response = await getTransactionHistory(session.access_token, 1, 20);
        if (response && response.success) {
          setTransactions(response.data || []);
          if (response.pagination) {
            setPagination(response.pagination);
          }
        } else {
          setTransactions([]);
        }
      } catch (err) {
        console.error('Failed to load transaction history:', err);
        setError(
          err.message ||
            'Failed to load transaction history. Please verify your connection.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [session]
  );

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const totalCount = pagination.total || transactions.length;
  const activeAlerts = transactions.filter(
    (tx) =>
      tx.fraud_assessment?.risk_level === 'high' ||
      tx.fraud_assessment?.risk_level === 'critical'
  );

  const getRiskBadgeProps = (riskLevel, riskScore) => {
    switch (riskLevel) {
      case 'critical':
      case 'high':
        return {
          variant: 'danger',
          label: `${riskLevel.toUpperCase()} (${riskScore ?? 0}/100)`,
        };
      case 'medium':
        return {
          variant: 'warning',
          label: `MEDIUM (${riskScore ?? 0}/100)`,
        };
      case 'low':
      default:
        return {
          variant: 'success',
          label: `LOW (${riskScore ?? 0}/100)`,
        };
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Return to Dashboard Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-brand-600 transition-colors group"
          title="Return to Main Dashboard"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Dashboard</span>
        </Link>
      </div>

      {/* Header & Primary Action Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-6 bg-white rounded-2xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              Bank Transaction Fraud Monitoring
            </h1>
            <Badge variant="brand" size="sm">
              Role: {effectiveRole}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
            <span>Deterministic heuristic scoring and Gemini AI transaction analysis.</span>
            <span className="text-slate-300">•</span>
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Supabase Session Active
            </span>
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="ghost"
            icon={RefreshCw}
            onClick={() => fetchTransactions(true)}
            disabled={loading || refreshing}
            className={refreshing ? 'animate-spin' : ''}
            title="Refresh transaction history"
          />
          <Button
            size="sm"
            variant="outline"
            icon={Download}
            onClick={downloadSampleCsv}
            title="Download formatted sample CSV template"
          >
            Sample CSV
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={UploadCloud}
            onClick={() => setIsCsvModalOpen(true)}
          >
            Import CSV
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={PlusCircle}
            onClick={() => setIsManualModalOpen(true)}
          >
            + Add Transaction
          </Button>
        </div>
      </div>

      {/* Quick Statistics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricWidget
          title="Monitored Transactions"
          value={String(totalCount)}
          subtitle="Persisted in Supabase"
          icon={Receipt}
          variant="default"
        />
        <MetricWidget
          title="Active Security Alerts"
          value={String(activeAlerts.length)}
          subtitle={
            activeAlerts.length > 0
              ? 'High/critical risks detected'
              : 'Zero flagged threats'
          }
          icon={AlertCircle}
          variant={activeAlerts.length > 0 ? 'danger' : 'success'}
        />
        <MetricWidget
          title="Fraud Engine Status"
          value="Active"
          subtitle="Deterministic Rule Engine v1"
          icon={ShieldCheck}
          variant="success"
        />
        <MetricWidget
          title="Ingestion Channels"
          value="2 Supported"
          subtitle="Manual Entry & RFC 4180 CSV"
          icon={UploadCloud}
          variant="default"
        />
      </div>

      {/* Active High-Risk Alerts Banner (if any) */}
      {activeAlerts.length > 0 && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
              <h3 className="text-sm font-bold text-rose-950">
                Active High-Risk Fraud Alerts ({activeAlerts.length})
              </h3>
            </div>
            <span className="text-xs text-rose-700 font-medium">
              Compliance investigation cases auto-opened
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
            {activeAlerts.map((alertTx) => (
              <div
                key={alertTx.id}
                onClick={() => setSelectedTransaction(alertTx)}
                className="p-3 bg-white rounded-lg border border-rose-200 shadow-2xs hover:border-rose-400 cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-slate-800 truncate">
                    {alertTx.merchant_name}
                  </span>
                  <Badge variant="danger" size="sm">
                    Score: {alertTx.fraud_assessment?.risk_score}/100
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-600 mb-1 font-mono">
                  <span>
                    {Number(alertTx.amount).toFixed(2)} {alertTx.currency}
                  </span>
                  <span>
                    {alertTx.transaction_date
                      ? new Date(alertTx.transaction_date).toLocaleDateString()
                      : ''}
                  </span>
                </div>
                <p className="text-[11px] text-rose-800 line-clamp-2">
                  {alertTx.fraud_assessment?.heuristic_reasons?.[0] ||
                    'High risk transaction detected'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('transactions')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'transactions'
              ? 'bg-brand-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Transaction Management & Fraud Scoring</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              activeTab === 'transactions'
                ? 'bg-brand-700 text-white'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {totalCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'security'
              ? 'bg-brand-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Account Security & Verification</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              activeTab === 'security'
                ? 'bg-brand-700 text-white'
                : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            Protected
          </span>
        </button>
      </div>

      {/* TAB 1: Monitored Transactions Table */}
      {activeTab === 'transactions' && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-bold text-slate-900">
                    Monitored Transactions & Deterministic Scoring
                  </CardTitle>
                  <Badge variant="brand" size="sm">
                    Live DB Records: {totalCount}
                  </Badge>
                </div>
                <CardDescription className="text-xs text-slate-500">
                  Live financial transactions with instant rule-based risk evaluation and audit trail.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  icon={Download}
                  onClick={downloadSampleCsv}
                >
                  Sample CSV
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={UploadCloud}
                  onClick={() => setIsCsvModalOpen(true)}
                >
                  Import CSV
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  icon={PlusCircle}
                  onClick={() => setIsManualModalOpen(true)}
                >
                  + Add Transaction
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{error}</span>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => fetchTransactions()}
                  className="text-xs h-7 px-2.5"
                >
                  Retry
                </Button>
              </div>
            )}

            {loading ? (
              <div className="p-12 flex flex-col items-center justify-center text-slate-400 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
                <p className="text-xs font-medium text-slate-500">
                  Loading monitored transactions from database...
                </p>
              </div>
            ) : transactions.length === 0 ? (
              <div className="space-y-4">
                <EmptyState
                  icon={Receipt}
                  title="No monitored transactions recorded yet"
                  description="Record a manual transaction or upload a bank statement CSV to evaluate transactions with the deterministic fraud engine."
                  actionLabel="+ Add First Transaction"
                  onAction={() => setIsManualModalOpen(true)}
                  actionIcon={PlusCircle}
                  actionVariant="primary"
                />
                <div className="flex items-center justify-center gap-3 pt-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={UploadCloud}
                    onClick={() => setIsCsvModalOpen(true)}
                  >
                    Import Statement CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Download}
                    onClick={downloadSampleCsv}
                  >
                    Download Sample CSV
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Merchant</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Source</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                        <th className="py-2.5 px-3 text-center">Risk Assessment</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {transactions.map((tx) => {
                        const assessment = tx.fraud_assessment;
                        const badgeInfo = getRiskBadgeProps(
                          assessment?.risk_level,
                          assessment?.risk_score
                        );

                        return (
                          <tr
                            key={tx.id}
                            className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                            onClick={() => setSelectedTransaction(tx)}
                          >
                            <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">
                              {tx.transaction_date
                                ? new Date(tx.transaction_date).toLocaleDateString()
                                : '—'}
                            </td>
                            <td className="py-3 px-3 font-semibold text-slate-800">
                              {tx.merchant_name}
                            </td>
                            <td className="py-3 px-3 text-slate-600 capitalize">
                              {tx.category}
                            </td>
                            <td className="py-3 px-3 text-slate-500 uppercase text-[11px]">
                              {tx.source === 'csv_import' ? 'CSV Import' : 'Manual'}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                              {Number(tx.amount).toFixed(2)} {tx.currency}
                            </td>
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              <Badge variant={badgeInfo.variant} size="sm">
                                {badgeInfo.label}
                              </Badge>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                icon={Eye}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTransaction(tx);
                                }}
                                className="text-xs h-7 px-2"
                              >
                                Inspect
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-2 px-1 border-t border-slate-100">
                  <span>
                    Showing {transactions.length} of {totalCount} transactions
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Click any transaction row to inspect heuristic rule explanations and AI analysis
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 2: Account Security Card */}
      {activeTab === 'security' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <AccountSecurityCard
            user={user}
            profile={profile}
            session={session}
            role={effectiveRole}
          />
        </div>
      )}

      {/* Modal: Manual Transaction Entry */}
      <ManualTransactionModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSuccess={() => {
          fetchTransactions(true);
        }}
        sessionToken={session?.access_token}
      />

      {/* Modal: CSV File Upload */}
      <CsvImportModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        onSuccess={() => {
          fetchTransactions(true);
        }}
        sessionToken={session?.access_token}
      />

      {/* Modal: Detailed Transaction Inspection */}
      <TransactionDetailModal
        isOpen={Boolean(selectedTransaction)}
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
      />
    </div>
  );
}

