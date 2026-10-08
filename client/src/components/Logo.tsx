import React from 'react';

/** 品牌標記：青綠方塊裡的上升階梯，對應 30 → 50 → 80 天的催帳升級。 */
export const Logo: React.FC<{ className?: string }> = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden>
    <rect width="32" height="32" rx="8" fill="#57BBAF" />
    <path
      d="M8 23h5v-5h5v-5h6"
      fill="none"
      stroke="#fff"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
