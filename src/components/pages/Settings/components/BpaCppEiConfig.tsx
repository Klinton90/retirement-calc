import React from 'react';
import { type TaxConfig } from '../../../../types/calculator';
import { FormInput } from '../../../shared/FormInput';

interface BpaCppEiConfigProps {
  taxConfig: TaxConfig;
  handleTaxConfigChange: (field: keyof TaxConfig, val: number) => void;
}

export const BpaCppEiConfig: React.FC<BpaCppEiConfigProps> = ({ taxConfig, handleTaxConfigChange }) => {
  return (
    <div className="card" style={{ padding: '20px' }}>
      <h3 style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        BPA, CPP & EI PARAMETERS
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px' }}>
        
        <div className="input-group-row">
          <FormInput
            label="Federal BPA Max ($)"
            type="number"
            value={taxConfig.federalBpaMax}
            onChange={val => handleTaxConfigChange('federalBpaMax', val)}
            inputStyle={{ padding: '6px' }}
            labelStyle={{ fontSize: '12px' }}
          />
          <FormInput
            label="Federal BPA Min ($)"
            type="number"
            value={taxConfig.federalBpaMin}
            onChange={val => handleTaxConfigChange('federalBpaMin', val)}
            inputStyle={{ padding: '6px' }}
            labelStyle={{ fontSize: '12px' }}
          />
        </div>

        <div className="input-group-row">
          <FormInput
            label="Federal Clawback Start ($)"
            type="number"
            value={taxConfig.federalBpaThreshold1}
            onChange={val => handleTaxConfigChange('federalBpaThreshold1', val)}
            inputStyle={{ padding: '6px' }}
            labelStyle={{ fontSize: '12px' }}
          />
          <FormInput
            label="Ontario BPA ($)"
            type="number"
            value={taxConfig.ontarioBpa}
            onChange={val => handleTaxConfigChange('ontarioBpa', val)}
            inputStyle={{ padding: '6px' }}
            labelStyle={{ fontSize: '12px' }}
          />
        </div>

        <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '8px', paddingTop: '8px' }} className="input-group-row">
          <FormInput
            label="CPP Rate (%)"
            type="number"
            step={0.001}
            value={taxConfig.cppRate === 0 ? 0 : Number((taxConfig.cppRate * 100).toFixed(3))}
            onChange={val => handleTaxConfigChange('cppRate', val / 100)}
            inputStyle={{ padding: '6px' }}
            labelStyle={{ fontSize: '12px' }}
          />
          <FormInput
            label="CPP Max Contribution ($)"
            type="number"
            value={taxConfig.cppMaxContribution}
            onChange={val => handleTaxConfigChange('cppMaxContribution', val)}
            inputStyle={{ padding: '6px' }}
            labelStyle={{ fontSize: '12px' }}
          />
        </div>

        <div className="input-group-row">
          <FormInput
            label="CPP YMPE ($)"
            type="number"
            value={taxConfig.cppYmpe}
            onChange={val => handleTaxConfigChange('cppYmpe', val)}
            inputStyle={{ padding: '6px' }}
            labelStyle={{ fontSize: '12px' }}
          />
          <FormInput
            label="CPP2 YAME ($)"
            type="number"
            value={taxConfig.cppYame}
            onChange={val => handleTaxConfigChange('cppYame', val)}
            inputStyle={{ padding: '6px' }}
            labelStyle={{ fontSize: '12px' }}
          />
        </div>

        <div className="input-group-row">
          <FormInput
            label="EI Rate (%)"
            type="number"
            step={0.001}
            value={taxConfig.eiRate === 0 ? 0 : Number((taxConfig.eiRate * 100).toFixed(3))}
            onChange={val => handleTaxConfigChange('eiRate', val / 100)}
            inputStyle={{ padding: '6px' }}
            labelStyle={{ fontSize: '12px' }}
          />
          <FormInput
            label="EI Max Premium ($)"
            type="number"
            value={taxConfig.eiMaxPremium}
            onChange={val => handleTaxConfigChange('eiMaxPremium', val)}
            inputStyle={{ padding: '6px' }}
            labelStyle={{ fontSize: '12px' }}
          />
        </div>

      </div>
    </div>
  );
};
export default BpaCppEiConfig;
