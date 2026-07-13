import React from 'react';
import { ShieldAlert, Sparkles, CheckCircle2, TrendingUp, Landmark } from 'lucide-react';
import { type PersonInput, ContributionType } from '../../../../types/calculator';
import { calculatePersonTax } from '../../../../utils/taxCalc';

interface SpousalRrspAdvisorProps {
  heInput: PersonInput;
  sheInput: PersonInput;
  optimizeSpousalRrsp: boolean;
  depositEsppToRrsp: boolean;
  includeExtraIncome: boolean;
  targetTaxAdvantageThreshold: number;
  onUpdatePlan: (updates: { optimizeSpousalRrsp: boolean; spousalRrspMonthly: number; targetTaxAdvantageThreshold?: number }) => void;
  /** When true, omit outer card chrome (for accordion embed). */
  embedded?: boolean;
}

export const SpousalRrspAdvisor: React.FC<SpousalRrspAdvisorProps> = ({
  heInput: rawHeInput,
  sheInput: rawSheInput,
  optimizeSpousalRrsp,
  depositEsppToRrsp,
  includeExtraIncome,
  targetTaxAdvantageThreshold,
  onUpdatePlan,
  embedded = false,
}) => {
  const targetThreshold = targetTaxAdvantageThreshold;

  // Apply active extra income scenario exclusion
  const heInput = React.useMemo(() => ({
    ...rawHeInput,
    extraIncomeMonthly: includeExtraIncome ? rawHeInput.extraIncomeMonthly : 0,
  }), [rawHeInput, includeExtraIncome]);

  const sheInput = React.useMemo(() => ({
    ...rawSheInput,
    extraIncomeMonthly: includeExtraIncome ? rawSheInput.extraIncomeMonthly : 0,
  }), [rawSheInput, includeExtraIncome]);

  // Generate exact unique marginal tax rates for Ontario/Federal brackets dynamically
  const possibleRates = React.useMemo(() => {
    const uniqueRates = new Set<string>();
    // Sample incomes from $30k to $280k to find all standard bracket rates
    for (let inc = 30000; inc <= 280000; inc += 5000) {
      const dummyPerson = {
        ...heInput,
        salary: inc,
        rrspEmployeeValue: 0,
        otherSavingsRrspMonthly: 0,
        extraIncomeMonthly: 0,
      };
      const r1 = calculatePersonTax(dummyPerson, undefined, false);
      const delta = 200;
      const dummyPersonDelta = { ...dummyPerson, salary: inc + delta };
      const r2 = calculatePersonTax(dummyPersonDelta, undefined, false);
      const rate = Math.min(0.60, Math.max(0, (r2.totalIncomeTax - r1.totalIncomeTax) / delta));
      // Store as percentage string rounded to 1 decimal place (e.g. "43.4")
      const pctVal = (rate * 100).toFixed(1);
      uniqueRates.add(pctVal);
    }
    // Convert back to numbers, filter out tiny rates (under 19%), sort descending
    return Array.from(uniqueRates)
      .map(r => parseFloat(r) / 100)
      .filter(r => r >= 0.19)
      .sort((a, b) => b - a);
  }, [heInput]);

  const getRateLabel = (rate: number) => {
    const pctStr = (rate * 100).toFixed(1);
    if (pctStr === '43.4') return `${pctStr}% (High Earner Bracket - Recommended)`;
    if (pctStr === '41.2') return `${pctStr}% (Upper Middle Bracket)`;
    if (pctStr === '37.9') return `${pctStr}% (Middle Bracket)`;
    if (pctStr === '31.5') return `${pctStr}% (Lower Middle Bracket)`;
    if (pctStr === '20.1') return `${pctStr}% (Low Bracket - TFSA Preferred)`;
    return `${pctStr}%`;
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const pct = (val: number) => `${(val * 100).toFixed(1)}%`;

  // Helper to calculate exact marginal tax rate at a given RRSP contribution level
  const getMarginalRateAtRRSP = (input: PersonInput, rrspDeductionAnnual: number) => {
    const pInput = {
      ...input,
      rrspEmployeeType: ContributionType.FLAT,
      rrspEmployeeValue: 0,
      rrspEmployerRate: 0,
      esppEmployeeRate: 0,
      esppEmployerRate: 0,
      otherSavingsRrspMonthly: rrspDeductionAnnual / 12,
    };
    const r1 = calculatePersonTax(pInput, undefined, false);
    
    // Increment salary slightly to evaluate marginal tax drag
    const delta = 500;
    const pInputDelta = { ...pInput, salary: input.salary + delta };
    const r2 = calculatePersonTax(pInputDelta, undefined, false);
    
    return Math.min(1, Math.max(0, (r2.totalIncomeTax - r1.totalIncomeTax) / delta));
  };

  // 1. Calculate He's RRSP limit and room (incorporating carry-forward)
  const maxRrspLimit = 33720;
  const heCarryForwardRoom = heInput.carryForwardRrspRoom ?? 0;
  const heRrspRoomMax = Math.min(maxRrspLimit, heInput.salary * 0.18) + heCarryForwardRoom;
  
  // He's own RRSP contributions (Employee + ESPP-to-RRSP)
  const heRrspDeductionBase = heInput.rrspEmployeeType === ContributionType.PERCENTAGE 
    ? (heInput.salary * heInput.rrspEmployeeValue) / 100 
    : heInput.rrspEmployeeValue * 12;
  
  const esppEmployeeContribution = (heInput.salary * heInput.esppEmployeeRate) / 100;
  const esppEmployerContribution = (heInput.salary * heInput.esppEmployerRate) / 100;
  
  let heEsppToRrspDeduction = 0;
  if (depositEsppToRrsp) {
    const combinedRrsp = heRrspDeductionBase + esppEmployeeContribution + esppEmployerContribution;
    const cappedCombined = Math.min(maxRrspLimit, combinedRrsp);
    heEsppToRrspDeduction = cappedCombined - heRrspDeductionBase;
  }
  
  const heOwnRrspDeductions = heRrspDeductionBase + heEsppToRrspDeduction;
  const heRemainingRoom = Math.max(0, heRrspRoomMax - heOwnRrspDeductions);
  const heRemainingRoomMonthly = heRemainingRoom / 12;

  // 2. She's extra savings target (She's otherSavingsRrspMonthly)
  const sheExtraRrspMonthly = sheInput.otherSavingsRrspMonthly || 0;
  const sheExtraRrspAnnual = sheExtraRrspMonthly * 12;

  const isOverContributionRisk = sheExtraRrspMonthly > heRemainingRoomMonthly;
  const optimizedSpousalMonthly = Math.min(sheExtraRrspMonthly, heRemainingRoomMonthly);
  const optimizedSheOwnMonthly = Math.max(0, sheExtraRrspMonthly - optimizedSpousalMonthly);

  // 3. Marginal rate audit
  const heGrossMarginal = getMarginalRateAtRRSP(heInput, 0);
  const heTotalRrspDeductions = heOwnRrspDeductions + (optimizeSpousalRrsp ? optimizedSpousalMonthly * 12 : 0);
  const heAfterRrspMarginal = getMarginalRateAtRRSP(heInput, heTotalRrspDeductions);

  const sheGrossMarginal = getMarginalRateAtRRSP(sheInput, 0);
  
  const sheRrspDeductionBase = sheInput.rrspEmployeeType === ContributionType.PERCENTAGE 
    ? (sheInput.salary * sheInput.rrspEmployeeValue) / 100 
    : sheInput.rrspEmployeeValue * 12;
  const sheOwnExtraRrsp = optimizeSpousalRrsp ? (sheExtraRrspAnnual - optimizedSpousalMonthly * 12) : sheExtraRrspAnnual;
  const sheTotalRrspDeductions = sheRrspDeductionBase + sheOwnExtraRrsp;
  const sheAfterRrspMarginal = getMarginalRateAtRRSP(sheInput, sheTotalRrspDeductions);

  // Average tax rate calculations
  const heGrossIncome = heInput.salary + (includeExtraIncome ? heInput.extraIncomeMonthly * 12 : 0);
  const heTaxBaseResult = calculatePersonTax({ ...heInput, rrspEmployeeValue: 0, rrspEmployerRate: 0 }, undefined, false, 0, true);
  const heTaxAfterResult = calculatePersonTax({ ...heInput, rrspEmployeeValue: 0, rrspEmployerRate: 0 }, undefined, false, heTotalRrspDeductions / 12, true);
  const heGovPaidBefore = heTaxBaseResult.totalIncomeTax + heTaxBaseResult.cppTotalContribution + heTaxBaseResult.eiPremium;
  const heGovPaidAfter = heTaxAfterResult.totalIncomeTax + heTaxAfterResult.cppTotalContribution + heTaxAfterResult.eiPremium;
  const heAverageTaxBefore = heGrossIncome > 0 ? heGovPaidBefore / heGrossIncome : 0;
  const heAverageTaxAfter = heGrossIncome > 0 ? heGovPaidAfter / heGrossIncome : 0;

  const sheGrossIncome = sheInput.salary + (includeExtraIncome ? sheInput.extraIncomeMonthly * 12 : 0);
  const sheTaxBaseResult = calculatePersonTax({ ...sheInput, rrspEmployeeValue: 0, rrspEmployerRate: 0 }, undefined, false, 0, true);
  const sheTaxAfterResult = calculatePersonTax({ ...sheInput, rrspEmployeeValue: 0, rrspEmployerRate: 0 }, undefined, false, sheTotalRrspDeductions / 12, true);
  const sheGovPaidBefore = sheTaxBaseResult.totalIncomeTax + sheTaxBaseResult.cppTotalContribution + sheTaxBaseResult.eiPremium;
  const sheGovPaidAfter = sheTaxAfterResult.totalIncomeTax + sheTaxAfterResult.cppTotalContribution + sheTaxAfterResult.eiPremium;
  const sheAverageTaxBefore = sheGrossIncome > 0 ? sheGovPaidBefore / sheGrossIncome : 0;
  const sheAverageTaxAfter = sheGrossIncome > 0 ? sheGovPaidAfter / sheGrossIncome : 0;

  // Find He's optimal stop point (where marginal tax rate drops below threshold)
  let heOptimalRrspAnnual = 0;
  let hePassedOptimal = false;
  for (let contrib = 0; contrib <= heRrspRoomMax; contrib += 1000) {
    const rate = getMarginalRateAtRRSP(heInput, contrib);
    if (rate >= targetThreshold - 0.005) {
      heOptimalRrspAnnual = contrib;
    } else {
      hePassedOptimal = true;
      break;
    }
  }

  // Find She's optimal stop point
  let sheOptimalRrspAnnual = 0;
  let shePassedOptimal = false;
  for (let contrib = 0; contrib <= 33720 + (sheInput.carryForwardRrspRoom ?? 0); contrib += 1000) {
    const rate = getMarginalRateAtRRSP(sheInput, contrib);
    if (rate >= targetThreshold - 0.005) {
      sheOptimalRrspAnnual = contrib;
    } else {
      shePassedOptimal = true;
      break;
    }
  }

  // 4. Spousal Optimization Analysis
  const showAdvisor = sheExtraRrspMonthly > 0;

  const enableToggle = (
    <label
      style={{
        fontSize: '12px',
        color: 'var(--text-secondary)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        checked={optimizeSpousalRrsp}
        onChange={(e) => {
          onUpdatePlan({
            optimizeSpousalRrsp: e.target.checked,
            spousalRrspMonthly: e.target.checked ? sheExtraRrspMonthly : 0,
          });
        }}
        style={{ width: '15px', height: '15px', accentColor: 'var(--accent)' }}
      />
      {embedded ? 'Enable split' : 'Enable Spousal RRSP Split'}
    </label>
  );

  if (!showAdvisor) {
    if (!embedded) return null;
    return (
      <div style={{ padding: '4px 0' }}>
        <div
          className="flex-row"
          style={{ gap: '8px', marginBottom: 12, justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5, flex: 1, minWidth: 0 }}>
            No discretionary RRSP from She to redirect. Set She&apos;s &quot;Other RRSP savings&quot; above to use this tool.
          </p>
          {enableToggle}
        </div>
      </div>
    );
  }

  // Tax Rate estimates
  const heMarginalRate = heAfterRrspMarginal;
  const sheMarginalRate = sheAfterRrspMarginal;

  const standardTaxRefund = sheExtraRrspAnnual * sheMarginalRate;
  const optimizedTaxRefund = (optimizedSpousalMonthly * 12 * heMarginalRate) + (optimizedSheOwnMonthly * 12 * sheMarginalRate);
  const annualTaxSavings = Math.max(0, optimizedTaxRefund - standardTaxRefund);

  return (
    <div
      className={embedded ? undefined : 'card'}
      style={
        embedded
          ? { padding: '4px 0' }
          : { padding: '20px', marginBottom: '24px', borderLeft: '4px solid var(--accent)' }
      }
    >
      {!embedded && (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={20} style={{ color: 'var(--accent)' }} />
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Spousal RRSP Optimizer & Tax Advisor
          </h3>
        </div>
        {enableToggle}
      </div>
      )}
      {embedded && (
        <div className="flex-row" style={{ gap: '8px', marginBottom: '12px', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4, flex: 1, minWidth: 0 }}>
            Working-years tax tool: He claims the deduction; She owns the RRSP. Does not replace target-engine cards.
          </p>
          {enableToggle}
        </div>
      )}

      {!embedded && (
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '-10px 0 16px 0', lineHeight: '1.4' }}>
        <strong>What this does:</strong> Instead of She contributing to She's own RRSP, He contributes that amount (up to He's available room) to a Spousal RRSP for She. He gets the tax deduction at He's higher tax bracket (approx. 43.4%), while She owns the funds and withdraws them in retirement at She's lower tax bracket.
      </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', fontSize: '13px' }}>
        {/* Left Column: Room Analysis */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
            CONTRIBUTION ROOM AUDIT
          </div>
          <div className="flex-between">
            <span style={{ color: 'var(--text-muted)' }}>He's Salary Room (18% Capped):</span>
            <span>{formatCurrency(Math.min(maxRrspLimit, heInput.salary * 0.18))}/yr</span>
          </div>
          <div className="flex-between">
            <span style={{ color: 'var(--text-muted)' }}>He's Carry-Forward Room:</span>
            <span>+{formatCurrency(heCarryForwardRoom)}</span>
          </div>
          <div className="flex-between">
            <span style={{ color: 'var(--text-muted)' }}>He's Deductible Savings (incl. ESPP):</span>
            <span>-{formatCurrency(heOwnRrspDeductions)}/yr</span>
          </div>
          <div className="flex-between" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            <span>He's Remaining Room:</span>
            <span style={{ color: heRemainingRoom > 0 ? 'var(--success)' : 'var(--warning)' }}>
              {formatCurrency(heRemainingRoom)}/yr ({formatCurrency(heRemainingRoomMonthly)}/mo)
            </span>
          </div>
          <div className="flex-between">
            <span style={{ color: 'var(--text-muted)' }}>She's Extra RRSP Savings Target:</span>
            <span style={{ fontWeight: 600 }}>{formatCurrency(sheExtraRrspAnnual)}/yr ({formatCurrency(sheExtraRrspMonthly)}/mo)</span>
          </div>

          {/* ESPP-to-RRSP Note */}
          <div style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid var(--info)', borderRadius: '6px', color: 'var(--info)', fontSize: '12.5px', lineHeight: '1.4' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.3px' }}>
              <Landmark size={14} />
              <span>ESPP-to-RRSP Transfer Benefit</span>
            </div>
            {depositEsppToRrsp ? (
              <span>
                He's ESPP-to-RRSP transfer shelters <strong>{formatCurrency(esppEmployeeContribution + esppEmployerContribution)}/yr</strong> of income, saving an estimated <strong>{formatCurrency(heEsppToRrspDeduction * heMarginalRate)}/yr</strong> in statutory income taxes at He's higher marginal rate.
              </span>
            ) : (
              <span style={{ opacity: 0.8 }}>
                ESPP-to-RRSP transfer is currently disabled. Enabling it in the settings accordion shelters He's ESPP contributions, saving additional taxes at He's marginal rate.
              </span>
            )}
          </div>
        </div>

        {/* Right Column: Advisory & Optimization */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
            ADVISORY ANALYSIS
          </div>

          {isOverContributionRisk ? (
            <div style={{ display: 'flex', gap: '10px', padding: '10px 12px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid var(--danger)', borderRadius: '6px', color: 'var(--danger)', lineHeight: '1.4' }}>
              <ShieldAlert size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ display: 'block', marginBottom: '2px' }}>Over-Contribution Penalty Risk!</strong>
                If you contribute She's full {formatCurrency(sheExtraRrspMonthly)}/mo to a Spousal RRSP, He will exceed He's remaining room by <strong>{formatCurrency(sheExtraRrspMonthly - heRemainingRoomMonthly)}/mo</strong> ({formatCurrency(sheExtraRrspAnnual - heRemainingRoom)}/yr). This incurs a 1% per month tax penalty from the CRA on the excess.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '10px', padding: '10px 12px', background: 'rgba(34, 197, 94, 0.05)', border: '1px solid var(--success)', borderRadius: '6px', color: 'var(--success)', lineHeight: '1.4' }}>
              <CheckCircle2 size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Safe to Splurge:</strong> He's remaining room is fully sufficient to cover She's extra savings. You can contribute the entire amount into the Spousal RRSP.
              </div>
            </div>
          )}

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
            <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              🏆 RECOMMENDED OPTIMIZED SPLIT
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div className="flex-between">
                <span>To He's Spousal RRSP (using He's room):</span>
                <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{formatCurrency(optimizedSpousalMonthly)}/mo</span>
              </div>
              <div className="flex-between">
                <span>To She's Own RRSP (using She's room):</span>
                <span style={{ fontWeight: 600 }}>{formatCurrency(optimizedSheOwnMonthly)}/mo</span>
              </div>
            </div>
          </div>

          <div className="flex-between" style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid var(--info)', padding: '8px 12px', borderRadius: '6px', color: 'var(--info)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingUp size={16} />
              <span>Net Tax Saved (Optimized vs Standard):</span>
            </div>
            <strong style={{ fontSize: '14px' }}>+{formatCurrency(annualTaxSavings)}/yr</strong>
          </div>
        </div>
      </div>

      {/* NEW SECTION: BRACKET TRANSFERS & TAX ADVANTAGE ADVISORY */}
      <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '20px', paddingTop: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Landmark size={18} style={{ color: 'var(--info)' }} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Tax Bracket Advantage & Stop-Point Optimizer
            </span>
          </div>
          <div className="flex-row" style={{ gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Min. Target Tax Advantage:</span>
            <select
              value={targetThreshold}
              onChange={(e) => {
                onUpdatePlan({
                  optimizeSpousalRrsp,
                  spousalRrspMonthly: sheExtraRrspMonthly,
                  targetTaxAdvantageThreshold: parseFloat(e.target.value),
                });
              }}
              style={{
                background: 'var(--card-bg, rgba(255,255,255,0.05))',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                fontSize: '12px',
                padding: '4px 8px',
                outline: 'none',
              }}
            >
              {possibleRates.map(rate => (
                <option key={rate} value={rate}>
                  {getRateLabel(rate)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', fontSize: '12.5px', lineHeight: '1.4' }}>
          {/* He's Bracket Analysis */}
          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '6px' }}>
            <strong style={{ display: 'block', marginBottom: '6px', color: 'var(--text-primary)' }}>He's Marginal Analysis</strong>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
              <div className="flex-between">
                <span style={{ color: 'var(--text-muted)' }}>Gross Income Margin:</span>
                <span style={{ fontWeight: 600 }}>{pct(heGrossMarginal)}</span>
              </div>
              <div className="flex-between">
                <span style={{ color: 'var(--text-muted)' }}>After-RRSP Margin:</span>
                <span style={{ fontWeight: 600, color: heAfterRrspMarginal >= targetThreshold ? 'var(--success)' : 'var(--warning)' }}>
                  {pct(heAfterRrspMarginal)}
                </span>
              </div>
              <div style={{ borderTop: '1px dashed var(--border-color)', margin: '4px 0', paddingTop: '4px' }} />
              <div className="flex-between">
                <span style={{ color: 'var(--text-muted)' }}>Average Tax (Before RRSP):</span>
                <span>{pct(heAverageTaxBefore)}</span>
              </div>
              <div className="flex-between">
                <span style={{ color: 'var(--text-muted)' }}>Average Tax (After RRSP):</span>
                <span style={{ fontWeight: 600, color: 'var(--success)' }}>{pct(heAverageTaxAfter)}</span>
              </div>
              <div style={{ borderTop: '1px dashed var(--border-color)', margin: '4px 0', paddingTop: '4px' }} />
              <div className="flex-between">
                <span style={{ color: 'var(--text-muted)' }}>Current Total RRSP:</span>
                <span style={{ fontWeight: 600 }}>{formatCurrency(heTotalRrspDeductions)}/yr</span>
              </div>
              <div className="flex-between">
                <span style={{ color: 'var(--text-muted)' }}>Max Target Room:</span>
                <strong style={{ color: 'var(--info)' }}>
                  {hePassedOptimal ? `${formatCurrency(heOptimalRrspAnnual)}/yr` : 'Room Capped'}
                </strong>
              </div>
            </div>
            {heAfterRrspMarginal >= targetThreshold ? (
              <span style={{ color: 'var(--success)', display: 'block', fontSize: '11.5px', marginTop: '6px' }}>
                ✓ <strong>Safe Zone</strong>: You can contribute another <strong>{formatCurrency(Math.max(0, heOptimalRrspAnnual - heTotalRrspDeductions))}/yr</strong> before tax savings drop below your {pct(targetThreshold)} target.
              </span>
            ) : (
              <span style={{ color: 'var(--warning)', display: 'block', fontSize: '11.5px', marginTop: '6px' }}>
                ⚠️ <strong>Over Target</strong>: You contributed <strong>{formatCurrency(Math.max(0, heTotalRrspDeductions - heOptimalRrspAnnual))}/yr</strong> past your optimal stop-point. The excess only saves tax at {pct(heAfterRrspMarginal)}.
              </span>
            )}
          </div>

          {/* She's Bracket Analysis */}
          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '6px' }}>
            <strong style={{ display: 'block', marginBottom: '6px', color: 'var(--text-primary)' }}>She's Marginal Analysis</strong>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
              <div className="flex-between">
                <span style={{ color: 'var(--text-muted)' }}>Gross Income Margin:</span>
                <span style={{ fontWeight: 600 }}>{pct(sheGrossMarginal)}</span>
              </div>
              <div className="flex-between">
                <span style={{ color: 'var(--text-muted)' }}>After-RRSP Margin:</span>
                <span style={{ fontWeight: 600, color: sheAfterRrspMarginal >= targetThreshold ? 'var(--success)' : 'var(--warning)' }}>
                  {pct(sheAfterRrspMarginal)}
                </span>
              </div>
              <div style={{ borderTop: '1px dashed var(--border-color)', margin: '4px 0', paddingTop: '4px' }} />
              <div className="flex-between">
                <span style={{ color: 'var(--text-muted)' }}>Average Tax (Before RRSP):</span>
                <span>{pct(sheAverageTaxBefore)}</span>
              </div>
              <div className="flex-between">
                <span style={{ color: 'var(--text-muted)' }}>Average Tax (After RRSP):</span>
                <span style={{ fontWeight: 600, color: 'var(--success)' }}>{pct(sheAverageTaxAfter)}</span>
              </div>
              <div style={{ borderTop: '1px dashed var(--border-color)', margin: '4px 0', paddingTop: '4px' }} />
              <div className="flex-between">
                <span style={{ color: 'var(--text-muted)' }}>Current Total RRSP:</span>
                <span style={{ fontWeight: 600 }}>{formatCurrency(sheTotalRrspDeductions)}/yr</span>
              </div>
              <div className="flex-between">
                <span style={{ color: 'var(--text-muted)' }}>Max Target Room:</span>
                <strong style={{ color: 'var(--info)' }}>
                  {shePassedOptimal ? `${formatCurrency(sheOptimalRrspAnnual)}/yr` : 'Room Capped'}
                </strong>
              </div>
            </div>
            {sheAfterRrspMarginal >= targetThreshold ? (
              <span style={{ color: 'var(--success)', display: 'block', fontSize: '11.5px', marginTop: '6px' }}>
                ✓ <strong>Safe Zone</strong>: You can contribute another <strong>{formatCurrency(Math.max(0, sheOptimalRrspAnnual - sheTotalRrspDeductions))}/yr</strong> before tax savings drop below your {pct(targetThreshold)} target.
              </span>
            ) : sheGrossMarginal < targetThreshold ? (
              <span style={{ color: 'var(--warning)', display: 'block', fontSize: '11.5px', marginTop: '6px' }}>
                ⚠️ <strong>Outside Bracket</strong>: She's gross marginal rate ({pct(sheGrossMarginal)}) is already below your {pct(targetThreshold)} target. **Advice**: Route extra savings to She's **TFSA**, or enable the **Spousal Split** above to claim He's {pct(heAfterRrspMarginal)} deduction.
              </span>
            ) : (
              <span style={{ color: 'var(--warning)', display: 'block', fontSize: '11.5px', marginTop: '6px' }}>
                ⚠️ <strong>Over Target</strong>: You contributed <strong>{formatCurrency(Math.max(0, sheTotalRrspDeductions - sheOptimalRrspAnnual))}/yr</strong> past She's optimal stop-point. Divert the excess to TFSA.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
