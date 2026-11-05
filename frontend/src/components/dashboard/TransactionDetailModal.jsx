import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Receipt,
  Calendar,
  Building,
  CreditCard,
  Tag,
  FileText,
  Clock,
  Sparkles,
  CheckCircle2,
  ListChecks,
  RefreshCw,
  Info,
} from 'lucide-react';
import Badge from '../common/Badge';
import Button from '../common/Button';
import { useAuth } from '../../context/AuthContext';
import { getAiTransactionExplanation } from '../../services/transactionApi';

export default function TransactionDetailModal({
  transaction,
  isOpen,
  onClose,
}) {
  const { session } = useAuth();
  const [aiData, setAiData] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiError, setAiError] = useState(null);

  // Fetch AI explanation on modal open or transaction change
  useEffect(() => {
    if (!isOpen || !transaction) {
      setAiData(null);
      setAiError(null);
      setLoadingAi(false);
      return;
    }

    let isMounted = true;
    const fetchExplanation = async () => {
      setLoadingAi(true);
      setAiError(null);

      try {
        const assessment = transaction.fraud_assessment || {};
        const res = await getAiTransactionExplanation(session?.access_token, {
          transaction,
          assessment,
          transactionId: transaction.id,
        });

        if (isMounted) {
          setAiData(res);
        }
      } catch (err) {
        if (isMounted) {
          console.warn('[TransactionDetailModal] AI explanation request note:', err.message);
          setAiError(err.message || 'Unable to generate AI explanation.');
        }
      } finally {
        if (isMounted) {
          setLoadingAi(false);
        }
      }
    };

    fetchExplanation();

    return () => {
      isMounted = false;
    };
  }, [isOpen, transaction?.id, session?.access_token]);

  if (!isOpen || !transaction) return null;

  const assessment = transaction.fraud_assessment || null;
  const reasons = assessment?.heuristic_reasons || [];
  const riskScore = assessment?.risk_score ?? 0;
  const riskLevel = assessment?.risk_level || 'low';

  const riskBadgeVariant = {
    low: 'success',
    medium: 'warning',
    high: 'danger',
    critical: 'danger',
  }[riskLevel] || 'default';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 border border-brand-200 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Transaction Details</h3>
              <p className="text-xs text-slate-500 font-mono">
                ID: {transaction.id ? transaction.id.substring(0, 18) + '...' : 'N/A'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Fraud Assessment Card */}
          <div
            className={`p-4 rounded-xl border ${
              riskLevel === 'critical' || riskLevel === 'high'
                ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                : riskLevel === 'medium'
                ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {riskLevel === 'critical' || riskLevel === 'high' ? (
                  <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                ) : riskLevel === 'medium' ? (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                ) : (
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                )}
                <span className="font-bold text-sm">Deterministic Fraud Assessment</span>
              </div>
              <Badge variant={riskBadgeVariant} size="md">
                {riskLevel.toUpperCase()} RISK ({riskScore}/100)
              </Badge>
            </div>

            {/* Heuristic Reasons List */}
            <div className="mt-2 text-xs">
              <p className="font-semibold mb-1.5 text-slate-700">Triggered Heuristics:</p>
              {reasons.length > 0 ? (
                <ul className="space-y-1.5 pl-1">
                  {reasons.map((reason, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-slate-800">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-500 mt-1.5 shrink-0" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-600 italic">
                  Zero risk heuristics triggered. Normal transaction pattern detected.
                </p>
              )}
            </div>

            {assessment?.model_version && (
              <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>Engine: {assessment.model_version}</span>
                {assessment.assessed_at && (
                  <span>Assessed: {new Date(assessment.assessed_at).toLocaleTimeString()}</span>
                )}
              </div>
            )}
          </div>

          {/* Google Gemini AI Explanation Section */}
          <div className="p-4 rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/40 via-white to-purple-50/30 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                    AI Fraud Analysis & Protection Insights
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Contextual evaluation powered by Google Gemini AI
                  </p>
                </div>
              </div>

              {loadingAi ? (
                <Badge variant="neutral" size="sm">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 animate-spin text-indigo-600" />
                    Analyzing...
                  </span>
                </Badge>
              ) : aiData?.aiAvailable ? (
                <Badge variant="primary" size="sm">
                  {aiData.model ? `Gemini AI (${aiData.model.replace('models/', '')})` : 'Gemini AI'}
                </Badge>
              ) : (
                <Badge variant="warning" size="sm">
                  Heuristic Fallback
                </Badge>
              )}
            </div>

            {/* Loading State */}
            {loadingAi && (
              <div className="py-6 text-center text-xs text-slate-500 space-y-2">
                <Sparkles className="w-5 h-5 text-indigo-500 animate-spin mx-auto" />
                <p>Generating natural-language risk explanation and safety recommendations...</p>
              </div>
            )}

            {/* Error State */}
            {!loadingAi && aiError && !aiData && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between">
                <span>{aiError}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const assessment = transaction.fraud_assessment || {};
                    getAiTransactionExplanation(session?.access_token, {
                      transaction,
                      assessment,
                      transactionId: transaction.id,
                    }).then(setAiData).catch(() => {});
                  }}
                  icon={RefreshCw}
                >
                  Retry
                </Button>
              </div>
            )}

            {/* AI Explanation Content */}
            {!loadingAi && aiData && (
              <div className="space-y-3.5 text-xs">
                {/* Fallback Notice when AI is unavailable */}
                {!aiData.aiAvailable && (
                  <div className="p-2.5 rounded-lg bg-amber-50/80 border border-amber-200/80 flex items-start gap-2 text-[11px] text-amber-900">
                    <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      {aiData.fallbackReason?.toLowerCase().includes('not configured') ? (
                        <>
                          <strong>API Key Notice:</strong> Google Gemini API key is not configured in <code>backend/.env</code>. Displaying verified rule-based heuristic explanation and protection advice.
                        </>
                      ) : (
                        <>
                          <strong>Rule-Based Analysis Notice:</strong> {aiData.fallbackReason || 'Gemini service is temporarily unavailable.'} Displaying verified rule-based heuristic explanation and protection advice.
                        </>
                      )}
                    </span>
                  </div>
                )}

                {/* Plain-Language Explanation Summary */}
                <div className="p-3 rounded-lg bg-white border border-indigo-100/80 shadow-2xs">
                  <span className="font-semibold text-slate-900 block mb-1">
                    Plain-Language Summary:
                  </span>
                  <p className="text-slate-700 leading-relaxed">{aiData.summary}</p>
                </div>

                {/* Facts vs Indicators Breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Confirmed Facts */}
                  <div className="p-3 rounded-lg bg-white border border-slate-200/80 space-y-1.5 shadow-2xs">
                    <span className="font-bold text-[11px] uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Confirmed Facts
                    </span>
                    <ul className="space-y-1 pl-1 text-[11px] text-slate-700">
                      {aiData.facts?.map((fact, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-emerald-500 font-bold shrink-0">•</span>
                          <span>{fact}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Potential Fraud Indicators */}
                  <div className="p-3 rounded-lg bg-white border border-slate-200/80 space-y-1.5 shadow-2xs">
                    <span className="font-bold text-[11px] uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      Potential Indicators
                    </span>
                    <ul className="space-y-1 pl-1 text-[11px] text-slate-700">
                      {aiData.indicators?.map((ind, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-amber-500 font-bold shrink-0">•</span>
                          <span>{ind}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Three Practical Recommendations */}
                <div className="p-3 rounded-lg bg-white border border-indigo-100 space-y-2 shadow-2xs">
                  <span className="font-bold text-[11px] uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                    <ListChecks className="w-3.5 h-3.5 text-indigo-600" />
                    Three Practical Protection Steps
                  </span>
                  <div className="space-y-1.5">
                    {aiData.recommendations?.map((rec, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-md bg-slate-50 border border-slate-100 flex items-start gap-2 text-[11px] text-slate-800"
                      >
                        <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0 text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="leading-snug">{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Transaction Metadata Grid */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
              <span className="text-slate-500 flex items-center gap-1.5 mb-1">
                <Receipt className="w-3.5 h-3.5 text-slate-400" /> Amount & Currency
              </span>
              <p className="text-base font-bold text-slate-900 font-mono">
                {Number(transaction.amount).toFixed(2)} {transaction.currency}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
              <span className="text-slate-500 flex items-center gap-1.5 mb-1">
                <Building className="w-3.5 h-3.5 text-slate-400" /> Merchant
              </span>
              <p className="text-sm font-semibold text-slate-800 truncate">
                {transaction.merchant_name}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
              <span className="text-slate-500 flex items-center gap-1.5 mb-1">
                <Tag className="w-3.5 h-3.5 text-slate-400" /> Category
              </span>
              <p className="text-xs font-medium text-slate-800 capitalize">
                {transaction.category}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
              <span className="text-slate-500 flex items-center gap-1.5 mb-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> Transaction Date
              </span>
              <p className="text-xs font-mono text-slate-800">
                {transaction.transaction_date ? new Date(transaction.transaction_date).toLocaleString() : 'N/A'}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
              <span className="text-slate-500 flex items-center gap-1.5 mb-1">
                <CreditCard className="w-3.5 h-3.5 text-slate-400" /> Payment Card
              </span>
              <p className="text-xs font-mono text-slate-800">
                {transaction.payment_method_last4 ? `•••• •••• •••• ${transaction.payment_method_last4}` : 'Not provided'}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
              <span className="text-slate-500 flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> Ingestion Source
              </span>
              <p className="text-xs font-medium text-slate-800 uppercase tracking-wide">
                {transaction.source || 'manual'}
              </p>
            </div>
          </div>

          {/* Description / Notes if provided */}
          {transaction.description && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-xs">
              <span className="text-slate-500 flex items-center gap-1.5 mb-1 font-semibold">
                <FileText className="w-3.5 h-3.5 text-slate-400" /> Description / Note
              </span>
              <p className="text-slate-700 leading-relaxed">{transaction.description}</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
