import React from 'react';

export const ChartDefs: React.FC = () => {
  return (
    <defs>
      {/* Plot 1 gradients */}
      <linearGradient id="realGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.15" />
        <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
      </linearGradient>
      <linearGradient id="mandGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--secondary)" stopOpacity="0.15" />
        <stop offset="100%" stopColor="var(--secondary)" stopOpacity="0.0" />
      </linearGradient>

      {/* Plot 2 gradients */}
      <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--success)" stopOpacity="0.12" />
        <stop offset="100%" stopColor="var(--success)" stopOpacity="0.0" />
      </linearGradient>
      <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--danger)" stopOpacity="0.12" />
        <stop offset="100%" stopColor="var(--danger)" stopOpacity="0.0" />
      </linearGradient>
      {/* Fill under negative unallocatedCash (cash shortfall after savings) */}
      <linearGradient id="cashGapGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--warning)" stopOpacity="0.0" />
        <stop offset="100%" stopColor="var(--warning)" stopOpacity="0.22" />
      </linearGradient>
    </defs>
  );
};
export default ChartDefs;
