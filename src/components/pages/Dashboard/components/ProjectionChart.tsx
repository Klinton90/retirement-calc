import React, { useState, useRef } from 'react';
import type { ProjectionYear } from '../../../../types/calculator';
import { ChartDefs } from './ChartDefs';
import { ChartTooltip } from './ChartTooltip';

interface ProjectionChartProps {
  realisticData: ProjectionYear[];
  mandatoryData: ProjectionYear[];
  minSavingsData?: ProjectionYear[];
  activeScenario: 'realistic' | 'mandatory';
  retirementAgeHe: number;
}

export const ProjectionChart: React.FC<ProjectionChartProps> = ({
  realisticData,
  mandatoryData,
  minSavingsData,
  activeScenario,
  retirementAgeHe,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (!realisticData || realisticData.length === 0) return null;

  const svgWidth = 720;
  const svgHeight = 440;
  
  const paddingLeft = 75;
  const paddingRight = 20;
  const length = realisticData.length;
  const chartWidth = svgWidth - paddingLeft - paddingRight;

  const plot1Top = 25;
  const plot1Height = 160;
  const plot1Bottom = plot1Top + plot1Height;

  const plot2Top = 235;
  const plot2Height = 140;
  const plot2Bottom = plot2Top + plot2Height;

  const maxPortfolioVal = Math.max(
    ...realisticData.map(d => d.portfolioEnd),
    ...mandatoryData.map(d => d.portfolioEnd),
    ...(minSavingsData || []).map(d => d.portfolioEnd),
    100000
  );

  const getPlot1Coords = (index: number, val: number) => {
    const x = paddingLeft + (index / (length - 1)) * chartWidth;
    const y = plot1Bottom - (val / maxPortfolioVal) * plot1Height;
    return { x, y };
  };

  const activeData = activeScenario === 'realistic' ? realisticData : mandatoryData;
  const maxCashFlowVal = Math.max(
    ...activeData.map(d => Math.max(d.netIncome, d.expenses)),
    40000
  ) * 1.1;

  const getPlot2Coords = (index: number, val: number) => {
    const x = paddingLeft + (index / (length - 1)) * chartWidth;
    const y = plot2Bottom - (val / maxCashFlowVal) * plot2Height;
    return { x, y };
  };

  let realisticLine = '';
  let realisticArea = '';
  let mandatoryLine = '';
  let mandatoryArea = '';
  let minSavingsLine = '';

  realisticData.forEach((d, idx) => {
    const { x, y } = getPlot1Coords(idx, d.portfolioEnd);
    if (idx === 0) {
      realisticLine = `M ${x} ${y}`;
      realisticArea = `M ${x} ${plot1Bottom} L ${x} ${y}`;
    } else {
      realisticLine += ` L ${x} ${y}`;
      realisticArea += ` L ${x} ${y}`;
    }
  });
  realisticArea += ` L ${paddingLeft + chartWidth} ${plot1Bottom} Z`;

  mandatoryData.forEach((d, idx) => {
    const { x, y } = getPlot1Coords(idx, d.portfolioEnd);
    if (idx === 0) {
      mandatoryLine = `M ${x} ${y}`;
      mandatoryArea = `M ${x} ${plot1Bottom} L ${x} ${y}`;
    } else {
      mandatoryLine += ` L ${x} ${y}`;
      mandatoryArea += ` L ${x} ${y}`;
    }
  });
  mandatoryArea += ` L ${paddingLeft + chartWidth} ${plot1Bottom} Z`;

  if (minSavingsData) {
    minSavingsData.forEach((d, idx) => {
      const { x, y } = getPlot1Coords(idx, d.portfolioEnd);
      if (idx === 0) {
        minSavingsLine = `M ${x} ${y}`;
      } else {
        minSavingsLine += ` L ${x} ${y}`;
      }
    });
  }

  let incomeLine = '';
  let incomeArea = '';
  let spendLine = '';
  let spendArea = '';

  activeData.forEach((d, idx) => {
    const coordsInc = getPlot2Coords(idx, d.netIncome);
    const coordsSpend = getPlot2Coords(idx, d.expenses);

    if (idx === 0) {
      incomeLine = `M ${coordsInc.x} ${coordsInc.y}`;
      incomeArea = `M ${coordsInc.x} ${plot2Bottom} L ${coordsInc.x} ${coordsInc.y}`;
      spendLine = `M ${coordsSpend.x} ${coordsSpend.y}`;
      spendArea = `M ${coordsSpend.x} ${plot2Bottom} L ${coordsSpend.x} ${coordsSpend.y}`;
    } else {
      incomeLine += ` L ${coordsInc.x} ${coordsInc.y}`;
      incomeArea += ` L ${coordsInc.x} ${coordsInc.y}`;
      spendLine += ` L ${coordsSpend.x} ${coordsSpend.y}`;
      spendArea += ` L ${coordsSpend.x} ${coordsSpend.y}`;
    }
  });
  incomeArea += ` L ${paddingLeft + chartWidth} ${plot2Bottom} Z`;
  spendArea += ` L ${paddingLeft + chartWidth} ${plot2Bottom} Z`;

  const retirementIndex = realisticData.findIndex(d => d.ageHe >= retirementAgeHe);
  const retirementX = retirementIndex !== -1 ? paddingLeft + (retirementIndex / (length - 1)) * chartWidth : null;

  const depletedIndex = activeData.findIndex(d => d.isRetired && d.portfolioEnd === 0);
  const depletedX = depletedIndex !== -1 ? paddingLeft + (depletedIndex / (length - 1)) * chartWidth : null;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!svgRef.current) return;
    const svgRect = svgRef.current.getBoundingClientRect();
    const screenX = e.clientX - svgRect.left;
    const svgX = (screenX / svgRect.width) * svgWidth;
    const chartX = svgX - paddingLeft;
    
    let index = Math.round((chartX / chartWidth) * (length - 1));
    index = Math.max(0, Math.min(length - 1, index));
    setHoverIndex(index);
  };

  const formatCurrency = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  };

  const yTicks = 4;
  const xTicks = 6;

  return (
    <div className="card" style={{ position: 'relative', width: '100%', padding: '20px' }}>
      <div className="flex-between" style={{ marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h3 style={{ textTransform: 'uppercase', letterSpacing: '-0.3px', margin: 0 }}>PORTFOLIO PROJECTION & WEALTH TRAJECTORIES</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>Wealth projection (Plot 1) stacked above Scenario Cash Flows (Plot 2). Hover to audit year-by-year targets.</p>
        </div>
        <div style={{ display: 'flex', gap: '16px', fontSize: '12px', flexWrap: 'wrap' }}>
          <div className="flex-row"><span style={{ width: '12px', height: '12px', background: 'var(--primary)', borderRadius: '3px' }}></span><span>Realistic Portfolio</span></div>
          <div className="flex-row"><span style={{ width: '12px', height: '12px', background: 'var(--secondary)', borderRadius: '3px' }}></span><span>Mandatory Portfolio</span></div>
          <div className="flex-row">
            <span style={{ width: '12px', height: '3px', background: 'var(--warning)', display: 'inline-block', borderTop: '2px dashed var(--warning)' }}></span>
            <span>Break-Even Portfolio</span>
          </div>
          <div className="flex-row"><span style={{ width: '12px', height: '12px', background: 'var(--success)', borderRadius: '3px' }}></span><span>Net Income</span></div>
          <div className="flex-row"><span style={{ width: '12px', height: '12px', background: 'var(--danger)', borderRadius: '3px' }}></span><span>Total Spend</span></div>
        </div>
      </div>

      <svg ref={svgRef} width="100%" height="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="xMidYMid meet" onMouseMove={handleMouseMove} onMouseLeave={() => setHoverIndex(null)} style={{ overflow: 'visible', cursor: 'crosshair' }}>
        <ChartDefs />

        <text x={paddingLeft} y={plot1Top - 5} fill="var(--text-secondary)" fontSize="12" fontWeight="bold">PLOT 1: PORTFOLIO WEALTH BALANCE (CAPITAL RESERVES)</text>
        {Array.from({ length: yTicks }).map((_, i) => {
          const val = (maxPortfolioVal / (yTicks - 1)) * i;
          const { y } = getPlot1Coords(0, val);
          return (
            <g key={`p1-grid-${i}`}>
              <line x1={paddingLeft} y1={y} x2={paddingLeft + chartWidth} y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
              <text x={paddingLeft - 8} y={y + 4} fill="var(--text-muted)" fontSize="12" textAnchor="end">{formatCurrency(val)}</text>
            </g>
          );
        })}

        <path d={realisticArea} fill="url(#realGrad)" />
        <path d={realisticLine} fill="none" stroke="var(--primary)" strokeWidth="2.5" />
        <path d={mandatoryArea} fill="url(#mandGrad)" />
        <path d={mandatoryLine} fill="none" stroke="var(--secondary)" strokeWidth="2" strokeDasharray="4 3" />
        {/* Draw Break-Even Portfolio Line */}
        {minSavingsData && (
          <path d={minSavingsLine} fill="none" stroke="var(--warning)" strokeWidth="2.5" strokeDasharray="5 4" />
        )}

        <text x={paddingLeft} y={plot2Top - 8} fill="var(--text-secondary)" fontSize="12" fontWeight="bold">PLOT 2: ANNUAL CASH FLOW (NET INCOME vs. TARGET SPEND - {activeScenario.toUpperCase()} SCENARIO)</text>
        {Array.from({ length: yTicks }).map((_, i) => {
          const val = (maxCashFlowVal / (yTicks - 1)) * i;
          const { y } = getPlot2Coords(0, val);
          return (
            <g key={`p2-grid-${i}`}>
              <line x1={paddingLeft} y1={y} x2={paddingLeft + chartWidth} y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
              <text x={paddingLeft - 8} y={y + 4} fill="var(--text-muted)" fontSize="12" textAnchor="end">{formatCurrency(val)}/yr</text>
            </g>
          );
        })}

        <path d={incomeArea} fill="url(#incGrad)" />
        <path d={incomeLine} fill="none" stroke="var(--success)" strokeWidth="2" />
        <path d={spendArea} fill="url(#spendGrad)" />
        {/* Make Spend Line in Plot 2 dashed as requested */}
        <path d={spendLine} fill="none" stroke="var(--danger)" strokeWidth="2" strokeDasharray="4 3" />

        {Array.from({ length: xTicks }).map((_, i) => {
          const idx = Math.round(((length - 1) / (xTicks - 1)) * i);
          const point = realisticData[idx];
          if (!point) return null;
          const x = paddingLeft + (idx / (length - 1)) * chartWidth;
          return (
            <g key={`x-grid-${i}`}>
              <line x1={x} y1={plot1Top} x2={x} y2={plot2Bottom} stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
              <text x={x} y={plot2Bottom + 16} fill="var(--text-secondary)" fontSize="12" textAnchor="middle">Age {point.ageHe}</text>
              <text x={x} y={plot2Bottom + 28} fill="var(--text-muted)" fontSize="12" textAnchor="middle">({point.year})</text>
            </g>
          );
        })}

        {retirementX !== null && (
          <g>
            <line x1={retirementX} y1={plot1Top} x2={retirementX} y2={plot2Bottom} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" />
            <text x={retirementX + 5} y={plot1Top + 12} fill="#94a3b8" fontSize="12" fontWeight="bold">RETIREMENT</text>
          </g>
        )}

        {depletedX !== null && (
          <g>
            <line x1={depletedX} y1={plot1Top} x2={depletedX} y2={plot2Bottom} stroke="var(--danger)" strokeWidth="1.5" strokeDasharray="4 3" />
            <rect x={depletedX + 4} y={plot1Top + 4} width="165" height="18" rx="4" fill="rgba(239, 68, 68, 0.15)" stroke="var(--danger)" strokeWidth="0.5" />
            <text x={depletedX + 8} y={plot1Top + 16} fill="var(--danger)" fontSize="12" fontWeight="bold">Portfolio Depleted (Age {activeData[depletedIndex].ageHe})</text>
          </g>
        )}

        {hoverIndex !== null && (
          <g>
            <line x1={paddingLeft + (hoverIndex / (length - 1)) * chartWidth} y1={plot1Top} x2={paddingLeft + (hoverIndex / (length - 1)) * chartWidth} y2={plot2Bottom} stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1" pointerEvents="none" />
            <circle cx={getPlot1Coords(hoverIndex, realisticData[hoverIndex].portfolioEnd).x} cy={getPlot1Coords(hoverIndex, realisticData[hoverIndex].portfolioEnd).y} r="4.5" fill="var(--primary)" stroke="white" strokeWidth="1.5" />
            <circle cx={getPlot1Coords(hoverIndex, mandatoryData[hoverIndex].portfolioEnd).x} cy={getPlot1Coords(hoverIndex, mandatoryData[hoverIndex].portfolioEnd).y} r="4.5" fill="var(--secondary)" stroke="white" strokeWidth="1.5" />
            {/* Circle on Break-Even Portfolio */}
            {minSavingsData && minSavingsData[hoverIndex] && (
              <circle cx={getPlot1Coords(hoverIndex, minSavingsData[hoverIndex].portfolioEnd).x} cy={getPlot1Coords(hoverIndex, minSavingsData[hoverIndex].portfolioEnd).y} r="4.5" fill="var(--warning)" stroke="white" strokeWidth="1.5" />
            )}
            <circle cx={getPlot2Coords(hoverIndex, activeData[hoverIndex].netIncome).x} cy={getPlot2Coords(hoverIndex, activeData[hoverIndex].netIncome).y} r="4" fill="var(--success)" stroke="white" strokeWidth="1" />
            <circle cx={getPlot2Coords(hoverIndex, activeData[hoverIndex].expenses).x} cy={getPlot2Coords(hoverIndex, activeData[hoverIndex].expenses).y} r="4" fill="var(--danger)" stroke="white" strokeWidth="1" />
            <ChartTooltip hoverIndex={hoverIndex} realisticData={realisticData} mandatoryData={mandatoryData} minSavingsData={minSavingsData} activeScenario={activeScenario} svgWidth={svgWidth} plot1Top={plot1Top} chartWidth={chartWidth} paddingLeft={paddingLeft} formatCurrency={formatCurrency} />
          </g>
        )}
      </svg>
    </div>
  );
};
export default ProjectionChart;
