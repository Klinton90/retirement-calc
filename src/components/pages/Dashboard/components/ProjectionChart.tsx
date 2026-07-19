import React, { useState, useRef } from 'react';
import type { ProjectionYear } from '../../../../types/calculator';
import { plot1PortfolioBalance } from '../../../../utils/chartWealth';
import { ChartDefs } from './ChartDefs';
import { ChartTooltip } from './ChartTooltip';

const TFSA_COLOR = '#14b8a6';
const RRSP_COLOR = '#6366f1';
const NONREG_COLOR = '#94a3b8';

function stackedAreaPath(
  bottom: number[],
  top: number[],
  toPoint: (index: number, value: number) => { x: number; y: number }
) {
  if (!top.length) return '';
  const upper = top.map((value, index) => {
    const { x, y } = toPoint(index, value);
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  });
  const lower = bottom
    .map((value, index) => ({ index, value }))
    .reverse()
    .map(({ index, value }) => {
      const { x, y } = toPoint(index, value);
      return `L ${x} ${y}`;
    });
  return `${upper.join(' ')} ${lower.join(' ')} Z`;
}

interface ProjectionChartProps {
  realisticData: ProjectionYear[];
  mandatoryData: ProjectionYear[];
  minSavingsData?: ProjectionYear[];
  activeScenario: 'realistic' | 'mandatory';
  retirementAgeHe: number;
  /** He's age at earliest joint comfortable stop (omit when none). */
  earliestRetireAgeHe?: number;
}

export const ProjectionChart: React.FC<ProjectionChartProps> = ({
  realisticData,
  mandatoryData,
  minSavingsData,
  activeScenario,
  retirementAgeHe,
  earliestRetireAgeHe,
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
    ...realisticData.map(plot1PortfolioBalance),
    ...mandatoryData.map(plot1PortfolioBalance),
    ...(minSavingsData || []).map(plot1PortfolioBalance),
    100000
  );

  const getPlot1Coords = (index: number, val: number) => {
    const x = paddingLeft + (index / (length - 1)) * chartWidth;
    const y = plot1Bottom - (val / maxPortfolioVal) * plot1Height;
    return { x, y };
  };

  const activeData = activeScenario === 'realistic' ? realisticData : mandatoryData;
  // Bucket balances are end-of-year, while Plot 1 uses opening balances in
  // retirement. Preserve the account proportions but scale each stack to the
  // exact aggregate balance displayed by Plot 1.
  const activeBucketMix = activeData.map(d => {
    const balances = d.bucketBalances;
    const tfsaRaw = (balances?.tfsaHe ?? 0) + (balances?.tfsaShe ?? 0);
    const rrspRaw = (balances?.rrspHe ?? 0) + (balances?.rrspShe ?? 0);
    const nonRegRaw = balances?.nonReg ?? 0;
    const rawTotal = tfsaRaw + rrspRaw + nonRegRaw;
    const displayedTotal = plot1PortfolioBalance(d);
    const scale = rawTotal > 0 ? displayedTotal / rawTotal : 0;
    return {
      tfsa: tfsaRaw * scale,
      rrsp: rrspRaw * scale,
      nonReg: nonRegRaw * scale,
    };
  });
  const tfsaTop = activeBucketMix.map(mix => mix.tfsa);
  const rrspTop = activeBucketMix.map(mix => mix.tfsa + mix.rrsp);
  const totalTop = activeBucketMix.map(mix => mix.tfsa + mix.rrsp + mix.nonReg);
  const zeroBottom = activeBucketMix.map(() => 0);
  const tfsaArea = stackedAreaPath(zeroBottom, tfsaTop, getPlot1Coords);
  const rrspArea = stackedAreaPath(tfsaTop, rrspTop, getPlot1Coords);
  const nonRegArea = stackedAreaPath(rrspTop, totalTop, getPlot1Coords);

  // Plot 2: income/spend and spend+intended contrib.
  // Strain (net − spend − intended) stays in the tooltip only.
  const spendPlusContribOf = (d: ProjectionYear) =>
    d.expenses + (d.intendedPersonalCash ?? 0);
  const maxCashFlowVal = Math.max(
    ...activeData.map(d => Math.max(d.netIncome, d.expenses, spendPlusContribOf(d))),
    40000
  ) * 1.1;
  const minCashFlowVal = 0;
  const cashFlowSpan = Math.max(1, maxCashFlowVal - minCashFlowVal);

  const getPlot2Coords = (index: number, val: number) => {
    const x = paddingLeft + (index / (length - 1)) * chartWidth;
    const y = plot2Bottom - ((val - minCashFlowVal) / cashFlowSpan) * plot2Height;
    return { x, y };
  };
  const plot2ZeroY = getPlot2Coords(0, 0).y;

  let realisticLine = '';
  let realisticArea = '';
  let mandatoryLine = '';
  let mandatoryArea = '';
  let minSavingsLine = '';

  realisticData.forEach((d, idx) => {
    const { x, y } = getPlot1Coords(idx, plot1PortfolioBalance(d));
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
    const { x, y } = getPlot1Coords(idx, plot1PortfolioBalance(d));
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
      const { x, y } = getPlot1Coords(idx, plot1PortfolioBalance(d));
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
  let spendPlusLine = '';

  activeData.forEach((d, idx) => {
    const coordsInc = getPlot2Coords(idx, d.netIncome);
    const coordsSpend = getPlot2Coords(idx, d.expenses);
    const coordsSpendPlus = getPlot2Coords(idx, spendPlusContribOf(d));

    if (idx === 0) {
      incomeLine = `M ${coordsInc.x} ${coordsInc.y}`;
      incomeArea = `M ${coordsInc.x} ${plot2ZeroY} L ${coordsInc.x} ${coordsInc.y}`;
      spendLine = `M ${coordsSpend.x} ${coordsSpend.y}`;
      spendArea = `M ${coordsSpend.x} ${plot2ZeroY} L ${coordsSpend.x} ${coordsSpend.y}`;
      spendPlusLine = `M ${coordsSpendPlus.x} ${coordsSpendPlus.y}`;
    } else {
      incomeLine += ` L ${coordsInc.x} ${coordsInc.y}`;
      incomeArea += ` L ${coordsInc.x} ${coordsInc.y}`;
      spendLine += ` L ${coordsSpend.x} ${coordsSpend.y}`;
      spendArea += ` L ${coordsSpend.x} ${coordsSpend.y}`;
      spendPlusLine += ` L ${coordsSpendPlus.x} ${coordsSpendPlus.y}`;
    }
  });
  incomeArea += ` L ${paddingLeft + chartWidth} ${plot2ZeroY} Z`;
  spendArea += ` L ${paddingLeft + chartWidth} ${plot2ZeroY} Z`;

  const retirementIndex = realisticData.findIndex(d => d.ageHe >= retirementAgeHe);
  const retirementX = retirementIndex !== -1 ? paddingLeft + (retirementIndex / (length - 1)) * chartWidth : null;

  const earliestIndex =
    earliestRetireAgeHe != null && earliestRetireAgeHe < retirementAgeHe
      ? realisticData.findIndex(d => d.ageHe >= earliestRetireAgeHe)
      : -1;
  const earliestX =
    earliestIndex !== -1 ? paddingLeft + (earliestIndex / (length - 1)) * chartWidth : null;

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
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
            Full-life viewer. Realistic ≈ Nest Egg card at retire. Active portfolio fill shows TFSA / RRSP / Non-reg mix. Yellow dashed is the Portfolio → $0 comparison. Plot 2 = cash flow.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '16px', fontSize: '12px', flexWrap: 'wrap' }}>
          <div className="flex-row"><span style={{ width: '12px', height: '12px', background: 'var(--primary)', borderRadius: '3px' }}></span><span>Realistic (≈ Nest Egg @ retire)</span></div>
          <div className="flex-row"><span style={{ width: '12px', height: '12px', background: 'var(--secondary)', borderRadius: '3px' }}></span><span>Mandatory Portfolio</span></div>
          <div className="flex-row">
            <span style={{ width: '12px', height: '3px', background: 'var(--warning)', display: 'inline-block', borderTop: '2px dashed var(--warning)' }}></span>
            <span>Portfolio → $0 (Min Savings)</span>
          </div>
          <div className="flex-row">
            <span style={{ width: '12px', height: '12px', background: TFSA_COLOR, borderRadius: '3px', opacity: 0.65 }}></span>
            <span>TFSA</span>
          </div>
          <div className="flex-row">
            <span style={{ width: '12px', height: '12px', background: RRSP_COLOR, borderRadius: '3px', opacity: 0.65 }}></span>
            <span>RRSP</span>
          </div>
          <div className="flex-row">
            <span style={{ width: '12px', height: '12px', background: NONREG_COLOR, borderRadius: '3px', opacity: 0.65 }}></span>
            <span>Non-reg</span>
          </div>
          <div className="flex-row"><span style={{ width: '12px', height: '12px', background: 'var(--success)', borderRadius: '3px' }}></span><span>Net Income</span></div>
          <div className="flex-row"><span style={{ width: '12px', height: '12px', background: 'var(--danger)', borderRadius: '3px' }}></span><span>Total Spend</span></div>
          <div className="flex-row">
            <span style={{ width: '12px', height: '3px', background: '#38bdf8', display: 'inline-block', borderTop: '2px dashed #38bdf8' }}></span>
            <span>Spend + intended contrib</span>
          </div>
          {earliestX !== null && (
            <div className="flex-row">
              <span
                style={{
                  width: '12px',
                  height: '3px',
                  background: 'var(--info)',
                  display: 'inline-block',
                  borderTop: '2px dashed var(--info)',
                }}
              />
              <span>Earliest comfortable</span>
            </div>
          )}
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

        {/* Active scenario account mix, scaled to the aggregate Plot 1 line. */}
        <path d={tfsaArea} fill={TFSA_COLOR} fillOpacity="0.24" />
        <path d={rrspArea} fill={RRSP_COLOR} fillOpacity="0.22" />
        <path d={nonRegArea} fill={NONREG_COLOR} fillOpacity="0.20" />
        <path d={realisticArea} fill="url(#realGrad)" />
        <path d={realisticLine} fill="none" stroke="var(--primary)" strokeWidth="2.5" />
        <path d={mandatoryArea} fill="url(#mandGrad)" />
        <path d={mandatoryLine} fill="none" stroke="var(--secondary)" strokeWidth="2" strokeDasharray="4 3" />
        {/* Portfolio → $0 overlay */}
        {minSavingsData && (
          <path d={minSavingsLine} fill="none" stroke="var(--warning)" strokeWidth="2.5" strokeDasharray="5 4" />
        )}

        <text x={paddingLeft} y={plot2Top - 8} fill="var(--text-secondary)" fontSize="12" fontWeight="bold">PLOT 2: ANNUAL CASH FLOW (NET INCOME vs. TARGET SPEND - {activeScenario.toUpperCase()} SCENARIO)</text>
        {Array.from({ length: yTicks }).map((_, i) => {
          const val = minCashFlowVal + (cashFlowSpan / (yTicks - 1)) * i;
          const { y } = getPlot2Coords(0, val);
          return (
            <g key={`p2-grid-${i}`}>
              <line x1={paddingLeft} y1={y} x2={paddingLeft + chartWidth} y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
              <text x={paddingLeft - 8} y={y + 4} fill="var(--text-muted)" fontSize="12" textAnchor="end">{formatCurrency(val)}/yr</text>
            </g>
          );
        })}

        {/* Zero baseline */}
        <line
          x1={paddingLeft}
          y1={plot2ZeroY}
          x2={paddingLeft + chartWidth}
          y2={plot2ZeroY}
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="1"
          strokeDasharray="2 2"
        />

        <path d={incomeArea} fill="url(#incGrad)" />
        <path d={incomeLine} fill="none" stroke="var(--success)" strokeWidth="2" />
        <path d={spendArea} fill="url(#spendGrad)" />
        <path d={spendLine} fill="none" stroke="var(--danger)" strokeWidth="2" strokeDasharray="4 3" />
        {/* Spend + full intended personal contributions (compare vs net income) */}
        <path d={spendPlusLine} fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="5 3" />

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

        {earliestX !== null && retirementX !== null && (
          <rect
            x={earliestX}
            y={plot1Top}
            width={Math.max(0, retirementX - earliestX)}
            height={plot2Bottom - plot1Top}
            fill="rgba(6,182,212,0.06)"
          />
        )}

        {earliestX !== null && (
          <g>
            <line
              x1={earliestX}
              y1={plot1Top}
              x2={earliestX}
              y2={plot2Bottom}
              stroke="var(--info)"
              strokeWidth="1.25"
              strokeDasharray="4 3"
            />
            <rect
              x={earliestX + 4}
              y={plot1Top + 4}
              width="72"
              height="18"
              rx="4"
              fill="rgba(6,182,212,0.15)"
              stroke="var(--info)"
              strokeWidth="0.5"
            />
            <text x={earliestX + 10} y={plot1Top + 16} fill="var(--info)" fontSize="12" fontWeight="bold">
              EARLIEST
            </text>
          </g>
        )}

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
            <circle cx={getPlot1Coords(hoverIndex, plot1PortfolioBalance(realisticData[hoverIndex])).x} cy={getPlot1Coords(hoverIndex, plot1PortfolioBalance(realisticData[hoverIndex])).y} r="4.5" fill="var(--primary)" stroke="white" strokeWidth="1.5" />
            <circle cx={getPlot1Coords(hoverIndex, plot1PortfolioBalance(mandatoryData[hoverIndex])).x} cy={getPlot1Coords(hoverIndex, plot1PortfolioBalance(mandatoryData[hoverIndex])).y} r="4.5" fill="var(--secondary)" stroke="white" strokeWidth="1.5" />
            {/* → $0 path hover point */}
            {minSavingsData && minSavingsData[hoverIndex] && (
              <circle cx={getPlot1Coords(hoverIndex, plot1PortfolioBalance(minSavingsData[hoverIndex])).x} cy={getPlot1Coords(hoverIndex, plot1PortfolioBalance(minSavingsData[hoverIndex])).y} r="4.5" fill="var(--warning)" stroke="white" strokeWidth="1.5" />
            )}
            <circle cx={getPlot2Coords(hoverIndex, activeData[hoverIndex].netIncome).x} cy={getPlot2Coords(hoverIndex, activeData[hoverIndex].netIncome).y} r="4" fill="var(--success)" stroke="white" strokeWidth="1" />
            <circle cx={getPlot2Coords(hoverIndex, activeData[hoverIndex].expenses).x} cy={getPlot2Coords(hoverIndex, activeData[hoverIndex].expenses).y} r="4" fill="var(--danger)" stroke="white" strokeWidth="1" />
            <circle
              cx={getPlot2Coords(hoverIndex, spendPlusContribOf(activeData[hoverIndex])).x}
              cy={getPlot2Coords(hoverIndex, spendPlusContribOf(activeData[hoverIndex])).y}
              r="4"
              fill="#38bdf8"
              stroke="white"
              strokeWidth="1"
            />
            <ChartTooltip
              hoverIndex={hoverIndex}
              realisticData={realisticData}
              mandatoryData={mandatoryData}
              minSavingsData={minSavingsData}
              activeScenario={activeScenario}
              earliestRetireAgeHe={earliestRetireAgeHe}
              svgWidth={svgWidth}
              plot1Top={plot1Top}
              chartWidth={chartWidth}
              paddingLeft={paddingLeft}
              formatCurrency={formatCurrency}
            />
          </g>
        )}
      </svg>
    </div>
  );
};
export default ProjectionChart;
