import React from 'react';
import { PiggyBank, Gauge } from 'lucide-react';
import { FamilyMember, type RetirementPlan } from '../../../../types/calculator';
import {
  SoftCapacityLevel,
  explainExcessMoney,
} from '../../../../utils/excessMoneyGuide';
import { resolveEarnerRoles } from '../../../../utils/earnerRoles';

interface ExcessRoomPanelProps {
  plan: RetirementPlan;
  currentYear?: number;
  /** Current path funds the horizon without solver Extra — same as Min Savings "Already Funded". */
  isFundedWithoutExtra?: boolean;
  /** Prefer parent-computed guide to avoid a second Excess/MV ranking. */
  excessGuide?: ReturnType<typeof explainExcessMoney>;
  onOptimizeSpousal?: (enable: boolean, spousalMonthly: number) => void;
}

const fmt = (val: number) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(val);

const capacityColor = (level: SoftCapacityLevel) => {
  if (level === SoftCapacityLevel.GREEN) return 'var(--success)';
  if (level === SoftCapacityLevel.AMBER) return 'var(--warning)';
  return 'var(--danger)';
};

const pctBar = (part: number, total: number, color: string) => {
  const w = total > 0 ? Math.max(0, Math.min(100, (part / total) * 100)) : 0;
  return (
    <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden', flex: 1 }}>
      <div style={{ width: `${w}%`, height: '100%', background: color }} />
    </div>
  );
};

export const ExcessRoomPanel: React.FC<ExcessRoomPanelProps> = ({
  plan,
  currentYear = new Date().getFullYear(),
  isFundedWithoutExtra = false,
  excessGuide,
  onOptimizeSpousal,
}) => {
  const excess =
    excessGuide ?? explainExcessMoney(plan, { currentYear, isFunded: isFundedWithoutExtra });
  const routing = excess.combinedMvRouting;
  const totalForBars = Math.max(routing.totalPoolAnnual, 1);
  const roles = resolveEarnerRoles(plan);
  const secondaryPoolAnnual =
    roles.secondary === FamilyMember.SHE
      ? routing.shePoolAnnual
      : routing.hePoolAnnual;

  return (
    <div className="card" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="flex-between" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Gauge size={18} style={{ color: 'var(--accent)' }} />
          <div>
            <h3 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '-0.3px', fontSize: '14px' }}>
              Excess / room advisor
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
              Highest-ROI (marginal value) split under TFSA ownership. Soft RRIF headroom is diagnostic for OAS/RRIF risk. Overflow invests (never lifestyle).
            </p>
          </div>
        </div>
        {isFundedWithoutExtra && (
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--info)', textTransform: 'uppercase' }}>
            Tax optimization framing
          </span>
        )}
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
        Extra, ESPP sale proceeds, and saved ESPP refunds are one discretionary pool per
        person. Each pool follows own TFSA → spouse TFSA → highest-MV registered
        destination → non-reg. The table shows their combined deployment this year.
      </p>

      <div className="excess-room-content">
      <div className="excess-room-summary-stack">
        <div style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
            HE RRIF HEADROOM @71 · diagnostic
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: capacityColor(excess.softCapacityHe.level) }}>
            {excess.softCapacityHe.level}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {fmt(excess.softCapacityHe.headroomAt71)} before OAS clawback path
          </div>
        </div>
        <div style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
            SHE RRIF HEADROOM @71 · diagnostic
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: capacityColor(excess.softCapacityShe.level) }}>
            {excess.softCapacityShe.level}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {fmt(excess.softCapacityShe.headroomAt71)} before OAS clawback path
          </div>
        </div>
        <div style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>TFSA EXHAUSTION</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
            {excess.yearsUntilTfsaExhaustion === null
              ? 'Within room'
              : `~${excess.yearsUntilTfsaExhaustion}y (${excess.tfsaExhaustionYear})`}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {excess.crowdingWinner ? `Primarily from ${excess.crowdingWinner}` : 'Extra vs ESPP vs refund race'}
          </div>
        </div>
      </div>

      <div className="excess-room-routing">
        <div className="flex-between" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PiggyBank size={16} style={{ color: 'var(--accent)' }} />
            <div>
              <h4 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '-0.3px', fontSize: 13 }}>
                Extra + ESPP cascade · this year
              </h4>
              <p style={{ margin: '2px 0 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                He pool {fmt(routing.hePoolAnnual)} · She pool {fmt(routing.shePoolAnnual)}
              </p>
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            {fmt(routing.totalPoolAnnual)}/yr deployable
          </div>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px 0', lineHeight: 1.45 }}>
          Extra {fmt((excess.heExtraMonthly + excess.sheExtraMonthly) * 12)}
          {' · '}ESPP sale {fmt(plan.depositEsppToRrsp ? 0 : excess.esppCashAnnual)}
          {excess.estimatedRefundRedepositAnnual > 0
            ? ` · saved refund ${fmt(excess.estimatedRefundRedepositAnnual)}`
            : ''}
          . The internal MV probe is not included.
          {plan.depositEsppToRrsp
            ? ' ESPP→RRSP is on, so ESPP deposits directly through payroll; only its saved refund joins this pool.'
            : ''}
        </p>
        {(() => {
          const bars = [
            { label: 'He TFSA', val: routing.toTfsaHe, color: '#34d399' },
            { label: 'She TFSA', val: routing.toTfsaShe, color: '#6ee7b7' },
            { label: 'He RRSP', val: routing.toRrspHe, color: '#818cf8' },
            { label: 'She RRSP', val: routing.toRrspShe, color: '#a78bfa' },
            { label: 'Spousal RRSP', val: routing.toSpousal, color: '#c084fc' },
            { label: 'Non-reg', val: routing.toNonReg, color: '#f59e0b' },
          ];
          return (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                border: '1px solid rgba(16,185,129,0.45)',
                background: 'rgba(16,185,129,0.06)',
              }}
            >
              {routing.totalPoolAnnual <= 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  No Extra, ESPP sale, or saved refund to deploy this year.
                </div>
              ) : (
                bars.map((bar) => (
                  <div key={bar.label} style={{ marginBottom: 7 }}>
                    <div className="flex-between" style={{ fontSize: 11, marginBottom: 2 }}>
                      <span style={{ color: 'var(--text-muted)' }}>{bar.label}</span>
                      <span style={{ fontWeight: 600 }}>{fmt(bar.val)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {pctBar(bar.val, totalForBars, bar.color)}
                    </div>
                  </div>
                ))
              )}
            </div>
          );
        })()}
        {onOptimizeSpousal &&
          secondaryPoolAnnual > 0 &&
          !plan.optimizeSpousalRrsp && (
          <button
            type="button"
            onClick={() =>
              onOptimizeSpousal(
                true,
                Math.max(
                  routing.toSpousal / 12,
                  secondaryPoolAnnual / 12
                )
              )
            }
            style={{
              marginTop: 10,
              fontSize: 12,
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              background: 'rgba(16,185,129,0.08)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            Enable Spousal for{' '}
            {roles.secondary === FamilyMember.SHE ? "She's" : "He's"} pool
          </button>
        )}
      </div>
      </div>
    </div>
  );
};

export default ExcessRoomPanel;
