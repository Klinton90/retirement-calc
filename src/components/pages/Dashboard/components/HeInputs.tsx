import React from 'react';
import { type PersonInput, ContributionType } from '../../../../types/calculator';
import { FormInput } from '../../../shared/FormInput';

interface HeInputsProps {
  heInput: PersonInput;
  updatePerson: (person: 'he' | 'she', field: keyof PersonInput, val: any) => void;
  includeExtraIncome: boolean;
}

export const HeInputs: React.FC<HeInputsProps> = ({ heInput, updatePerson, includeExtraIncome }) => {
  return (
    <>
      <div className="input-group-row">
        <FormInput
          label="Age"
          type="number"
          value={heInput.age}
          onChange={val => updatePerson('he', 'age', val)}
        />
        <FormInput
          label="Retire Target Age"
          type="number"
          value={heInput.retirementAge}
          onChange={val => updatePerson('he', 'retirementAge', val)}
        />
      </div>

      <FormInput
        label="Gross Salary"
        type="number"
        prefix="$"
        value={heInput.salary}
        onChange={val => updatePerson('he', 'salary', val)}
      />

      <FormInput
        label="Extra Income ($/month, After-Tax)"
        type="number"
        prefix="$"
        value={heInput.extraIncomeMonthly}
        onChange={val => updatePerson('he', 'extraIncomeMonthly', val)}
        disabled={!includeExtraIncome}
        style={{ opacity: !includeExtraIncome ? 0.45 : 1, transition: 'opacity 0.2s ease' }}
        helperText={!includeExtraIncome ? 'Disabled (Excluded in selector)' : ''}
      />

      <FormInput
        label="Year Arrived in Canada"
        type="number"
        value={heInput.startYearInCanada}
        onChange={val => updatePerson('he', 'startYearInCanada', val)}
      />

      {/* RRSP */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '12px' }}>
        <div className="flex-between" style={{ marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>RRSP CONTRIBUTIONS</span>
        </div>
        
        <div className="input-group-row">
          <FormInput
            label="Employee Type"
            type="select"
            value={heInput.rrspEmployeeType}
            onChange={val => updatePerson('he', 'rrspEmployeeType', val)}
            options={[
              { value: ContributionType.PERCENTAGE, label: '% of Salary' },
              { value: ContributionType.FLAT, label: '$ / month' },
            ]}
          />
          <FormInput
            label="Employee Value"
            type="number"
            value={heInput.rrspEmployeeValue}
            onChange={val => updatePerson('he', 'rrspEmployeeValue', val)}
          />
        </div>

        <FormInput
          label="Employer Match (Max %)"
          type="range"
          min={0}
          max={18}
          step={0.5}
          value={heInput.rrspEmployerRate}
          onChange={val => updatePerson('he', 'rrspEmployerRate', val)}
          suffix="%"
        />
      </div>

      {/* ESPP */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '12px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
          ESPP CONTRIBUTION
        </span>
        <div className="input-group-row">
          <FormInput
            label="Employee Rate"
            type="number"
            suffix="%"
            value={heInput.esppEmployeeRate}
            onChange={val => updatePerson('he', 'esppEmployeeRate', val)}
          />
          <FormInput
            label="Employer Match"
            type="number"
            suffix="%"
            value={heInput.esppEmployerRate}
            onChange={val => updatePerson('he', 'esppEmployerRate', val)}
          />
        </div>
      </div>

      {/* Other savings */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '12px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
          OTHER SAVINGS
        </span>
        <div className="input-group-row">
          <FormInput
            label="Other Savings to TFSA ($/mo)"
            type="number"
            prefix="$"
            value={heInput.otherSavingsTfsaMonthly}
            onChange={val => updatePerson('he', 'otherSavingsTfsaMonthly', val)}
          />
          <FormInput
            label="Other Savings to RRSP ($/mo)"
            type="number"
            prefix="$"
            value={heInput.otherSavingsRrspMonthly}
            onChange={val => updatePerson('he', 'otherSavingsRrspMonthly', val)}
          />
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
          TFSA contributions are after-tax. RRSP contributions are tax-deductible.
        </p>
      </div>

      {/* Registered Carry-Forward Room */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '12px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
          REGISTERED ROOM CARRY-FORWARDS
        </span>
        <div className="input-group-row">
          <FormInput
            label="Unused RRSP Room"
            type="number"
            prefix="$"
            value={heInput.carryForwardRrspRoom ?? 0}
            onChange={val => updatePerson('he', 'carryForwardRrspRoom', val)}
          />
          <FormInput
            label="Unused TFSA Room"
            type="number"
            prefix="$"
            value={heInput.carryForwardTfsaRoom ?? 0}
            onChange={val => updatePerson('he', 'carryForwardTfsaRoom', val)}
          />
        </div>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Unused room available <strong>today</strong>. For TFSA, include this calendar year&apos;s already-granted limit (new Jan 1 room is modeled separately in later years).
        </p>
      </div>
    </>
  );
};
export default HeInputs;
