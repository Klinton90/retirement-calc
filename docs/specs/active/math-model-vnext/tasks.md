# Tasks: math-model-vnext

- [x] A1 Types: AccountBuckets, room fields, conversion/survivor plan knobs
- [x] A2 Defaults + Dashboard state for bucket balances (migrate from currentSavings)
- [x] B1 RRIF minimum helper + tests
- [x] B1 Per-year CPP/OAS (age-based OAS; residency vs cpp start); clawback; age-75 bump
- [x] B1 Retirement tax (no CPP/EI on pension/RRIF; RRIF-only split)
- [x] B1 Bucket grow/contribute/withdraw + forced-excess redeposit
- [x] B1 Demote/remove calculateMinimumNestEgg from card path
- [x] B2 Target backsolve (feasibility = spend met + minima; keep employer match)
- [x] B2 Conversion grid 65–71 + regime scorer (two-step)
- [x] B2 Allocation side-by-side helper (TFSA-first vs RRSP-first)
- [x] C Wire SummaryCards / MinSavingsPanel / projection to new engine
- [x] D Contribution policy (ESPP redeploy; match first; TFSA then discretionary)
- [x] D Keep spousal RRSP optimizer (UI demoted to Advanced accordion in InputSection)
- [x] Docs: update math-model status; validation notes; archive pending user confirm

## OpenSpec gate (end of B2/C)

**Verdict: wait** — still one primary change stream; archive/merge discipline not failing yet. Re-check if ≥2 active specs appear or archive is skipped repeatedly.
