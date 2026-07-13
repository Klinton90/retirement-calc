import React from 'react';
import type { TaxBracket } from '../../types/calculator';
import { FormInput } from './FormInput';

interface BracketTableProps {
  title: string;
  brackets: TaxBracket[];
  onChange: (idx: number, field: keyof TaxBracket, val: number) => void;
}

export const BracketTable: React.FC<BracketTableProps> = ({ title, brackets, onChange }) => {
  return (
    <div className="card" style={{ padding: '20px' }}>
      <h3 style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        {title}
      </h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ color: 'var(--text-secondary)', fontSize: '12px', borderBottom: '1px solid var(--border-color)' }}>
            <th style={{ padding: '8px 4px', textAlign: 'left' }}>Tier</th>
            <th style={{ padding: '8px 4px', textAlign: 'left' }}>Threshold ($)</th>
            <th style={{ padding: '8px 4px', textAlign: 'right' }}>Rate (%)</th>
          </tr>
        </thead>
        <tbody>
          {brackets.map((bracket, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
              <td style={{ padding: '8px 4px', fontWeight: 600, fontSize: '12px' }}>Tier {idx + 1}</td>
              <td style={{ padding: '8px 4px' }}>
                <FormInput
                  type="number"
                  prefix="$"
                  disabled={bracket.threshold === Infinity}
                  value={bracket.threshold === Infinity ? '' : bracket.threshold}
                  placeholder="Infinity"
                  onChange={val => onChange(idx, 'threshold', val === 0 || val === '' ? (bracket.threshold === Infinity ? Infinity : 0) : val)}
                  style={{ margin: 0 }}
                  inputStyle={{ padding: '6px', fontSize: '12px', width: '100%' }}
                />
              </td>
              <td style={{ padding: '8px 4px' }}>
                <FormInput
                  type="number"
                  suffix="%"
                  step={0.01}
                  value={bracket.rate === 0 ? 0 : Number((bracket.rate * 100).toFixed(2))}
                  onChange={val => onChange(idx, 'rate', val / 100)}
                  style={{ margin: 0 }}
                  inputStyle={{ padding: '6px', fontSize: '12px', width: '70px', textAlign: 'right' }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
export default BracketTable;
