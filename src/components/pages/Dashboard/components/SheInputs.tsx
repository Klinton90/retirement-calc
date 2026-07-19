import React from 'react';
import { type PersonInput, ContributionType } from '../../../../types/calculator';
import { FormInput } from '../../../shared/FormInput';

interface SheInputsProps {
  sheInput: PersonInput;
  updatePerson: (person: 'he' | 'she', field: keyof PersonInput, val: any) => void;
  includeExtraIncome: boolean;
}

export const SheInputs: React.FC<SheInputsProps> = ({ sheInput, updatePerson, includeExtraIncome }) => {
  return (
    <>
      <div className="input-group-row">
        <FormInput
          label="Age"
          type="number"
          value={sheInput.age}
          onChange={val => updatePerson('she', 'age', val)}
        />
        <FormInput
          label="Retire Target Age"
          type="number"
          value={sheInput.retirementAge}
          onChange={val => updatePerson('she', 'retirementAge', val)}
        />
      </div>

      <FormInput
        label="Gross Salary"
        type="number"
        prefix="$"
        value={sheInput.salary}
        onChange={val => updatePerson('she', 'salary', val)}
      />

      <FormInput
        label="Extra Income ($/month, After-Tax)"
        type="number"
        prefix="$"
        value={sheInput.extraIncomeMonthly}
        onChange={val => updatePerson('she', 'extraIncomeMonthly', val)}
        disabled={!includeExtraIncome}
        style={{ opacity: !includeExtraIncome ? 0.45 : 1, transition: 'opacity 0.2s ease' }}
        helperText={!includeExtraIncome ? 'Disabled (Excluded in selector)' : ''}
      />

      <div className="input-group-row">
        <FormInput
          label="Arrived in Canada"
          type="number"
          value={sheInput.startYearInCanada}
          onChange={val => updatePerson('she', 'startYearInCanada', val)}
          helperText="OAS residency"
        />
        <FormInput
          label="Started working (CPP)"
          type="number"
          value={sheInput.cppStartYear}
          onChange={val => updatePerson('she', 'cppStartYear', val)}
          helperText={
            sheInput.cppStartYear < sheInput.startYearInCanada
              ? 'Before arrival — unusual for CPP'
              : 'CPP start (not before age 18)'
          }
        />
      </div>

      {/* RRSP */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '12px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
          RRSP CONTRIBUTIONS
        </span>
        <div className="input-group-row">
          <FormInput
            label="Employee Type"
            type="select"
            value={sheInput.rrspEmployeeType}
            onChange={val => updatePerson('she', 'rrspEmployeeType', val)}
            options={[
              { value: ContributionType.PERCENTAGE, label: '% of Salary' },
              { value: ContributionType.FLAT, label: '$ / month' },
            ]}
          />
          <FormInput
            label="Employee Value"
            type="number"
            value={sheInput.rrspEmployeeValue}
            onChange={val => updatePerson('she', 'rrspEmployeeValue', val)}
          />
        </div>

        <FormInput
          label="Employer Match (Max %)"
          type="range"
          min={0}
          max={18}
          step={0.5}
          value={sheInput.rrspEmployerRate}
          onChange={val => updatePerson('she', 'rrspEmployerRate', val)}
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
            value={sheInput.esppEmployeeRate}
            onChange={val => updatePerson('she', 'esppEmployeeRate', val)}
          />
          <FormInput
            label="Employer Match"
            type="number"
            suffix="%"
            value={sheInput.esppEmployerRate}
            onChange={val => updatePerson('she', 'esppEmployerRate', val)}
          />
        </div>
      </div>

      {/* Extra contribution — app allocates destination under soft limits */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '12px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
          EXTRA CONTRIBUTION
        </span>
        <div className="input-group-row">
          <FormInput
            label="Extra investable ($/mo)"
            type="number"
            prefix="$"
            value={sheInput.extraContributionMonthly ?? ((sheInput.otherSavingsTfsaMonthly || 0) + (sheInput.otherSavingsRrspMonthly || 0))}
            onChange={val => updatePerson('she', 'extraContributionMonthly', val)}
          />
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Today&apos;s $. Fills She TFSA, then He TFSA; leftover uses She RRSP / Spousal (if secondary) / Non-reg by MV ranking.
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
            value={sheInput.carryForwardRrspRoom ?? 0}
            onChange={val => updatePerson('she', 'carryForwardRrspRoom', val)}
          />
          <FormInput
            label="Unused TFSA Room"
            type="number"
            prefix="$"
            value={sheInput.carryForwardTfsaRoom ?? 0}
            onChange={val => updatePerson('she', 'carryForwardTfsaRoom', val)}
          />
        </div>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Unused room available <strong>today</strong>. For TFSA, include this calendar year&apos;s already-granted limit (new Jan 1 room is modeled separately in later years).
        </p>
      </div>
    </>
  );
};
export default SheInputs;
