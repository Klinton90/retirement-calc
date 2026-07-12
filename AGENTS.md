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
- RRIF minima; conversion ages 65–71 compared; two-step recommend (see math-model doc).
- OAS/CPP by **age each year**; do not zero OAS for entire retirement if stop-work age &lt; 65.
- Income split: RRIF (65+) only — not OAS; not fake 50/50 of all gross.
- All assumptions configurable; label cards (real $, ~20y to ~85, survivor toggle).

## Testing

Logic changes need tests in `src/test/`. Skip full test runs for pure styling tweaks.

## Handoff

Update `docs/explanation/` or ADRs when product/math decisions change. Archive finished specs.

At phase B2/C gates (or other triggers in `docs/README.md`), self-evaluate full OpenSpec upgrade and report upgrade/wait — do not wait for the human to ask.
