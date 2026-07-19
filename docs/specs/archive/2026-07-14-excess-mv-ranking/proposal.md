# Proposal: Excess advisor — marginal-value ranking

Evolve the Excess / room advisor so recommendations optimize **marginal after-tax retirement value** of Extra / ESPP dollars, instead of treating soft-capacity cascade as “the optimum.”

Settled tradeoffs: [ADR 0003](../../../decisions/0003-excess-marginal-value.md). Living domain: `docs/explanation/math-model.md` §3.3.

## Why

- Soft RRIF headroom @71 correctly *limits* blind RRSP fill (OAS clawback / forced minima) but does not measure highest ROI.
- Product wants one clear answer for “where should this Extra dollar go?”
- A second parallel optimizer UI would fight the existing Excess panel.

## Scope

- Define MV objective by funding regime (underfunded vs funded / tax framing).
- Shadow-compare MV destination ranking vs current cascade splits in tests.
- Replace Excess **recommendation / suggested split** UI to report MV ranking; demote soft capacity to diagnostic.
- Decide whether projection deploy stays on cascade or adopts MV cutovers (after shadow).

## Out of scope

- Permanent dual Excess vs ROI panels
- Classical DE / closed-form portfolio extrema for the whole tax system
- Monte-Carlo, full non-reg CG precision, partial RRIF convert
- Redesigning Min Savings / conversion grid objectives (reuse their engines)

## Success

- Excess suggests destinations via \(\arg\max_d \mathrm{MV}(d)\) under room/ownership constraints.
- Soft capacity remains visible as explanation when RRSP MV is poor.
- Tests prove cascade vs MV agreement or document intentional deltas before deploy changes.
- No second user-facing optimization track.
