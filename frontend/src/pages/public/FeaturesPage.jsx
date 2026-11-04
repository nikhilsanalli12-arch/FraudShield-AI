import React from 'react';
import { Link } from 'react-router-dom';
import {
  CreditCard,
  Globe,
  Smartphone,
  Calculator,
  TrendingUp,
  FileCheck2,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Database,
  Cpu,
  Layers,
  Network,
  Lock,
  Eye,
  Sliders,
  AlertTriangle,
} from 'lucide-react';
import Button from '../../components/common/Button';
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '../../components/common/Card';
import Badge from '../../components/common/Badge';

export default function FeaturesPage() {
  const modules = [
    {
      id: 'transactions',
      badge: 'Module A',
      title: 'Transaction Security & Behavioral Analytics',
      subtitle: 'Identify unusual, velocity-spiking, or potentially fraudulent transfer patterns.',
      icon: CreditCard,
      color: 'blue',
      features: [
        'Multi-format CSV transaction upload with flexible column mapping',
        'Duplicate transaction detection and historical trend aggregation',
        'Transaction frequency and velocity deviation scoring',
        'Device and beneficiary familiarity tracking when metadata is present',
        'Dual-model inference: Random Forest classification + Isolation Forest anomaly detection',
        'Calibrated 0 to 100 Risk Score with SHAP local feature explainability',
        'Real-time fraud alert queuing for high-risk transfer events',
        'Synthetic live transaction simulator for analyst stress testing',
      ],
      disclaimer: 'Statistical risk indicators and anomaly scores, not definitive proof of fraud.',
    },
    {
      id: 'link-scanner',
      badge: 'Module B',
      title: 'SSRF-Protected Website & Link Scanner',
      subtitle: 'Inspect suspicious URLs, phishing domains, and impersonation attempts safely.',
      icon: Globe,
      color: 'indigo',
      features: [
        'Strict SSRF defense: pre-resolves DNS and blocks loopbacks (127.0.0.1), private ranges (RFC 1918), and cloud metadata endpoints',
        'Normalized domain analysis and Unicode/homoglyph spoof detection',
        'Safe redirect hop inspection (capped at 3 hops with max payload limits)',
        'HTTPS validity, TLS cipher quality, and certificate expiration inspection',
        'Known malicious domain reputation cross-referencing',
        'Zero execution: remote scripts, HTML payloads, or executables are never executed',
        'Detailed scan history with timestamped evidence records',
      ],
      disclaimer: 'Absence of a known warning does not certify that an unverified URL is safe.',
    },
    {
      id: 'app-checker',
      badge: 'Module C',
      title: 'Financial App Analyzer',
      subtitle: 'Audit financial mobile apps for regulatory registration and invasive permissions.',
      icon: Smartphone,
      color: 'emerald',
      features: [
        'Developer and publisher verification against registered legal entity databases',
        'Official app store presence confirmation (Google Play, Apple App Store)',
        'Dangerous permission auditing (SMS reading, contact harvesting, storage scraping)',
        'Mandatory privacy policy availability and data retention disclosure checks',
        'Cross-reference with RBI Digital Lending App whitelist records where available',
        'Absolute safety policy: untrusted APK binaries are never executed on backend infrastructure',
        'Clear distinction between verified regulatory records and unverified developer claims',
      ],
      disclaimer: 'Listing on an app store does not guarantee total compliance.',
    },
    {
      id: 'loan-analyzer',
      badge: 'Module D',
      title: 'Loan Analyzer & Hidden Fee Calculator',
      subtitle: 'Expose the true cost of borrowing with deterministic financial mathematics.',
      icon: Calculator,
      color: 'amber',
      features: [
        'Standard reducing-balance EMI formula calculation: EMI = P · r · (1+r)ⁿ / ((1+r)ⁿ - 1)',
        'Deterministic mathematical code only — no LLM calculation approximations',
        'Total interest, total repayment, and true borrowing cost breakdown',
        'Processing fee deduction impact and upfront fee schedule analysis',
        'True Annual Percentage Rate (APR) computation across complete cash-flow timelines',
        'Key Fact Statement (KFS) review for missing mandatory disclosures',
        'Multi-offer comparative analysis to identify inflated borrowing rates',
      ],
      disclaimer: 'High cost or high interest does not by itself prove a loan offer is fraudulent.',
    },
    {
      id: 'investment-analyzer',
      badge: 'Module E',
      title: 'Investment Offer & Return Claim Analyzer',
      subtitle: 'Detect unviable promised returns, Ponzi structures, and fake regulatory claims.',
      icon: TrendingUp,
      color: 'rose',
      features: [
        'Automated detection of illegal "guaranteed return" claims and unrealistic yields',
        'Regulatory registration check against SEBI (Registered Investment Advisors / Brokers) and RBI databases',
        'Intermediary and broker authorization auditing',
        'Fee transparency analysis and penalty clause extraction',
        'Offer document OCR and structured disclosure verification',
        'Clear distinction between guaranteed claims, variable estimates, and high-risk speculations',
        'Strict policy: FraudShield AI never certifies any investment as "safe" or guarantees returns',
      ],
      disclaimer: 'All investments carry risk; platform evaluates disclosures and regulatory status.',
    },
    {
      id: 'trust-reports',
      badge: 'Module F & G',
      title: 'Financial Trust Reports & Analyst Intelligence',
      subtitle: 'Generate evidence-backed audit reports and map entity relationships in React Flow.',
      icon: FileCheck2,
      color: 'slate',
      features: [
        'Structured Financial Trust Reports with cryptographic assessment IDs and source timestamps',
        'Standardized 5-tier evaluation: No known warning, Incomplete, Review recommended, Strong warning, Official warning',
        'Analyst Command Center: centralized alert triage, reviewer notes, and evidence logs',
        'Fraud Network Radar: NetworkX centrality analytics and React Flow interactive visualization',
        'Entity clustering: detect shared devices, phone numbers, and beneficiary hubs across accounts',
        'ML model monitoring: tracking Precision, Recall, F1, PR-AUC, and drift metrics',
        'Complete immutable audit logging for all administrative and analyst operations',
      ],
      disclaimer: 'Shared attributes or device indicators do not constitute definitive criminal evidence.',
    },
  ];

  return (
    <div className="space-y-20 pb-20">
      {/* Header */}
      <section className="bg-navy-950 text-white py-16 lg:py-20 border-b border-navy-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-3xl space-y-4">
          <Badge variant="brand" size="md">
            Product Capabilities
          </Badge>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Complete Financial Safety Architecture
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            Every module in FraudShield AI is designed around a single standard: rigorous, verifiable evidence without fabrication or unsupported claims.
          </p>
        </div>
      </section>

      {/* Modules Deep Dive */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {modules.map((m, index) => {
          const Icon = m.icon;
          const isEven = index % 2 === 0;
          return (
            <div
              key={m.id}
              id={m.id}
              className="scroll-mt-24 p-8 sm:p-10 rounded-2xl bg-white border border-slate-200 shadow-card hover:shadow-elevated transition-all"
            >
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="p-3.5 rounded-xl bg-brand-50 text-brand-600 border border-brand-100">
                    <Icon className="w-7 h-7" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="brand" size="sm">
                        {m.badge}
                      </Badge>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
                      {m.title}
                    </h2>
                  </div>
                </div>

                <Button
                  to={`/login?redirect=/${m.id}`}
                  variant="secondary"
                  size="sm"
                  icon={ArrowRight}
                  iconPosition="right"
                >
                  Launch in Demo Portal
                </Button>
              </div>

              <div className="mt-6 space-y-6">
                <p className="text-base text-slate-600 leading-relaxed font-medium">
                  {m.subtitle}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {m.features.map((feat, i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/70 flex items-start gap-3"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                        {feat}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="p-3.5 rounded-lg bg-amber-50/70 border border-amber-200/80 flex items-start gap-2.5 text-xs text-amber-800">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Algorithmic Limitation:</strong> {m.disclaimer}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* System Architecture Section */}
      <section id="architecture" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24">
        <div className="bg-navy-950 text-white rounded-2xl p-8 sm:p-12 border border-navy-800 space-y-8">
          <div className="max-w-2xl space-y-2">
            <Badge variant="brand" size="md">
              Engineering Architecture
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              One Unified System, Four Architectural Tiers
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              FraudShield AI operates as one unified web application connecting a robust React frontend to a secure Node.js API gateway, an isolated Python ML service, and a Supabase database with Row Level Security.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="p-5 rounded-xl bg-navy-900 border border-navy-800 space-y-3">
              <span className="text-xs font-mono font-bold text-brand-400">01. FRONTEND</span>
              <h3 className="text-base font-bold text-white">React + Vite</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Tailwind CSS design system, Lucide icons, Recharts for financial trends, and React Flow for analyst entity radars.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-navy-900 border border-navy-800 space-y-3">
              <span className="text-xs font-mono font-bold text-emerald-400">02. API GATEWAY</span>
              <h3 className="text-base font-bold text-white">Node.js + Express</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Zod request validation, Supabase JWT verification, server-side RBAC, SSRF defense filter, and pure deterministic math.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-navy-900 border border-navy-800 space-y-3">
              <span className="text-xs font-mono font-bold text-amber-400">03. AI SERVICE</span>
              <h3 className="text-base font-bold text-white">Python FastAPI</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Scikit-Learn Random Forest, Isolation Forest anomaly detector, SHAP explainability engine, and NetworkX graph analytics.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-navy-900 border border-navy-800 space-y-3">
              <span className="text-xs font-mono font-bold text-indigo-400">04. DATABASE</span>
              <h3 className="text-base font-bold text-white">Supabase PostgreSQL</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Row Level Security (RLS) on all user data, encrypted storage buckets, immutable audit logs, and role-based permissions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
        <h3 className="text-2xl font-bold text-slate-900">
          Ready to test the modules?
        </h3>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Explore the interactive portal in demo preview mode or review our methodology.
        </p>
        <div className="pt-2 flex items-center justify-center gap-3">
          <Button to="/register" variant="primary" icon={ArrowRight} iconPosition="right">
            Open Demo Portal
          </Button>
          <Button to="/how-it-works" variant="secondary">
            Read Methodology
          </Button>
        </div>
      </section>
    </div>
  );
}
