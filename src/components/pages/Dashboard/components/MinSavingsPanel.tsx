import React, { useState, useRef } from 'react';
import { calculateMinSavingsRequired } from '../../../../utils/retirementCalc';
import type { SurplusSpendResult, TargetEngineResult } from '../../../../utils/targetEngine';
import { Target, TrendingDown, Info, Sparkles } from 'lucide-react';
import { FundingRegime, type RetirementPlan } from '../../../../types/calculator';

interface MinSavingsPanelProps {
  plan: RetirementPlan;
  activeScenario: 'realistic' | 'mandatory';
  planTargets?: TargetEngineResult;
}

const fmt = (val: number, compact = false) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
    notation: compact ? 'compact' : 'standard',
  }).format(val);

const pct = (val: number) => `${(val * 100).toFixed(1)}%`;

const SURPLUS_PORT_COLOR = '#10b981';
const EXTRA_SPEND_COLOR = '#f59e0b';

function buildLinePath(
  values: number[],
  toX: (i: number) => number,
  toY: (v: number) => number,
  nAxis: number
): string {
  if (!values.length || nAxis < 2) return '';
  return values
    .map((v, i) => {
      const x = toX(Math.min(i, nAxis - 1));
      const y = toY(v);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}

// ─── SVG Depletion Chart ─────────────────────────────────────────────────────
interface DepletionChartProps {
  portfolioCurve: number[];
  annualSpendCurve: number[];
  nestEgg: number;
  surplus?: SurplusSpendResult;
}

const DepletionChart: React.FC<DepletionChartProps> = ({
  portfolioCurve,
  annualSpendCurve,
  nestEgg,
  surplus,
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const svgW = 560;
  const svgH = 200;
  const padL = 60;
  const padR = 12;
  const padT = 16;
  const padB = 30;
  const chartW = svgW - padL - padR;
  const chartH = svgH - padT - padB;

  const n = portfolioCurve.length;
  const maxVal = Math.max(
    nestEgg,
    ...(surplus?.depletePortfolioCurve ?? []),
    ...(surplus?.depleteSpendCurve ?? []),
    1
  );

  const toX = (i: number) => padL + (i / (n - 1)) * chartW;
  const toY = (v: number) => padT + chartH - (Math.min(v, maxVal) / maxVal) * chartH;

  let portfolioPath = '';
  let portfolioArea = '';
  let spendPath = '';
  let spendArea = '';

  portfolioCurve.forEach((v, i) => {
    const x = toX(i);
    const y = toY(v);
    if (i === 0) {
      portfolioPath = `M ${x} ${y}`;
      portfolioArea = `M ${x} ${padT + chartH} L ${x} ${y}`;
    } else {
      portfolioPath += ` L ${x} ${y}`;
      portfolioArea += ` L ${x} ${y}`;
    }
  });
  portfolioArea += ` L ${toX(n - 1)} ${padT + chartH} Z`;

  const spendN = annualSpendCurve.length;
  annualSpendCurve.forEach((v, i) => {
    const x = toX(i);
    const y = toY(v);
    if (i === 0) {
      spendPath = `M ${x} ${y}`;
      spendArea = `M ${x} ${padT + chartH} L ${x} ${y}`;
    } else {
      spendPath += ` L ${x} ${y}`;
      spendArea += ` L ${x} ${y}`;
    }
  });
  spendArea += ` L ${toX(spendN - 1)} ${padT + chartH} Z`;

  const depletePortPath = surplus
    ? buildLinePath(surplus.depletePortfolioCurve, toX, toY, n)
    : '';
  const showExtraPull = !!surplus && surplus.kind === 'surplus';
  const extraSpendPath = showExtraPull
    ? buildLinePath(surplus!.annualExtraCurve, toX, toY, n)
    : '';
  const depleteSpendPath =
    surplus && surplus.kind !== 'required'
      ? buildLinePath(surplus.depleteSpendCurve, toX, toY, n)
      : '';

  const yTicks = 4;
  const tipH = surplus ? 68 : 42;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * svgW;
    const chartX = svgX - padL;
    let idx = Math.round((chartX / chartW) * (n - 1));
    idx = Math.max(0, Math.min(n - 1, idx));
    setHoverIdx(idx);
  };

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox={`0 0 ${svgW} ${svgH}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ overflow: 'visible', cursor: 'crosshair' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverIdx(null)}
    >
      <defs>
        <linearGradient id="minPortGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="minSpendGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.20" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {Array.from({ length: yTicks }).map((_, i) => {
        const val = (maxVal / (yTicks - 1)) * i;
        const y = toY(val);
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={padL + chartW} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            <text x={padL - 5} y={y + 4} fill="var(--text-muted)" fontSize="12" textAnchor="end">
              {fmt(val, true)}
            </text>
          </g>
        );
      })}

      <path d={portfolioArea} fill="url(#minPortGrad)" />
      <path d={portfolioPath} fill="none" stroke="var(--primary)" strokeWidth="2" />
      <path d={spendArea} fill="url(#minSpendGrad)" />
      <path d={spendPath} fill="none" stroke="var(--danger)" strokeWidth="1.5" strokeDasharray="4 3" />

      {surplus && depletePortPath && (
        <path d={depletePortPath} fill="none" stroke={SURPLUS_PORT_COLOR} strokeWidth="2" strokeDasharray="6 3" />
      )}
      {surplus && depleteSpendPath && (
        <path d={depleteSpendPath} fill="none" stroke={EXTRA_SPEND_COLOR} strokeWidth="1.5" strokeDasharray="2 3" opacity={0.55} />
      )}
      {surplus && extraSpendPath && (
        <path d={extraSpendPath} fill="none" stroke={EXTRA_SPEND_COLOR} strokeWidth="2" />
      )}

      {portfolioCurve.map((_, i) => {
        if (i % 5 !== 0 && i !== n - 1) return null;
        return (
          <text key={i} x={toX(i)} y={padT + chartH + 16} fill="var(--text-muted)" fontSize="12" textAnchor="middle">
            Yr {i}
          </text>
        );
      })}

      {hoverIdx !== null && (
        <g>
          <line
            x1={toX(hoverIdx)} y1={padT}
            x2={toX(hoverIdx)} y2={padT + chartH}
            stroke="rgba(255,255,255,0.25)" strokeWidth="1"
          />
          <circle cx={toX(hoverIdx)} cy={toY(portfolioCurve[hoverIdx])} r="4" fill="var(--primary)" stroke="white" strokeWidth="1.5" />
          {surplus?.depletePortfolioCurve[hoverIdx] != null && (
            <circle
              cx={toX(hoverIdx)}
              cy={toY(surplus.depletePortfolioCurve[hoverIdx])}
              r="3.5"
              fill={SURPLUS_PORT_COLOR}
              stroke="white"
              strokeWidth="1"
            />
          )}
          <g transform={`translate(${Math.min(toX(hoverIdx) + 6, svgW - 150)}, ${padT + 6})`}>
            <rect width="148" height={tipH} rx="6" fill="#111827" stroke="var(--border-color)" strokeWidth="0.8" />
            <text x="8" y="15" fill="var(--text-secondary)" fontSize="12" fontWeight="600">YEAR {hoverIdx}</text>
            <text x="8" y="28" fill="var(--primary)" fontSize="12" fontWeight="700">
              {fmt(portfolioCurve[hoverIdx], true)} {surplus?.kind === 'required' ? '@ current' : '@ target'}
            </text>
            <text x="8" y="39" fill="var(--danger)" fontSize="12">
              {hoverIdx < annualSpendCurve.length ? `Spend: ${fmt(annualSpendCurve[hoverIdx] / 12, true)}/mo` : ''}
            </text>
            {surplus && hoverIdx < surplus.annualExtraCurve.length && (
              <>
                <text x="8" y="52" fill={SURPLUS_PORT_COLOR} fontSize="12" fontWeight="600">
                  {fmt(surplus.depletePortfolioCurve[Math.min(hoverIdx, surplus.depletePortfolioCurve.length - 1)], true)} → $0 path
                </text>
                <text x="8" y="63" fill={EXTRA_SPEND_COLOR} fontSize="12">
                  {surplus.kind === 'required'
                    ? 'Required nest egg @ target'
                    : surplus.kind === 'affordable'
                      ? `Affordable: ${fmt(surplus.depleteSpendCurve[hoverIdx] / 12, true)}/mo`
                      : `Extra: ${fmt(surplus.annualExtraCurve[hoverIdx] / 12, true)}/mo`}
                </text>
              </>
            )}
          </g>
        </g>
      )}
    </svg>
  );
};

// ─── Main Panel ──────────────────────────────────────────────────────────────
export const MinSavingsPanel: React.FC<MinSavingsPanelProps> = ({
  plan,
  activeScenario,
  planTargets,
}) => {
  const currentYear = new Date().getFullYear();
  const useMandatoryOnly = activeScenario === 'mandatory';

  const result = planTargets ?? (() => {
    const m = calculateMinSavingsRequired(plan, currentYear, useMandatoryOnly);
    return {
      nestEggAtRetirement: m.nestEgg,
      monthlyPersonalSavingsNeeded: m.monthlySavingsNeeded,
      isFundedWithoutExtra: m.isFunded,
      shortfallFromCurrentPath: m.shortfallFromCurrent,
      firstYearPensionGross: m.firstYearPensionGross,
      portfolioCurve: m.portfolioCurve,
      annualSpendCurve: m.annualSpendCurve,
      regime: m.regime,
      recommendedConversion: m.recommendedConversion,
      runnersUp: m.runnersUp ?? [],
      surplusSpend: (m as { surplusSpend?: SurplusSpendResult }).surplusSpend,
      currentPathPortfolioCurve: (m as { currentPathPortfolioCurve?: number[] }).currentPathPortfolioCurve,
    } as TargetEngineResult;
  })();

  const isFunded = result.isFundedWithoutExtra;
  const savingsColor = isFunded ? 'var(--success)' : 'var(--warning)';
  const surplus = result.surplusSpend;
  const isRequiredPath = surplus?.kind === 'required';
  const isAffordablePath = surplus?.kind === 'affordable';
  // Below target: solid = current (short) path; green dashed = required nest egg @ target → $0
  const chartPortfolio =
    !isFunded && result.currentPathPortfolioCurve?.length
      ? result.currentPathPortfolioCurve
      : result.portfolioCurve;
  const showSurplusCard =
    !!surplus &&
    (isRequiredPath
      ? true
      : isAffordablePath
        ? surplus.totalMonthlyToday >= 1
        : surplus.extraMonthlyToday >= 1);

  const retireSpend = useMandatoryOnly
    ? plan.mandatoryRetirementSpendMonthly
    : plan.desiredRetirementSpendMonthly;
  const postYears = plan.lifeExpectancyDelta ?? 20;
  const inflation = plan.inflationRate;
  const returnRate = plan.investmentReturnRate;
  const yearsToRetirement = Math.max(0, plan.heInput.retirementAge - plan.heInput.age);
  const fmtNest = result.nestEggAtRetirement;
  const fmtMonthly = result.monthlyPersonalSavingsNeeded;
  const fmtShort = result.shortfallFromCurrentPath;
  const firstPen = result.firstYearPensionGross;
  const endAge = plan.heInput.retirementAge + postYears;

  return (
    <div className="card" style={{ padding: '24px' }}>
      <div className="flex-between" style={{ marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h3 style={{ textTransform: 'uppercase', letterSpacing: '-0.3px', margin: 0 }}>
            MINIMUM SAVINGS REQUIRED
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '3px 0 0 0' }}>
            Exact nest egg for ~{postYears}y retirement (to ~{endAge}) · bucket-aware · RRIF-aware
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', fontSize: '12px', flexWrap: 'wrap' }}>
          <div className="flex-row">
            <span style={{ width: '10px', height: '10px', background: 'var(--primary)', borderRadius: '2px' }} />
            <span>{isRequiredPath ? 'Current path @ target spend' : 'Portfolio @ target spend'}</span>
          </div>
          <div className="flex-row">
            <span style={{ width: '10px', height: '3px', background: 'var(--danger)', display: 'inline-block' }} />
            <span>Target spend</span>
          </div>
          {surplus && (
            <>
              <div className="flex-row">
                <span style={{ width: '14px', height: '0', borderTop: `2px dashed ${SURPLUS_PORT_COLOR}`, display: 'inline-block' }} />
                <span>
                  {isRequiredPath
                    ? `Required nest egg → $0 @ ${endAge}`
                    : `Portfolio → $0 @ ${endAge}`}
                </span>
              </div>
              {surplus.kind === 'surplus' && (
                <div className="flex-row">
                  <span style={{ width: '10px', height: '3px', background: EXTRA_SPEND_COLOR, display: 'inline-block' }} />
                  <span>Extra pull capacity</span>
                </div>
              )}
              {isAffordablePath && (
                <div className="flex-row">
                  <span style={{ width: '10px', height: '3px', background: EXTRA_SPEND_COLOR, display: 'inline-block' }} />
                  <span>Affordable spend (→ $0)</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 340px) minmax(0, 1fr)', gap: '24px', alignItems: 'start' }}>
        <div>
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            padding: '16px',
            marginBottom: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
              Dashboard Assumptions
            </div>

            <div className="flex-between">
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Retire Monthly Spend</span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {fmt(retireSpend)}/mo
              </span>
            </div>

            <div className="flex-between">
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Retirement Horizon</span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {postYears} yrs <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>({yearsToRetirement} yrs to go)</span>
              </span>
            </div>

            <div className="flex-between">
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Target Inflation Rate</span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {pct(inflation)}
              </span>
            </div>

            <div className="flex-between">
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Portfolio Return Rate</span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {pct(returnRate)}
              </span>
            </div>

            <div className="flex-between">
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Gov. Pensions (First-Yr)</span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {fmt(firstPen / 12)}/mo
              </span>
            </div>

            <div className="flex-between" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Current Savings</span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {fmt(plan.currentSavings)}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{
              padding: '14px 16px',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(168,85,247,0.10) 100%)',
              borderRadius: '12px',
              border: '1px solid rgba(99,102,241,0.3)',
            }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Target size={11} /> {isFunded ? 'Nest Egg at Retirement' : 'Required Nest Egg at Retirement'}
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.8px', color: 'var(--primary)' }}>
                {fmt(fmtNest)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {isFunded
                  ? `Projected on current path · ~${postYears}y · regime ${result.regime}`
                  : `Min balance to fund target · ~${postYears}y · regime ${result.regime}`}
                {result.recommendedConversion && (
                  <> · convert He@{result.recommendedConversion.conversionAgeHe}/She@{result.recommendedConversion.conversionAgeShe}</>
                )}
              </div>
            </div>

            <div style={{
              padding: '14px 16px',
              background: isFunded
                ? 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(5,150,105,0.08) 100%)'
                : 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(217,119,6,0.08) 100%)',
              borderRadius: '12px',
              border: `1px solid ${isFunded ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
            }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <TrendingDown size={11} style={{ transform: 'rotate(180deg)' }} /> Min. Monthly Savings Needed
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.8px', color: savingsColor }}>
                {isFunded ? 'Already Funded' : `${fmt(fmtMonthly)}/mo`}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {isFunded
                  ? `Current path covers the horizon (${fmt(plan.currentSavings)} on hand today)`
                  : `Shortfall: ${fmt(fmtShort)} · ${yearsToRetirement} yrs · today's $, rises with inflation`}
              </div>
            </div>

            {showSurplusCard && surplus && (
              <div style={{
                padding: '14px 16px',
                background: isRequiredPath || isAffordablePath
                  ? 'linear-gradient(135deg, rgba(245,158,11,0.14) 0%, rgba(239,68,68,0.08) 100%)'
                  : 'linear-gradient(135deg, rgba(16,185,129,0.14) 0%, rgba(245,158,11,0.10) 100%)',
                borderRadius: '12px',
                border: isRequiredPath || isAffordablePath
                  ? '1px solid rgba(245,158,11,0.4)'
                  : '1px solid rgba(16,185,129,0.35)',
              }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Sparkles size={11} />
                  {isRequiredPath
                    ? `Required Path (→ $0 @ ${endAge})`
                    : isAffordablePath
                      ? `Affordable Spend (→ $0 @ ${endAge})`
                      : `Extra Spend Capacity (→ $0 @ ${endAge})`}
                </div>
                <div style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.8px', color: isRequiredPath || isAffordablePath ? 'var(--warning)' : SURPLUS_PORT_COLOR }}>
                  {isRequiredPath
                    ? fmt(fmtNest)
                    : isAffordablePath
                      ? `${fmt(surplus.totalMonthlyToday)}/mo`
                      : `+${fmt(surplus.extraMonthlyToday)}/mo`}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {isRequiredPath
                    ? `Nest egg at retirement to fund ${fmt(retireSpend)}/mo to ~${endAge} · green dashed vs solid current path · need ${fmt(fmtMonthly)}/mo extra today`
                    : isAffordablePath
                      ? `Max funded lifestyle on this nest egg · ${fmt(Math.abs(surplus.extraMonthlyToday))}/mo below target ${fmt(retireSpend)} · green dashed = that path to ~$0`
                      : `Today's $ on top of ${fmt(retireSpend)}/mo · total ${fmt(surplus.totalMonthlyToday)}/mo · rises with inflation · amber line = that extra each year`}
                </div>
              </div>
            )}

            <div style={{
              display: 'flex', gap: '5px', alignItems: 'flex-start', padding: '10px 12px',
              background: 'rgba(255,255,255,0.02)', borderRadius: '8px',
              border: '1px solid var(--border-color)', fontSize: '12px', color: 'var(--text-muted)',
              lineHeight: '1.5',
            }}>
              <Info size={11} style={{ marginTop: '1px', flexShrink: 0, color: 'var(--info)' }} />
              <span>
                Feasibility = spend met every year + RRIF minima honored (terminal ≥ 0).
                {surplus
                  ? isRequiredPath
                    ? ' Below target: solid = current path at target spend (runs out); green dashed = required nest egg at the same target spend → ~$0.'
                    : isAffordablePath
                      ? ' UNDER: green dashed line is max spend that still reaches ~$0 at the horizon (compare to red target spend).'
                      : ' Green dashed line: same nest egg spent harder until ~$0 at horizon.'
                  : ' Min $ solved under conversion @71; conversion ages above are the recommended grid winner.'}
                {' '}Not financial advice.
              </span>
            </div>
          </div>
        </div>

        <div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
            Portfolio Depletion Curve — {postYears}-Year Horizon
            {surplus
              ? isRequiredPath
                ? ' · current vs required → $0'
                : isAffordablePath
                  ? ' · with affordable → $0 path'
                  : ' · with surplus burn-down'
              : ''}
          </div>
          <div style={{ width: '100%' }}>
            <DepletionChart
              portfolioCurve={chartPortfolio}
              annualSpendCurve={result.annualSpendCurve}
              nestEgg={Math.max(fmtNest, chartPortfolio[0] ?? 0)}
              surplus={surplus}
            />
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: showSurplusCard ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)',
            gap: '8px',
            marginTop: '12px',
          }}>
            {[
              {
                label: 'First-Yr Spend',
                value: fmt((result.annualSpendCurve[0] || 0) / 12, true) + '/mo',
                sub: 'Target at retirement',
                color: 'var(--danger)',
              },
              {
                label: 'Last-Yr Spend',
                value: fmt((result.annualSpendCurve[result.annualSpendCurve.length - 1] || 0) / 12, true) + '/mo',
                sub: `Target at +${postYears}y`,
                color: 'var(--warning)',
              },
              ...(showSurplusCard && surplus
                ? [{
                    label: isRequiredPath ? 'Required nest egg' : isAffordablePath ? 'Affordable' : 'First-Yr Extra',
                    value: isRequiredPath
                      ? fmt(fmtNest, true)
                      : isAffordablePath
                        ? fmt(surplus.totalMonthlyToday, true) + '/mo'
                        : '+' + fmt((surplus.annualExtraCurve[0] || 0) / 12, true) + '/mo',
                    sub: isRequiredPath
                      ? `vs current shortfall ${fmt(fmtShort, true)}`
                      : isAffordablePath
                        ? `${fmt(Math.abs(surplus.extraMonthlyToday), true)}/mo below target`
                        : `Burn-down to ~$0 @ ${endAge}`,
                    color: EXTRA_SPEND_COLOR,
                  }]
                : []),
              {
                label: 'Real Return',
                value: pct((1 + returnRate) / (1 + inflation) - 1),
                sub: 'Return minus inflation',
                color: 'var(--info)',
              },
            ].map(card => (
              <div key={card.label} style={{
                padding: '10px 12px',
                background: 'rgba(255,255,255,0.025)',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
              }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '3px' }}>
                  {card.label}
                </div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: card.color }}>
                  {card.value}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '1px' }}>
                  {card.sub}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MinSavingsPanel;
