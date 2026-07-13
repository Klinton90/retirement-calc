import React from 'react';
import { Landmark } from 'lucide-react';
import { FundingRegime } from '../../../../types/calculator';
import type { ConversionScenarioResult } from '../../../../utils/targetEngine';

interface ConversionGuidePanelProps {
  ranking: ConversionScenarioResult[];
  regime: FundingRegime;
  endAge: number;
}

const fmt = (val: number, compact = false) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
    notation: compact ? 'compact' : 'standard',
  }).format(val);

export const ConversionGuidePanel: React.FC<ConversionGuidePanelProps> = ({
  ranking,
  regime,
  endAge,
}) => {
  if (!ranking.length) return null;
  const best = ranking[0];

  return (
    <div className="card" style={{ padding: '20px 24px' }}>
      <div className="flex-between" style={{ marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Landmark size={18} style={{ color: 'var(--info)' }} />
          <div>
            <h3 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '-0.3px', fontSize: '14px' }}>
              RRSP → RRIF conversion
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
              Grid 65–71 × 65–71 · min $ solved @71 · re-ranked for regime <strong>{regime}</strong> · to ~{endAge}
            </p>
          </div>
        </div>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--success)' }}>
          Suggest He@{best.conversionAgeHe} / She@{best.conversionAgeShe}
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '8px 6px', fontWeight: 600 }}>Rank</th>
              <th style={{ padding: '8px 6px', fontWeight: 600 }}>He convert</th>
              <th style={{ padding: '8px 6px', fontWeight: 600 }}>She convert</th>
              <th style={{ padding: '8px 6px', fontWeight: 600 }}>Years funded</th>
              <th style={{ padding: '8px 6px', fontWeight: 600 }}>Terminal</th>
              <th style={{ padding: '8px 6px', fontWeight: 600 }}>Tax paid</th>
              <th style={{ padding: '8px 6px', fontWeight: 600 }}>OAS claw</th>
              <th style={{ padding: '8px 6px', fontWeight: 600 }}>Regime</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((row, i) => {
              const isBest = i === 0;
              return (
                <tr
                  key={`${row.conversionAgeHe}-${row.conversionAgeShe}-${i}`}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: isBest ? 'rgba(16,185,129,0.08)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '8px 6px', fontWeight: isBest ? 700 : 500 }}>
                    {isBest ? '★ Best' : `#${i + 1}`}
                  </td>
                  <td style={{ padding: '8px 6px' }}>{row.conversionAgeHe}</td>
                  <td style={{ padding: '8px 6px' }}>{row.conversionAgeShe}</td>
                  <td style={{ padding: '8px 6px' }}>
                    {row.yearsFunded}/{row.horizonYears}
                  </td>
                  <td style={{ padding: '8px 6px' }}>{fmt(row.terminalWealth, true)}</td>
                  <td style={{ padding: '8px 6px' }}>{fmt(row.totalTaxPaid, true)}</td>
                  <td style={{ padding: '8px 6px' }}>{fmt(row.totalOasClawback, true)}</td>
                  <td style={{ padding: '8px 6px', fontWeight: 600 }}>{row.regime}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ margin: '12px 0 0 0', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.45 }}>
        Scoring: UNDER → maximize years funded; NEAR → meet spend then min tax/clawback; ABOVE → keep spend floor then favor terminal wealth − tax − clawback.
        Full convert only (no partial RRIF in v1). Not financial advice.
      </p>
    </div>
  );
};

export default ConversionGuidePanel;
