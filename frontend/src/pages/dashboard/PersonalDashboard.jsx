import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldCheck,
  ShieldAlert,
  Link as LinkIcon,
  CreditCard,
  UploadCloud,
  FileText,
  Sparkles,
  ArrowRight,
  Activity,
  Shield,
  Lock,
} from 'lucide-react';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';

/**
 * Platform Architectural Roadmap & Safety Invariants:
 * - Milestone 5: CSV bank statement upload and batch fraud scoring (Active in Production)
 * - Milestone 7: Android APK malware & intrusive permission auditing (Scheduled Future Milestone)
 * - Milestone 8: Predatory loan terms & hidden APR calculator (Scheduled Future Milestone)
 * - Milestone 9: High-yield investment Ponzi scheme evaluator (Scheduled Future Milestone)
 * Note: Only verified, active services are surfaced as available to end-users.
 */

export default function PersonalDashboard() {
  const navigate = useNavigate();
  const { user, profile, role } = useAuth();

  const effectiveRole = role || profile?.role || 'personal';
  const displayName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    'User';

  // Available feature cards (strictly existing, functional services only)
  const features = [
    {
      id: 'transaction-fraud',
      title: 'Bank Transaction Fraud Detection',
      badge: 'Live Protection',
      badgeVariant: 'success',
      icon: CreditCard,
      description:
        'Evaluate individual financial transactions in real time using deterministic heuristic rules (velocity bursts, extreme currency amounts, repeated attempts, and round numbers).',
      actionLabel: 'Open Transaction Monitor',
      onAction: () => navigate('/dashboard/transactions'),
    },
    {
      id: 'csv-analysis',
      title: 'CSV Transaction Analysis',
      badge: 'Batch Ingestion',
      badgeVariant: 'success',
      icon: UploadCloud,
      description:
        'Upload standardized bank statement CSV exports (RFC 4180). Automatically sanitizes, validates formatting, eliminates duplicates, and scores all historical statement rows.',
      actionLabel: 'Import Statement CSV',
      onAction: () => navigate('/dashboard/transactions?action=import'),
    },
    {
      id: 'link-scanner',
      title: 'Suspicious Link Scanner',
      badge: 'Threat Inspection',
      badgeVariant: 'success',
      icon: LinkIcon,
      description:
        'Defensive zero-fetch static URL threat scanner. Detects lookalike homoglyphs, misleading multi-level subdomains, raw IP hostnames, and shortened URLs without visiting dangerous sites.',
      actionLabel: 'Scan Suspicious Link',
      onAction: () => navigate('/dashboard/link-scanner'),
    },
    {
      id: 'ai-explanations',
      title: 'AI-Powered Fraud Explanations',
      badge: 'Google Gemini 3.8',
      badgeVariant: 'brand',
      icon: Sparkles,
      description:
        'Transparent, plain-English security breakdowns powered by Google Gemini AI. Translates technical heuristic flags into clear risk summaries and actionable defensive recommendations.',
      actionLabel: 'Explore AI Insights',
      onAction: () => navigate('/dashboard/transactions'),
    },
    {
      id: 'pdf-reports',
      title: 'PDF Security Reports',
      badge: 'Audit Export',
      badgeVariant: 'success',
      icon: FileText,
      description:
        'Generate formal, tamper-evident PDF security reports containing defanged non-clickable URLs, deterministic risk scores, confirmed facts, observed indicators, and safety disclaimers.',
      actionLabel: 'Download Security Report',
      onAction: () => navigate('/dashboard/link-scanner'),
    },
    ...(effectiveRole === 'analyst' || effectiveRole === 'admin'
      ? [
          {
            id: 'analyst-triage',
            title: 'Analyst Investigation & Case Management',
            badge: `Role: ${effectiveRole.toUpperCase()}`,
            badgeVariant: 'brand',
            icon: Activity,
            description:
              'Centralized compliance queue for financial fraud analysts. Review auto-opened high-risk cases, triage risk levels, assign investigators, and record audit decisions.',
            actionLabel: 'Open Investigation Queue',
            onAction: () => navigate('/analyst/dashboard'),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* 1. WELCOME SECTION */}
      <section
        aria-label="Welcome to FraudShield AI"
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-navy-950 via-slate-900 to-navy-900 text-white p-6 sm:p-10 border border-slate-800 shadow-md"
      >
        {/* Subtle background ambient gradients */}
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-4">
          {/* Status chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-brand-500/20 text-brand-300 border border-brand-500/30">
              <Sparkles className="w-3.5 h-3.5 text-brand-300" />
              AI-Powered Financial Defense
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Active Protection
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700">
              Role: {effectiveRole}
            </span>
          </div>

          {/* Heading */}
          <div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
              Welcome to FraudShield AI
            </h1>
            <p className="text-sm font-medium text-brand-300 mt-1">
              Hello, {displayName} ({user?.email})
            </p>
          </div>

          {/* Short Platform Introduction */}
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            FraudShield AI is an intelligent financial fraud detection and digital safety platform. We protect users and organizations against transaction fraud, deceptive phishing links, and account threats using real-time deterministic heuristic scoring combined with Google Gemini AI security analysis.
          </p>

          {/* Session Attributes */}
          <div className="flex items-center gap-4 text-xs text-slate-400 pt-2 flex-wrap">
            <span className="text-emerald-400 flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Supabase Auth Connected
            </span>
            <span className="text-slate-600">•</span>
            <span>Row Level Security (RLS) Active</span>
            <span className="text-slate-600">•</span>
            <span>Deterministic Scoring Engine v1</span>
          </div>
        </div>
      </section>

      {/* 2. OUR FEATURES SECTION */}
      <section aria-label="Our Features" className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-brand-600" />
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Our Features & What We Offer
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Select an existing security capability below to open its dedicated workflow.
            </p>
          </div>
          <span className="text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-200 px-3 py-1 rounded-full self-start sm:self-auto">
            {features.length} Available Services
          </span>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.id}
                className="group p-5 bg-white rounded-2xl border border-slate-200 hover:border-brand-400 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-11 h-11 rounded-xl bg-slate-50 group-hover:bg-brand-50 border border-slate-200 group-hover:border-brand-200 flex items-center justify-center transition-colors text-slate-700 group-hover:text-brand-600">
                      <Icon className="w-5 h-5" />
                    </div>
                    <Badge variant={feature.badgeVariant} size="sm">
                      {feature.badge}
                    </Badge>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
                    {feature.title}
                  </h3>

                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    {feature.description}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <Button
                    size="sm"
                    variant="primary"
                    icon={ArrowRight}
                    onClick={feature.onAction}
                    className="text-xs font-semibold w-full justify-between"
                  >
                    <span>{feature.actionLabel}</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. SECURITY MESSAGE / FOOTER */}
      <footer aria-label="Security Notice" className="pt-4">
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-brand-600 shrink-0" />
            <span>
              <strong>FraudShield AI Security Guarantee:</strong> All fraud risk scoring is evaluated deterministically using verified heuristics. AI explanations are advisory and never alter risk scores or access raw bank credentials.
            </span>
          </div>
          <span className="text-[11px] font-medium text-slate-400 shrink-0">
            Zero-Fetch Threat Scanner • Client-Side PDF Audit
          </span>
        </div>
      </footer>
    </div>
  );
}
