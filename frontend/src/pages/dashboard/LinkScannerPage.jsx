import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { scanLink } from '../../services/linkScannerApi';
import {
  Link2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Info,
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  Lock,
  Unlock,
  Globe,
  FileCode,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Download,
  ArrowLeft,
  LayoutDashboard,
} from 'lucide-react';
import Badge from '../../components/common/Badge';
import { downloadLinkSecurityReportPdf } from '../../utils/pdfReportGenerator';
import { getRoleDashboardPath } from '../../components/dashboard/DashboardSidebar';

export default function LinkScannerPage() {
  const { session, role, profile } = useAuth();
  const effectiveRole = role || profile?.role || 'personal';
  const dashboardPath = getRoleDashboardPath(effectiveRole);

  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleDownloadPdf = () => {
    if (!result) return;
    try {
      setDownloadingPdf(true);
      downloadLinkSecurityReportPdf(result);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setTimeout(() => setDownloadingPdf(false), 800);
    }
  };

  const sampleLinks = [
    {
      label: 'Deceptive Lookalike',
      url: 'https://paypal.com.verify-login.xyz/account-update',
      badge: 'Critical/High',
    },
    {
      label: 'URL Shortener',
      url: 'https://bit.ly/3xY8abc',
      badge: 'Medium',
    },
    {
      label: 'Raw IP Hostname',
      url: 'http://192.168.1.1/admin/login',
      badge: 'Critical',
    },
    {
      label: 'Official HTTPS',
      url: 'https://docs.github.com/en/rest',
      badge: 'Low/Clean',
    },
  ];

  const handleScan = async (targetUrl = urlInput) => {
    const trimmed = (targetUrl || '').trim();
    if (!trimmed) {
      setError('Please enter a valid website address or link to scan.');
      return;
    }

    if (!session?.access_token) {
      setError('Active session required. Please sign in again.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await scanLink(session.access_token, trimmed);
      setResult(data);
    } catch (err) {
      console.error('Scan error:', err);
      setError(err.message || 'Failed to complete link analysis. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyDefanged = () => {
    if (!result?.defanged_url) return;
    navigator.clipboard.writeText(result.defanged_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getRiskBadgeVariant = (level) => {
    switch (level) {
      case 'critical':
        return 'danger';
      case 'high':
        return 'danger';
      case 'medium':
        return 'warning';
      case 'low':
      default:
        return 'success';
    }
  };

  const getRiskColor = (level) => {
    switch (level) {
      case 'critical':
        return 'text-rose-600 bg-rose-50 border-rose-200';
      case 'high':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium':
        return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'low':
      default:
        return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Return to Main Dashboard Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to={dashboardPath}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-brand-600 transition-colors group"
          title="Return to Main Dashboard"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Dashboard</span>
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-brand-50 text-brand-600">
              <Link2 className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Suspicious Link Scanner
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Defensive static URL threat inspection and plain-English AI risk explanation.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to={dashboardPath}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all shadow-xs"
            title="Return to Main Dashboard"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-slate-500" />
            <span>Dashboard</span>
          </Link>

          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5" />
            SSRF & Execution Immune
          </span>
        </div>
      </div>

      {/* Zero-Fetch Security Notice Banner */}
      <div className="p-4 rounded-xl bg-slate-900 text-white text-xs flex items-start gap-3 shadow-xs">
        <Info className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="font-semibold text-white">Zero-Fetch Security Invariant:</strong>{' '}
          FraudShield AI inspects the URL's structural syntax, encoding, hostnames, and domain depth statically.{' '}
          <span className="text-slate-300">
            Our servers never visit, resolve, download, or execute submitted URLs, shielding your network from SSRF attacks, malware downloads, and tracking pixels.
          </span>
        </div>
      </div>

      {/* URL Input Form Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
        <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">
          Enter Link or Domain to Analyze
        </label>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleScan();
          }}
          className="space-y-3"
        >
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Globe className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. https://paypal.com.verify-login.xyz/account or bit.ly/3xY8abc"
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:bg-white text-slate-900 transition-all placeholder:text-slate-400 font-mono"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !urlInput.trim()}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs shrink-0"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Inspecting Link...</span>
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  <span>Scan Link</span>
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick-test Sample Links */}
          <div className="pt-2 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Sample links:
            </span>
            {sampleLinks.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => {
                  setUrlInput(s.url);
                  handleScan(s.url);
                }}
                className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all flex items-center gap-1.5"
              >
                <span>{s.label}</span>
                <span className="text-[9px] text-slate-500 font-mono">({s.badge})</span>
              </button>
            ))}
          </div>
        </form>
      </div>

      {/* Analysis Results View */}
      {result && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Main Risk Overview Banner */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
              <div className="space-y-2">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <Badge variant={getRiskBadgeVariant(result.risk_level)} size="sm">
                    {result.risk_level.toUpperCase()} RISK
                  </Badge>

                  {result.provider === 'gemini' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      <Sparkles className="w-3 h-3 text-indigo-600" />
                      Google Gemini AI Explanation
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                      <FileCode className="w-3 h-3 text-slate-500" />
                      Deterministic Rule Engine Fallback
                    </span>
                  )}

                  <span className="text-[11px] text-slate-400">
                    Analyzed at {new Date(result.analyzed_at).toLocaleTimeString()}
                  </span>
                </div>

                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  {result.risk_level === 'critical' || result.risk_level === 'high'
                    ? 'Elevated Phishing or Malicious Indicators Detected'
                    : result.risk_level === 'medium'
                    ? 'Caution Advised: Unverified or Obscured Link Structure'
                    : 'Clean Structural Baseline: No Obvious Static Indicators'}
                </h2>
              </div>

              {/* Actions & Risk Score Dial */}
              <div className="flex items-center gap-3 shrink-0 flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={downloadingPdf}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all shadow-xs shrink-0 cursor-pointer"
                  title="Generate and download complete PDF Security Report"
                >
                  <Download className={`w-4 h-4 text-brand-400 ${downloadingPdf ? 'animate-bounce' : ''}`} />
                  <span>{downloadingPdf ? 'Generating PDF...' : 'Download PDF Report'}</span>
                </button>

                <div className="flex items-center gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <div className="text-right">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Deterministic Risk Score
                    </div>
                    <div className="text-xs text-slate-500">
                      {result.risk_level === 'low' ? 'Normal Baseline' : 'Threat Elevation'}
                    </div>
                  </div>
                  <div
                    className={`w-14 h-14 rounded-2xl border flex flex-col items-center justify-center font-bold text-lg font-mono shadow-xs ${getRiskColor(
                      result.risk_level
                    )}`}
                  >
                    <span>{result.risk_score}</span>
                    <span className="text-[8px] font-sans text-slate-400 uppercase -mt-1">/100</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Defanged Safe URL Display */}
            <div className="mt-5 p-3.5 rounded-xl bg-slate-900 text-slate-200 text-xs font-mono flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Lock className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                <span className="truncate">{result.defanged_url}</span>
              </div>
              <button
                type="button"
                onClick={handleCopyDefanged}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all flex items-center gap-1.5 shrink-0 text-[11px]"
                title="Copy safe defanged URL text"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy Safe Text</span>
                  </>
                )}
              </button>
            </div>

            {/* Plain-English Summary */}
            <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-100">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                Plain-English Security Assessment
              </h3>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                {result.summary}
              </p>
            </div>
          </div>

          {/* Two-Column Facts vs Indicators Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Confirmed Structural Facts */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-100">
                  <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                    <CheckCircle2 className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                      Confirmed Structural Facts
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Verified static URL syntax and protocol parameters
                    </p>
                  </div>
                </div>

                <ul className="space-y-2.5 text-xs text-slate-700">
                  {result.facts && result.facts.length > 0 ? (
                    result.facts.map((fact, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                        <span className="font-mono text-[11px] leading-relaxed text-slate-800">
                          {fact}
                        </span>
                      </li>
                    ))
                  ) : (
                    <li className="text-slate-400 italic">No structural facts extracted.</li>
                  )}
                </ul>
              </div>
            </div>

            {/* Potential Threat Indicators */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-100">
                  <span
                    className={`p-1.5 rounded-lg ${
                      result.risk_level === 'low'
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-rose-50 text-rose-600'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                      Observed Heuristic Indicators
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Potential anomaly signals and lookalike indicators
                    </p>
                  </div>
                </div>

                <ul className="space-y-2.5 text-xs text-slate-700">
                  {result.indicators && result.indicators.length > 0 ? (
                    result.indicators.map((indicator, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${
                            result.risk_level === 'low' ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        />
                        <span className="leading-relaxed text-slate-800">{indicator}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-slate-400 italic">No threat indicators triggered.</li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* Three Practical Safety Recommendations */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                <ShieldCheck className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  Practical Safety Recommendations
                </h3>
                <p className="text-[11px] text-slate-400">
                  Actionable steps to safeguard your accounts and credentials
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {result.recommendations &&
                result.recommendations.map((rec, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between"
                  >
                    <div className="flex items-center gap-2 text-brand-600 text-xs font-bold mb-2">
                      <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px]">
                        {i + 1}
                      </span>
                      <span>Action Step {i + 1}</span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">{rec}</p>
                  </div>
                ))}
            </div>
          </div>

          {/* Legal & Safety Disclaimer */}
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2.5">
            <HelpCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="font-semibold text-amber-950">Safety Disclaimer:</strong>{' '}
              {result.disclaimer ||
                'Static heuristic analysis is advisory and does NOT guarantee safety or constitute definitive forensic proof.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

