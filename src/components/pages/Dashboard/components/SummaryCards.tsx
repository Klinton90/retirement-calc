import React from 'react';
import { type HouseholdTaxResult, SavingsBase, FundingRegime, AllocationPolicy } from '../../../../types/calculator';
import { DollarSign, TrendingUp, AlertCircle, ShieldAlert, Award, Sparkles, Target, Landmark } from 'lucide-react';

interface SummaryCardsProps {
  householdTax: HouseholdTaxResult;
  savingsBase: SavingsBase;
  savingsTargetRate: number;
  yearsSecure: number;
  totalPension: number;
  unallocatedCash: number;
  ccbBenefitMonthly: number;
  childCostsMonthly: number;
  currentSavingsMonthly: number;
  realisticRequired: number;
  mandatoryRequired: number;
  lifeExpectancyAge: number;
  
  // Solver results for Minimum Break-Even savings
  minSavingsNestEgg: number;
  minSavingsMonthlyNeeded: number;
  minSavingsShortfall: number;
  minSavingsIsFunded: boolean;
  yearsToRetirement: number;
  inflationRate: number;
  retirementAgeHe: number;
  activeScenario: 'realistic' | 'mandatory';
  fundingRegime?: FundingRegime;
  conversionAgeHe?: number;
  conversionAgeShe?: number;
  conversionWhy?: string;
  lifeExpectancyDelta?: number;
  survivorToggle?: boolean;
  onSurvivorToggle?: (v: boolean) => void;
  allocationPolicy?: AllocationPolicy;
  onAllocationPolicy?: (v: AllocationPolicy) => void;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  householdTax,
  savingsBase,
  savingsTargetRate,
  yearsSecure,
  totalPension,
  unallocatedCash,
  ccbBenefitMonthly,
  childCostsMonthly,
  currentSavingsMonthly,
  realisticRequired,
  mandatoryRequired,
  lifeExpectancyAge,
  
  minSavingsNestEgg,
  minSavingsMonthlyNeeded,
  minSavingsShortfall,
  minSavingsIsFunded,
  yearsToRetirement,
  inflationRate,
  retirementAgeHe,
  activeScenario,
  fundingRegime,
  conversionAgeHe,
  conversionAgeShe,
  conversionWhy,
  lifeExpectancyDelta = 20,
  survivorToggle = false,
  onSurvivorToggle,
  allocationPolicy = AllocationPolicy.TFSA_FIRST,
  onAllocationPolicy,
}) => {
  const {
    totalHouseholdGross,
    totalHouseholdNet,
    totalHouseholdActualSavings,
    savingsDrift,
    actualSavingsRate,
  } = householdTax;

  const targetPercentageText = `${(savingsTargetRate * 100).toFixed(0)}%`;
  const isDriftPositive = savingsDrift >= 0;
  const actualSavingsRateText = `${(actualSavingsRate * 100).toFixed(1)}%`;
  const monthlySurplus = unallocatedCash / 12;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const pct = (val: number) => `${(val * 100).toFixed(1)}%`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '24px' }}>
      
      {/* GROUP 1: PRE-RETIREMENT PLAN & CASH FLOW */}
      <div>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
          Current Cash Flow & Plan (Pre-Retirement)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
          
          {/* 1. Take-Home Pay card */}
          <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }} title="Statutory net income after taxes, before any voluntary contributions like RRSP, ESPP, TFSA.">
            <div className="flex-between" style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>TAKE-HOME PAY</span>
              <DollarSign size={18} style={{ color: 'var(--info)' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '4px 0', letterSpacing: '-0.5px' }}>
                {formatCurrency(totalHouseholdNet / 12)}
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 400 }}>/mo net</span>
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                Gross: {formatCurrency(totalHouseholdGross / 12)}/mo
              </p>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0 0', lineHeight: '1.3' }}>
                Net after statutory taxes. Before RRSP/ESPP & other voluntary savings.
              </p>
            </div>
          </div>

          {/* 2. Savings & Drift Card */}
          <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }} title="Your actual voluntary savings rate today compared to your target percentage.">
            <div className="flex-between" style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>ACTUAL SAVINGS & DRIFT</span>
              <TrendingUp size={18} style={{ color: isDriftPositive ? 'var(--success)' : 'var(--warning)' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '4px 0', letterSpacing: '-0.5px' }}>
                {formatCurrency(totalHouseholdActualSavings / 12)}
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 400 }}>/mo actual</span>
              </h2>
              <div className="flex-row" style={{ marginTop: '4px', gap: '6px', flexWrap: 'wrap' }}>
                <span className={`badge ${isDriftPositive ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '12px', padding: '2px 6px' }}>
                  {isDriftPositive ? '+' : ''}{formatCurrency(savingsDrift / 12)}/mo drift
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {actualSavingsRateText} actual vs {targetPercentageText} target of {savingsBase.toLowerCase()}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Disposable Monthly Cash Surplus */}
          <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div className="flex-between" style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>DISPOSABLE CASH SURPLUS</span>
              <Sparkles size={18} style={{ color: monthlySurplus > 0 ? 'var(--success)' : 'var(--danger)' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '4px 0', letterSpacing: '-0.5px', color: monthlySurplus > 0 ? 'var(--success)' : 'var(--danger)' }}>
                {monthlySurplus > 0 ? `+${formatCurrency(monthlySurplus)}` : formatCurrency(monthlySurplus)}
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 400 }}>/mo left</span>
              </h2>
              {(childCostsMonthly > 0 || ccbBenefitMonthly > 0) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', margin: '4px 0 6px 0', padding: '6px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12px' }}>
                  {childCostsMonthly > 0 && (
                    <div className="flex-between">
                      <span style={{ color: 'var(--text-secondary)' }}>Child Costs:</span>
                      <span style={{ color: 'var(--danger)', fontWeight: 600 }}>-{formatCurrency(childCostsMonthly)}/mo</span>
                    </div>
                  )}
                  {ccbBenefitMonthly > 0 && (
                    <div className="flex-between">
                      <span style={{ color: 'var(--text-secondary)' }}>CCB Benefit:</span>
                      <span style={{ color: 'var(--success)', fontWeight: 600 }}>+{formatCurrency(ccbBenefitMonthly)}/mo</span>
                    </div>
                  )}
                </div>
              )}
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0 0', lineHeight: '1.3' }}>
                Leftover cash after actual savings & expenses. Assumed fully spent on lifestyle (not accumulated in portfolio).
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* GROUP 2: POST-RETIREMENT READINESS & GOALS */}
      <div>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
          Retirement Readiness & Targets (Post-Retirement)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
          
          {/* 4. Retirement Readiness Card */}
          <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div className="flex-between" style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>RETIREMENT READINESS</span>
              {yearsSecure >= lifeExpectancyAge ? (
                <Award size={18} style={{ color: 'var(--success)' }} />
              ) : yearsSecure > 70 ? (
                <AlertCircle size={18} style={{ color: 'var(--warning)' }} />
              ) : (
                <ShieldAlert size={18} style={{ color: 'var(--danger)' }} />
              )}
            </div>
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '4px 0', letterSpacing: '-0.5px' }}>
                {yearsSecure >= lifeExpectancyAge ? (
                  <span style={{ color: 'var(--success)' }}>Lasts to Age {lifeExpectancyAge}+</span>
                ) : (
                  <span style={{ color: 'var(--danger)' }}>Depleted at Age {yearsSecure}</span>
                )}
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 6px 0', fontWeight: 500 }}>
                {yearsSecure >= lifeExpectancyAge 
                  ? `Sustains entire ${lifeExpectancyAge - retirementAgeHe} yrs of retirement`
                  : `Runs out ${lifeExpectancyAge - yearsSecure} yrs before life expectancy`
                }
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 6px 0' }}>
                Gov Pension: {formatCurrency(totalPension / 12)}/mo net (Prorated CPP & OAS)
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12px' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.2px' }}>
                  Active Scenario Target ({activeScenario.toUpperCase()})
                </div>
                
                {activeScenario === 'realistic' ? (
                  <>
                    <div className="flex-between">
                      <span>Required Savings:</span>
                      <span style={{ fontWeight: 600, color: realisticRequired > currentSavingsMonthly ? 'var(--danger)' : 'var(--success)' }}>
                        {formatCurrency(realisticRequired)}/mo
                      </span>
                    </div>
                    <div className="flex-between" style={{ fontSize: '12px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>(Current: {formatCurrency(currentSavingsMonthly)}/mo)</span>
                      <span style={{ fontWeight: 500, color: realisticRequired > currentSavingsMonthly ? 'var(--danger)' : 'var(--success)' }}>
                        {realisticRequired > currentSavingsMonthly ? `+${formatCurrency(realisticRequired - currentSavingsMonthly)}/mo needed` : 'Plan is Secure'}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex-between">
                      <span>Required Savings:</span>
                      <span style={{ fontWeight: 600, color: mandatoryRequired > currentSavingsMonthly ? 'var(--danger)' : 'var(--success)' }}>
                        {formatCurrency(mandatoryRequired)}/mo
                      </span>
                    </div>
                    <div className="flex-between" style={{ fontSize: '12px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>(Current: {formatCurrency(currentSavingsMonthly)}/mo)</span>
                      <span style={{ fontWeight: 500, color: mandatoryRequired > currentSavingsMonthly ? 'var(--danger)' : 'var(--success)' }}>
                        {mandatoryRequired > currentSavingsMonthly ? `+${formatCurrency(mandatoryRequired - currentSavingsMonthly)}/mo needed` : 'Plan is Secure'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 5. Required Nest Egg Card */}
          <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div className="flex-between" style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>REQUIRED NEST EGG</span>
              <Landmark size={18} style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '4px 0', letterSpacing: '-0.5px', color: 'var(--primary)' }}>
                {formatCurrency(minSavingsNestEgg)}
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                Required balance at Age {retirementAgeHe}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Nominal value · inflated at {pct(inflationRate)}/yr
              </p>
            </div>
          </div>

          {/* 6. Min. Savings Needed & Shortfall Card */}
          <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div className="flex-between" style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>MIN. MONTHLY SAVINGS</span>
              <Target size={18} style={{ color: minSavingsIsFunded ? 'var(--success)' : 'var(--warning)' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '4px 0', letterSpacing: '-0.5px', color: minSavingsIsFunded ? 'var(--success)' : 'var(--warning)' }}>
                {minSavingsIsFunded ? 'Already Funded' : `${formatCurrency(minSavingsMonthlyNeeded)}/mo`}
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                {minSavingsIsFunded
                  ? `Savings cover target nest egg`
                  : `Shortfall: ${formatCurrency(minSavingsShortfall)}`}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                {minSavingsIsFunded
                  ? 'No extra contributions needed'
                  : `${yearsToRetirement} yrs left · today's $ · rises with inflation`}
              </p>
              {fundingRegime && (
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '8px 0 0 0' }}>
                  Regime: <strong>{fundingRegime}</strong>
                  {conversionAgeHe != null && conversionAgeShe != null && (
                    <> · Convert He@{conversionAgeHe} / She@{conversionAgeShe}</>
                  )}
                </p>
              )}
              {conversionWhy && (
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0 0', lineHeight: 1.35 }}>
                  {conversionWhy}
                </p>
              )}
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '8px 0 0 0' }}>
                Horizon ~{lifeExpectancyDelta}y post-retire (to ~{retirementAgeHe + lifeExpectancyDelta}).
                Survivor stress: {survivorToggle ? 'ON' : 'off'}.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                {onSurvivorToggle && (
                  <label style={{ fontSize: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input type="checkbox" checked={survivorToggle} onChange={e => onSurvivorToggle(e.target.checked)} />
                    Survivor stress toggle
                  </label>
                )}
                {onAllocationPolicy && (
                  <label style={{ fontSize: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    Allocation
                    <select
                      value={allocationPolicy}
                      onChange={e => onAllocationPolicy(e.target.value as AllocationPolicy)}
                      style={{ fontSize: '12px' }}
                    >
                      <option value={AllocationPolicy.TFSA_FIRST}>TFSA first</option>
                      <option value={AllocationPolicy.RRSP_FIRST}>RRSP first</option>
                    </select>
                  </label>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};

export default SummaryCards;
