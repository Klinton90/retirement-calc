---
name: remind-docs
description: >-
  Enforces this repo's documentation maintenance contract after code or
  decision changes were made without updating docs. Use when the user
  invokes this skill, says docs were skipped, asks to sync docs, or
  reminds the agent about AGENTS.md / docs/README.md / OpenSpec-lite specs.
disable-model-invocation: true
---

# Remind docs

The user is invoking this because documentation likely lagged behind work in this session. Treat docs as part of “done.”

## Contract (read if needed)

1. Map: `docs/README.md`
2. Living math/domain: `docs/explanation/math-model.md`
3. Decisions: `docs/decisions/`
4. Active change: `docs/specs/active/<change>/` (`proposal.md`, `tasks.md`; `design.md` only if needed)
5. On ship: merge lasting facts into explanation/reference; add ADR for tradeoffs; move change folder to `docs/specs/archive/YYYY-MM-DD-<name>/`
6. Keep `.cursor/rules` short — point at docs; do not paste long specs into rules

## Do now

1. Scan this conversation + git status/diff for decisions and behavior changes.
2. List doc gaps (missing active spec, stale math-model, missing ADR, unarchived change, rules duplicating docs).
3. Update the minimum set of files to close gaps. Prefer editing existing docs over new ones.
4. If work is mid-flight: ensure `docs/specs/active/<name>/` exists and `tasks.md` matches reality.
5. If work is finished this session: archive or clearly mark remaining tasks; merge durable truth upward.
6. Reply with a short checklist of what you updated (paths only) and what you deliberately left unchanged.

## Do not

- Rewrite the whole doc tree
- Invent product decisions not present in chat or code
- Claim docs are synced without actually writing files
