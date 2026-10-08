import React from 'react';
import { dayColor } from './stage';

interface AgingBarProps {
  days: number;
  isClosed?: boolean;
  className?: string;
}

/** 刻度位置：30 勸導、50 催告、80 終止、95 待 write-off；軌道總長 110 天 */
const MAX = 110;
const TICKS = [30, 50, 80, 95];

/**
 * 逾期天數進度軌：一眼看出客戶在升級階梯上走到哪裡、離下一關還有多遠。
 */
export const AgingBar: React.FC<AgingBarProps> = ({ days, isClosed = false, className = '' }) => {
  const pct = Math.min(days, MAX) / MAX * 100;
  return (
    <div className={`relative h-1.5 rounded-full bg-ink-100 ${className}`} aria-hidden>
      <div
        className={`absolute inset-y-0 left-0 rounded-full ${isClosed ? 'bg-ink-300' : dayColor(days)}`}
        style={{ width: `${Math.max(pct, 3)}%` }}
      />
      {TICKS.map((t) => (
        <span
          key={t}
          className="absolute top-1/2 -translate-y-1/2 w-px h-2.5 bg-white"
          style={{ left: `${(t / MAX) * 100}%` }}
        />
      ))}
    </div>
  );
};
