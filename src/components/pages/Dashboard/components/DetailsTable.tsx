import React, { useState } from 'react';
import type { ProjectionYear } from '../../../../types/calculator';
import { Table, EyeOff } from 'lucide-react';

const Tooltip: React.FC<{ text: string; alignLeft?: boolean }> = ({ text, alignLeft }) => (
  <span className={`tooltip-container ${alignLeft ? 'tooltip-left' : ''}`}>
    <span className="tooltip-icon">?</span>
    <span className="tooltip-text">{text}</span>
  </span>
);

interface DetailsTableProps {
  data: ProjectionYear[];
}

const dash = <span style={{ color: 'var(--text-muted)' }}>-</span>;

export const DetailsTable: React.FC<DetailsTableProps> = ({ data }) => {
  const [showTable, setShowTable] = useState(false);

  if (!data || data.length === 0) return null;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);

  const formatPct = (share: number | undefined) =>
    share == null || Number.isNaN(share) ? '' : ` · ${(share * 100).toFixed(0)}%`;

  const formatSurplus = (val: number) => {
    const monthly = val / 12;
    if (monthly > 0) {
      return (
        <span style={{ color: 'var(--success)', fontWeight: 600 }}>
          +{formatCurrency(monthly)}/mo
        </span>
      );
    }
    if (monthly < 0) {
      return (
        <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
          {formatCurrency(monthly)}/mo
        </span>
      );
    }
    return dash;
  };

  const cell = (val: number | undefined, opts?: { color?: string; share?: number }) => {
    if (val == null || Math.abs(val) < 0.5) return dash;
    return (
      <span style={{ color: opts?.color }}>
        {formatCurrency(val)}
        {opts?.share != null ? (
          <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{formatPct(opts.share)}</span>
        ) : null}
      </span>
    );
  };

  return (
    <div style={{ marginTop: '24px', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
        <button
          onClick={() => setShowTable(!showTable)}
          className="btn btn-secondary"
          style={{ gap: '10px', fontSize: '13px' }}
        >
          {showTable ? (
            <>
              <EyeOff size={16} /> Hide Detailed Year-by-Year Table
            </>
          ) : (
            <>
              <Table size={16} /> View Detailed Year-by-Year Table
            </>
          )}
        </button>
      </div>

      {showTable && (
        <div className="card" style={{ padding: '16px', width: '100%' }}>
          <h3 style={{ marginBottom: '6px' }}>ANNUAL AUDIT TRAIL</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 8px 0', lineHeight: 1.45, maxWidth: 1100 }}>
            <strong>Working:</strong> He net + She net + Extra + CCB + Refund (+ pensions if any) = <strong>Net Cash</strong>
            {' · '}
            <strong>Retired:</strong> He pen + She pen + He/She RRSP + He/She TFSA + Non-reg − Tax = <strong>Net Cash</strong>
            {' '}(≈ Spend when funded).
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 12px 0', lineHeight: 1.45, maxWidth: 1100 }}>
            <strong>Why He/She % is dynamic (not fixed 50/50):</strong> TFSA bridge draws the <em>larger remaining TFSA</em> first
            (secondary-earner tie-break). Extra RRSP (above each person’s RRIF minimum) repeatedly takes from whoever has the <em>larger remaining RRSP</em>.
            The % shown is that year’s outcome of those rules + starting balances — not a configured split.
            {' '}
            <strong>ESPP / Extra:</strong> not lifestyle spend — each person fills own TFSA then spouse TFSA, then own RRSP / Spousal / <em>non-reg</em> by MV (see “Where savings went”).
          </p>
          <div className="details-table-scroll">
            <table
              style={{
                width: '100%',
                fontSize: '12px',
                textAlign: 'left',
                whiteSpace: 'nowrap',
              }}
            >
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  <th colSpan={2} className="sticky-col-span" style={{ padding: '8px 10px', textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>
                    Year / Ages
                  </th>
                  <th style={{ padding: '8px 10px', textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>Status</th>
                  <th colSpan={1} style={{ padding: '8px 10px', textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>Taxable Gross</th>
                  <th
                    colSpan={14}
                    style={{ padding: '8px 10px', textAlign: 'center', borderRight: '1px solid var(--border-color)', background: 'rgba(34, 197, 94, 0.06)' }}
                  >
                    Build Net Cash (parts → total) · retired % = that year’s He share of the bucket
                  </th>
                  <th colSpan={4} style={{ padding: '8px 10px', textAlign: 'center', borderRight: '1px solid var(--border-color)', background: 'rgba(59, 130, 246, 0.02)' }}>Savings (working)</th>
                  <th colSpan={3} style={{ padding: '8px 10px', textAlign: 'center', borderRight: '1px solid var(--border-color)', background: 'rgba(14, 165, 233, 0.08)' }}>Where savings went</th>
                  <th colSpan={4} style={{ padding: '8px 10px', textAlign: 'center', borderRight: '1px solid var(--border-color)', background: 'rgba(251, 191, 36, 0.02)' }}>Room Left</th>
                  <th colSpan={3} style={{ padding: '8px 10px', textAlign: 'center', borderRight: '1px solid var(--border-color)', background: 'rgba(239, 68, 68, 0.02)' }}>Spend</th>
                  <th colSpan={4} style={{ padding: '8px 10px', textAlign: 'center', background: 'rgba(168, 85, 247, 0.02)' }}>Portfolio Ledger</th>
                </tr>
                <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th className="sticky-col-year" style={{ padding: '10px' }}>Year</th>
                  <th className="sticky-col-age" style={{ padding: '10px' }}>Ages</th>
                  <th style={{ padding: '10px', borderRight: '1px solid var(--border-color)' }}>Status</th>

                  <th style={{ padding: '10px', borderRight: '1px solid var(--border-color)' }}>
                    Taxable Gross <Tooltip text="Working: salaries+extras+pension. Retired: both pensions + both RRSP/RRIF + 50% non-reg. TFSA excluded." />
                  </th>

                  <th style={{ padding: '10px' }}>+ He Net <Tooltip text="Working only." /></th>
                  <th style={{ padding: '10px' }}>+ She Net <Tooltip text="Working only." /></th>
                  <th style={{ padding: '10px' }}>+ Extra</th>
                  <th style={{ padding: '10px' }}>+ CCB</th>
                  <th style={{ padding: '10px' }}>+ Refund</th>

                  <th style={{ padding: '10px' }}>
                    + He Pen <Tooltip text="He's CPP+OAS gross this year (by age)." />
                  </th>
                  <th style={{ padding: '10px' }}>
                    + She Pen <Tooltip text="She's CPP+OAS gross this year (by age)." />
                  </th>
                  <th style={{ padding: '10px' }}>
                    + He RRSP <Tooltip text="He's RRSP/RRIF gross draw. % = He÷(He+She) that year. Policy: each pays own RRIF min; extra from larger remaining RRSP." alignLeft />
                  </th>
                  <th style={{ padding: '10px' }}>
                    + She RRSP <Tooltip text="She's RRSP/RRIF gross draw. % = She÷(He+She)." alignLeft />
                  </th>
                  <th style={{ padding: '10px' }}>
                    + He TFSA <Tooltip text="He's TFSA draw. % = He÷(He+She). Policy: fill spend bridge from He TFSA first, then She." alignLeft />
                  </th>
                  <th style={{ padding: '10px' }}>
                    + She TFSA <Tooltip text="She's TFSA draw. % = She÷(He+She)." alignLeft />
                  </th>
                  <th style={{ padding: '10px' }}>
                    + Non-reg <Tooltip text="Household non-registered withdrawal (shared account)." alignLeft />
                  </th>
                  <th style={{ padding: '10px' }}>
                    − Tax <Tooltip text="Household retirement tax. Pension+RRSP(+taxable non-reg) − Tax + TFSA = Net Cash." alignLeft />
                  </th>
                  <th style={{ padding: '10px', borderRight: '1px solid var(--border-color)', fontWeight: 700 }}>
                    = Net Cash
                  </th>

                  <th style={{ padding: '10px' }}>Formula</th>
                  <th style={{ padding: '10px' }}>Planned</th>
                  <th style={{ padding: '10px' }}>Real Save</th>
                  <th style={{ padding: '10px', borderRight: '1px solid var(--border-color)' }}>Shortfall</th>

                  <th style={{ padding: '10px' }}>
                    → TFSA <Tooltip text="Working: Extra/ESPP into TFSA this year (own TFSA first, then spouse TFSA)." alignLeft />
                  </th>
                  <th style={{ padding: '10px' }}>
                    → RRSP <Tooltip text="Working: payroll RRSP + employer match + discretionary RRSP after TFSA (preferred spouse by soft capacity / income)." alignLeft />
                  </th>
                  <th style={{ padding: '10px', borderRight: '1px solid var(--border-color)' }}>
                    → Non-reg <Tooltip text="Working: overflow after TFSA + soft RRSP capacity. Still invested — not lifestyle. Common once both TFSAs are full." alignLeft />
                  </th>

                  <th style={{ padding: '10px' }}>He RRSP rm</th>
                  <th style={{ padding: '10px' }}>She RRSP rm</th>
                  <th style={{ padding: '10px' }}>He TFSA rm</th>
                  <th style={{ padding: '10px', borderRight: '1px solid var(--border-color)' }}>She TFSA rm</th>

                  <th style={{ padding: '10px' }}>Spend</th>
                  <th style={{ padding: '10px' }}>Child</th>
                  <th style={{ padding: '10px', borderRight: '1px solid var(--border-color)' }}>Surplus</th>

                  <th style={{ padding: '10px' }}>Port. Start</th>
                  <th style={{ padding: '10px' }}>± Port.</th>
                  <th style={{ padding: '10px' }}>
                    Returns <Tooltip text="Growth on Port. Start only (opening balance × return). This year’s contributions are added after growth — they do not earn a full-year return." alignLeft />
                  </th>
                  <th style={{ padding: '10px', fontWeight: 700 }}>Port. End</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, idx) => {
                  const retired = row.isRetired;
                  const portDelta = retired
                    ? -(row.portfolioDrawTotal ?? row.drawdownGross)
                    : row.actualSavings + Math.min(0, row.unallocatedCash);
                  const heRrspShare = row.heRrspDrawShare;
                  const sheRrspShare =
                    heRrspShare != null ? 1 - heRrspShare : undefined;
                  const heTfsaShare = row.heTfsaDrawShare;
                  const sheTfsaShare =
                    heTfsaShare != null ? 1 - heTfsaShare : undefined;

                  return (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        background: retired ? 'rgba(168, 85, 247, 0.03)' : 'transparent',
                        color: row.portfolioEnd === 0 && retired ? 'var(--danger)' : 'inherit',
                      }}
                    >
                      <td className="sticky-col-year" style={{ padding: '8px 10px', fontWeight: 600 }}>{row.year}</td>
                      <td className="sticky-col-age" style={{ padding: '8px 10px' }}>{`${row.ageHe} / ${row.ageShe}`}</td>
                      <td style={{ padding: '8px 10px', borderRight: '1px solid var(--border-color)' }}>
                        <span className={`badge ${retired ? 'badge-info' : 'badge-success'}`}>
                          {retired ? 'Retired' : 'Working'}
                        </span>
                      </td>

                      <td style={{ padding: '8px 10px', borderRight: '1px solid var(--border-color)' }}>
                        {formatCurrency(row.grossIncome)}
                      </td>

                      <td style={{ padding: '8px 10px' }}>
                        {retired ? dash : formatCurrency(row.heTakeHomePay)}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        {retired ? dash : formatCurrency(row.sheTakeHomePay)}
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--info)' }}>
                        {retired
                          ? dash
                          : cell(row.heExtraIncomeNet + row.sheExtraIncomeNet, { color: 'var(--info)' })}
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--success)' }}>
                        {retired ? dash : cell(row.ccbBenefit, { color: 'var(--success)' })}
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--success)' }}>
                        {retired ? dash : cell(row.taxSavingsPending, { color: 'var(--success)' })}
                      </td>

                      <td style={{ padding: '8px 10px', color: 'var(--success)' }}>
                        {cell(row.hePensionGross, { color: 'var(--success)' })}
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--success)' }}>
                        {cell(row.shePensionGross, { color: 'var(--success)' })}
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--primary)' }}>
                        {retired
                          ? cell(row.heRrspDraw, { color: 'var(--primary)', share: heRrspShare })
                          : dash}
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--primary)' }}>
                        {retired
                          ? cell(row.sheRrspDraw, { color: 'var(--primary)', share: sheRrspShare })
                          : dash}
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--success)' }}>
                        {retired
                          ? cell(row.heTfsaDraw, { color: 'var(--success)', share: heTfsaShare })
                          : dash}
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--success)' }}>
                        {retired
                          ? cell(row.sheTfsaDraw, { color: 'var(--success)', share: sheTfsaShare })
                          : dash}
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--warning)' }}>
                        {retired ? cell(row.nonRegDraw, { color: 'var(--warning)' }) : dash}
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--danger)' }}>
                        {retired && row.retirementTax > 0
                          ? `−${formatCurrency(row.retirementTax)}`
                          : dash}
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: 700, borderRight: '1px solid var(--border-color)' }}>
                        {formatCurrency(row.netIncome)}
                      </td>

                      <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>
                        {retired ? dash : formatCurrency(row.savingsTargetAmount)}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        {retired ? dash : formatCurrency(row.actualSavings)}
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--success)' }}>
                        {retired
                          ? dash
                          : formatCurrency(Math.max(0, row.actualSavings + Math.min(0, row.unallocatedCash)))}
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--danger)', borderRight: '1px solid var(--border-color)' }}>
                        {(() => {
                          if (retired) return dash;
                          const real = Math.max(0, row.actualSavings + Math.min(0, row.unallocatedCash));
                          const d = row.actualSavings - real;
                          return d > 0 ? `−${formatCurrency(d)}` : dash;
                        })()}
                      </td>

                      <td style={{ padding: '8px 10px', color: 'var(--success)' }}>
                        {retired ? dash : cell(row.contribToTfsa, { color: 'var(--success)' })}
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--primary)' }}>
                        {retired ? dash : cell(row.contribToRrsp, { color: 'var(--primary)' })}
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--warning)', borderRight: '1px solid var(--border-color)' }}>
                        {retired ? dash : cell(row.contribToNonReg, { color: 'var(--warning)' })}
                      </td>

                      <td style={{ padding: '8px 10px' }}>{formatCurrency(row.heRrspRoomRemaining ?? 0)}</td>
                      <td style={{ padding: '8px 10px' }}>{formatCurrency(row.sheRrspRoomRemaining ?? 0)}</td>
                      <td style={{ padding: '8px 10px' }}>{formatCurrency(row.heTfsaRoomRemaining ?? 0)}</td>
                      <td style={{ padding: '8px 10px', borderRight: '1px solid var(--border-color)' }}>
                        {formatCurrency(row.sheTfsaRoomRemaining ?? 0)}
                      </td>

                      <td style={{ padding: '8px 10px', color: 'var(--danger)' }}>
                        {retired
                          ? formatCurrency(row.expenses)
                          : formatCurrency(row.expenses - row.childCosts)}
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--warning)' }}>
                        {cell(row.childCosts, { color: 'var(--warning)' })}
                      </td>
                      <td style={{ padding: '8px 10px', borderRight: '1px solid var(--border-color)' }}>
                        {retired ? dash : formatSurplus(row.unallocatedCash)}
                      </td>

                      <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>
                        {formatCurrency(row.portfolioStart)}
                      </td>
                      <td
                        style={{
                          padding: '8px 10px',
                          color: portDelta > 0 ? 'var(--success)' : portDelta < 0 ? 'var(--danger)' : 'inherit',
                        }}
                      >
                        {portDelta > 0
                          ? `+${formatCurrency(portDelta)}`
                          : portDelta < 0
                            ? `−${formatCurrency(Math.abs(portDelta))}`
                            : '0'}
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--success)' }}>
                        {row.investmentGain > 0 ? `+${formatCurrency(row.investmentGain)}` : dash}
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: 700 }}>
                        {formatCurrency(row.portfolioEnd)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
export default DetailsTable;
