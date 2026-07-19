# Proposal: Symmetric optimization — earner roles, not hardcoded He

Status: Shipped 2026-07-18. Settled decision → [ADR 0006](../../../decisions/0006-symmetric-earner-roles.md).
Living truth: `docs/explanation/math-model.md` §3.3, §3.4, §3.7.

## Why

The optimizer assumed **He was the higher earner and the equity/ESPP owner**. Audit found:

1. She's ESPP was omitted from both accumulation engines.
2. All ESPP and refund cash was routed through He's MV order.
3. TFSA spill and RRSP ownership rules were one-directional.
4. Spousal RRSP was fixed to He-contributes / She-owns.
5. Survivor stress always removed He.
6. Dead `allocateDiscretionaryYear` retained a “Never She RRSP” cascade.

## Outcome

Allocation, attribution, and stress logic now use stable **earner roles**:

- Primary = higher base gross salary; secondary = the other; exact tie → He.
- ESPP is computed per person and follows that person's MV path.
- TFSA spill works in both directions.
- Personal RRSP is owner-only; cross-spouse RRSP is spousal-only.
- Spousal contributor = primary; annuitant = secondary.
- Survivor default deceased = primary, with explicit override support.
- Room race = secondary then primary, enabling mirrored outputs.
- Dead asymmetric allocation helpers were deleted.

## Non-goals

- No user-facing primary-earner toggle.
- No asset-side survivor changes.
- No change to the ADR 0003 MV objective.
