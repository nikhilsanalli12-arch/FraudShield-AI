import React from 'react';
import Card, { CardContent } from '../common/Card';
import DemoBadge from './DemoBadge';

export default function MetricWidget({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
  isDemo = false,
  isPending = false,
  className = '',
}) {
  const iconColorMap = {
    default: 'bg-brand-50 text-brand-600 border-brand-100',
    success: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    warning: 'bg-amber-50 text-amber-600 border-amber-100',
    danger: 'bg-rose-50 text-rose-600 border-rose-100',
  };

  const currentIconColor = iconColorMap[variant] || iconColorMap.default;

  return (
    <Card className={`border-slate-200/90 shadow-sm relative overflow-hidden ${className}`}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              {title}
            </p>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {value}
            </div>
            {subtitle && (
              <p className="text-xs text-slate-500">
                {subtitle}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-1.5">
            {Icon && (
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-xs ${currentIconColor}`}>
                <Icon className="w-5 h-5" />
              </div>
            )}
            {isDemo && <DemoBadge text="DEMO" />}
            {isPending && (
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                PENDING
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

