import React, { useState } from 'react';
import {
  X,
  PlusCircle,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import Button from '../common/Button';
import Badge from '../common/Badge';
import { createManualTransaction } from '../../services/transactionApi';

const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR'];
const CATEGORIES = [
  'retail',
  'grocery',
  'dining',
  'electronics',
  'travel',
  'transfer',
  'utilities',
  'entertainment',
  'other',
];

function getInitialIsoDateTime() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function ManualTransactionModal({
  isOpen,
  onClose,
  onSuccess,
  sessionToken,
}) {
  const [formData, setFormData] = useState(() => ({
    amount: '',
    currency: 'USD',
    merchant_name: '',
    category: 'retail',
    transaction_date: getInitialIsoDateTime(),
    description: '',
    payment_method_last4: '',
  }));
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [submissionResult, setSubmissionResult] = useState(null);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errorMessage) setErrorMessage(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    // Frontend validation
    const numAmount = parseFloat(formData.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMessage('Please enter a valid amount greater than 0.');
      return;
    }

    if (!formData.merchant_name.trim()) {
      setErrorMessage('Merchant name is required.');
      return;
    }

    if (!formData.transaction_date) {
      setErrorMessage('Transaction date is required.');
      return;
    }

    if (
      formData.payment_method_last4 &&
      !/^[0-9]{4}$/.test(formData.payment_method_last4.trim())
    ) {
      setErrorMessage('Card last 4 digits must be exactly 4 numeric digits.');
      return;
    }

    setSubmitting(true);

    try {
      // Build ISO 8601 string with timezone
      const parsedDate = new Date(formData.transaction_date);
      const isoDate = !isNaN(parsedDate.getTime())
        ? parsedDate.toISOString()
        : new Date().toISOString();

      const payload = {
        amount: Number(numAmount.toFixed(2)),
        currency: formData.currency,
        merchant_name: formData.merchant_name.trim(),
        category: formData.category,
        transaction_date: isoDate,
        description: formData.description.trim() || undefined,
        payment_method_last4: formData.payment_method_last4.trim() || undefined,
      };

      const result = await createManualTransaction(sessionToken, payload);
      setSubmissionResult(result);

      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err) {
      console.error('Manual transaction creation failed:', err);
      setErrorMessage(
        err.message || 'Failed to submit transaction. Please check details and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({
      amount: '',
      currency: 'USD',
      merchant_name: '',
      category: 'retail',
      transaction_date: getInitialIsoDateTime(),
      description: '',
      payment_method_last4: '',
    });
    setSubmissionResult(null);
    setErrorMessage(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 border border-brand-200 flex items-center justify-center">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {submissionResult ? 'Fraud Assessment Result' : 'Enter Manual Transaction'}
              </h3>
              <p className="text-xs text-slate-500">
                {submissionResult
                  ? 'Real-time rule engine evaluation complete'
                  : 'Submit transaction for immediate deterministic risk scoring'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {submissionResult ? (
            /* Result View: Immediate Fraud Engine Results */
            <div className="space-y-5">
              {/* Result Assessment Card */}
              {(() => {
                const assessment = submissionResult.assessment;
                const riskLevel = assessment?.risk_level || 'low';
                const riskScore = assessment?.risk_score ?? 0;
                const reasons = assessment?.heuristic_reasons || [];

                const cardBg =
                  riskLevel === 'critical' || riskLevel === 'high'
                    ? 'bg-rose-50 border-rose-200 text-rose-950'
                    : riskLevel === 'medium'
                    ? 'bg-amber-50 border-amber-200 text-amber-950'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-950';

                const badgeVariant =
                  riskLevel === 'critical' || riskLevel === 'high'
                    ? 'danger'
                    : riskLevel === 'medium'
                    ? 'warning'
                    : 'success';

                return (
                  <div className={`p-4 rounded-xl border ${cardBg}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {riskLevel === 'critical' || riskLevel === 'high' ? (
                          <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0" />
                        ) : riskLevel === 'medium' ? (
                          <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
                        ) : (
                          <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
                        )}
                        <div>
                          <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
                            Assessment Status
                          </span>
                          <h4 className="text-base font-bold capitalize">
                            {riskLevel} Risk Detected
                          </h4>
                        </div>
                      </div>
                      <Badge variant={badgeVariant} size="lg">
                        Score: {riskScore} / 100
                      </Badge>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-200/60">
                      <p className="text-xs font-semibold mb-1">Heuristic Rule Breakdown:</p>
                      {reasons.length > 0 ? (
                        <ul className="space-y-1 text-xs pl-1">
                          {reasons.map((r, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-600 mt-1.5 shrink-0" />
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs italic text-slate-600">
                          Clean record: No heuristic risk rules triggered.
                        </p>
                      )}
                    </div>

                    {submissionResult.investigation_case && (
                      <div className="mt-3 p-2.5 rounded-lg bg-rose-100/80 border border-rose-300 text-xs text-rose-900 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
                        <span>
                          <strong>Investigation Case Opened:</strong> Case ID{' '}
                          <code className="font-mono font-bold">
                            {submissionResult.investigation_case.id.substring(0, 8)}...
                          </code>{' '}
                          queued for analyst audit.
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Recorded Transaction Details */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Merchant:</span>
                  <span className="font-semibold text-slate-800">
                    {submissionResult.transaction?.merchant_name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {Number(submissionResult.transaction?.amount).toFixed(2)}{' '}
                    {submissionResult.transaction?.currency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Category:</span>
                  <span className="text-slate-800 capitalize">
                    {submissionResult.transaction?.category}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date:</span>
                  <span className="text-slate-800 font-mono">
                    {new Date(
                      submissionResult.transaction?.transaction_date
                    ).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={RotateCcw}
                  onClick={handleReset}
                >
                  Add Another Transaction
                </Button>
                <Button variant="primary" size="sm" onClick={handleClose}>
                  Done
                </Button>
              </div>
            </div>
          ) : (
            /* Input Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">{errorMessage}</div>
                </div>
              )}

              {/* Amount & Currency */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Amount <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    name="amount"
                    value={formData.amount}
                    onChange={handleChange}
                    placeholder="125.50"
                    required
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Currency <span className="text-rose-500">*</span>
                  </label>
                  <select
                    name="currency"
                    value={formData.currency}
                    onChange={handleChange}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white"
                  >
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Merchant Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Merchant Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="merchant_name"
                  value={formData.merchant_name}
                  onChange={handleChange}
                  placeholder="e.g. Acme Supermarket, BestBuy, Uber"
                  maxLength={200}
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>

              {/* Category & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white capitalize"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Transaction Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    name="transaction_date"
                    value={formData.transaction_date}
                    onChange={handleChange}
                    required
                    className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
              </div>

              {/* Payment Method Last 4 & Description */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Card Last 4
                  </label>
                  <input
                    type="text"
                    name="payment_method_last4"
                    value={formData.payment_method_last4}
                    onChange={handleChange}
                    placeholder="4242"
                    maxLength={4}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-mono"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Description <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="e.g. Office supplies purchase"
                    maxLength={500}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleClose}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={submitting}
                  icon={ArrowRight}
                  iconPosition="right"
                >
                  Evaluate & Submit
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
