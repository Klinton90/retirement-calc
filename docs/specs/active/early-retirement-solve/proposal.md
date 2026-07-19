# Proposal: Comfortable early retirement (joint)

Status: Active. Settled decision → [ADR 0007](../../../decisions/0007-early-retirement-solve.md).
Living truth: `docs/explanation/math-model.md` §3.7.

## Why

When the active Realistic/Mandatory path is already funded through the horizon, the family has two surplus levers: spend more (Extra Spend Capacity) or **stop working earlier**. Today only spend surplus is solved; retirement ages are fixed inputs.

## Decision (summary)

- Earliest comfortable stop-work = max joint `yearsEarlier` such that Plot 1 / Readiness still lasts the **same terminal age** as the entered plan.
- Both spouses shift by the same `yearsEarlier` (relative age gap preserved).
- Spend = active scenario only (Realistic wants / Mandatory needs).
- Viewer path owns the predicate (`runProjection` + `analyzeRetirementShortfall`), not @71 backsolve.

## Non-goals

- Auto-writing entered `retirementAge` inputs.
- One-spouse-only / partial retirement.
- Monte Carlo / sequence risk.
- Dual early-path portfolio lines on Plot 1 (marker + Outlook card only).
