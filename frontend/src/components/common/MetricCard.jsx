import React from 'react';
import Card from './Card';
import Badge from './Badge';
import { cn } from '../../utils/cn';

export default function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendDirection = 'neutral', // 'positive' | 'negative' | 'neutral' | 'warning'
  statusBadge,
  statusVariant = 'neutral',
  loading = false,
  className = '',
}) {
  const trendColorMap = {
    positive: 'text-emerald-600',
    negative: 'text-rose-600',
    warning: 'text-amber-600',
    neutral: 'text-slate-500',
  };

  return (
    <Card hover className={cn('relative overflow-hidden', className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            {title}
          </p>
          {loading ? (
            <div className="h-8 w-24 bg-slate-200 animate-pulse rounded my-1" />
          ) : (
            <div className="text-2xl font-bold text-slate-900 tracking-tight tabular-nums font-mono">
              {value}
            </div>
          )}
        </div>

        {Icon && (
          <div className="p-2.5 rounded-lg bg-brand-50 border border-brand-100/60 text-brand-600 shrink-0">
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100">
        <span className="truncate">{subtitle}</span>

        {trend && (
          <span className={cn('font-medium tabular-nums shrink-0', trendColorMap[trendDirection])}>
            {trend}
          </span>
        )}

        {statusBadge && (
          <Badge variant={statusVariant} size="sm">
            {statusBadge}
          </Badge>
        )}
      </div>
    </Card>
  );
}

