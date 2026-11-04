import React from 'react';
import { cn } from '../../utils/cn';

export default function Card({
  children,
  className = '',
  hover = false,
  bordered = true,
  padding = 'normal',
  ...props
}) {
  const paddingStyles = {
    none: 'p-0',
    sm: 'p-4',
    normal: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={cn(
        'bg-white rounded-xl transition-all duration-200',
        bordered && 'border border-slate-200/90',
        hover && 'hover:shadow-elevated hover:border-slate-300 hover:-translate-y-0.5',
        !hover && 'shadow-card',
        paddingStyles[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }) {
  return <div className={cn('mb-4 space-y-1', className)}>{children}</div>;
}

export function CardTitle({ children, className = '', as: Component = 'h3' }) {
  return (
    <Component className={cn('text-lg font-semibold text-slate-900 tracking-tight', className)}>
      {children}
    </Component>
  );
}

export function CardDescription({ children, className = '' }) {
  return <p className={cn('text-sm text-slate-500 leading-relaxed', className)}>{children}</p>;
}

export function CardContent({ children, className = '' }) {
  return <div className={cn('space-y-4', className)}>{children}</div>;
}

export function CardFooter({ children, className = '' }) {
  return (
    <div className={cn('mt-6 pt-4 border-t border-slate-100 flex items-center justify-between', className)}>
      {children}
    </div>
  );
}
