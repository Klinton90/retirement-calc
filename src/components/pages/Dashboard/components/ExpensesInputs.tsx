import React from 'react';
import type { ExpenseInput } from '../../../../types/calculator';
import { FormInput } from '../../../shared/FormInput';
import { Plus, Trash2 } from 'lucide-react';

interface ExpensesInputsProps {
  expenses: ExpenseInput[];
  setExpenses: React.Dispatch<React.SetStateAction<ExpenseInput[]>>;
  activeScenario: 'realistic' | 'mandatory';
}

export const ExpensesInputs: React.FC<ExpensesInputsProps> = ({ expenses, setExpenses, activeScenario }) => {
  const addExpense = () => {
    const newExp: ExpenseInput = {
      id: Math.random().toString(),
      label: 'New Expense',
      amount: 100,
      isMandatory: false,
    };
    setExpenses([...expenses, newExp]);
  };

  const removeExpense = (id: string) => {
    setExpenses(expenses.filter(e => e.id !== id));
  };

  const updateExpense = (id: string, label: string, amount: number, isMandatory: boolean) => {
    setExpenses(expenses.map(e => (e.id === id ? { ...e, label, amount, isMandatory } : e)));
  };

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
        {expenses.map(exp => {
          const isExcluded = activeScenario === 'mandatory' && !exp.isMandatory;
          return (
            <div
              key={exp.id}
              className="flex-between"
              style={{
                gap: '10px',
                opacity: isExcluded ? 0.45 : 1,
                transition: 'opacity 0.2s ease',
              }}
              title={isExcluded ? 'Excluded from active Mandatory calculation' : ''}
            >
              <FormInput
                value={exp.label}
                onChange={val => updateExpense(exp.id, val, exp.amount, exp.isMandatory)}
                style={{ flex: 2, margin: 0 }}
                inputStyle={{ padding: '8px' }}
                disabled={isExcluded}
              />
              <FormInput
                type="number"
                prefix="$"
                value={exp.amount}
                onChange={val => updateExpense(exp.id, exp.label, val, exp.isMandatory)}
                style={{ flex: 1.5, margin: 0 }}
                inputStyle={{ padding: '8px', width: '100%' }}
                disabled={isExcluded}
              />
              <button
                onClick={() => updateExpense(exp.id, exp.label, exp.amount, !exp.isMandatory)}
                className="btn btn-secondary"
                style={{
                  padding: '8px',
                  fontSize: '12px',
                  color: exp.isMandatory ? 'var(--success)' : 'var(--text-secondary)',
                  border: '1px solid',
                  borderColor: exp.isMandatory ? 'rgba(46, 204, 113, 0.4)' : 'rgba(255, 255, 255, 0.1)',
                  minWidth: '55px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  margin: 0,
                }}
                title={exp.isMandatory ? 'Mark as Want (Discretionary)' : 'Mark as Need (Mandatory)'}
              >
                {exp.isMandatory ? 'Need' : 'Want'}
              </button>
              <button onClick={() => removeExpense(exp.id)} className="btn btn-secondary" style={{ padding: '8px', color: 'var(--danger)' }}>
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
        <button onClick={addExpense} className="btn btn-secondary" style={{ width: '100%', marginTop: '8px' }}>
          <Plus size={16} /> Add Expense Item
        </button>
      </div>
      
      <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '14px', paddingTop: '10px' }} className="flex-between">
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          {activeScenario === 'mandatory' ? 'ACTIVE MANDATORY SPEND' : 'TOTAL MONTHLY SPEND'}
        </span>
        <span style={{ fontSize: '16px', fontWeight: 700, color: activeScenario === 'mandatory' ? 'var(--warning)' : 'var(--text-primary)' }}>
          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
            expenses.reduce((sum, e) => sum + (activeScenario === 'mandatory' && !e.isMandatory ? 0 : e.amount), 0)
          )}
        </span>
      </div>
    </div>
  );
};
export default ExpensesInputs;
