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
  colorClass = 'text-slate-900',
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">{title}</span>
        <div className="p-2.5 rounded-lg bg-slate-50 text-slate-600 border border-slate-100">
          {icon}
        </div>
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <span className={`text-2xl font-bold tracking-tight ${colorClass}`}>
          {value}
        </span>
        {subValue && (
          <span className="text-sm text-slate-500 font-medium">
            {subValue}
          </span>
        )}
      </div>
      {(trend || badge) && (
        <div className="mt-2 flex items-center gap-2">
          {badge && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
              {badge}
            </span>
          )}
          {trend && <span className="text-xs text-slate-500">{trend}</span>}
        </div>
      )}
    </div>
  );
};
