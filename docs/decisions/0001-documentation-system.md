# ADR 0001: Documentation system

- Status: Accepted
- Date: 2026-07-12

## Context

We need evolving documentation so future Cursor (and other) agents inherit domain decisions without re-deriving them from chat. Candidates included Cursor-native rules, AGENTS.md, full SDD toolkits, colocated per-file specs, Diátaxis, and ADRs.

## Decision

Use a **hybrid**:

1. **Cursor-native** — short `AGENTS.md` + scoped `.cursor/rules/*.mdc` for behavior injection.
2. **Diátaxis-lite** — `docs/{explanation,reference,how-to,decisions}` for durable content orientation.
3. **ADR** — append-only `docs/decisions/` for settled tradeoffs.
4. **OpenSpec-lite** — `docs/specs/active|archive` propose → implement → archive **without** requiring the OpenSpec CLI (folders + markdown only). Revisit full OpenSpec using the agent-owned criteria in [`docs/README.md`](../README.md#when-to-evaluate-full-openspec-agent-owned) — do not wait for the operator to remember.

Reject as *primary* system **for now**: GitHub Spec Kit / BMAD (ceremony-heavy), SpecDD 1:1 `.sdd` beside every file, Diátaxis alone, AGENTS.md alone. Full OpenSpec remains an upgrade path, not a forever ban.

## Consequences

- Next agents start from `docs/README.md` + `math-model.md`, not chat archaeology.
- Active work has an obvious place; completed work merges into explanation/reference/ADRs.
- Slight structure overhead; lower than full Spec Kit; higher clarity than a single mega-GEMINI.md.

## Comparison snapshot (five+ frameworks)

See chat decision record below — kept here so the ADR stands alone.

| Framework | Pros | Cons | Fit here |
|---|---|---|---|
| **Cursor rules + AGENTS.md** | Official Cursor path; glob scoping; portable AGENTS.md | Rules must stay short; not a domain wiki | **Required layer** |
| **GitHub Spec Kit / full SDD** | Strong propose→plan→tasks; enterprise | Heavy ceremony for solo personal app | Reject primary |
| **OpenSpec** | Brownfield deltas; archive merges; change folders | CLI optional overhead | **Adopt lite** (folders only) |
| **SpecDD (colocated .sdd)** | Local context when editing a file | 1:1 file drift; UI churn tax; duplicates tests | Reject primary |
| **Diátaxis** | Clear explanation/reference/how-to split; AI-friendly retrieval | Not agent injection by itself | **Adopt lite** for `docs/` |
| **ADR** | Cheap “why”; stops re-litigation | Not a feature workflow | **Adopt** |
