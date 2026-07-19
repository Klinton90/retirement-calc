# Proposal: Extra $/mo Gap card — realistic path + uncapped solve

Shipped 2026-07-17. Settled in [ADR 0004](../../../decisions/0004-extra-funding-solve.md). Living truth: `docs/explanation/math-model.md` §3.7–3.8.

## Why

- Gap card stuck at **$50,000/mo** (binary-search ceiling + cash-aware Extra undeployable).
- Card must show **additional $/mo** for desired lifestyle, not nest-egg gap and not an idealized “No Extra needed” while Nest Egg &lt; →$0 band.

## Outcome

- Funding solve: `realistic₀ + (ideal(M) − ideal(0))`; expand until @71 funds; safety max only; `fundingSolveReached`.
- Gap card = Extra $/mo (or `>$…`).
- Related viewer fixes documented in math-model: Plot 1 bucket stack + start-of-year retired wealth; Plot 2 spend+intended; readiness from active projection; underfunded max-drain.
