import React from 'react';
import type { ProjectionYear } from '../../../../types/calculator';

interface ChartTooltipProps {
  hoverIndex: number;
  realisticData: ProjectionYear[];
  mandatoryData: ProjectionYear[];
  minSavingsData?: ProjectionYear[];
  activeScenario: 'realistic' | 'mandatory';
  svgWidth: number;
  plot1Top: number;
  chartWidth: number;
  paddingLeft: number;
  formatCurrency: (val: number) => string;
}

export const ChartTooltip: React.FC<ChartTooltipProps> = ({
  hoverIndex,
  realisticData,
  mandatoryData,
  minSavingsData,
  activeScenario,
  svgWidth,
  plot1Top,
  chartWidth,
  paddingLeft,
  formatCurrency,
}) => {
  const length = realisticData.length;
  const activeData = activeScenario === 'realistic' ? realisticData : mandatoryData;

  const tooltipX =
    paddingLeft + (hoverIndex / (length - 1)) * chartWidth > svgWidth / 2
      ? paddingLeft + (hoverIndex / (length - 1)) * chartWidth - 305
      : paddingLeft + (hoverIndex / (length - 1)) * chartWidth + 15;

  return (
    <foreignObject
      x={tooltipX}
      y={plot1Top + 5}
      width="290"
      height="260"
      style={{ pointerEvents: 'none' }}
    >
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.98)',
          border: '1px solid var(--border-active)',
          borderRadius: '12px',
          padding: '12px',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.6)',
          fontSize: '12px',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {/* Tooltip Header */}
        <div style={{ fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px', marginBottom: '8px', color: 'var(--info)', fontSize: '12px' }}>
          Year {realisticData[hoverIndex].year} (Ages He {realisticData[hoverIndex].ageHe} / She {realisticData[hoverIndex].ageShe})
        </div>

        {/* Plot 1: Portfolio Balances */}
        <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
          CAPITAL RESERVES (PLOT 1)
        </div>
        <div className="flex-between" style={{ padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <span className="flex-row" style={{ gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', background: 'var(--primary)', borderRadius: '50%' }}></span>
            <span>Realistic (Wants):</span>
          </span>
          <span style={{ fontWeight: 700 }}>{formatCurrency(realisticData[hoverIndex].portfolioEnd)}</span>
        </div>
        <div className="flex-between" style={{ padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <span className="flex-row" style={{ gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', background: 'var(--secondary)', borderRadius: '50%' }}></span>
            <span>Mandatory (Needs):</span>
          </span>
          <span style={{ fontWeight: 700 }}>{formatCurrency(mandatoryData[hoverIndex].portfolioEnd)}</span>
        </div>
        {/* Break-Even Portfolio Row */}
        {minSavingsData && minSavingsData[hoverIndex] && (
          <div className="flex-between" style={{ padding: '2px 0', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span className="flex-row" style={{ gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', background: 'var(--warning)', borderRadius: '50%' }}></span>
              <span>Break-Even:</span>
            </span>
            <span style={{ fontWeight: 700, color: 'var(--warning)' }}>{formatCurrency(minSavingsData[hoverIndex].portfolioEnd)}</span>
          </div>
        )}

        {/* Plot 2: Active Scenario Cash Flows */}
        <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>
          {activeScenario} Cash Flow (PLOT 2)
        </div>
        <div className="flex-between" style={{ padding: '2px 0' }}>
          <span className="flex-row" style={{ gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', background: 'var(--success)', borderRadius: '50%' }}></span>
            <span>Net Income (Inflow):</span>
          </span>
          <span style={{ fontWeight: 700, color: 'var(--success)' }}>
            {formatCurrency(activeData[hoverIndex].netIncome / 12)}/mo
          </span>
        </div>
        <div className="flex-between" style={{ padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}>
          <span className="flex-row" style={{ gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', background: 'var(--danger)', borderRadius: '50%' }}></span>
            <span>Target Budget (Outflow):</span>
          </span>
          <span style={{ fontWeight: 700, color: 'var(--danger)' }}>
            {formatCurrency(activeData[hoverIndex].expenses / 12)}/mo
          </span>
        </div>

        {/* Child costs detailed breakdown */}
        {activeData[hoverIndex].childCosts > 0 && (
          <div className="flex-between" style={{ padding: '2px 0', color: 'var(--warning)', fontSize: '12px' }}>
            <span>↳ Child Cost Included:</span>
            <span>-{formatCurrency(activeData[hoverIndex].childCosts / 12)}/mo</span>
          </div>
        )}
        {activeData[hoverIndex].ccbBenefit > 0 && (
          <div className="flex-between" style={{ padding: '2px 0', color: 'var(--success)', fontSize: '12px' }}>
            <span>↳ Tax-free CCB Received:</span>
            <span>+{formatCurrency(activeData[hoverIndex].ccbBenefit / 12)}/mo</span>
          </div>
        )}

        {/* Drawdown Details in retirement */}
        {activeData[hoverIndex].isRetired && (
          <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <div>Pensions (Net): {formatCurrency(activeData[hoverIndex].pensionNet / 12)}/mo</div>
            <div>RRSP Drawdown (Net): {formatCurrency(activeData[hoverIndex].drawdownNet / 12)}/mo</div>
            {activeData[hoverIndex].retirementTax > 0 && (
              <div style={{ color: 'var(--danger)' }}>Combined Taxes paid: {formatCurrency(activeData[hoverIndex].retirementTax / 12)}/mo</div>
            )}
          </div>
        )}
      </div>
    </foreignObject>
  );
};
export default ChartTooltip;
