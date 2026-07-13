import React from 'react';
import type { CcbConfig } from '../../../../types/calculator';
import { FormInput } from '../../../shared/FormInput';

interface CcbConfigSectionProps {
  ccbConfig: CcbConfig;
  handleCcbConfigChange: (field: keyof CcbConfig, val: number) => void;
}

export const CcbConfigSection: React.FC<CcbConfigSectionProps> = ({
  ccbConfig,
  handleCcbConfigChange,
}) => {
  return (
    <div className="card" style={{ padding: '20px' }}>
      <h3 style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        CANADA CHILD BENEFIT (CCB) CONFIGURATION
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <FormInput
            label="Max Benefit Under Age 6 ($/yr)"
            type="number"
            value={ccbConfig.maxUnder6}
            onChange={val => handleCcbConfigChange('maxUnder6', val)}
            inputStyle={{ padding: '6px' }}
          />
          <FormInput
            label="Max Benefit Ages 6 to 17 ($/yr)"
            type="number"
            value={ccbConfig.max6To17}
            onChange={val => handleCcbConfigChange('max6To17', val)}
            inputStyle={{ padding: '6px' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <FormInput
            label="CCB Tier 1 Threshold ($)"
            type="number"
            value={ccbConfig.threshold1}
            onChange={val => handleCcbConfigChange('threshold1', val)}
            inputStyle={{ padding: '6px' }}
          />
          <FormInput
            label="CCB Tier 2 Threshold ($)"
            type="number"
            value={ccbConfig.threshold2}
            onChange={val => handleCcbConfigChange('threshold2', val)}
            inputStyle={{ padding: '6px' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px' }}>
          <div className="flex-between">
            <span>1 Child Reduction Rates (Tier 1 / 2):</span>
            <span style={{ fontWeight: 600 }}>{(ccbConfig.reduction1ChildTier1 * 100).toFixed(1)}% / {(ccbConfig.reduction1ChildTier2 * 100).toFixed(1)}%</span>
          </div>
          <div className="flex-between">
            <span>2 Children Reduction Rates (Tier 1 / 2):</span>
            <span style={{ fontWeight: 600 }}>{(ccbConfig.reduction2ChildrenTier1 * 100).toFixed(1)}% / {(ccbConfig.reduction2ChildrenTier2 * 100).toFixed(1)}%</span>
          </div>
          <div className="flex-between">
            <span>3 Children Reduction Rates (Tier 1 / 2):</span>
            <span style={{ fontWeight: 600 }}>{(ccbConfig.reduction3ChildrenTier1 * 100).toFixed(1)}% / {(ccbConfig.reduction3ChildrenTier2 * 100).toFixed(1)}%</span>
          </div>
          <div className="flex-between">
            <span>4+ Children Reduction Rates (Tier 1 / 2):</span>
            <span style={{ fontWeight: 600 }}>{(ccbConfig.reduction4PlusChildrenTier1 * 100).toFixed(1)}% / {(ccbConfig.reduction4PlusChildrenTier2 * 100).toFixed(1)}%</span>
          </div>
        </div>

      </div>
    </div>
  );
};
export default CcbConfigSection;
