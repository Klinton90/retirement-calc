import React from 'react';
import { PiggyBank } from 'lucide-react';
import { type RetirementPlan } from '../../../../types/calculator';
import { explainEsppAllocation } from '../../../../utils/esppAllocationGuide';

interface EsppAllocationGuideProps {
  plan: RetirementPlan;
}

const fmt = (val: number) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(val);

const pctBar = (part: number, total: number, color: string) => {
  const w = total > 0 ? Math.max(0, Math.min(100, (part / total) * 100)) : 0;
  return (
    <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden', flex: 1 }}>
      <div style={{ width: `${w}%`, height: '100%', background: color }} />
    </div>
  );
};

/** Standalone ESPP guide (optional). ExcessRoomPanel embeds a similar cascade view. */
export const EsppAllocationGuide: React.FC<EsppAllocationGuideProps> = ({ plan }) => {
  const g = explainEsppAllocation(plan);
  const totalForBars = Math.max(g.esppCashAnnual, 1);
  const c = g.lockedCascade;

  const bars = [
    { label: 'He TFSA', val: c.toTfsaHe, color: '#34d399' },
    { label: 'She TFSA', val: c.toTfsaShe, color: '#6ee7b7' },
    { label: 'He RRSP', val: c.toRrspHe, color: '#818cf8' },
    { label: 'She RRSP', val: c.toRrspShe, color: '#a78bfa' },
    { label: 'Non-reg', val: c.toNonReg, color: '#f59e0b' },
  ];

  return (
    <div className="card" style={{ padding: '20px 24px' }}>
      <div className="flex-between" style={{ marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PiggyBank size={18} style={{ color: 'var(--accent)' }} />
          <div>
            <h3 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '-0.3px', fontSize: '14px' }}>
              ESPP redeploy guidance
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
              After Extra: He TFSA → She TFSA → preferred RRSP → Non-reg. Nest-egg Extra uses MV (ADR 0003).
            </p>
          </div>
        </div>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
          {fmt(g.esppCashAnnual)}/yr ESPP
        </div>
      </div>

      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 14px 0', lineHeight: 1.45 }}>
        {g.summary}
      </p>

      <div
        style={{
          padding: '12px 14px',
          borderRadius: 10,
          border: '1px solid rgba(16,185,129,0.45)',
          background: 'rgba(16,185,129,0.06)',
          maxWidth: 420,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>
          ESPP cascade · this year (after Extra)
        </div>
        {bars.map(b => (
          <div key={b.label} style={{ marginBottom: 6 }}>
            <div className="flex-between" style={{ fontSize: 11, marginBottom: 2 }}>
              <span style={{ color: 'var(--text-muted)' }}>{b.label}</span>
              <span style={{ fontWeight: 600 }}>{fmt(b.val)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {pctBar(b.val, totalForBars, b.color)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EsppAllocationGuide;
