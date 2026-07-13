import React from 'react';
import type { TaxConfig, CcbConfig, ChildCostConfig, ParentalLeaveConfig, TaxBracket } from '../../../../types/calculator';
import { AlertCircle } from 'lucide-react';
import { BracketTable } from '../../../shared/BracketTable';
import { BpaCppEiConfig } from './BpaCppEiConfig';
import { ChildRaisingCostsConfig } from './ChildRaisingCostsConfig';
import { ParentalLeaveConfigSection } from './ParentalLeaveConfigSection';
import { CcbConfigSection } from './CcbConfigSection';

interface SettingsContentProps {
  taxConfig: TaxConfig;
  setTaxConfig: React.Dispatch<React.SetStateAction<TaxConfig>>;
  ccbConfig: CcbConfig;
  setCcbConfig: React.Dispatch<React.SetStateAction<CcbConfig>>;
  childCostConfig: ChildCostConfig;
  setChildCostConfig: React.Dispatch<React.SetStateAction<ChildCostConfig>>;
  parentalLeaveConfig: ParentalLeaveConfig;
  setParentalLeaveConfig: React.Dispatch<React.SetStateAction<ParentalLeaveConfig>>;
}

export const SettingsContent: React.FC<SettingsContentProps> = ({
  taxConfig,
  setTaxConfig,
  ccbConfig,
  setCcbConfig,
  childCostConfig,
  setChildCostConfig,
  parentalLeaveConfig,
  setParentalLeaveConfig,
}) => {
  const handleFederalBracketChange = (idx: number, field: keyof TaxBracket, val: number) => {
    setTaxConfig(prev => {
      const next = [...prev.federalBrackets];
      next[idx] = { ...next[idx], [field]: val };
      return { ...prev, federalBrackets: next };
    });
  };

  const handleOntarioBracketChange = (idx: number, field: keyof TaxBracket, val: number) => {
    setTaxConfig(prev => {
      const next = [...prev.ontarioBrackets];
      next[idx] = { ...next[idx], [field]: val };
      return { ...prev, ontarioBrackets: next };
    });
  };

  const handleTaxConfigChange = (field: keyof TaxConfig, val: number) =>
    setTaxConfig(prev => ({ ...prev, [field]: val }));

  const handleCcbConfigChange = (field: keyof CcbConfig, val: number) =>
    setCcbConfig(prev => ({ ...prev, [field]: val }));

  const handleChildCostChange = (field: keyof ChildCostConfig, val: number) =>
    setChildCostConfig(prev => ({ ...prev, [field]: val }));

  const handleParentalLeaveChange = (field: keyof ParentalLeaveConfig, val: number) =>
    setParentalLeaveConfig(prev => ({ ...prev, [field]: val }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1600px', margin: '0 auto', width: '100%' }}>

      {/* Info banner */}
      <div className="card" style={{ display: 'flex', gap: '16px', alignItems: 'center', background: 'rgba(56, 189, 248, 0.05)', borderColor: 'rgba(56, 189, 248, 0.2)' }}>
        <AlertCircle className="text-info" size={24} style={{ flexShrink: 0 }} />
        <div>
          <h4 style={{ margin: 0, color: 'var(--info)' }}>Global Settings & Tax Brackets</h4>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
            Configure Ontario/Federal progressive tax brackets, Basic Personal Amounts, CPP/EI, CCB clawbacks, child costs, and employer top-ups. Changes apply immediately.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>

        <BracketTable
          title="FEDERAL INCOME TAX BRACKETS (2026)"
          brackets={taxConfig.federalBrackets}
          onChange={handleFederalBracketChange}
        />

        <BracketTable
          title="ONTARIO TAX BRACKETS (2026)"
          brackets={taxConfig.ontarioBrackets}
          onChange={handleOntarioBracketChange}
        />

        <BpaCppEiConfig
          taxConfig={taxConfig}
          handleTaxConfigChange={handleTaxConfigChange}
        />

        <ChildRaisingCostsConfig
          childCostConfig={childCostConfig}
          handleChildCostChange={handleChildCostChange}
        />

        <ParentalLeaveConfigSection
          parentalLeaveConfig={parentalLeaveConfig}
          handleParentalLeaveChange={handleParentalLeaveChange}
        />

      </div>

      <CcbConfigSection
        ccbConfig={ccbConfig}
        handleCcbConfigChange={handleCcbConfigChange}
      />
    </div>
  );
};
export default SettingsContent;
