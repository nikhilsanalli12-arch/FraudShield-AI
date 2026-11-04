import React, { useState } from 'react';
import { X, ShieldAlert, CheckCircle2, FileText, AlertTriangle, Terminal, Info } from 'lucide-react';
import Button from '../common/Button';
import Badge from '../common/Badge';

export default function InvestigationModal({
  item,
  isOpen,
  onClose,
  onMarkReviewed,
}) {
  const [demoNote, setDemoNote] = useState('');
  const [savedNotes, setSavedNotes] = useState([]);
  const [caseCreated, setCaseCreated] = useState(false);

  if (!isOpen || !item) return null;

  const handleAddNote = (e) => {
    e.preventDefault();
    if (!demoNote.trim()) return;
    setSavedNotes((prev) => [
      ...prev,
      {
        id: Date.now(),
        text: demoNote.trim(),
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
    setDemoNote('');
  };

  const handleToggleReviewed = () => {
    if (onMarkReviewed) {
      onMarkReviewed(item.id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-8">
        {/* Simulation Notice Banner */}
        <div className="bg-amber-500/10 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Simulated Analyst Action:</strong> Demonstrating investigation workflow. No financial reversal, blocking, or account freezing performed.
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-semibold text-slate-500">{item.id}</span>
              <Badge
                variant={item.severity === 'critical' ? 'danger' : 'warning'}
                size="sm"
              >
                Risk Score: {item.riskScore}/100
              </Badge>
              {item.status === 'REVIEWED_IN_DEMO' ? (
                <Badge variant="success" size="sm">
                  Reviewed in Demo
                </Badge>
              ) : (
                <Badge variant="neutral" size="sm">
                  Pending Review
                </Badge>
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              {item.category}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Target Account: <span className="font-mono">{item.accountId}</span> • Amount: <strong className="text-slate-800">${item.amount.toFixed(2)} {item.currency}</strong>
            </p>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto text-sm">
          {/* Risk Indicators Section */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
              Observed Anomaly Indicators
            </h3>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5 text-xs text-slate-700">
              {item.indicators.map((ind, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-rose-500 font-bold">•</span>
                  <span>{ind}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Simulated Telemetry Packet */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-brand-600" />
              Simulated Telemetry Packet
            </h3>
            <div className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-xs space-y-1.5">
              <div><span className="text-slate-400">client_ip:</span> {item.simulatedTelemetry.clientIp}</div>
              <div><span className="text-slate-400">device_fp:</span> {item.simulatedTelemetry.deviceFingerprint}</div>
              <div className="truncate"><span className="text-slate-400">user_agent:</span> {item.simulatedTelemetry.userAgent}</div>
              <div><span className="text-slate-400">heuristic_confidence:</span> <span className="text-amber-400">{item.simulatedTelemetry.anomalyConfidence}</span></div>
            </div>
          </div>

          {/* Demonstration Investigation Notes */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-brand-600" />
              Investigation Notes (In-Memory Demo)
            </h3>
            
            {savedNotes.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {savedNotes.map((note) => (
                  <div key={note.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                      <span>Analyst Note</span>
                      <span>{note.timestamp}</span>
                    </div>
                    <div className="text-slate-700">{note.text}</div>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleAddNote} className="flex gap-2">
              <input
                type="text"
                value={demoNote}
                onChange={(e) => setDemoNote(e.target.value)}
                placeholder="Type demonstration investigation observation..."
                className="flex-1 text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-brand-500"
              />
              <Button type="submit" size="sm" variant="secondary">
                Add Note
              </Button>
            </form>
          </div>

          {/* Open Demo Case Notification */}
          {caseCreated && (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                Demonstration case file <strong>#CASE-M3-DEMO</strong> recorded in local session state. Formal case management database tables arrive in Milestone 11.
              </span>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setCaseCreated(true)}
            icon={FileText}
          >
            {caseCreated ? 'Case Opened (Demo)' : 'Open Demo Case'}
          </Button>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={item.status === 'REVIEWED_IN_DEMO' ? 'secondary' : 'primary'}
              onClick={handleToggleReviewed}
              icon={CheckCircle2}
            >
              {item.status === 'REVIEWED_IN_DEMO' ? 'Mark as Unreviewed' : 'Mark as Reviewed (Demo)'}
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

