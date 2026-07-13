import React from 'react';
import type { ProjectionYear } from '../../../../types/calculator';
import {
  Landmark, CalendarClock, BarChart3, Baby, Wallet, TrendingDown,
} from 'lucide-react';

interface MetricStripProps {
  projection: ProjectionYear[];
  heRetirementAge: number;
  heCurrentAge: number;
  sheCurrentAge: number;
  sheRetirementAge: number;
  effectiveTaxRateHe: number; // 0-1
  effectiveTaxRateShe: number; // 0-1
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
  heCurrentAge,
  heRetirementAge,
  sheCurrentAge,
  sheRetirementAge,
  effectiveTaxRateHe,
  effectiveTaxRateShe,
  totalHouseholdGross,
  totalIncomeTaxHe,
  totalIncomeTaxShe,
}) => {
  // 1. Years to retirement
  const heYears = Math.max(0, heRetirementAge - heCurrentAge);
  const sheYears = Math.max(0, sheRetirementAge - sheCurrentAge);

  // 2. Peak portfolio
  const peakRow = projection.reduce((best, r) => r.portfolioEnd > best.portfolioEnd ? r : best, projection[0]);

  // 3. Lifetime CCB
  const totalCcbLifetime = projection.reduce((sum, r) => sum + (r.ccbBenefit || 0), 0);

  // 4. Worst-case cash flow deficit during retirement
  const retiredRows = projection.filter(r => r.isRetired);
  const worstRetiredRow = retiredRows.length > 0
    ? Math.min(...retiredRows.map(r => r.netIncome - r.expenses), 0)
    : 0;
  const worstRow = retiredRows.find(r => (r.netIncome - r.expenses) === worstRetiredRow);
  const monthlyRetirementDeficit = worstRetiredRow / 12;

  // 5. Total tax paid (current year, annualized)
  const totalTaxCurrentYear = totalIncomeTaxHe + totalIncomeTaxShe;
  const combinedEffectiveTaxRate = totalHouseholdGross > 0 ? totalTaxCurrentYear / totalHouseholdGross : 0;

  // 6. Lifetime investment gains (working phase)
  const totalGains = projection.filter(r => !r.isRetired).reduce((sum, r) => sum + r.investmentGain, 0);

  const retirementColor = heYears <= 5 ? 'var(--success)' : heYears <= 15 ? 'var(--warning)' : 'var(--info)';
  const taxColor = combinedEffectiveTaxRate > 0.30 ? 'var(--danger)' : combinedEffectiveTaxRate > 0.22 ? 'var(--warning)' : 'var(--success)';
  const surplusColor = monthlyRetirementDeficit >= 0 ? 'var(--success)' : 'var(--danger)';

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
        label="Years to Retirement"
        value={<span style={{ color: retirementColor }}>{heYears} yrs</span>}
        sub={`He retires ${heRetirementAge} · She retires ${sheRetirementAge} (${sheYears} yrs)`}
        icon={<CalendarClock size={15} />}
        accentColor={retirementColor}
      />

      <MiniCard
        label="Peak Portfolio"
        value={fmt(peakRow.portfolioEnd, true)}
        sub={`Age ${peakRow.ageHe} (${peakRow.year})`}
        icon={<BarChart3 size={15} />}
        accentColor="var(--accent)"
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
            {monthlyRetirementDeficit >= 0 
              ? '$0/mo' 
              : `${fmt(Math.abs(monthlyRetirementDeficit))}/mo`}
          </span>
        }
        sub={
          monthlyRetirementDeficit >= 0 
            ? 'Fully Funded (drawdowns match expenses)' 
            : worstRow
            ? `Shortfall starts Age ${retiredRows.find(r => r.portfolioEnd === 0)?.ageHe || worstRow.ageHe} (max Age ${worstRow.ageHe})`
            : 'Portfolio depleted! Deficit remains'
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
