# Documentation system (RetireSmart Canada)

Evolving, agent-first documentation. Not a one-off for the current math rewrite.

**Chosen stack:** Cursor-native agent layer + Diátaxis-lite `docs/` + ADRs + OpenSpec-lite change folders.  
**Rejected as primary:** full GitHub Spec Kit / BMAD, SpecDD 1:1 colocated specs, Diátaxis-only, AGENTS.md-only.

Rationale and comparison: see [ADR 0001](decisions/0001-documentation-system.md).

---

## Where truth lives

| Need | Location | Who loads it |
|---|---|---|
| Always-on agent behavior | [`AGENTS.md`](../AGENTS.md) + [`.cursor/rules/`](../.cursor/rules/) | Cursor (and other tools via AGENTS.md) |
| Domain *why* / living model | [`docs/explanation/`](explanation/) | Read when planning or changing math |
| Stable facts / formulas / defaults | [`docs/reference/`](reference/) | Read when implementing or testing |
| Settled decisions | [`docs/decisions/`](decisions/) | Read when revisiting a tradeoff |
| Active change (this sprint) | [`docs/specs/active/`](specs/active/) | Read/write for the current feature |
| Done changes | [`docs/specs/archive/`](specs/archive/) | Audit only |
| How to run / build | [`docs/how-to/`](how-to/) | On demand |

**Code and tests beat prose** for “what the implementation does today.” Docs beat code for **intent not yet encoded**, **cross-cutting policy**, and **why we rejected alternatives**.

---

## Rules for agents (and humans)

1. Before a multi-file math/domain change: read `explanation/math-model.md` + relevant ADRs.
2. Start a change under `specs/active/<name>/` with `proposal.md` + `tasks.md` (add `design.md` only if non-obvious).
3. When the change ships: merge lasting facts into `explanation/` or `reference/`, add ADR if a tradeoff was decided, move the change folder to `specs/archive/YYYY-MM-DD-<name>/`.
4. Do **not** duplicate long specs into `.cursor/rules`. Rules stay short; they **point** at docs.
5. Do **not** invent tax/account behavior that contradicts `explanation/math-model.md`.
6. UI is not sacred — prefer correct math; presentation may change.
7. At **phase gates** (see below), self-evaluate whether to upgrade to **full OpenSpec** — do not wait for the human to ask.

---

## When to evaluate full OpenSpec (agent-owned)

Agents must run this check and state **upgrade / wait / revisit later** (one line + evidence) when **any** trigger fires:

**Triggers (any one):**
- End of math phases **B2** or **C** (see `explanation/math-model.md`)
- `docs/specs/active/` has **≥2** concurrent change folders
- Same session (or consecutive sessions) ships a change **without** archiving / merging truth upward (doc drift)
- Human invokes `@remind-docs` twice for the same underlying process failure

**Upgrade to full OpenSpec if ≥2 of these are true:**
1. Active or recent changes routinely need **delta** “what changed vs current truth,” not just a living math essay
2. Archive step is skipped or truth fails to merge into `explanation/` / `reference/` / ADRs
3. Parallel features fight over the same domain facts
4. You want enforced `/opsx:propose → apply → archive` (or equivalent) more than folder discipline alone

**Stay on lite if:**
- One change at a time, and archiving + math-model updates are reliable
- Domain is still mostly one living doc (`math-model.md`) plus ADRs
- Adding CLI/skills would slow the current phase more than it would prevent drift

**On “upgrade”:** propose installing OpenSpec (CLI/skills), map `docs/specs` → OpenSpec layout, keep `math-model.md` as explanation (or migrate slices into `openspec/specs/`), write ADR superseding the “lite only” part of [0001](decisions/0001-documentation-system.md). Do **not** silently install without user OK.

**On “wait”:** note which criteria failed and the next trigger to re-check.

---

## Handoff snippet (paste into a new chat)

```
Read AGENTS.md and docs/README.md.
Current domain truth: docs/explanation/math-model.md
Active work: docs/specs/active/ (if any)
Implement / plan the next phase; update docs when decisions change.
```
