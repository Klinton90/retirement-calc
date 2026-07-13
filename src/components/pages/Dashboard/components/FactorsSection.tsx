import React from 'react';
import { type FactorInput, FactorType } from '../../../../types/calculator';
import { ShieldAlert, Trash2, Plus, Percent, DollarSign, Calendar } from 'lucide-react';

interface FactorsSectionProps {
  factors: FactorInput[];
  setFactors: React.Dispatch<React.SetStateAction<FactorInput[]>>;
  heAge: number;
}

export const FactorsSection: React.FC<FactorsSectionProps> = ({
  factors,
  setFactors,
  heAge,
}) => {
  const addFactor = (type: FactorType) => {
    let label = 'New Custom Event';
    let val = 0;
    let duration = 1;
    let startAge = heAge + 1;

    switch (type) {
      case FactorType.MATERNITY_LEAVE:
        label = 'Maternity Leave (She)';
        val = 12;
        duration = 1;
        break;
      case FactorType.PATERNITY_LEAVE:
        label = 'Paternity Leave (He)';
        val = 2;
        duration = 1;
        break;
      case FactorType.BLACK_SWAN:
        label = 'Market Crash (Black Swan)';
        val = 30;
        duration = 1;
        break;
      case FactorType.INFLATION:
        label = 'High Inflation Phase';
        val = 5;
        duration = 3;
        break;
      case FactorType.CHILD:
        label = 'Child Cost';
        val = 8000;
        duration = 18;
        break;
    }

    const newFactor: FactorInput = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      label,
      value: val,
      startAgeHe: startAge,
      durationYears: duration,
      isActive: true,
    };

    setFactors([...factors, newFactor]);
  };

  const updateFactor = (id: string, field: keyof FactorInput, val: any) => {
    setFactors(
      factors.map(f => (f.id === id ? { ...f, [field]: val } : f))
    );
  };

  const removeFactor = (id: string) => {
    setFactors(factors.filter(f => f.id !== id));
  };

  const getFactorIcon = (type: FactorType) => {
    switch (type) {
      case FactorType.BLACK_SWAN:
        return <ShieldAlert size={18} style={{ color: 'var(--danger)' }} />;
      case FactorType.MATERNITY_LEAVE:
      case FactorType.PATERNITY_LEAVE:
        return <Calendar size={18} style={{ color: 'var(--info)' }} />;
      case FactorType.INFLATION:
        return <Percent size={18} style={{ color: 'var(--warning)' }} />;
      default:
        return <DollarSign size={18} style={{ color: 'var(--primary)' }} />;
    }
  };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="flex-between">
        <div>
          <h3>EXTENSIBLE LIFE FACTORS</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Simulate black swan events, maternity leave, and inflation spikes.
          </p>
        </div>
      </div>

      {/* List of factors */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {factors.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px' }}>
            No factors added. Click below to add simulation events.
          </p>
        ) : (
          factors.map(factor => {
            const isPast = factor.startAgeHe + factor.durationYears <= heAge;
            const isInactiveOrPast = !factor.isActive || isPast;
            
            return (
              <div
                key={factor.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  borderColor: factor.isActive ? 'var(--border-active)' : 'var(--border-color)',
                  opacity: isInactiveOrPast ? 0.5 : 1,
                  transition: 'border-color 0.2s ease, opacity 0.2s ease',
                }}
                title={isPast ? 'Event ended in the past and is excluded from calculations' : !factor.isActive ? 'Event is turned off' : ''}
              >
                {/* Header: Title and Toggle */}
                <div className="flex-between" style={{ gap: '8px' }}>
                  <div className="flex-row" style={{ flex: 1, minWidth: 0, gap: '8px' }}>
                    {getFactorIcon(factor.type)}
                    <input
                      type="text"
                      value={factor.label}
                      onChange={e => updateFactor(factor.id, 'label', e.target.value)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: isInactiveOrPast ? 'var(--text-secondary)' : 'var(--text-primary)',
                        padding: 0,
                        width: '100%',
                        minWidth: 0,
                      }}
                      disabled={isPast}
                    />
                  </div>
                  
                  <div className="flex-row" style={{ flexShrink: 0, gap: '8px' }}>
                    <label className="toggle-container" style={{ gap: 0 }}>
                      <input
                        type="checkbox"
                        checked={factor.isActive}
                        onChange={e => updateFactor(factor.id, 'isActive', e.target.checked)}
                        style={{ display: 'none' }}
                      />
                      <div className="toggle-switch"></div>
                    </label>

                    <button
                      onClick={() => removeFactor(factor.id)}
                      className="btn btn-secondary"
                      style={{ padding: '6px 8px', color: 'var(--danger)' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Settings: Start age & Duration */}
                <div className="input-group-row" style={{ margin: 0, gap: '12px', gridTemplateColumns: (factor.type === FactorType.MATERNITY_LEAVE || factor.type === FactorType.PATERNITY_LEAVE) ? '1fr' : '1fr 1fr' }}>
                  <div className="input-group" style={{ margin: 0, opacity: isInactiveOrPast ? 0.6 : 1 }}>
                    <label style={{ fontSize: '12px', color: isInactiveOrPast ? 'var(--text-muted)' : 'var(--text-secondary)' }}>Start Age (He)</label>
                    <input
                      type="number"
                      value={factor.startAgeHe || ''}
                      onChange={e => updateFactor(factor.id, 'startAgeHe', e.target.value === '' ? 0 : Number(e.target.value))}
                      style={{ padding: '6px', fontSize: '12px' }}
                      disabled={isInactiveOrPast}
                    />
                    {isPast && <span style={{ fontSize: '10px', color: 'var(--danger)', display: 'block', marginTop: '2px' }}>Event is in past</span>}
                  </div>
                  
                  {factor.type !== FactorType.MATERNITY_LEAVE && factor.type !== FactorType.PATERNITY_LEAVE && (
                    <div className="input-group" style={{ margin: 0, opacity: isInactiveOrPast ? 0.6 : 1 }}>
                      <label style={{ fontSize: '12px', color: isInactiveOrPast ? 'var(--text-muted)' : 'var(--text-secondary)' }}>Duration (yrs)</label>
                      <input
                        type="number"
                        value={factor.durationYears || ''}
                        onChange={e => updateFactor(factor.id, 'durationYears', e.target.value === '' ? 0 : Number(e.target.value))}
                        style={{ padding: '6px', fontSize: '12px' }}
                        disabled={isInactiveOrPast}
                      />
                    </div>
                  )}
                </div>

              {/* Settings: Value/Months */}
              <div className="input-group" style={{ margin: 0, opacity: isInactiveOrPast ? 0.6 : 1 }}>
                <label style={{ fontSize: '12px', color: isInactiveOrPast ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
                  {factor.type === FactorType.MATERNITY_LEAVE || factor.type === FactorType.PATERNITY_LEAVE
                    ? 'Leave Duration (months)'
                    : factor.type === FactorType.BLACK_SWAN && factor.value < 100
                    ? 'Portfolio Crash Drop (%)'
                    : 'Annual Cost / Value ($ / yr)'}
                </label>
                <input
                  type="number"
                  min={0}
                  value={factor.value || ''}
                  onChange={e => {
                    const num = e.target.value === '' ? 0 : Number(e.target.value);
                    if (factor.type === FactorType.MATERNITY_LEAVE || factor.type === FactorType.PATERNITY_LEAVE) {
                      const calculatedDuration = Math.ceil(num / 12) || 1;
                      setFactors(factors.map(f => f.id === factor.id ? { ...f, value: num, durationYears: calculatedDuration } : f));
                    } else {
                      updateFactor(factor.id, 'value', num);
                    }
                  }}
                  style={{ padding: '6px', fontSize: '12px' }}
                  disabled={isInactiveOrPast}
                />
              </div>
            </div>
          );
        })
        )}
      </div>

      {/* Add Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
        <button
          onClick={() => addFactor(FactorType.BLACK_SWAN)}
          className="btn btn-secondary"
          style={{ fontSize: '12px', padding: '8px' }}
        >
          <Plus size={12} /> + Market Crash
        </button>
        <button
          onClick={() => addFactor(FactorType.INFLATION)}
          className="btn btn-secondary"
          style={{ fontSize: '12px', padding: '8px' }}
        >
          <Plus size={12} /> + High Inflation
        </button>
      </div>
    </div>
  );
};
export default FactorsSection;
