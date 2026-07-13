import React from 'react';
import { SavingsBase, type PersonInput } from '../../../../types/calculator';
import { FormInput } from '../../../shared/FormInput';

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
}) => {
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
        helperText={`Defines expected life length (Retirement Age + Delta). Currently: ${heInput.retirementAge + lifeExpectancyDelta} yrs.`}
      />

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
          ESPP TAX STRATEGY
        </span>
        <FormInput
          id="depositEsppToRrsp"
          type="checkbox"
          label="Deposit ESPP Contributions into RRSP"
          value={depositEsppToRrsp}
          onChange={val => setDepositEsppToRrsp(val)}
        />
        {depositEsppToRrsp && (
          <FormInput
            label="ESPP Tax Refund Reinvestment Rate (%)"
            type="range"
            min={0}
            max={100}
            step={5}
            value={esppRefundSaveRate * 100}
            onChange={val => setEsppRefundSaveRate(val / 100)}
            suffix="%"
            helperText="Portion of the generated tax refund that is saved/reinvested (e.g. to TFSA). The remaining portion is spent."
          />
        )}
      </div>
    </>
  );
};
export default GlobalConstantsInputs;
