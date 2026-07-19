# ADR 0007: Earliest comfortable retirement — viewer / joint / fixed terminal

- Status: Accepted
- Date: 2026-07-19
- Relates: [`docs/explanation/math-model.md`](../explanation/math-model.md) §3.7, [ADR 0004](0004-extra-funding-solve.md)

## Context

Overfunded households already see **Extra Spend Capacity** (spend more → ≈$0 at horizon). They also ask: *how early can we stop working at the current lifestyle?* Retirement ages were fixed inputs; no age solve existed. Spend surplus and time surplus are twins of the same funded nest egg — they must not invent a second “plan OK?” light.

Failed shapes:

1. **@71 backsolve as the age gate** — can disagree with Plot 1 / Readiness the same way BACKSOLVE Extra already does.
2. **Shorter life when retiring earlier** — holding `lifeExpectancyDelta` fixed moves terminal age earlier (retire @60 → ~80), which understates the need.
3. **Independent He/She earliest ages** — confusing dual answers when the horizon is He-anchored.
4. **A third spend definition** — “comfortable” must mean the active Realistic/Mandatory path only.

## Decision

1. **Predicate** = active-scenario `runProjection` + `analyzeRetirementShortfall.lastsFullHorizon` (same as Readiness / ADR 0004).
2. **Joint shift** = binary-search max integer `yearsEarlier ≥ 0` applied to both:
   - `he.retirementAge' = he.retirementAge − yearsEarlier`
   - `she.retirementAge' = she.retirementAge − yearsEarlier`
   - Clamp so each age stays `≥ age + 1`. Relative gap preserved.
3. **Fixed terminal** = keep entered plan’s `terminalAgeHe`. Trial plans set
   `lifeExpectancyDelta = terminalAgeHe − he.retirementAge'` so “Lasts to ~85” does not shrink.
   User-stored `lifeExpectancyDelta` is unchanged.
4. **Spend** = active Realistic/Mandatory selector + entered expenses / retire-spend inputs.
5. **UI** = Extra Spend Capacity chip (only when surplus $/mo > 0 and `yearsEarlier` > 0) + Plot 1 EARLIEST marker (and optional band). No separate Outlook card; no auto-edit of inputs.
6. CPP/OAS unchanged: OAS @65; CPP claim = clamp(retireAge, 60–70). Stop-work before 60 is allowed (gap years).

## Consequences

- Earliest age and Extra Spend Capacity answer complementary questions on the same funded path.
- Trial projections are heavier (binary search of `runProjection`); integer years keep probe count small (~log₂ max shift).
- Target-engine `isFundedWithoutExtra` remains a cross-check, not the age gate.

## Rejected

| Alternative | Why rejected |
|---|---|
| Age gate on @71 `isFundedWithoutExtra` only | Diverges from primary “plan OK?” |
| Keep delta fixed (terminal moves earlier) | Mislabels “comfortable” as a shorter life |
| Independent earliest ages per spouse | Dual answers; horizon is He-anchored |
| Separate “buffer spend” comfort definition | Realistic/Mandatory already define lifestyle |
