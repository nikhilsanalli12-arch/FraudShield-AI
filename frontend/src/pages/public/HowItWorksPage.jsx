import React from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Cpu,
  Lock,
  Calculator,
  Search,
  Scale,
  ArrowRight,
  Database,
  Sliders,
  FileText,
} from 'lucide-react';
import Button from '../../components/common/Button';
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '../../components/common/Card';
import Badge from '../../components/common/Badge';

export default function HowItWorksPage() {
  const steps = [
    {
      step: '01',
      title: 'Data Ingestion & Strict Sanitization',
      desc: 'Users upload bank statements (CSV), enter URLs, app names, or loan terms. Data is sanitized, validated using Zod schemas, and stripped of unneeded identifiers before processing.',
      highlight: 'Zero banking credentials, UPI PINs, or CVVs are ever requested.',
    },
    {
      step: '02',
      title: 'Deterministic Rules & Math First',
      desc: 'Before invoking machine learning, deterministic engines evaluate hard facts: reducing-balance EMI calculations, mathematical cash-flow APR, DNS resolution checks, and regulatory registry matches.',
      highlight: 'Financial arithmetic is 100% deterministic code — never LLM generation.',
    },
    {
      step: '03',
      title: 'Dual-Layer AI Inference & Anomaly Detection',
      desc: 'The Python microservice executes a supervised Random Forest classifier alongside an unsupervised Isolation Forest to measure behavioral deviation and statistical anomaly indicators.',
      highlight: 'Outputs a calibrated 0–100 Risk Score, never a binary "criminal" verdict.',
    },
    {
      step: '04',
      title: 'SHAP Explainability & Trust Reporting',
      desc: 'SHAP (SHapley Additive exPlanations) values decompose the risk score into clear positive and negative contributors, compiled into an auditable Financial Trust Report with timestamped evidence.',
      highlight: 'Every report states what was checked, what was found, and what limitations apply.',
    },
  ];

  return (
    <div className="space-y-20 pb-20">
      {/* Header */}
      <section className="bg-navy-950 text-white py-16 lg:py-20 border-b border-navy-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-3xl space-y-4">
          <Badge variant="brand" size="md">
            Transparency & Methodology
          </Badge>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            How FraudShield AI Operates
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            We reject "black-box" predictions and fabricated certifications. Here is an honest, transparent breakdown of our engineering pipeline, security safeguards, and risk standards.
          </p>
        </div>
      </section>

      {/* Step by Step Pipeline */}
      <section id="methodology" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 scroll-mt-24">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <Badge variant="neutral" size="md">
            Pipeline Architecture
          </Badge>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
            Four Stages from Input to Actionable Intelligence
          </h2>
          <p className="text-sm text-slate-600">
            A structured workflow combining deterministic financial math, verified registries, and explainable AI models.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s) => (
            <Card key={s.step} hover className="flex flex-col justify-between">
              <div className="space-y-3">
                <span className="text-3xl font-mono font-black text-brand-600">
                  {s.step}
                </span>
                <h3 className="text-lg font-bold text-slate-900 leading-snug">{s.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{s.desc}</p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100">
                <span className="inline-block text-[11px] font-semibold text-brand-700 bg-brand-50 px-2.5 py-1.5 rounded border border-brand-200/60">
                  {s.highlight}
                </span>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Deterministic Math Policy */}
      <section id="deterministic-math" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 shadow-card space-y-8">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <Badge variant="warning" size="sm">
                Engineering Standard
              </Badge>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
                The Deterministic Financial Math Policy
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-sm text-slate-600 leading-relaxed">
            <div className="space-y-4">
              <h4 className="text-base font-bold text-slate-900">
                Why Large Language Models Must Never Calculate Loans
              </h4>
              <p>
                Generative AI models are statistical word predictors, not calculators. Prompting an LLM to compute compound interest or amortization leads to subtle hallucinations, rounding anomalies, and incorrect borrowing totals.
              </p>
              <p>
                In FraudShield AI, all loan evaluations run on pure, deterministic mathematical functions executing standard reducing-balance formulas:
              </p>
              <div className="p-4 rounded-lg bg-navy-950 text-brand-200 font-mono text-xs overflow-x-auto">
                EMI = P · r · (1 + r)ⁿ / ((1 + r)ⁿ - 1)
              </div>
              <p className="text-xs text-slate-500">
                Where <strong>P</strong> is Principal, <strong>r</strong> is monthly interest rate, and <strong>n</strong> is total tenure in months. Zero-interest promotions and fee deductions are handled through dedicated deterministic branches.
              </p>
            </div>

            <div className="space-y-4 bg-slate-50 p-6 rounded-xl border border-slate-200/80">
              <h4 className="text-base font-bold text-slate-900">
                Key Fact Statement (KFS) Audit Rules
              </h4>
              <ul className="space-y-2.5 text-xs text-slate-700">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Disclosed APR:</strong> Compares advertised nominal rate against true effective annual rate including processing fees.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Net Disbursal:</strong> Computes actual cash received after upfront fee deductions vs loan principal.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Unclear Surcharges:</strong> Flags ambiguous insurance or documentation fees that lack regulatory mandates.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* SSRF & Link Scanner Architecture */}
      <section id="architecture" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24">
        <div className="bg-navy-950 text-white rounded-2xl p-8 sm:p-12 border border-navy-800 space-y-8">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-brand-600 text-white">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <Badge variant="brand" size="sm">
                Security Engineering
              </Badge>
              <h2 className="text-2xl font-bold tracking-tight text-white mt-1">
                Server-Side Request Forgery (SSRF) Defense Layer
              </h2>
            </div>
          </div>

          <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
            When users submit suspicious links, scanning them naively on a backend can expose internal cloud services to Server-Side Request Forgery. FraudShield AI enforces multi-stage defense controls before any connection is opened:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-300">
            <div className="p-5 rounded-xl bg-navy-900 border border-navy-800 space-y-2">
              <span className="font-bold text-white text-sm">1. DNS Pre-Resolution Check</span>
              <p className="text-slate-400 leading-relaxed">
                Before making any HTTP call, the backend resolves the host IP. If the resolved IP belongs to `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, or `169.254.169.254`, the request is immediately rejected.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-navy-900 border border-navy-800 space-y-2">
              <span className="font-bold text-white text-sm">2. Destination IP Pinning</span>
              <p className="text-slate-400 leading-relaxed">
                To prevent DNS rebinding attacks where a domain resolves to an external IP on check and an internal IP on fetch, the HTTP socket binds directly to the pre-validated IP address.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-navy-900 border border-navy-800 space-y-2">
              <span className="font-bold text-white text-sm">3. Sandboxed Inspection</span>
              <p className="text-slate-400 leading-relaxed">
                Redirects are capped at 3 hops and re-validated at each hop. Response payloads are strictly size-capped at 512 KB, and remote JavaScript is never executed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Explainable AI (SHAP) & Calibrated Risk */}
      <section id="explainability" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24 space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <Badge variant="purple" size="md">
            Model Explainability
          </Badge>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
            Understanding the 0–100 Calibrated Risk Index
          </h2>
          <p className="text-sm text-slate-600">
            Why we never provide an opaque black-box number or claim absolute proof of criminality.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-emerald-200 bg-emerald-50/20">
            <Badge variant="success" size="sm">
              Band 0 – 30: Low Deviation
            </Badge>
            <h3 className="text-lg font-bold text-slate-900 mt-2">Normal Baseline</h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Amounts, velocities, timing, and beneficiary details match historical patterns. No anomalous indicators detected.
            </p>
          </Card>

          <Card className="border-amber-200 bg-amber-50/20">
            <Badge variant="warning" size="sm">
              Band 31 – 70: Moderate Deviation
            </Badge>
            <h3 className="text-lg font-bold text-slate-900 mt-2">Review Recommended</h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Unusual transaction amount or frequency spike detected relative to past behavior. Further confirmation is prudent.
            </p>
          </Card>

          <Card className="border-rose-200 bg-rose-50/20">
            <Badge variant="danger" size="sm">
              Band 71 – 100: High Deviation
            </Badge>
            <h3 className="text-lg font-bold text-slate-900 mt-2">Strong Warning Signs</h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Multiple anomalous vectors align: rapid velocity burst, brand-new device, offshore routing, or unverified intermediary claim.
            </p>
          </Card>
        </div>

        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-card space-y-4">
          <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-brand-600" />
            SHAP (SHapley Additive exPlanations) Local Attributions
          </h4>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            For every flagged transaction, FraudShield AI computes SHAP values that explicitly tell the user or analyst <em>why</em> the model flagged the record. Instead of an uninterpretable score, users see clear contributing factors:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-3.5 rounded-lg bg-rose-50/80 border border-rose-200/70 text-xs text-rose-900 space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-rose-700">
                <AlertTriangle className="w-3.5 h-3.5" /> High Risk Contributors (+Score)
              </span>
              <p>• Transfer velocity is 4.8x higher than 30-day user rolling average (+28 pts)</p>
              <p>• Beneficiary account created &lt; 24 hours prior to transaction (+22 pts)</p>
              <p>• Transaction executed from unrecognized hardware fingerprint (+15 pts)</p>
            </div>
            <div className="p-3.5 rounded-lg bg-emerald-50/80 border border-emerald-200/70 text-xs text-emerald-900 space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" /> Low Risk Mitigators (-Score)
              </span>
              <p>• Geolocation matches typical home IP subnetwork (-12 pts)</p>
              <p>• Longstanding user account tenure &gt; 2 years (-8 pts)</p>
              <p>• Consistent recurring payment schedule (-6 pts)</p>
            </div>
          </div>
        </div>
      </section>

      {/* Privacy & Ethical Standards */}
      <section id="privacy" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24">
        <div className="bg-slate-100 rounded-2xl p-8 sm:p-10 border border-slate-200 space-y-6">
          <div className="flex items-center gap-2.5">
            <Scale className="w-6 h-6 text-navy-950" />
            <h3 className="text-xl font-bold text-slate-900">
              Ethical Standards & User Privacy Guarantees
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs text-slate-600">
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900">No Secret Scraping</h4>
              <p>
                We do not scrape private user accounts, scrape password-protected repositories, or harvest unauthorized device contacts.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900">Controlled Data Retention</h4>
              <p>
                Personal users retain complete ownership of uploaded transaction records, with explicit controls to purge statements at any time.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900">Synthetic Benchmarks</h4>
              <p>
                All development, testing, and simulator sessions operate on mathematically generated synthetic accounts and transactions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
        <h3 className="text-2xl font-bold text-slate-900">
          Experience FraudShield AI
        </h3>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Explore the platform with interactive demo accounts and test our risk engines.
        </p>
        <div className="pt-2 flex items-center justify-center gap-3">
          <Button to="/register" variant="primary" icon={ArrowRight} iconPosition="right">
            Access Demo Environment
          </Button>
          <Button to="/features" variant="secondary">
            View All Features
          </Button>
        </div>
      </section>
    </div>
  );
}
