import React from 'react';
import type { StageType } from '../types';
import { stageMeta } from './stage';

interface StatusBadgeProps {
  stage: StageType;
  isClosed?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/** 階段標示：色點 + 階段名稱。顏色只出現在色點上，文字維持可讀的深色。 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  stage,
  isClosed = false,
  className = '',
  size = 'md',
}) => {
  const meta = stageMeta(stage, isClosed || stage === 'CLOSED');
  const sizeCls = {
    sm: 'text-xs gap-1.5',
    md: 'text-[13px] gap-2',
    lg: 'text-sm gap-2 font-semibold',
  }[size];

  return (
    <span className={`inline-flex items-center whitespace-nowrap font-medium text-ink-800 ${sizeCls} ${className}`}>
      <span className={`w-2 h-2 rounded-[3px] flex-shrink-0 ${meta.dot}`} aria-hidden />
      {meta.name}
    </span>
  );
};
