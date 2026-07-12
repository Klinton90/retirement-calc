# ADR 0002: Math model vNext direction

- Status: Accepted
- Date: 2026-07-12
- Supersedes: informal chat research (same day)

## Context

Mono-portfolio + ESPP→RRSP defaults mis-model Canadian registered accounts and RRIF rules. Product goal is periodic min-contribution review, not prediction theatre.

## Decision

Adopt the living spec in [`docs/explanation/math-model.md`](../explanation/math-model.md): buckets, target backsolve, RRIF grid 65–71 with regime scoring, two-step conversion recommend, survivor toggle default off, UI not sacred.

## Consequences

Implementation phases B1→B2→C… follow that doc. Do not re-open settled defaults without a new ADR.
