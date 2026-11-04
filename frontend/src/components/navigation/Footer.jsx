import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, Cpu, Lock, FileText, CheckCircle2 } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-navy-950 text-slate-300 border-t border-navy-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Brand & Vision */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-md shadow-brand-600/30">
                <ShieldCheck className="w-5 h-5 text-brand-100" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white">
                FraudShield <span className="text-brand-400">AI</span>
              </span>
            </Link>

            <p className="text-sm text-slate-400 font-medium italic">
              "Your transactions. Your security. Your control."
            </p>

            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              FraudShield AI is a unified financial safety platform engineered to help individuals detect financial deception and equip authorized analysts with verifiable risk intelligence.
            </p>

            <div className="pt-2 flex items-center gap-3 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-navy-900 border border-navy-800 text-slate-300">
                <Lock className="w-3.5 h-3.5 text-brand-400" /> Zero Banking Credentials Requested
              </span>
            </div>
          </div>

          {/* Safety Modules */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white">
              Safety Modules
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/features#transactions" className="hover:text-brand-400 transition-colors">
                  Transaction Security
                </Link>
              </li>
              <li>
                <Link to="/features#link-scanner" className="hover:text-brand-400 transition-colors">
                  Website & Link Scanner
                </Link>
              </li>
              <li>
                <Link to="/features#app-checker" className="hover:text-brand-400 transition-colors">
                  Financial App Analyzer
                </Link>
              </li>
              <li>
                <Link to="/features#loan-analyzer" className="hover:text-brand-400 transition-colors">
                  Loan & EMI Cost Analyzer
                </Link>
              </li>
              <li>
                <Link to="/features#investment-analyzer" className="hover:text-brand-400 transition-colors">
                  Investment Claim Checker
                </Link>
              </li>
              <li>
                <Link to="/features#trust-reports" className="hover:text-brand-400 transition-colors">
                  Financial Trust Reports
                </Link>
              </li>
            </ul>
          </div>

          {/* Platform & Roles */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white">
              Platform & Roles
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/login?role=personal" className="hover:text-brand-400 transition-colors">
                  Personal Safety Portal
                </Link>
              </li>
              <li>
                <Link to="/login?role=analyst" className="hover:text-brand-400 transition-colors">
                  Analyst Command Center
                </Link>
              </li>
              <li>
                <Link to="/login?role=admin" className="hover:text-brand-400 transition-colors">
                  Administrator Portal
                </Link>
              </li>
              <li>
                <Link to="/how-it-works#architecture" className="hover:text-brand-400 transition-colors">
                  System Architecture
                </Link>
              </li>
              <li>
                <Link to="/how-it-works#explainability" className="hover:text-brand-400 transition-colors">
                  Explainable AI (SHAP)
                </Link>
              </li>
            </ul>
          </div>

          {/* Ethics & Transparency */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white">
              Ethics & Transparency
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/how-it-works#methodology" className="hover:text-brand-400 transition-colors">
                  Risk Methodology
                </Link>
              </li>
              <li>
                <Link to="/how-it-works#deterministic-math" className="hover:text-brand-400 transition-colors">
                  Deterministic Math Policy
                </Link>
              </li>
              <li>
                <Link to="/how-it-works#privacy" className="hover:text-brand-400 transition-colors">
                  Privacy & Data Deletion
                </Link>
              </li>
              <li>
                <span className="text-slate-400 cursor-default">
                  Synthetic Benchmarks Only
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Ethical Disclaimer Bar */}
        <div className="mt-12 pt-8 border-t border-navy-800/80 text-xs text-slate-400 space-y-3">
          <div className="p-3.5 rounded-lg bg-navy-900/80 border border-navy-800 flex items-start gap-3">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed text-slate-300">
              <strong className="text-white">Strict Transparency Disclosure:</strong> FraudShield AI generates statistical risk scores and anomaly detection flags. A high risk score represents statistical deviation and warning indicators, never definitive legal proof of fraudulent or criminal activity. Absence of a known warning is not an absolute guarantee of safety. All evaluations must be reviewed with human judgment.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <p className="text-slate-400">
              © {currentYear} FraudShield AI. Built with precision, security, and algorithmic integrity.
            </p>
            <div className="flex items-center gap-4 text-slate-400">
              <span>Single Unified Codebase</span>
              <span>•</span>
              <span>Version 1.0</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

