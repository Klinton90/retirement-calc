# RetireSmart Canada — agent instructions

Personal Canadian retirement calculator (Ontario). Client-side only. Not financial advice.

## Stack

- React + TypeScript + Vite
- Types/enums: `src/types/calculator.ts` only; prefer enums over string unions
- `import type` under `verbatimModuleSyntax`
- Custom SVG charts only (no Recharts)
- Persist plan in `localStorage` key `retiresmart_plan_v1` — no backend

## Documentation (read this first in a new session)

- Map: [`docs/README.md`](docs/README.md)
- Living math model: [`docs/explanation/math-model.md`](docs/explanation/math-model.md)
- Decisions: [`docs/decisions/`](docs/decisions/)
- Active change specs: [`docs/specs/active/`](docs/specs/active/)

Cursor also uses scoped rules under `.cursor/rules/`. Do not duplicate long domain text into rules.

## Math invariants (summary)

- Target **backsolve** is the product core; long projection is a viewer.
- Model **TFSA / RRSP·RRIF / non-reg** buckets — never treat all wealth as taxable RRSP.
- **Nest egg at retirement** card = current-path (cash-aware) projection (`projectedNestEggAtRetirement`); min need for spend → ≈$0 is the separate →$0 band. Excess “funded” = `isFundedWithoutExtra`, not conversion regime.
- **Extra needed for lifestyle** = Gap **headline** = READINESS Extra (`solveExtraForReadiness`) so Plot 1 / Readiness lasts the full horizon; BACKSOLVE (`monthlyPersonalSavingsNeeded` @71/71) and wealth-gap PMTs are diagnostics ([ADR 0004](docs/decisions/0004-extra-funding-solve.md)). Never nest-egg gap alone as the answer.
- Symmetric allocation: each person's Extra/ESPP/refund → own TFSA then spouse TFSA; personal RRSP is owner-only; cross-spouse RRSP is spousal-only (primary contributes, secondary owns); residual by MV order ([ADR 0003](docs/decisions/0003-excess-marginal-value.md), [ADR 0006](docs/decisions/0006-symmetric-earner-roles.md)). Soft capacity is diagnostic.
- RRIF minima; conversion ages 65–71 compared; two-step recommend (see math-model doc).
- OAS/CPP by **age each year**; do not zero OAS for entire retirement if stop-work age &lt; 65. OAS uses **arrival year**; CPP uses **work-start year** (`cppStartYear`) — two inputs, not one.
- Income split: RRIF (65+) only — not OAS; not fake 50/50 of all gross.
- Retirement readiness / “lasts to 85” = **primary “plan OK?”** — active projection shortfall, not solved conversion curve. Readiness does **not** show Extra needed (that lives on the Gap card only).
- Earliest comfortable retirement = joint `yearsEarlier` on both stop-work ages so the **active** Realistic/Mandatory path still lasts the **same** terminal age ([ADR 0007](docs/decisions/0007-early-retirement-solve.md)); twin of Extra Spend Capacity.
- Two current engines, different jobs (neither deprecated): `simulateDecumulation`/`calculatePlanTargets` = **backsolve core** (design Extra @71 / →$0 / surplus); `runProjection` = **viewer** (Plot 1 / readiness / Deficit / Gap headline Extra) under the actual withdrawal policy. Both model the **same horizon** via `resolveRetirementHorizon` (`lifeExpectancyDelta` retirement years, ages 65..84, $0 at ~85; default **20** — never a different engine fallback). `runProjection` loops `t < projectionYearsFromNow`. Readiness ↔ Deficit share `analyzeRetirementShortfall`. Deprecated = `solveRequiredSavings` only.
- Survivor stress is applied **identically** in both engines (primary earner deceased by default; optional override; survivor CPP benefit, no split, spend factor 0.70, assets stay); Plot 1/readiness/deficit must match Extra/→$0 ([ADR 0005](docs/decisions/0005-survivor-consistency.md), [ADR 0006](docs/decisions/0006-symmetric-earner-roles.md)).
- All assumptions configurable; label cards (real $, ~20y to ~85, survivor toggle).

## Testing

Logic changes need tests in `src/test/`. Skip full test runs for pure styling tweaks.

## Handoff

Update `docs/explanation/` or ADRs when product/math decisions change. Archive finished specs.

At phase B2/C gates (or other triggers in `docs/README.md`), self-evaluate full OpenSpec upgrade and report upgrade/wait — do not wait for the human to ask.
