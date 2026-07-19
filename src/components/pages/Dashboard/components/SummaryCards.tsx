import React from 'react';
import { type HouseholdTaxResult, SavingsBase } from '../../../../types/calculator';
import { DollarSign, TrendingUp, Sparkles } from 'lucide-react';

interface SummaryCardsProps {
  householdTax: HouseholdTaxResult;
  savingsBase: SavingsBase;
  savingsTargetRate: number;
  unallocatedCash: number;
  ccbBenefitMonthly: number;
  childCostsMonthly: number;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  householdTax,
  savingsBase,
  savingsTargetRate,
  unallocatedCash,
  ccbBenefitMonthly,
  childCostsMonthly,
}) => {
  const {
    totalHouseholdGross,
    totalHouseholdNet,
    totalHouseholdActualSavings,
    savingsDrift,
    actualSavingsRate,
  } = householdTax;

  const targetPercentageText = `${(savingsTargetRate * 100).toFixed(0)}%`;
  const isDriftPositive = savingsDrift >= 0;
  const actualSavingsRateText = `${(actualSavingsRate * 100).toFixed(1)}%`;
  const monthlySurplus = unallocatedCash / 12;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '24px' }}>
      
      {/* GROUP 1: PRE-RETIREMENT PLAN & CASH FLOW */}
      <div>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
          Current Cash Flow & Plan (Pre-Retirement)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
          
          {/* 1. Take-Home Pay card */}
          <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }} title="Statutory net income after taxes, before any voluntary contributions like RRSP, ESPP, TFSA.">
            <div className="flex-between" style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>TAKE-HOME PAY</span>
              <DollarSign size={18} style={{ color: 'var(--info)' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '4px 0', letterSpacing: '-0.5px' }}>
                {formatCurrency(totalHouseholdNet / 12)}
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 400 }}>/mo net</span>
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                Gross: {formatCurrency(totalHouseholdGross / 12)}/mo
              </p>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0 0', lineHeight: '1.3' }}>
                Net after statutory taxes. Before RRSP/ESPP & other voluntary savings.
              </p>
            </div>
          </div>

          {/* 2. Savings & Drift Card */}
          <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }} title="Your actual voluntary savings rate today compared to your target percentage.">
            <div className="flex-between" style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>ACTUAL SAVINGS & DRIFT</span>
              <TrendingUp size={18} style={{ color: isDriftPositive ? 'var(--success)' : 'var(--warning)' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '4px 0', letterSpacing: '-0.5px' }}>
                {formatCurrency(totalHouseholdActualSavings / 12)}
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 400 }}>/mo actual</span>
              </h2>
              <div className="flex-row" style={{ marginTop: '4px', gap: '6px', flexWrap: 'wrap' }}>
                <span className={`badge ${isDriftPositive ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '12px', padding: '2px 6px' }}>
                  {isDriftPositive ? '+' : ''}{formatCurrency(savingsDrift / 12)}/mo drift
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {actualSavingsRateText} actual vs {targetPercentageText} target of {savingsBase.toLowerCase()}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Disposable Monthly Cash Surplus */}
          <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div className="flex-between" style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>DISPOSABLE CASH SURPLUS</span>
              <Sparkles size={18} style={{ color: monthlySurplus > 0 ? 'var(--success)' : 'var(--danger)' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '4px 0', letterSpacing: '-0.5px', color: monthlySurplus > 0 ? 'var(--success)' : 'var(--danger)' }}>
                {monthlySurplus > 0 ? `+${formatCurrency(monthlySurplus)}` : formatCurrency(monthlySurplus)}
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 400 }}>/mo left</span>
              </h2>
              {(childCostsMonthly > 0 || ccbBenefitMonthly > 0) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', margin: '4px 0 6px 0', padding: '6px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12px' }}>
                  {childCostsMonthly > 0 && (
                    <div className="flex-between">
                      <span style={{ color: 'var(--text-secondary)' }}>Child Costs:</span>
                      <span style={{ color: 'var(--danger)', fontWeight: 600 }}>-{formatCurrency(childCostsMonthly)}/mo</span>
                    </div>
                  )}
                  {ccbBenefitMonthly > 0 && (
                    <div className="flex-between">
                      <span style={{ color: 'var(--text-secondary)' }}>CCB Benefit:</span>
                      <span style={{ color: 'var(--success)', fontWeight: 600 }}>+{formatCurrency(ccbBenefitMonthly)}/mo</span>
                    </div>
                  )}
                </div>
              )}
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0 0', lineHeight: '1.3' }}>
                Leftover cash after actual savings & expenses. Assumed fully spent on lifestyle (not accumulated in portfolio).
              </p>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};

export default SummaryCards;
