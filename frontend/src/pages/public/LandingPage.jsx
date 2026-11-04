import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Search,
  CreditCard,
  Globe,
  Smartphone,
  Calculator,
  TrendingUp,
  FileCheck2,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Cpu,
  Layers,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import Button from '../../components/common/Button';
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import MetricCard from '../../components/common/MetricCard';

export default function LandingPage() {
  const [selectedChecker, setSelectedChecker] = useState('transaction');

  const checkerOptions = [
    {
      id: 'transaction',
      label: 'Bank Transaction',
      icon: CreditCard,
      prompt: 'Check unusual velocity, unknown beneficiaries, and anomaly indicators',
      placeholder: 'e.g. Upload CSV statement or inspect a single transfer',
      route: '/login?redirect=/transactions',
      metric: '0-100 Calibrated Risk Index',
      tag: 'Module A',
    },
    {
      id: 'link',
      label: 'Website or Link',
      icon: Globe,
      prompt: 'Inspect suspicious domains, homograph typos, and phishing heuristics',
      placeholder: 'e.g. https://secure-bank-verify-alert.com',
      route: '/login?redirect=/scanner',
      metric: 'SSRF-Guarded Sandbox Scan',
      tag: 'Module B',
    },
    {
      id: 'app',
      label: 'Financial App',
      icon: Smartphone,
      prompt: 'Verify publisher credentials, official store listings, and dangerous permissions',
      placeholder: 'e.g. Instant Cash Quick Loan Pro APK',
      route: '/login?redirect=/app-checker',
      metric: 'Registry & Permission Cross-Check',
      tag: 'Module C',
    },
    {
      id: 'loan',
      label: 'Loan Offer',
      icon: Calculator,
      prompt: 'Calculate true reducing-balance EMI, hidden processing fees, and actual APR',
      placeholder: 'e.g. ₹5,00,000 at 12% p.a. with ₹15,000 upfront fee',
      route: '/login?redirect=/loan-analyzer',
      metric: 'Deterministic Math (No LLM Hallucinations)',
      tag: 'Module D',
    },
    {
      id: 'investment',
      label: 'Investment Offer',
      icon: TrendingUp,
      prompt: 'Detect unviable guaranteed-return claims and verify official SEBI/RBI registration',
      placeholder: 'e.g. "Guaranteed 4% daily return with algorithmic arbitrage"',
      route: '/login?redirect=/investment-analyzer',
      metric: 'Regulatory Registration Audit',
      tag: 'Module E',
    },
  ];

  const activeChecker = checkerOptions.find((c) => c.id === selectedChecker) || checkerOptions[0];

  return (
    <div className="space-y-24 pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white via-slate-50 to-slate-100/70 border-b border-slate-200/80 pt-16 pb-20 lg:pt-24 lg:pb-28">
        {/* Subtle Background Grid Accent */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-40 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-2">
              <Badge variant="navy" size="md" dot pulseDot>
                Unified Financial Safety Platform
              </Badge>
              <Badge variant="neutral" size="md">
                Demo & Architecture Preview
              </Badge>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-navy-950 tracking-tight leading-[1.12]">
              Your transactions.{' '}
              <span className="text-brand-600 block sm:inline">Your security.</span>{' '}
              <span className="text-slate-800 block sm:inline">Your control.</span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto">
              A unified platform to analyze transaction anomalies, scan suspicious links, audit financial apps, uncover hidden loan charges, and evaluate investment claims.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Button
                to="/register"
                variant="primary"
                size="lg"
                icon={ArrowRight}
                iconPosition="right"
                className="w-full sm:w-auto shadow-lg shadow-brand-600/25"
              >
                Access Platform Demo
              </Button>
              <Button
                to="/how-it-works"
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto"
              >
                Explore Methodology
              </Button>
            </div>

            {/* Credibility Micro-Points (Strictly factual, no fake badges) */}
            <div className="pt-6 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Pure Deterministic Loan Math
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> SSRF-Hardened URL Verification
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Explainable Risk Indicators (SHAP)
              </span>
            </div>
          </div>

          {/* Central Interactive Entry Point */}
          <div className="mt-16 max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
              <div className="bg-navy-950 px-6 py-4 border-b border-navy-800 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                  <span className="text-xs font-mono text-slate-400 ml-2">
                    FraudShield Central Safety Hub
                  </span>
                </div>
                <span className="text-xs font-mono text-brand-300">
                  Select a module to examine
                </span>
              </div>

              <div className="p-6 sm:p-8 space-y-6">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    What would you like to check?
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Select any financial asset or communication to inspect its risk indicators:
                  </p>
                </div>

                {/* Checker Tabs */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                  {checkerOptions.map((opt) => {
                    const Icon = opt.icon;
                    const isSelected = selectedChecker === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSelectedChecker(opt.id)}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between h-28 focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                          isSelected
                            ? 'bg-brand-50/80 border-brand-500 text-brand-900 shadow-sm ring-1 ring-brand-500'
                            : 'bg-slate-50/70 border-slate-200/90 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div
                            className={`p-2 rounded-lg ${
                              isSelected
                                ? 'bg-brand-600 text-white'
                                : 'bg-white text-slate-600 border border-slate-200'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className="text-[10px] font-mono font-semibold text-slate-400">
                            {opt.tag}
                          </span>
                        </div>
                        <span className="text-xs font-bold leading-tight">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Checker Details & Action Input Mock */}
                <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-brand-600">
                        {activeChecker.tag} Capability
                      </span>
                      <h4 className="text-base font-bold text-slate-900">{activeChecker.prompt}</h4>
                    </div>
                    <Badge variant="brand" size="sm">
                      {activeChecker.metric}
                    </Badge>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        readOnly
                        value={activeChecker.placeholder}
                        className="w-full bg-white border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-600 cursor-not-allowed select-none"
                      />
                    </div>
                    <Button
                      to={activeChecker.route}
                      variant="primary"
                      icon={ArrowRight}
                      iconPosition="right"
                      className="shrink-0"
                    >
                      Open in Portal
                    </Button>
                  </div>

                  <p className="text-xs text-slate-500 italic">
                    * Interactive portal requires logging in as Personal User, Financial Analyst, or Administrator.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6 Unified Modules Showcase */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <Badge variant="brand" size="md">
            Complete Product Modules
          </Badge>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
            Six Specialized Safety Engines in One Unified Platform
          </h2>
          <p className="text-sm text-slate-600">
            Engineered as single unified system with one database, one backend API, and role-based access control.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Module A */}
          <Card hover className="flex flex-col justify-between">
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <div className="p-2.5 rounded-lg bg-blue-50 text-brand-600 border border-blue-100">
                  <CreditCard className="w-5 h-5" />
                </div>
                <Badge variant="neutral" size="sm">
                  Module A
                </Badge>
              </div>
              <CardTitle>Transaction Security</CardTitle>
              <CardDescription>
                CSV ingestion, transaction velocity tracking, unusual amount spikes, Isolation Forest anomaly scoring, and SHAP explainability.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-xs text-slate-600 space-y-2 border-t border-slate-100 pt-3">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  0–100 calibrated risk index
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  Beneficiary & device familiarity analysis
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  Synthetic live transaction simulator
                </li>
              </ul>
            </CardContent>
            <div className="pt-4 border-t border-slate-100">
              <Link
                to="/features#transactions"
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 group"
              >
                Explore Transaction Engine{' '}
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </Card>

          {/* Module B */}
          <Card hover className="flex flex-col justify-between">
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <Globe className="w-5 h-5" />
                </div>
                <Badge variant="neutral" size="sm">
                  Module B
                </Badge>
              </div>
              <CardTitle>Website & Link Scanner</CardTitle>
              <CardDescription>
                Server-side SSRF-protected link evaluation, domain impersonation checks, homoglyph detection, and redirect chain analysis.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-xs text-slate-600 space-y-2 border-t border-slate-100 pt-3">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  Blocks loopback, RFC 1918 & cloud metadata IPs
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  Never executes untrusted remote scripts
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  Evidence-based risk findings with source timestamps
                </li>
              </ul>
            </CardContent>
            <div className="pt-4 border-t border-slate-100">
              <Link
                to="/features#link-scanner"
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 group"
              >
                Explore Link Scanner{' '}
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </Card>

          {/* Module C */}
          <Card hover className="flex flex-col justify-between">
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <Smartphone className="w-5 h-5" />
                </div>
                <Badge variant="neutral" size="sm">
                  Module C
                </Badge>
              </div>
              <CardTitle>Financial App Analyzer</CardTitle>
              <CardDescription>
                Publisher and developer verification, official store presence audits, privacy disclosures, and high-risk permission inspection.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-xs text-slate-600 space-y-2 border-t border-slate-100 pt-3">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  Regulated entity association checks
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  Never downloads or executes APKs on backend
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  Distinguishes verified records from unverified claims
                </li>
              </ul>
            </CardContent>
            <div className="pt-4 border-t border-slate-100">
              <Link
                to="/features#app-checker"
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 group"
              >
                Explore App Checker{' '}
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </Card>

          {/* Module D */}
          <Card hover className="flex flex-col justify-between">
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
                  <Calculator className="w-5 h-5" />
                </div>
                <Badge variant="neutral" size="sm">
                  Module D
                </Badge>
              </div>
              <CardTitle>Loan Analyzer</CardTitle>
              <CardDescription>
                Deterministic reducing-balance EMI calculations, hidden processing fee discovery, amortization breakdown, and true APR calculation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-xs text-slate-600 space-y-2 border-t border-slate-100 pt-3">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  Pure mathematical formulas (Never LLM arithmetic)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  Zero-interest & edge case handling
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  Key Fact Statement (KFS) review criteria
                </li>
              </ul>
            </CardContent>
            <div className="pt-4 border-t border-slate-100">
              <Link
                to="/features#loan-analyzer"
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 group"
              >
                Explore Loan Engine{' '}
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </Card>

          {/* Module E */}
          <Card hover className="flex flex-col justify-between">
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <div className="p-2.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-100">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <Badge variant="neutral" size="sm">
                  Module E
                </Badge>
              </div>
              <CardTitle>Investment Offer Analyzer</CardTitle>
              <CardDescription>
                Guaranteed-return claim detection, unviable promise alerts, regulatory registration verification, and intermediary audits.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-xs text-slate-600 space-y-2 border-t border-slate-100 pt-3">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  Flags illegal "guaranteed profit" claims
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  SEBI / RBI regulatory listing verification
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  Never certifies an investment as "safe"
                </li>
              </ul>
            </CardContent>
            <div className="pt-4 border-t border-slate-100">
              <Link
                to="/features#investment-analyzer"
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 group"
              >
                Explore Investment Checker{' '}
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </Card>

          {/* Module F & G */}
          <Card hover className="flex flex-col justify-between">
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <div className="p-2.5 rounded-lg bg-slate-100 text-navy-900 border border-slate-200">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <Badge variant="neutral" size="sm">
                  Modules F & G
                </Badge>
              </div>
              <CardTitle>Trust Reports & Analyst Hub</CardTitle>
              <CardDescription>
                Auditable, evidence-backed assessment reports, React Flow fraud network graphs, and investigation case management.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-xs text-slate-600 space-y-2 border-t border-slate-100 pt-3">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  Standardized 5-tier result categorization
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  Entity graph centrality (NetworkX + React Flow)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  Role-based views for Analysts & Admins
                </li>
              </ul>
            </CardContent>
            <div className="pt-4 border-t border-slate-100">
              <Link
                to="/features#trust-reports"
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 group"
              >
                Explore Reports & Intelligence{' '}
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </Card>
        </div>
      </section>

      {/* Security Architecture & Transparency Principles */}
      <section className="bg-navy-950 text-white py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="max-w-3xl space-y-4">
            <Badge variant="brand" size="md">
              Architecture & Integrity
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Built on Uncompromising Security & Algorithmic Rigor
            </h2>
            <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
              FraudShield AI does not make assumptions or fabricate evidence. Every finding traces directly to verified inputs, deterministic calculations, or calibrated model outputs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-xl bg-navy-900 border border-navy-800 space-y-3">
              <div className="w-10 h-10 rounded-lg bg-brand-600/20 text-brand-400 flex items-center justify-center border border-brand-500/30">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Zero Credential Collection</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                We never request banking credentials, UPI PINs, OTPs, or CVVs. All analyses run exclusively on user-provided statements, URLs, or offer terms.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-navy-900 border border-navy-800 space-y-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Deterministic Financial Math</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Loan EMIs, APRs, and charges use mathematically verified reducing-balance equations. Large Language Models never compute numerical finances.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-navy-900 border border-navy-800 space-y-3">
              <div className="w-10 h-10 rounded-lg bg-amber-600/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">SSRF Defense Layer</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Link Scanner pre-resolves DNS to reject loopback, internal RFC 1918 networks, and cloud metadata endpoints before fetching HTTP headers.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-navy-900 border border-navy-800 space-y-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Transparent Uncertainty</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                The absence of a known warning is never equated to proof of safety. If data is incomplete or unavailable, the system states it honestly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Target Roles Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <Badge variant="neutral" size="md">
            Role-Based Workflows
          </Badge>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
            Tailored Workflows for Every Stakeholder
          </h2>
          <p className="text-sm text-slate-600">
            One platform powering personal protection, analyst investigations, and system governance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="flex flex-col justify-between">
            <div className="space-y-4">
              <Badge variant="brand" size="sm">
                For Individuals
              </Badge>
              <h3 className="text-xl font-bold text-slate-900">Personal Safety</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Protect yourself from unauthorized transfers, phishing SMS links, predatory instant loan apps, and fraudulent high-yield schemes.
              </p>
              <ul className="text-xs text-slate-600 space-y-2 border-t border-slate-100 pt-4">
                <li>• Self-service statement upload & CSV mapping</li>
                <li>• Instant link & app verification</li>
                <li>• True loan cost & APR calculator</li>
                <li>• Personal trust reports & privacy controls</li>
              </ul>
            </div>
            <div className="pt-6">
              <Button to="/login?role=personal" variant="secondary" className="w-full">
                Try Personal Portal
              </Button>
            </div>
          </Card>

          <Card className="flex flex-col justify-between border-brand-200 bg-brand-50/20">
            <div className="space-y-4">
              <Badge variant="purple" size="sm">
                For Financial Analysts
              </Badge>
              <h3 className="text-xl font-bold text-slate-900">Analyst Command Center</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Triage fraud alert queues, inspect multi-account transaction graphs, review SHAP feature attributions, and track case evidence.
              </p>
              <ul className="text-xs text-slate-600 space-y-2 border-t border-slate-100 pt-4">
                <li>• Real-time fraud alert triage queues</li>
                <li>• Entity relationship graph (React Flow + NetworkX)</li>
                <li>• PR-AUC, confusion matrix & model monitoring</li>
                <li>• Synthetic live transaction simulator</li>
              </ul>
            </div>
            <div className="pt-6">
              <Button to="/login?role=analyst" variant="primary" className="w-full">
                Try Analyst Console
              </Button>
            </div>
          </Card>

          <Card className="flex flex-col justify-between">
            <div className="space-y-4">
              <Badge variant="navy" size="sm">
                For Administrators
              </Badge>
              <h3 className="text-xl font-bold text-slate-900">Platform Governance</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Manage user access, enforce Row Level Security, review immutable audit trails, and oversee model version deployments.
              </p>
              <ul className="text-xs text-slate-600 space-y-2 border-t border-slate-100 pt-4">
                <li>• Role-based permission assignments</li>
                <li>• Immutable system audit log records</li>
                <li>• Model lifecycle & rollback management</li>
                <li>• Global rate limits & security settings</li>
              </ul>
            </div>
            <div className="pt-6">
              <Button to="/login?role=admin" variant="secondary" className="w-full">
                Try Admin Portal
              </Button>
            </div>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl bg-gradient-to-br from-navy-950 via-navy-900 to-brand-950 text-white p-8 sm:p-12 lg:p-16 text-center space-y-6 shadow-2xl relative overflow-hidden border border-navy-800">
          <div className="inline-flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-brand-400" />
            <span className="text-xs uppercase font-mono tracking-widest text-brand-300">
              Demo Environment Ready
            </span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight max-w-2xl mx-auto leading-tight">
            Take Control of Your Financial Safety Today
          </h2>

          <p className="text-slate-300 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
            Experience the unified platform with synthetic data benchmarks and full interactive module previews.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              to="/register"
              variant="primary"
              size="lg"
              icon={ArrowRight}
              iconPosition="right"
              className="w-full sm:w-auto shadow-lg shadow-brand-600/30"
            >
              Get Started with Demo
            </Button>
            <Button
              to="/features"
              variant="ghost"
              size="lg"
              className="w-full sm:w-auto text-white hover:text-white hover:bg-white/10"
            >
              Review All Features
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

