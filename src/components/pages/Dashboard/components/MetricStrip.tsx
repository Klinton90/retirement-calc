import React from 'react';
import type { ProjectionYear } from '../../../../types/calculator';
import { analyzeRetirementShortfall } from '../../../../utils/retirementShortfall';
import {
  Landmark, Baby, Wallet, TrendingDown, Percent,
} from 'lucide-react';

interface MetricStripProps {
  projection: ProjectionYear[];
  effectiveTaxRateHe: number; // 0-1
  effectiveTaxRateShe: number; // 0-1
  /** Combined Ontario marginal income-tax rate on next taxable $ (0–1). */
  marginalTaxRateHe: number;
  marginalTaxRateShe: number;
  totalHouseholdGross: number;
  totalIncomeTaxHe: number;
  totalIncomeTaxShe: number;
}

const fmt = (val: number, compact = false) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
    notation: compact ? 'compact' : 'standard',
  }).format(val);

const pct = (val: number) => `${(val * 100).toFixed(1)}%`;

interface MiniCardProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: React.ReactNode;
  accentColor?: string;
}

const MiniCard: React.FC<MiniCardProps> = ({ label, value, sub, icon, accentColor = 'var(--info)' }) => (
  <div
    className="card"
    style={{
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      borderTop: `2px solid ${accentColor}`,
      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
    }}
    onMouseEnter={e => {
      (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
      (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px rgba(0,0,0,0.35)`;
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLElement).style.transform = '';
      (e.currentTarget as HTMLElement).style.boxShadow = '';
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </span>
      <span style={{ color: accentColor, opacity: 0.8 }}>{icon}</span>
    </div>
    <div style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>
      {value}
    </div>
    {sub && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{sub}</div>}
  </div>
);

export const MetricStrip: React.FC<MetricStripProps> = ({
  projection,
  effectiveTaxRateHe,
  effectiveTaxRateShe,
  marginalTaxRateHe,
  marginalTaxRateShe,
  totalHouseholdGross,
  totalIncomeTaxHe,
  totalIncomeTaxShe,
}) => {
  const totalCcbLifetime = projection.reduce((sum, r) => sum + (r.ccbBenefit || 0), 0);

  // Shared analysis so this card and the Retirement Readiness card agree on
  // whether the final horizon year has a shortfall.
  const shortfall = analyzeRetirementShortfall(projection);
  const hasShortfall = !shortfall.lastsFullHorizon;
  const firstShortAge = shortfall.firstShortfallAge;
  const worstShortAge = shortfall.worstShortfallAge;
  const monthlyRetirementDeficit = hasShortfall ? -(shortfall.worstAnnualGap / 12) : 0;

  const totalTaxCurrentYear = totalIncomeTaxHe + totalIncomeTaxShe;
  const combinedEffectiveTaxRate = totalHouseholdGross > 0 ? totalTaxCurrentYear / totalHouseholdGross : 0;
  // Headline = higher earner's marginal (next household $ typically hits them).
  const headlineMarginal = Math.max(marginalTaxRateHe, marginalTaxRateShe);

  const totalGains = projection.filter(r => !r.isRetired).reduce((sum, r) => sum + r.investmentGain, 0);

  const taxColor = combinedEffectiveTaxRate > 0.30 ? 'var(--danger)' : combinedEffectiveTaxRate > 0.22 ? 'var(--warning)' : 'var(--success)';
  const marginalColor = headlineMarginal > 0.45 ? 'var(--danger)' : headlineMarginal > 0.35 ? 'var(--warning)' : 'var(--success)';
  const surplusColor = hasShortfall ? 'var(--danger)' : 'var(--success)';

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
      gap: '14px',
      marginBottom: '4px',
    }}>
      <MiniCard
        label="Effective Tax Rate"
        value={<span style={{ color: taxColor }}>{pct(combinedEffectiveTaxRate)}</span>}
        sub={`He ${pct(effectiveTaxRateHe)} · She ${pct(effectiveTaxRateShe)}`}
        icon={<Landmark size={15} />}
        accentColor={taxColor}
      />

      <MiniCard
        label="Marginal Tax Rate"
        value={<span style={{ color: marginalColor }}>{pct(headlineMarginal)}</span>}
        sub={`He ${pct(marginalTaxRateHe)} · She ${pct(marginalTaxRateShe)} · next taxable $`}
        icon={<Percent size={15} />}
        accentColor={marginalColor}
      />

      {totalCcbLifetime > 0 && (
        <MiniCard
          label="Lifetime CCB"
          value={fmt(totalCcbLifetime, true)}
          sub="Total tax-free child benefit"
          icon={<Baby size={15} />}
          accentColor="var(--success)"
        />
      )}

      <MiniCard
        label="Retirement Monthly Deficit"
        value={
          <span style={{ color: surplusColor }}>
            {hasShortfall ? `${fmt(Math.abs(monthlyRetirementDeficit))}/mo` : '$0/mo'}
          </span>
        }
        sub={
          !hasShortfall
            ? 'Viewer cash path fully funded (same scan as Readiness) — not Extra $/mo to add'
            : firstShortAge !== null && worstShortAge !== null && worstShortAge !== firstShortAge
            ? `Worst cash gap Age ${worstShortAge} · starts Age ${firstShortAge} · not Extra to add`
            : `Worst cash gap at Age ${(firstShortAge ?? worstShortAge)!} · not Extra to add`
        }
        icon={<Wallet size={15} />}
        accentColor={surplusColor}
      />

      <MiniCard
        label="Working-Phase Inv. Gains"
        value={fmt(totalGains, true)}
        sub="Total portfolio growth before retirement"
        icon={<TrendingDown size={15} style={{ transform: 'rotate(180deg)' }} />}
        accentColor="var(--purple, #a78bfa)"
      />
    </div>
  );
};
export default MetricStrip;
