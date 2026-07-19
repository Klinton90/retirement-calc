# ADR 0004: Extra $/mo — Plot 1 / Readiness primary + design backsolve

- Status: Accepted
- Date: 2026-07-17
- Updated: 2026-07-18
- Relates: [`docs/explanation/math-model.md`](../explanation/math-model.md) §3.7

## Context

The Gap / “Extra needed for lifestyle” card must answer how much additional personal $/mo the family needs. Two engines disagree at the margin:

- **Viewer** (`runProjection` / Plot 1 / Retirement Readiness) — “is the plan OK?” on the live cash path.
- **Target backsolve** (`simulateDecumulation` @71/71) — design Extra under the two-step conversion gate.

Users also see nest-egg face-value gaps and ask how those convert to $/mo. Closed-form PMTs answer yet another question and must not replace either engine.

Failed shapes:

1. **Hard $50k/mo ceiling** on the binary search — Extra undeployable on cash-aware path → stuck at ceiling as if that were the answer.
2. **Idealized-only funded check** — “No Extra needed” while Nest Egg at Retirement / live path is still short.
3. **Nest-egg $ gap alone** — wrong unit (user wants $/mo).
4. **Gap answered only with `→$0 band − projected`** — ignores tax mix, conversion, cash-aware baseline.
5. **Headline = BACKSOLVE @71 while Readiness is already green** — contradicts the primary “plan OK?” signal (Plot 1).

## Decision

1. **Primary “plan OK?”** = Plot 1 / Retirement Readiness / Deficit (`analyzeRetirementShortfall` on `runProjection`). Not the →$0 band, not nest-egg face-value, not @71 backsolve alone.
2. **Gap card headline** = **READINESS** Extra (`solveExtraForReadiness`) — min additional solver Extra $/mo so the viewer path lasts the full horizon (or `>$…` if unreachable). Same conversion ages as Plot 1 (recommended after grid re-rank).
3. **Funding Extra solve** (`monthlyPersonalSavingsNeeded`, conversion **@71/71**) remains the **design / two-step** Extra:
   - Start from realistic retirement buckets; add marginal idealized Extra: `realistic₀ + (ideal(M) − ideal(0))`.
   - Expand until @71 funds (or safety max); report known-good upper bound; no $50k product cap.
   - Shown as labeled **BACKSOLVE** column — not the Gap headline.
4. Gap card **four labeled estimates** (sorted low → high in UI):
   | Column | Source | Role |
   |---|---|---|
   | **READINESS** | `solveExtraForReadiness` | **Primary** — greens Plot 1 / Readiness |
   | **BACKSOLVE** | `monthlyPersonalSavingsNeeded` | Design Extra under @71/71 |
   | **→$0 MIX** | `monthlyFromWealthGap(yourMix − projected)` | Diagnostic wealth-gap PMT |
   | **SOLVE EGG** | `monthlyFromWealthGap(shortfallFromCurrentPath)` | Diagnostic wealth-gap PMT |

5. Wealth-gap PMTs are never the sole headline. BACKSOLVE is never the sole headline when it disagrees with Readiness.

## Consequences

- Extra headline aligns with Readiness / Plot 1 / Deficit.
- BACKSOLVE can still show Extra when Readiness is already green (design vs live path) — labeled, not headline.
- READINESS Extra is cash-aware; free-cash cuts can make it higher or unreachable (`>$…`) even when BACKSOLVE finds a number.

## Rejected

- Solving design Extra entirely inside cash-aware accumulate as the *only* Extra (false ceilings).
- Idealized-only funded check that hides live-path shortfall.
- Nest-egg $ as Gap primary.
- Wealth-gap PMT as Gap primary.
- Keeping BACKSOLVE as Gap headline while Plot 1 is the “plan OK?” light.
