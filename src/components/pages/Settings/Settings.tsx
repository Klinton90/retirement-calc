import React from 'react';
import type { TaxConfig, CcbConfig, ChildCostConfig, ParentalLeaveConfig } from '../../../types/calculator';
import { SettingsContent } from './components/SettingsContent';

interface SettingsProps {
  taxConfig: TaxConfig;
  setTaxConfig: React.Dispatch<React.SetStateAction<TaxConfig>>;
  ccbConfig: CcbConfig;
  setCcbConfig: React.Dispatch<React.SetStateAction<CcbConfig>>;
  childCostConfig: ChildCostConfig;
  setChildCostConfig: React.Dispatch<React.SetStateAction<ChildCostConfig>>;
  parentalLeaveConfig: ParentalLeaveConfig;
  setParentalLeaveConfig: React.Dispatch<React.SetStateAction<ParentalLeaveConfig>>;
}

export const Settings: React.FC<SettingsProps> = (props) => {
  return (
    <main style={{ maxWidth: '1600px', margin: '0 auto', width: '100%', padding: '24px' }}>
      <SettingsContent {...props} />
    </main>
  );
};
export default Settings;
