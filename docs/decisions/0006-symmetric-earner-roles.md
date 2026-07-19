# ADR 0006: Symmetric optimization via earner roles (not hardcoded He)

- Status: Accepted
- Date: 2026-07-18
- Relates: [`docs/explanation/math-model.md`](../explanation/math-model.md) §3.3, §3.4, §3.7;
  [ADR 0003](0003-excess-marginal-value.md), [ADR 0004](0004-extra-funding-solve.md),
  [ADR 0005](0005-survivor-consistency.md); spec
  [`docs/specs/archive/2026-07-18-symmetric-optimization/`](../specs/archive/2026-07-18-symmetric-optimization/)

## Context

The allocation/optimization logic assumed **He = higher earner + ESPP owner**. Audit (2026-07-18)
found the assumption baked into four live places plus one dead function:

1. **ESPP dropped for She (correctness bug).** `targetEngine.ts:596-598` computes ESPP from
   `plan.heInput` only; `retirementCalc.ts:625` likewise. She's ESPP never enters the backsolve
   even though the UI collects it.
2. **ESPP routed He-only.** `deployDiscretionaryByMvOrder` pools ESPP into `heOrder`.
3. **One-way ownership spill.** He's stream can fill `TFSA_SHE`/`RRSP_SHE`; She's cannot reach His.
4. **One-way spousal RRSP.** Only He-contributes / She-owns; consumes He's room.
5. **Survivor always kills He.**

`preferDiscretionaryRrspOwner` was already symmetric. The `allocateDiscretionaryYear`
"Never She RRSP" cascade is dead code.

## Decision

Express allocation, attribution, and stress logic in terms of **earner roles**, never hardcoded
He/She:

- **Roles:** `primary` = higher **base gross** salary, `secondary` = the other; exact tie → HE
  (deterministic, documented). Fixed once at plan level (not per year) so ESPP owner, spousal
  contributor, and survivor default stay stable; per-year RRSP-owner choice keeps using the already
  symmetric `preferDiscretionaryRrspOwner`.
- **ESPP** is after-tax extra for **whoever earns it**: computed per person from each spouse's
  `esppEmployeeRate`/`esppEmployerRate`, and deployed through **that person's** MV order — not
  pooled into He.
- **TFSA spill** is symmetric (either spouse's cash → the other's TFSA; no attribution). Cross-spouse
  **RRSP** is only via **spousal RRSP** (the sole legal route), gated on `optimizeSpousal`.
- **Spousal RRSP** direction is role-based: contributor = primary (uses primary's room), annuitant =
  secondary; offered on the secondary's residual, both directions.
- **Survivor** default deceased = primary earner; optional `survivorWho` override. CPP survivor
  benefit + `survivorSpendFactor` + identical application across both engines stay per ADR 0005.
- **TFSA decumulation** draws the larger remaining account first with a role-based tie-break,
  replacing the old He-first bridge order.
- Delete dead `allocateDiscretionaryYear`.

No new "who earns more" UI toggle — roles come from salaries.

## Consequences

- **Headline numbers change** for any plan where She holds ESPP (previously silently dropped) —
  this is a correction, not a regression. Extra-needed / →$0 / surplus will shift.
- Equal- or She-higher-earner plans get correct, mirrored allocation and spousal direction.
- Mirror-symmetry becomes a testable invariant: swapping all He/She inputs must mirror all outputs.
- The RRSP-legality fix means He's stream no longer routes to She's *personal* RRSP; cross-spouse
  RRSP is spousal-only. This may change deploy for spousal-enabled plans.
- Implemented with a **secondary-then-primary** room race so mirrored household inputs produce
  mirrored account outputs.

## Rejected

- **Per-year role recomputation** — causes ESPP/spousal/survivor role flip-flop across years;
  structural roles should be stable. (Per-year RRSP-owner preference stays year-by-year.)
- **User toggle for "primary earner" / "who dies"** beyond the salary-derived default + optional
  `survivorWho` — adds UI for something derivable; keep it inferred.
- **Leave ESPP He-only and just document it** — it silently discards real money from the solve.
- **Allow He-stream → She personal RRSP** (status quo) — not a legal contribution path; spousal only.
