import React from 'react';
import { Calculator, Sliders, Landmark, RefreshCw } from 'lucide-react';

interface HeaderProps {
  activeTab: 'planner' | 'taxSettings';
  setActiveTab: (tab: 'planner' | 'taxSettings') => void;
  resetToDefaults: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, resetToDefaults }) => {
  return (
    <header className="app-header">
      <div className="flex-between" style={{ maxWidth: '1600px', margin: '0 auto', width: '100%', alignItems: 'center' }}>
        <div className="flex-row">
          <Calculator size={28} className="text-gradient" />
          <div>
            <h1 style={{ fontSize: '24px', margin: 0, fontWeight: 700, letterSpacing: '-0.5px' }}>
              RetireSmart <span className="text-gradient">Canada</span>
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Personal Retirement Projection Engine & Tax Optimizer (Local Sandbox)
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.02)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <button
            onClick={() => setActiveTab('planner')}
            className="btn"
            style={{
              padding: '6px 16px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: activeTab === 'planner' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'planner' ? 'white' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            <Sliders size={14} /> Retirement Planner
          </button>
          <button
            onClick={() => setActiveTab('taxSettings')}
            className="btn"
            style={{
              padding: '6px 16px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: activeTab === 'taxSettings' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'taxSettings' ? 'white' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            <Landmark size={14} /> Settings & Brackets
          </button>
        </div>
        
        <button onClick={resetToDefaults} className="btn btn-secondary" style={{ fontSize: '12px', gap: '6px' }}>
          <RefreshCw size={14} /> Reset Defaults
        </button>
      </div>
    </header>
  );
};
export default Header;
