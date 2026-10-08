import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
  trend?: string;
  badge?: string;
  colorClass?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subValue,
  icon,
  trend,
  badge,
  colorClass = 'text-ink-900',
}) => {
  return (
    <div className="group relative bg-white rounded-2xl border border-ink-200/80 p-5 shadow-xs hover:shadow-md hover:shadow-brand-900/5 hover:border-brand-200 transition-all">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink-500">{title}</span>
        <div className="p-2.5 rounded-xl bg-ink-50 text-ink-600 ring-1 ring-inset ring-ink-100 group-hover:bg-brand-50 group-hover:ring-brand-100 transition-colors">
          {icon}
        </div>
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <span className={`text-2xl font-bold tracking-tight ${colorClass}`}>
          {value}
        </span>
        {subValue && (
          <span className="text-sm text-ink-500 font-medium">
            {subValue}
          </span>
        )}
      </div>
      {(trend || badge) && (
        <div className="mt-2 flex items-center gap-2">
          {badge && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-ink-100 text-ink-600">
              {badge}
            </span>
          )}
          {trend && <span className="text-xs text-ink-500">{trend}</span>}
        </div>
      )}
    </div>
  );
};
