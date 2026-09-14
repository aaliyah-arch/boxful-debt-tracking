import React from 'react';
import type { StageType } from '../types';

interface StatusBadgeProps {
  stage: StageType;
  isClosed?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  stage,
  isClosed = false,
  className = '',
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1 font-medium',
    lg: 'text-sm px-3 py-1.5 font-semibold',
  };

  if (isClosed || stage === 'CLOSED') {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 ${sizeClasses[size]} ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        5. 已結案
      </span>
    );
  }

  switch (stage) {
    case 'STAGE_1':
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 ${sizeClasses[size]} ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
          1. 第一階段：勸導期 (滿30天)
        </span>
      );
    case 'STAGE_2':
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 border border-amber-300 ${sizeClasses[size]} ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          2. 第二階段：催告期 (滿50天)
        </span>
      );
    case 'STAGE_3':
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-rose-50 text-rose-700 border border-rose-300 ${sizeClasses[size]} ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
          3. 第三階段：終止期 (滿80天)
        </span>
      );
    case 'STAGE_4':
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-purple-50 text-purple-700 border border-purple-300 ${sizeClasses[size]} ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-purple-600"></span>
          4. 待write-off (滿95天/終止滿15天)
        </span>
      );
    case 'UNREACHED':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 ${sizeClasses[size]} ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
          追蹤中 (未滿30天)
        </span>
      );
  }
};
