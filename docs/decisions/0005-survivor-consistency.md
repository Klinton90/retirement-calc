# ADR 0005: Survivor stress applied consistently across both engines

- Status: Accepted
- Date: 2026-07-17
- Relates: [`docs/explanation/math-model.md`](../explanation/math-model.md) §3.4, §3.7

## Context

The optional Survivor stress toggle models one spouse dying mid-retirement (crude v1). It existed in **`simulateDecumulation`** (target engine: Extra needed, →$0 band, nest-egg funding solve) but **not** in **`runProjection`** (Plot 1 "Realistic" line, Retirement Readiness, Retirement Monthly Deficit).

With the toggle **on**, the two engines answered different questions on the same plan:

- Same $2.70M nest egg, same $10k/mo spend, same 65/65 conversion.
- `simulateDecumulation` (survivor on): funded only 18/20 years, terminal $0 → **$310/mo Extra**, $290k short.
- `runProjection` (survivor ignored): funded 20/20, **$475k left at 85** → "Lasts to 85+", deficit $0.

The bottom-row control (survivor **off** in `simulateDecumulation`) funded 20/20 with ~$467k terminal — matching `runProjection`. So the entire discrepancy was one engine honoring the toggle and the other ignoring it, presented side-by-side as if consistent.

## Decision

`runProjection` applies the **same** survivor stress as `simulateDecumulation`:

- Trigger at retirement year index `survivorYearIndex` (default: `floor(lifeExpectancyDelta / 2)`).
- From that year on, the **primary earner** is treated as deceased by default
  ([ADR 0006](0006-symmetric-earner-roles.md)); `survivorWho` may explicitly select He or She:
  - The deceased's OAS stops entirely (OAS has no survivor benefit).
  - **CPP survivor benefit:** the survivor keeps their own CPP **plus 60% of the deceased's CPP** (`CPP_SURVIVOR_RATE`), capped at the max single CPP retirement pension (`survivorCombinedCppAnnual`).
  - **Pension income-splitting is disabled** (`canSplit` requires both alive).
- **Retirement spend drops to `survivorSpendFactor` (default 0.70)** of the couple's target for the survivor years — a single survivor spends less than the couple. Exposed as a **UI slider (50–100%)** under the survivor toggle; applied identically in both engines.
- Household **assets remain available** to the survivor (deliberately crude — no asset-side survivor haircut in v1).
- Toggle default stays **off**.

Result: Plot 1, Readiness, Deficit, Extra needed, and the →$0 band all share one survivor assumption (income loss **and** reduced spend).

### Direction note (not a bug)

Survivor stress can make the **required** nest egg go *up or down* depending on the spend factor. Losing the higher earner's OAS + net CPP is a fixed income hit; the spend cut scales with the factor. For a high-spend household the break-even is roughly a spend factor of **~0.78**: below that (e.g. the 0.70 default) the 30% spend cut saves more than the lost pension, so the survivor case needs *less* capital; above it, survivor is a genuine downside. The **"nest egg at retirement" card never moves** with the toggle — the death is mid-retirement (decumulation), while that card measures accumulation up to age 65.

## Consequences

- With survivor on, the live plan now depletes at ~age 83 on Plot 1 (was showing ~$475k at 85), matching the $310/mo Extra and the →$0 shortfall — no more split-brain cards.
- The Readiness footer now reports `monthlyPersonalSavingsNeeded` (same as the Gap card); the legacy `solveRequiredSavings` no longer drives that display.
- Survivor models both the income drop (lost CPP/OAS, no splitting) and a spend drop (`survivorSpendFactor`, default 0.70). A full asset-side survivor model (e.g. lost TFSA room, estate/probate) is out of scope for v1.

## Rejected

- **Turn survivor off for the funding solve** so cards match by dropping the stress — hides real widow(er) risk from the headline number.
- **Label the two paths with different assumptions** and leave the math inconsistent — cheapest, but keeps two contradictory answers on screen.
