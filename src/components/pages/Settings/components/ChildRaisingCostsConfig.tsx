import React from 'react';
import type { ChildCostConfig } from '../../../../types/calculator';
import { FormInput } from '../../../shared/FormInput';

interface ChildRaisingCostsConfigProps {
  childCostConfig: ChildCostConfig;
  handleChildCostChange: (field: keyof ChildCostConfig, val: number) => void;
}

export const ChildRaisingCostsConfig: React.FC<ChildRaisingCostsConfigProps> = ({
  childCostConfig,
  handleChildCostChange,
}) => {
  return (
    <div className="card" style={{ padding: '20px' }}>
      <h3 style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        CHILD RAISING COSTS PER AGE BRACKET
      </h3>
      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
        Estimated monthly cost per child by age group. These expenses apply during pre-retirement years and terminate when the child turns 22.
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ color: 'var(--text-secondary)', fontSize: '12px', borderBottom: '1px solid var(--border-color)' }}>
            <th style={{ padding: '8px 4px', textAlign: 'left' }}>Age Group</th>
            <th style={{ padding: '8px 4px', textAlign: 'right' }}>Mandatory ($/mo)</th>
            <th style={{ padding: '8px 4px', textAlign: 'right' }}>Realistic ($/mo)</th>
          </tr>
        </thead>
        <tbody>
          {/* Ages 0 to 4 */}
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
            <td style={{ padding: '8px 4px', fontWeight: 600, fontSize: '12px' }}>0 to 4 (Toddler / Daycare)</td>
            <td style={{ padding: '8px 4px' }}>
              <FormInput
                type="number"
                prefix="$"
                value={childCostConfig.age0To4Mandatory}
                onChange={val => handleChildCostChange('age0To4Mandatory', val)}
                style={{ margin: 0 }}
                inputStyle={{ padding: '4px', fontSize: '12px', width: '75px', textAlign: 'right' }}
              />
            </td>
            <td style={{ padding: '8px 4px' }}>
              <FormInput
                type="number"
                prefix="$"
                value={childCostConfig.age0To4Realistic}
                onChange={val => handleChildCostChange('age0To4Realistic', val)}
                style={{ margin: 0 }}
                inputStyle={{ padding: '4px', fontSize: '12px', width: '75px', textAlign: 'right' }}
              />
            </td>
          </tr>
          {/* Ages 5 to 11 */}
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
            <td style={{ padding: '8px 4px', fontWeight: 600, fontSize: '12px' }}>5 to 11 (Primary School)</td>
            <td style={{ padding: '8px 4px' }}>
              <FormInput
                type="number"
                prefix="$"
                value={childCostConfig.age5To11Mandatory}
                onChange={val => handleChildCostChange('age5To11Mandatory', val)}
                style={{ margin: 0 }}
                inputStyle={{ padding: '4px', fontSize: '12px', width: '75px', textAlign: 'right' }}
              />
            </td>
            <td style={{ padding: '8px 4px' }}>
              <FormInput
                type="number"
                prefix="$"
                value={childCostConfig.age5To11Realistic}
                onChange={val => handleChildCostChange('age5To11Realistic', val)}
                style={{ margin: 0 }}
                inputStyle={{ padding: '4px', fontSize: '12px', width: '75px', textAlign: 'right' }}
              />
            </td>
          </tr>
          {/* Ages 12 to 17 */}
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
            <td style={{ padding: '8px 4px', fontWeight: 600, fontSize: '12px' }}>12 to 17 (Teenager)</td>
            <td style={{ padding: '8px 4px' }}>
              <FormInput
                type="number"
                prefix="$"
                value={childCostConfig.age12To17Mandatory}
                onChange={val => handleChildCostChange('age12To17Mandatory', val)}
                style={{ margin: 0 }}
                inputStyle={{ padding: '4px', fontSize: '12px', width: '75px', textAlign: 'right' }}
              />
            </td>
            <td style={{ padding: '8px 4px' }}>
              <FormInput
                type="number"
                prefix="$"
                value={childCostConfig.age12To17Realistic}
                onChange={val => handleChildCostChange('age12To17Realistic', val)}
                style={{ margin: 0 }}
                inputStyle={{ padding: '4px', fontSize: '12px', width: '75px', textAlign: 'right' }}
              />
            </td>
          </tr>
          {/* Ages 18 to 21 */}
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
            <td style={{ padding: '8px 4px', fontWeight: 600, fontSize: '12px' }}>18 to 21 (University/College)</td>
            <td style={{ padding: '8px 4px' }}>
              <FormInput
                type="number"
                prefix="$"
                value={childCostConfig.age18To21Mandatory}
                onChange={val => handleChildCostChange('age18To21Mandatory', val)}
                style={{ margin: 0 }}
                inputStyle={{ padding: '4px', fontSize: '12px', width: '75px', textAlign: 'right' }}
              />
            </td>
            <td style={{ padding: '8px 4px' }}>
              <FormInput
                type="number"
                prefix="$"
                value={childCostConfig.age18To21Realistic}
                onChange={val => handleChildCostChange('age18To21Realistic', val)}
                style={{ margin: 0 }}
                inputStyle={{ padding: '4px', fontSize: '12px', width: '75px', textAlign: 'right' }}
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
export default ChildRaisingCostsConfig;
