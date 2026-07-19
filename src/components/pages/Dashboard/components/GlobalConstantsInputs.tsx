import React from 'react';
import { SavingsBase, type PersonInput } from '../../../../types/calculator';
import { FormInput } from '../../../shared/FormInput';
import { resolveRetirementHorizon } from '../../../../utils/retirementHorizon';

interface GlobalConstantsInputsProps {
  savingsTargetRate: number;
  setSavingsTargetRate: (rate: number) => void;
  currentSavings: number;
  setCurrentSavings: (val: number) => void;
  lifeExpectancyDelta: number;
  setLifeExpectancyDelta: (val: number) => void;
  savingsBase: SavingsBase;
  setSavingsBase: (base: SavingsBase) => void;
  investmentReturnRate: number;
  setInvestmentReturnRate: (rate: number) => void;
  inflationRate: number;
  setInflationRate: (rate: number) => void;
  salaryGrowthRate: number;
  setSalaryGrowthRate: (rate: number) => void;
  desiredRetirementSpendMonthly: number;
  setDesiredRetirementSpendMonthly: (val: number) => void;
  mandatoryRetirementSpendMonthly: number;
  setMandatoryRetirementSpendMonthly: (val: number) => void;
  depositEsppToRrsp: boolean;
  setDepositEsppToRrsp: (val: boolean) => void;
  esppRefundSaveRate: number;
  setEsppRefundSaveRate: (val: number) => void;
  annualTfsaLimit: number;
  setAnnualTfsaLimit: (val: number) => void;
  inflateAnnualTfsaLimit: boolean;
  setInflateAnnualTfsaLimit: (val: boolean) => void;
  heInput: PersonInput;
  activeScenario: 'realistic' | 'mandatory';
  survivorToggle?: boolean;
  setSurvivorToggle?: (val: boolean) => void;
  survivorSpendFactor?: number;
  setSurvivorSpendFactor?: (val: number) => void;
  optimizeSpousalRrsp?: boolean;
  setOptimizeSpousalRrsp?: (val: boolean) => void;
}

export const GlobalConstantsInputs: React.FC<GlobalConstantsInputsProps> = ({
  savingsTargetRate,
  setSavingsTargetRate,
  currentSavings,
  setCurrentSavings,
  lifeExpectancyDelta,
  setLifeExpectancyDelta,
  savingsBase,
  setSavingsBase,
  investmentReturnRate,
  setInvestmentReturnRate,
  inflationRate,
  setInflationRate,
  salaryGrowthRate,
  setSalaryGrowthRate,
  desiredRetirementSpendMonthly,
  setDesiredRetirementSpendMonthly,
  mandatoryRetirementSpendMonthly,
  setMandatoryRetirementSpendMonthly,
  depositEsppToRrsp,
  setDepositEsppToRrsp,
  esppRefundSaveRate,
  setEsppRefundSaveRate,
  annualTfsaLimit,
  setAnnualTfsaLimit,
  inflateAnnualTfsaLimit,
  setInflateAnnualTfsaLimit,
  heInput,
  activeScenario,
  survivorToggle = false,
  setSurvivorToggle,
  survivorSpendFactor = 0.70,
  setSurvivorSpendFactor,
  optimizeSpousalRrsp = false,
  setOptimizeSpousalRrsp,
}) => {
  const horizonHint = resolveRetirementHorizon({
    heInput,
    lifeExpectancyDelta,
  });

  return (
    <>
      <FormInput
        label="Savings Target Rate (%)"
        type="range"
        min={0}
        max={50}
        step={1}
        value={savingsTargetRate * 100}
        onChange={val => setSavingsTargetRate(val / 100)}
        suffix="%"
      />

      <FormInput
        label="Current Family Savings ($)"
        type="number"
        prefix="$"
        value={currentSavings}
        onChange={val => setCurrentSavings(val)}
      />

      <FormInput
        label="Years Post-Retirement (Life Delta)"
        type="number"
        value={lifeExpectancyDelta}
        onChange={val => setLifeExpectancyDelta(val)}
        min={0}
        helperText={`Models ${horizonHint.retirementYears} retirement years (ages ${horizonHint.firstRetireAgeHe}–${horizonHint.lastFundedAgeHe}); → $0 @ ~${horizonHint.terminalAgeHe}.`}
      />

      {setSurvivorToggle && (
        <div style={{ marginBottom: '8px' }}>
          <FormInput
            id="survivorToggle"
            type="checkbox"
            label="Survivor stress (mid-horizon)"
            value={survivorToggle}
            onChange={val => setSurvivorToggle(val)}
          />
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '-4px 0 0 24px' }}>
            Optional: model one spouse dying mid-retirement (crude stress). Default off.
          </p>
          {survivorToggle && setSurvivorSpendFactor && (
            <div style={{ margin: '8px 0 0 24px' }}>
              <FormInput
                label="Survivor spend (% of couple)"
                type="range"
                min={50}
                max={100}
                step={5}
                value={Math.round(survivorSpendFactor * 100)}
                onChange={val => setSurvivorSpendFactor(val / 100)}
                suffix="%"
              />
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '-4px 0 0 0' }}>
                Spend after the death, as a share of the couple&apos;s target. Survivor keeps
                own CPP + 60% of the deceased&apos;s CPP (capped at max); the deceased&apos;s OAS stops.
              </p>
            </div>
          )}
        </div>
      )}

      {setOptimizeSpousalRrsp && (
        <div style={{ marginBottom: '8px' }}>
          <FormInput
            id="optimizeSpousalRrsp"
            type="checkbox"
            label="Spousal RRSP (primary → secondary)"
            value={optimizeSpousalRrsp}
            onChange={val => setOptimizeSpousalRrsp(val)}
          />
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '-4px 0 0 24px' }}>
            Higher earner contributes to the lower earner&apos;s spousal RRSP (contributor deducts; annuitant owns). Off by default.
          </p>
        </div>
      )}

      <FormInput
        label="Savings Base Calculation"
        type="select"
        value={savingsBase}
        onChange={val => setSavingsBase(val as SavingsBase)}
        options={[
          { value: SavingsBase.GROSS, label: 'Gross Household Income' },
          { value: SavingsBase.NET, label: 'Net Household Income (Take-Home)' },
        ]}
      />

      <div className="input-group-row">
        <FormInput
          label="Nominal Return (%)"
          type="number"
          step={0.1}
          value={Number((investmentReturnRate * 100).toFixed(1))}
          onChange={val => setInvestmentReturnRate(val / 100)}
        />
        <FormInput
          label="Inflation Rate (%)"
          type="number"
          step={0.1}
          value={Number((inflationRate * 100).toFixed(1))}
          onChange={val => setInflationRate(val / 100)}
        />
      </div>

      <div className="input-group-row">
        <FormInput
          label="Salary Growth (%)"
          type="number"
          step={0.1}
          value={Number((salaryGrowthRate * 100).toFixed(1))}
          onChange={val => setSalaryGrowthRate(val / 100)}
          helperText="Annual raise — separate from CPI (default 1%)"
        />
      </div>

      <div className="input-group-row">
        <FormInput
          label="Realistic Retire Spend ($/mo)"
          type="number"
          prefix="$"
          value={desiredRetirementSpendMonthly}
          onChange={val => setDesiredRetirementSpendMonthly(val)}
          disabled={activeScenario === 'mandatory'}
          style={{ opacity: activeScenario === 'mandatory' ? 0.45 : 1, transition: 'opacity 0.2s ease' }}
          helperText={activeScenario === 'mandatory' ? 'Excluded in Mandatory mode' : ''}
        />
        <FormInput
          label="Mandatory Retire Spend ($/mo)"
          type="number"
          prefix="$"
          value={mandatoryRetirementSpendMonthly}
          onChange={val => setMandatoryRetirementSpendMonthly(val)}
          disabled={activeScenario === 'realistic'}
          style={{ opacity: activeScenario === 'realistic' ? 0.45 : 1, transition: 'opacity 0.2s ease' }}
          helperText={activeScenario === 'realistic' ? 'Excluded in Realistic mode' : ''}
        />
      </div>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
        Replaces working expenses once both members are retired (Wants vs Needs targets).
      </p>

      <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '14px', paddingTop: '14px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>
          TFSA ANNUAL ROOM
        </span>
        <FormInput
          label="New TFSA Room ($/person/year)"
          type="number"
          prefix="$"
          value={annualTfsaLimit}
          onChange={val => setAnnualTfsaLimit(val)}
          helperText="CRA sets this ad hoc (historically flat for years, then a step). Default stays nominal — not CPI-linked."
        />
        <FormInput
          id="inflateAnnualTfsaLimit"
          type="checkbox"
          label="Inflate TFSA limit with CPI (sensitivity)"
          value={inflateAnnualTfsaLimit}
          onChange={val => setInflateAnnualTfsaLimit(val)}
          helperText="Off by default. Turn on only to stress a rising legislated limit."
        />
      </div>

      <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '14px', paddingTop: '14px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>
          RRSP TAX REFUND
        </span>
        <FormInput
          id="depositEsppToRrsp"
          type="checkbox"
          label="Deposit ESPP Contributions into RRSP"
          value={depositEsppToRrsp}
          onChange={val => setDepositEsppToRrsp(val)}
        />
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px 0', lineHeight: 1.4 }}>
          When on, ESPP goes to RRSP via payroll. When off, ESPP sale proceeds join the Extra cascade (and may still land in RRSP after TFSA).
        </p>
        <FormInput
          label="Tax refund reinvestment rate (%)"
          type="range"
          min={0}
          max={100}
          step={5}
          value={esppRefundSaveRate * 100}
          onChange={val => setEsppRefundSaveRate(val / 100)}
          suffix="%"
          helperText="Portion of the RRSP deduction refund (from Extra and/or ESPP that landed in RRSP) that is saved and redeployed next year. The remainder is spent."
        />
      </div>
    </>
  );
};
export default GlobalConstantsInputs;
