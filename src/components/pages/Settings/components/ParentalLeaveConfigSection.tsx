import React from 'react';
import type { ParentalLeaveConfig } from '../../../../types/calculator';
import { FormInput } from '../../../shared/FormInput';

interface ParentalLeaveConfigSectionProps {
  parentalLeaveConfig: ParentalLeaveConfig;
  handleParentalLeaveChange: (field: keyof ParentalLeaveConfig, val: number) => void;
}

export const ParentalLeaveConfigSection: React.FC<ParentalLeaveConfigSectionProps> = ({
  parentalLeaveConfig,
  handleParentalLeaveChange,
}) => {
  return (
    <div className="card" style={{ padding: '20px' }}>
      <h3 style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        PARENTAL LEAVE EMPLOYER TOP-UP TARGETS
      </h3>
      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
        Configure the target percentage of normal salary your employers top up to during leaves. Government EI parental benefits are calculated and subtracted first.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px' }}>
        
        <FormInput
          label="She (Maternity Leave) Employer Top-up Target (%)"
          type="number"
          suffix="%"
          placeholder="e.g. 70 for 70%"
          value={parentalLeaveConfig.sheTopupTargetRate === 0 ? 0 : Number((parentalLeaveConfig.sheTopupTargetRate * 100).toFixed(0))}
          onChange={val => handleParentalLeaveChange('sheTopupTargetRate', val / 100)}
          helperText="Standard target is 70% to 93% for public sector/premium corporate packages. Default is 70%."
        />

        <FormInput
          label="He (Paternity Leave) Employer Top-up Target (%)"
          type="number"
          suffix="%"
          placeholder="e.g. 0 for no top-up (EI only)"
          value={parentalLeaveConfig.heTopupTargetRate === 0 ? 0 : Number((parentalLeaveConfig.heTopupTargetRate * 100).toFixed(0))}
          onChange={val => handleParentalLeaveChange('heTopupTargetRate', val / 100)}
          style={{ borderTop: '1px solid var(--border-color)', marginTop: '8px', paddingTop: '8px' }}
          helperText="Usually 0% (standard EI payments only) unless your employer provides a top-up benefit."
        />

      </div>
    </div>
  );
};
export default ParentalLeaveConfigSection;
