import React from 'react';
import { PiggyBank } from 'lucide-react';
import { AllocationPolicy, type RetirementPlan } from '../../../../types/calculator';
import { explainEsppAllocation } from '../../../../utils/esppAllocationGuide';

interface EsppAllocationGuideProps {
  plan: RetirementPlan;
  onAllocationPolicy?: (policy: AllocationPolicy) => void;
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

export const EsppAllocationGuide: React.FC<EsppAllocationGuideProps> = ({
  plan,
  onAllocationPolicy,
}) => {
  const g = explainEsppAllocation(plan);
  const totalForBars = Math.max(g.esppCashAnnual, 1);

  const rows: { label: string; policy: AllocationPolicy; split: typeof g.underTfsaFirst; suggested: boolean }[] = [
    {
      label: 'TFSA first',
      policy: AllocationPolicy.TFSA_FIRST,
      split: g.underTfsaFirst,
      suggested: g.suggestedPolicy === AllocationPolicy.TFSA_FIRST,
    },
    {
      label: 'RRSP first',
      policy: AllocationPolicy.RRSP_FIRST,
      split: g.underRrspFirst,
      suggested: g.suggestedPolicy === AllocationPolicy.RRSP_FIRST,
    },
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
              ESPP is cash after sale — not its own account. Match + payroll RRSP stay in RRSP; sale proceeds follow allocation policy.
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
        {rows.map(row => {
          const active = g.activePolicy === row.policy;
          return (
            <div
              key={row.policy}
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                border: active ? '1px solid rgba(16,185,129,0.45)' : '1px solid var(--border-color)',
                background: row.suggested ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.02)',
              }}
            >
              <div className="flex-between" style={{ marginBottom: 8 }}>
                <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>
                  {row.label}
                  {row.suggested ? ' · suggest' : ''}
                  {active ? ' · active' : ''}
                </span>
                {onAllocationPolicy && !active && (
                  <button
                    type="button"
                    onClick={() => onAllocationPolicy(row.policy)}
                    style={{
                      fontSize: '11px',
                      padding: '3px 8px',
                      borderRadius: 4,
                      border: '1px solid var(--border-color)',
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    Use
                  </button>
                )}
              </div>

              {[
                { label: 'TFSA', val: row.split.toTfsa, color: '#34d399' },
                { label: 'RRSP (discretionary)', val: row.split.toRrsp, color: '#818cf8' },
                { label: 'Non-reg', val: row.split.toNonReg, color: '#f59e0b' },
              ].map(b => (
                <div key={b.label} style={{ marginBottom: 6 }}>
                  <div className="flex-between" style={{ fontSize: '11px', marginBottom: 2 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{b.label}</span>
                    <span style={{ fontWeight: 600 }}>{fmt(b.val)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {pctBar(b.val, totalForBars, b.color)}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: 12,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 8,
        fontSize: '11px',
        color: 'var(--text-muted)',
      }}>
        <div>TFSA room (He/She): {fmt(g.rooms.tfsaHe)} / {fmt(g.rooms.tfsaShe)}</div>
        <div>RRSP room (He/She): {fmt(g.rooms.rrspHe)} / {fmt(g.rooms.rrspShe)}</div>
        <div>Payroll+match RRSP (fixed): {fmt(g.payrollRrspHe + g.payrollRrspShe + g.employerMatchHe + g.employerMatchShe)}</div>
        <div>ESPP→RRSP tax toggle: {g.depositEsppToRrsp ? 'ON' : 'OFF'}</div>
      </div>
    </div>
  );
};

export default EsppAllocationGuide;
