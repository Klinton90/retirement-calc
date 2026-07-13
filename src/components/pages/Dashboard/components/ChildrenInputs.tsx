import React from 'react';
import type { ChildInput, PersonInput } from '../../../../types/calculator';
import { FormInput } from '../../../shared/FormInput';
import { Plus, Trash2 } from 'lucide-react';

interface ChildrenInputsProps {
  children: ChildInput[];
  heInput: PersonInput;
  setChildren: React.Dispatch<React.SetStateAction<ChildInput[]>>;
}

export const ChildrenInputs: React.FC<ChildrenInputsProps> = ({ children, heInput, setChildren }) => {
  const addChild = () => {
    const defaultBirthAgeHe = Math.max(heInput.age, 38);
    const isFuture = defaultBirthAgeHe > heInput.age;
    const newChild: ChildInput = {
      id: Math.random().toString(),
      age: isFuture ? 0 : heInput.age - defaultBirthAgeHe,
      birthAgeHe: defaultBirthAgeHe,
      sheLeaveMonths: 12,
      heLeaveMonths: 2,
    };
    setChildren([...children, newChild]);
  };

  const removeChild = (id: string) => {
    setChildren(children.filter(c => c.id !== id));
  };

  const updateChildField = (id: string, field: keyof ChildInput, val: any) => {
    setChildren(children.map(c => (c.id === id ? { ...c, [field]: val } : c)));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {children.map((child, idx) => {
        const birthAge = child.birthAgeHe ?? heInput.age;
        const isPlanned = birthAge > heInput.age;
        const isChildExcluded = child.age > 21;
        const isLeaveExcluded = child.age >= 2;
        
        return (
          <div
            key={child.id}
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border-color)',
              padding: '14px',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              opacity: isChildExcluded ? 0.45 : 1,
              transition: 'opacity 0.2s ease',
            }}
            title={isChildExcluded ? 'Child is past age 21 and excluded from all calculations' : ''}
          >
            <div className="flex-between">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>CHILD #{idx + 1}</span>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: isChildExcluded ? 'rgba(239, 68, 68, 0.15)' : isPlanned ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.05)',
                  color: isChildExcluded ? 'var(--danger)' : isPlanned ? 'var(--primary)' : 'var(--text-secondary)',
                  border: isChildExcluded ? '1px solid rgba(239, 68, 68, 0.3)' : isPlanned ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(255,255,255,0.1)',
                }}>
                  {isChildExcluded ? 'Excluded (> Age 21)' : isPlanned ? `Planned (in ${birthAge - heInput.age} yrs)` : `Born (Age ${child.age})`}
                </span>
              </div>
              <button onClick={() => removeChild(child.id)} className="btn btn-secondary" style={{ padding: '4px 6px', color: 'var(--danger)', border: 'none', background: 'transparent' }}>
                <Trash2 size={14} />
              </button>
            </div>
            
            {/* Synchronized birth inputs */}
            <div className="input-group-row" style={{ margin: 0, gap: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              <FormInput
                label="He's Age at Birth"
                type="number"
                value={birthAge}
                onChange={val => {
                  setChildren(children.map(ch => {
                    if (ch.id === child.id) {
                      const isFuture = val > heInput.age;
                      return {
                        ...ch,
                        birthAgeHe: val,
                        age: isFuture ? 0 : heInput.age - val
                      };
                    }
                    return ch;
                  }));
                }}
                style={{ margin: 0 }}
                labelStyle={{ fontSize: '12px' }}
                inputStyle={{ padding: '6px', fontSize: '12px' }}
                min={0}
              />
              <FormInput
                label="Current Age Today"
                type="number"
                value={child.age}
                onChange={val => {
                  setChildren(children.map(ch => {
                    if (ch.id === child.id) {
                      const isCurrentlyPlanned = (ch.birthAgeHe ?? heInput.age) > heInput.age;
                      const newBirthAge = (val <= 0 && isCurrentlyPlanned) 
                         ? ch.birthAgeHe 
                         : heInput.age - val;
                      return {
                        ...ch,
                        age: Math.max(0, val),
                        birthAgeHe: newBirthAge
                      };
                    }
                    return ch;
                  }));
                }}
                style={{ margin: 0 }}
                labelStyle={{ fontSize: '12px' }}
                inputStyle={{ padding: '6px', fontSize: '12px' }}
                min={0}
              />
            </div>

            <div className="input-group-row" style={{ margin: 0, gap: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              <FormInput
                label="She Leave (months)"
                type="number"
                value={child.sheLeaveMonths ?? 12}
                onChange={val => updateChildField(child.id, 'sheLeaveMonths', val)}
                style={{ margin: 0, opacity: (isLeaveExcluded || isChildExcluded) ? 0.45 : 1, transition: 'opacity 0.2s ease' }}
                labelStyle={{ fontSize: '12px', textTransform: 'none' }}
                inputStyle={{ padding: '6px', fontSize: '12px' }}
                min={0}
                disabled={isLeaveExcluded || isChildExcluded}
                helperText={(isLeaveExcluded && !isChildExcluded) ? 'Excluded (Past leave age)' : ''}
              />
              <FormInput
                label="He Leave (months)"
                type="number"
                value={child.heLeaveMonths ?? 2}
                onChange={val => updateChildField(child.id, 'heLeaveMonths', val)}
                style={{ margin: 0, opacity: (isLeaveExcluded || isChildExcluded) ? 0.45 : 1, transition: 'opacity 0.2s ease' }}
                labelStyle={{ fontSize: '12px', textTransform: 'none' }}
                inputStyle={{ padding: '6px', fontSize: '12px' }}
                min={0}
                disabled={isLeaveExcluded || isChildExcluded}
                helperText={(isLeaveExcluded && !isChildExcluded) ? 'Excluded (Past leave age)' : ''}
              />
            </div>
          </div>
        );
      })}
      
      <button onClick={addChild} className="btn btn-secondary" style={{ width: '100%', marginTop: '4px' }}>
        <Plus size={16} /> Add Child
      </button>
    </div>
  );
};
export default ChildrenInputs;
