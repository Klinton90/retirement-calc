import React from 'react';
import type { TargetEngineResult } from '../../../../utils/targetEngine';
import { Target, Info, Sparkles, AlertCircle, ShieldAlert, Award } from 'lucide-react';
import { type RetirementPlan } from '../../../../types/calculator';
import {
  monthlyFromWealthGap,
  resolveRetirementHorizon,
} from '../../../../utils/retirementHorizon';
import type { EarliestJointRetirementResult } from '../../../../utils/retirementShortfall';

interface MinSavingsPanelProps {
  plan: RetirementPlan;
  activeScenario: 'realistic' | 'mandatory';
  planTargets: TargetEngineResult;
  yearsSecure: number;
  /**
   * True when the current-path projection funds every retired year through the
   * horizon (no cash gap, including the final year). Distinguishes "funded to
   * horizon" from "first gap lands exactly on the final horizon year" — the
   * latter must read as depleted, matching the Retirement Monthly Deficit card.
   */
  lastsFullHorizon: boolean;
  currentSavingsMonthly: number;
  /** Extra $/mo so Readiness (viewer path) lasts full horizon. */
  readinessExtraMonthly: number;
  /** False if even a very high Extra could not green Readiness. */
  readinessExtraReached: boolean;
  /** Retirement nest egg produced by the READINESS Extra viewer path. */
  readinessNestEgg: number | null;
  /** Joint earliest stop-work ages (active scenario, fixed terminal). */
  earliestRetirement?: EarliestJointRetirementResult;
  /** When false, only the Plan Basis strip is rendered (for placement above Plot 1). */
  showOutlook?: boolean;
  /** When false, only Retirement Outlook cards are rendered. */
  showPlanBasis?: boolean;
}

const fmt = (val: number, compact = false) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
    notation: compact ? 'compact' : 'standard',
  }).format(val);

/** Compact $ with one decimal so TFSA/mix/RRSP band ends don't all collapse to "$3M". */
const fmtBandCompact = (val: number) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    notation: 'compact',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);

const pct = (val: number) => `${(val * 100).toFixed(1)}%`;

const SURPLUS_PORT_COLOR = '#10b981';
const TFSA_COLOR = '#14b8a6';
const RRSP_COLOR = '#6366f1';
const NONREG_COLOR = '#94a3b8';

function NestEggBucketBreakdown({
  tfsa,
  rrsp,
  nonReg,
}: {
  tfsa: number;
  rrsp: number;
  nonReg: number;
}) {
  const total = tfsa + rrsp + nonReg;
  if (total < 1) return null;
  const rows = [
    { label: 'TFSA', value: tfsa, color: TFSA_COLOR, note: 'tax-free' },
    { label: 'RRSP', value: rrsp, color: RRSP_COLOR, note: 'pre-tax' },
    { label: 'Non-reg', value: nonReg, color: NONREG_COLOR, note: 'taxable' },
  ];
  return (
    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
        {rows.map(r =>
          r.value > 0 ? (
            <div
              key={r.label}
              title={`${r.label}: ${fmt(r.value)}`}
              style={{ width: `${(r.value / total) * 100}%`, background: r.color }}
            />
          ) : null
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
        {rows.map(r => (
          <div key={r.label} style={{ minWidth: 0 }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: 6, height: 6, borderRadius: 1, background: r.color, flexShrink: 0 }} />
              {r.label}
            </div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>
              {fmt(r.value, true)}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              {r.note}
              {total > 0 ? ` · ${((r.value / total) * 100).toFixed(0)}%` : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const MinSavingsPanel: React.FC<MinSavingsPanelProps> = ({
  plan,
  activeScenario,
  planTargets: result,
  yearsSecure,
  lastsFullHorizon,
  currentSavingsMonthly,
  readinessExtraMonthly,
  readinessExtraReached,
  readinessNestEgg,
  earliestRetirement,
  showOutlook = true,
  showPlanBasis = true,
}) => {
  const useMandatoryOnly = activeScenario === 'mandatory';
  const isFunded = result.isFundedWithoutExtra;
  const fundingSolveReached = result.fundingSolveReached ?? true;
  const surplus = result.surplusSpend;
  const isAffordablePath = surplus?.kind === 'affordable';
  // Gap when Plot 1 / Readiness needs Extra, or backsolve still short (diagnostics).
  const showGapCard =
    !lastsFullHorizon ||
    readinessExtraMonthly > 0.5 ||
    !readinessExtraReached ||
    !isFunded;

  const retireSpend = useMandatoryOnly
    ? plan.mandatoryRetirementSpendMonthly
    : plan.desiredRetirementSpendMonthly;
  const horizon = resolveRetirementHorizon(plan);
  const postYears = horizon.retirementYears;
  const inflation = plan.inflationRate;
  const returnRate = plan.investmentReturnRate;
  const yearsToRetirement = horizon.yearsToRetirement;
  const fmtNest = result.projectedNestEggAtRetirement;
  const solvedNest = result.nestEggAtRetirement;
  const fmtMonthly = result.monthlyPersonalSavingsNeeded;
  const fmtShort = result.shortfallFromCurrentPath;
  const firstPen = result.firstYearPensionGross;
  const endAge = horizon.terminalAgeHe;
  const buckets = result.projectedBucketsAtRetirement;
  const nestTfsa = (buckets?.tfsaHe ?? 0) + (buckets?.tfsaShe ?? 0);
  const nestRrsp = (buckets?.rrspHe ?? 0) + (buckets?.rrspShe ?? 0);
  const nestNonReg = buckets?.nonReg ?? 0;

  const basisItems = [
    { label: 'Retire spend', value: `${fmt(retireSpend)}/mo` },
    { label: 'Horizon', value: `${postYears} yrs · ${yearsToRetirement} to go` },
    { label: 'Current savings', value: fmt(plan.currentSavings) },
    { label: 'Inflation', value: pct(inflation) },
    { label: 'Salary growth', value: pct(plan.salaryGrowthRate ?? 0.01) },
    { label: 'Portfolio return', value: pct(returnRate) },
    {
      label: 'Real return',
      value: pct((1 + returnRate) / (1 + inflation) - 1),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {showOutlook && (
        <div>
          <div style={{ marginBottom: '12px' }}>
            <h3 style={{ textTransform: 'uppercase', letterSpacing: '-0.3px', margin: 0, fontSize: '14px' }}>
              Retirement Outlook
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '3px 0 0 0' }}>
              Nest egg for ~{postYears}y retirement (to ~{endAge}) · bucket-aware · RRIF-aware
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '12px',
            }}
          >
            <div
              style={{
                padding: '14px 16px',
                background:
                  lastsFullHorizon
                    ? 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(5,150,105,0.08) 100%)'
                    : 'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(217,119,6,0.08) 100%)',
                borderRadius: '12px',
                border: `1px solid ${lastsFullHorizon ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  marginBottom: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '5px',
                }}
              >
                <span>Retirement Readiness</span>
                {lastsFullHorizon ? (
                  <Award size={14} style={{ color: 'var(--success)' }} />
                ) : yearsSecure > 70 ? (
                  <AlertCircle size={14} style={{ color: 'var(--warning)' }} />
                ) : (
                  <ShieldAlert size={14} style={{ color: 'var(--danger)' }} />
                )}
              </div>
              <div
                style={{
                  fontSize: '22px',
                  fontWeight: 800,
                  letterSpacing: '-0.8px',
                  color: lastsFullHorizon ? 'var(--success)' : 'var(--danger)',
                }}
              >
                {lastsFullHorizon ? `Lasts to Age ${endAge}+` : `Depleted at Age ${yearsSecure}`}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {lastsFullHorizon
                  ? `Sustains the full ${postYears}-year horizon`
                  : yearsSecure >= endAge
                    ? 'Depletes in the final horizon year'
                    : `Runs out ${endAge - yearsSecure} year${endAge - yearsSecure === 1 ? '' : 's'} before the horizon`}
                {' · '}
                First-year pensions {fmt(firstPen / 12)}/mo gross
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                Primary “plan OK?” — Plot 1 viewer cash path (same shortfall scan as Monthly Deficit).
                Current savings {fmt(currentSavingsMonthly)}/mo. Extra Gap headline matches this path.
              </div>
            </div>

            <div
              style={{
                padding: '14px 16px',
                background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(168,85,247,0.10) 100%)',
                borderRadius: '12px',
                border: '1px solid rgba(99,102,241,0.3)',
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  marginBottom: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <Target size={11} /> Nest Egg at Retirement
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.8px', color: 'var(--primary)' }}>
                {fmt(fmtNest)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Current-path projected face value @ retire (cash-aware) — not the funding gate
                {!isFunded && solvedNest > fmtNest + 1_000
                  ? ` · ${fmt(solvedNest - fmtNest)} short of funding-solve egg`
                  : ` · ~${postYears}y · regime ${result.regime}`}
                {result.recommendedConversion && (
                  <>
                    {' '}
                    · convert He@{result.recommendedConversion.conversionAgeHe}/She@
                    {result.recommendedConversion.conversionAgeShe}
                  </>
                )}
              </div>
              <NestEggBucketBreakdown tfsa={nestTfsa} rrsp={nestRrsp} nonReg={nestNonReg} />
            </div>

            <div
              style={{
                padding: '14px 16px',
                background: 'linear-gradient(135deg, rgba(245,158,11,0.14) 0%, rgba(99,102,241,0.08) 100%)',
                borderRadius: '12px',
                border: '1px solid rgba(245,158,11,0.35)',
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  marginBottom: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <Target size={11} /> Nest Egg → $0 Band
              </div>
              {(() => {
                const band = result.nestEggToZeroBand;
                const lo = band?.allTfsa ?? 0;
                const mid = band?.yourMix ?? result.requiredNestEggToZero ?? 0;
                const hi = band?.allRrsp ?? 0;
                const span = Math.max(hi - lo, 1);
                const midPct = Math.min(100, Math.max(0, ((mid - lo) / span) * 100));
                const nestEggColumns = [
                  {
                    key: 'mix',
                    label: '→$0 MIX',
                    value: mid,
                    valueLabel: fmtBandCompact(mid),
                    note: result.recommendedConversion
                      ? `Recommended He@${result.recommendedConversion.conversionAgeHe}/She@${result.recommendedConversion.conversionAgeShe}`
                      : 'Recommended conversion ages',
                    color: 'var(--warning)',
                  },
                  {
                    key: 'backsolve',
                    label: 'BACKSOLVE',
                    value: solvedNest,
                    valueLabel: fmtBandCompact(solvedNest),
                    note: 'Funding-solve egg @71/71',
                    color: 'var(--text-muted)',
                  },
                  {
                    key: 'solveEgg',
                    label: 'SOLVE EGG',
                    value: solvedNest,
                    valueLabel: fmtBandCompact(solvedNest),
                    note: `Same solve egg · gap ${fmt(fmtShort, true)}`,
                    color: 'var(--text-muted)',
                  },
                  {
                    key: 'readiness',
                    label: 'READINESS',
                    value: readinessNestEgg ?? Number.POSITIVE_INFINITY,
                    valueLabel: readinessNestEgg === null ? 'Unreached' : fmtBandCompact(readinessNestEgg),
                    note: readinessNestEgg === null
                      ? 'Viewer could not turn green'
                      : `Viewer egg with ${fmt(readinessExtraMonthly)}/mo Extra`,
                    color: lastsFullHorizon ? 'var(--success)' : 'var(--warning)',
                  },
                ].sort((a, b) => a.value - b.value);

                return (
                  <>
                    <div style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.8px', color: 'var(--warning)' }}>
                      {fmt(mid)}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Nest eggs behind the four Extra estimates below, sorted low → high. The headline is
                      →$0 MIX; READINESS remains the primary “plan OK?” path.
                    </div>
                    <div
                      style={{
                        marginTop: '10px',
                        position: 'relative',
                        height: '8px',
                        borderRadius: '4px',
                        background: 'rgba(255,255,255,0.06)',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          top: 0,
                          bottom: 0,
                          borderRadius: '4px',
                          background: `linear-gradient(90deg, ${TFSA_COLOR} 0%, ${RRSP_COLOR} 100%)`,
                          opacity: 0.35,
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          left: `calc(${midPct}% - 5px)`,
                          top: '-3px',
                          width: '10px',
                          height: '14px',
                          borderRadius: '2px',
                          background: 'var(--warning)',
                          border: '1px solid rgba(255,255,255,0.5)',
                        }}
                      />
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px' }}>
                      Wrapper range: <span style={{ color: TFSA_COLOR }}>all TFSA {fmtBandCompact(lo)}</span>
                      {' → '}your mix {fmtBandCompact(mid)}
                      {' → '}<span style={{ color: RRSP_COLOR }}>all RRSP {fmtBandCompact(hi)}</span>
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                        gap: '6px',
                        marginTop: '10px',
                      }}
                    >
                      {nestEggColumns.map(col => (
                        <div key={col.key}>
                          <div style={{ fontSize: '10px', color: col.color, fontWeight: 600 }}>
                            {col.label}
                          </div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {col.valueLabel}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            {col.note}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                      Current-path projected egg: {fmt(fmtNest)} · each Extra column below shows the
                      monthly amount used to reach its corresponding egg/path.
                    </div>
                  </>
                );
              })()}
            </div>

            {showGapCard && (
              <div
                style={{
                  padding: '14px 16px',
                  background: readinessExtraReached
                    ? 'linear-gradient(135deg, rgba(245,158,11,0.14) 0%, rgba(239,68,68,0.08) 100%)'
                    : 'linear-gradient(135deg, rgba(239,68,68,0.14) 0%, rgba(245,158,11,0.08) 100%)',
                  borderRadius: '12px',
                  border: readinessExtraReached
                    ? '1px solid rgba(245,158,11,0.4)'
                    : '1px solid rgba(239,68,68,0.45)',
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    marginBottom: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <Sparkles size={11} />
                  {`Extra needed for ${fmt(retireSpend)}/mo lifestyle (→ $0 @ ${endAge})`}
                </div>
                {(() => {
                  const mixNeed = result.nestEggToZeroBand?.yourMix ?? result.requiredNestEggToZero ?? 0;
                  const mixGap = Math.max(0, mixNeed - fmtNest);
                  const extraMix = monthlyFromWealthGap(mixGap, yearsToRetirement, returnRate);
                  const extraSolveEgg = monthlyFromWealthGap(fmtShort, yearsToRetirement, returnRate);
                  const backsolveUnreached = !isFunded && !fundingSolveReached;
                  const readinessUnreached = !readinessExtraReached;
                  // Primary “plan OK?” Extra = Plot 1 / Readiness (not @71 backsolve).
                  const headline = readinessExtraReached
                    ? `${fmt(readinessExtraMonthly)}/mo`
                    : `>${fmt(readinessExtraMonthly)}/mo`;

                  const columns = [
                    {
                      key: 'mix',
                      label: '→$0 MIX',
                      labelColor: 'var(--text-muted)',
                      valueLabel: `${fmt(extraMix)}/mo`,
                      note: `PMT of band−projected · gap ${fmt(mixGap, true)}`,
                      sort: extraMix,
                    },
                    {
                      key: 'backsolve',
                      label: 'BACKSOLVE',
                      labelColor: 'var(--text-muted)',
                      valueLabel: backsolveUnreached
                        ? `>${fmt(fmtMonthly)}/mo`
                        : `${fmt(fmtMonthly)}/mo`,
                      note: `Design Extra @71/71 · solve egg ${fmt(solvedNest, true)}`,
                      sort: backsolveUnreached ? Number.POSITIVE_INFINITY : fmtMonthly,
                    },
                    {
                      key: 'solveEgg',
                      label: 'SOLVE EGG',
                      labelColor: 'var(--text-muted)',
                      valueLabel: `${fmt(extraSolveEgg)}/mo`,
                      note: `PMT of solve−projected · gap ${fmt(fmtShort, true)}`,
                      sort: extraSolveEgg,
                    },
                    {
                      key: 'readiness',
                      label: 'READINESS',
                      labelColor: lastsFullHorizon ? 'var(--success)' : 'var(--warning)',
                      valueLabel: readinessUnreached
                        ? `>${fmt(readinessExtraMonthly)}/mo`
                        : `${fmt(readinessExtraMonthly)}/mo`,
                      note: lastsFullHorizon
                        ? 'Primary · already green on Plot 1'
                        : 'Primary · Extra so Plot 1 / Readiness turns green',
                      sort: readinessUnreached
                        ? Number.POSITIVE_INFINITY
                        : readinessExtraMonthly,
                    },
                  ].sort((a, b) => a.sort - b.sort);

                  return (
                    <>
                      <div
                        style={{
                          fontSize: '22px',
                          fontWeight: 800,
                          letterSpacing: '-0.8px',
                          color: lastsFullHorizon ? 'var(--success)' : 'var(--warning)',
                        }}
                      >
                        {headline}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {readinessUnreached
                          ? 'Could not green Retirement Readiness (Plot 1 viewer) even at very high Extra — cash constraints may block deploy. Other columns are diagnostic (sorted low → high).'
                          : lastsFullHorizon
                            ? `Headline = $0 — Plot 1 / Readiness already lasts through ~${endAge}. BACKSOLVE @71/71 is a separate design Extra. Columns sorted low → high.`
                            : `Headline = Extra so Plot 1 / Retirement Readiness turns green (viewer path, recommended conversion). Columns sorted low → high.`}
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                          gap: '6px',
                          marginTop: '10px',
                        }}
                      >
                        {columns.map(col => (
                          <div key={col.key}>
                            <div style={{ fontSize: '10px', color: col.labelColor, fontWeight: 600 }}>
                              {col.label}
                            </div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {col.valueLabel}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{col.note}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {!showGapCard && surplus && (isAffordablePath || surplus.kind === 'surplus') && (
              <div
                style={{
                  padding: '14px 16px',
                  background:
                    isAffordablePath
                      ? 'linear-gradient(135deg, rgba(245,158,11,0.14) 0%, rgba(239,68,68,0.08) 100%)'
                      : 'linear-gradient(135deg, rgba(16,185,129,0.14) 0%, rgba(245,158,11,0.10) 100%)',
                  borderRadius: '12px',
                  border: isAffordablePath
                    ? '1px solid rgba(245,158,11,0.4)'
                    : '1px solid rgba(16,185,129,0.35)',
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    marginBottom: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <Sparkles size={11} />
                  {isAffordablePath
                    ? `Affordable Spend (→ $0 @ ${endAge})`
                    : `Extra Spend Capacity (→ $0 @ ${endAge})`}
                </div>
                <div
                  style={{
                    fontSize: '22px',
                    fontWeight: 800,
                    letterSpacing: '-0.8px',
                    color: isAffordablePath ? 'var(--warning)' : SURPLUS_PORT_COLOR,
                  }}
                >
                  {isAffordablePath
                    ? `${fmt(surplus.totalMonthlyToday)}/mo`
                    : `+${fmt(surplus.extraMonthlyToday)}/mo`}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {isAffordablePath
                    ? `Max funded lifestyle on this nest egg · ${fmt(Math.abs(surplus.extraMonthlyToday))}/mo below target ${fmt(retireSpend)}`
                    : `Today's $ on top of ${fmt(retireSpend)}/mo · total ${fmt(surplus.totalMonthlyToday)}/mo · rises with inflation`}
                </div>
                {!isAffordablePath &&
                  surplus.extraMonthlyToday > 0 &&
                  earliestRetirement &&
                  earliestRetirement.lastsAtEntered &&
                  earliestRetirement.yearsEarlier > 0 && (
                    <div
                      style={{
                        marginTop: '10px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--info)',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        background: 'rgba(6,182,212,0.10)',
                        border: '1px solid rgba(6,182,212,0.25)',
                      }}
                    >
                      Or retire ~{earliestRetirement.yearsEarlier}y earlier at current spend
                      {earliestRetirement.heRetireAge === earliestRetirement.sheRetireAge
                        ? ` (Age ${earliestRetirement.heRetireAge})`
                        : ` (He ${earliestRetirement.heRetireAge} · She ${earliestRetirement.sheRetireAge})`}
                    </div>
                  )}
              </div>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              gap: '5px',
              alignItems: 'flex-start',
              padding: '10px 12px',
              marginTop: '12px',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              fontSize: '12px',
              color: 'var(--text-muted)',
              lineHeight: '1.5',
            }}
          >
            <Info size={11} style={{ marginTop: '1px', flexShrink: 0, color: 'var(--info)' }} />
            <span>
              Primary “plan OK?” = Plot 1 / Retirement Readiness (viewer cash path). Extra card
              headline = READINESS Extra (`solveExtraForReadiness`). BACKSOLVE @71/71 is design-only
              (two-step funding solve); →$0 MIX / SOLVE EGG are rough wealth-gap → $/mo. Nest egg →$0
              band uses recommended conversion ages after the grid re-rank. Not financial advice.
            </span>
          </div>
        </div>
      )}

      {showPlanBasis && (
        <div
          className="card"
          style={{
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Plan Basis
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '10px',
            }}
          >
            {basisItems.map(item => (
              <div
                key={item.label}
                style={{
                  padding: '8px 10px',
                  background: 'rgba(255,255,255,0.025)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    marginBottom: '2px',
                  }}
                >
                  {item.label}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MinSavingsPanel;
