import React from 'react';
import { FlaskConical } from 'lucide-react';

export default function DemoBadge({ className = '', text = 'SYNTHETIC DEMO DATA' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 ${className}`}
      title="This data is synthetically generated for UI workflow testing."
    >
      <FlaskConical className="w-3.5 h-3.5 text-amber-600" />
      <span>{text}</span>
    </span>
  );
}
