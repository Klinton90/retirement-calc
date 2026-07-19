import React from 'react';

interface ScenarioSelectorProps {
  activeScenario: 'realistic' | 'mandatory';
  setActiveScenario: (scenario: 'realistic' | 'mandatory') => void;
  includeExtraIncome: boolean;
  setIncludeExtraIncome: (val: boolean) => void;
}

export const ScenarioSelector: React.FC<ScenarioSelectorProps> = ({
  activeScenario,
  setActiveScenario,
  includeExtraIncome,
  setIncludeExtraIncome,
}) => {
  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        padding: '16px',
        gap: '12px',
      }}
    >
      <div>
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>CALCULATION SCENARIO</span>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
          Select budget path to inspect metrics, cash surplus, and details. Both lines are plotted in the chart.
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Scenario Selector */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', background: 'rgba(255,255,255,0.02)', padding: '3px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
          <button
            onClick={() => setActiveScenario('realistic')}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              background: activeScenario === 'realistic' ? 'var(--primary)' : 'transparent',
              color: activeScenario === 'realistic' ? 'white' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Realistic (Wants)
          </button>
          <button
            onClick={() => setActiveScenario('mandatory')}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              background: activeScenario === 'mandatory' ? 'var(--secondary)' : 'transparent',
              color: activeScenario === 'mandatory' ? 'white' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Mandatory (Needs)
          </button>
        </div>

        {/* Extra Income Toggle */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', background: 'rgba(255,255,255,0.02)', padding: '3px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
          <button
            onClick={() => setIncludeExtraIncome(true)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              background: includeExtraIncome ? 'var(--success)' : 'transparent',
              color: includeExtraIncome ? 'white' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            + Extra Income
          </button>
          <button
            onClick={() => setIncludeExtraIncome(false)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              background: !includeExtraIncome ? 'var(--danger)' : 'transparent',
              color: !includeExtraIncome ? 'white' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            No Extra Income
          </button>
        </div>
      </div>
    </div>
  );
};
export default ScenarioSelector;
