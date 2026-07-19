# Tasks: excess-mv-ranking

## Spec / docs

- [x] ADR 0003 — Excess MV over soft-capacity cascade (evolve Excess in place)
- [x] Archive completed `math-model-vnext` → `docs/specs/archive/2026-07-14-math-model-vnext/`
- [x] Living math-model §3.3 — soft capacity diagnostic; MV is recommendation target
- [x] Resolve open questions in `design.md` (underfunded → required Extra $/mo; funded → surplus spend; probe → $1k/yr scaled)

## Math

- [x] Phase 0: named Excess/cascade fixtures (characterization; must stay green)
- [x] Phase 1: MV scorer module (`marginalValueGuide.ts` + `mvDeposit.ts`) with regime scalars + probe helper
- [x] Phase 1: ownership / room feasibility before ranking
- [x] Phase 1 tests: TFSA wins when room; regime scalar gate; probe sizing
- [x] Phase 1 tests: agreement fixtures (same **top** destination as cascade where expected)
- [x] Phase 1 tests: disagreement path documented (amber fixture records if constructible; RED→Non-reg agreement otherwise)
- [x] Phase 1 tests: monotonicity (best \(d\) does not worsen primary scalar)
- [x] **Dropped:** assert full split equality cascade ≡ MV as a ship gate (see migration.md)

## UI

- [x] Phase 2: ExcessRoomPanel recommendations from MV; soft capacity diagnostic copy
- [x] Do **not** add a second parallel optimizer panel
- [x] Keep tax-optimization framing badge tied to `isFundedWithoutExtra`
- [x] Cascade after-TFSA splits still shown muted as diagnostic compare

## Deploy path (Phase 3B)

- [x] Decide: **B — adopt MV cutovers** (ownership TFSA first + MV residual order)
- [x] Wire `accumulateToRetirement` + `runProjection` via `deployDiscretionaryByMvOrder`
- [x] `personInputsFromExtraAllocation` → MV suggested splits
- [x] Tests: RED Extra → Non-reg on accumulate; open TFSA Extra → TFSA; suite green

## Docs

- [x] [`migration.md`](./migration.md) — phases, comparison policy, test plan
- [x] ADR 0003 + math-model §3.3 updated for Phase 3B
- [x] Archive this folder → `docs/specs/archive/2026-07-14-excess-mv-ranking/`
- [x] Remove user AllocationPolicy TFSA/RRSP-first toggle; coerce engines to TFSA_FIRST

## OpenSpec gate (this change)

**Verdict: wait** — archived; active specs empty again. Stay on OpenSpec-lite.
