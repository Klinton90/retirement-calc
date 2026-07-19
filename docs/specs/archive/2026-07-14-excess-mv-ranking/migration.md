# Migration plan: Excess → MV ranking

Status: Phases 0–3B implemented (Excess UI + deploy on MV; soft cascade diagnostic). Ready to archive after doc merge.  
ADR: [0003](../../../decisions/0003-excess-marginal-value.md)  
Scalars: locked in `design.md` (required Extra $/mo · surplus spend · $1k probe)

---

## Goal

Replace Excess **recommendations** with marginal-value ranking while keeping:

- Ownership / room rules unchanged  
- Soft capacity as diagnostic UI  
- Cascade deploy in projection/target until a later, explicit cutover  

**Non-goal this phase:** second optimizer UI; changing `deployDiscretionaryWithSoftLimits` behavior.

---

## Phases

### Phase 0 — Fixture inventory (no product change)

Lock today’s Excess behavior so deploy regressions are detectable while UI swaps.

- Keep / extend `excessMoneyGuide.test.ts` as **cascade characterization** (splits, ownership, red → Non-reg).
- Add named plan fixtures: `greenRrspFunded`, `redRrspFunded`, `underfundedTfsaRoom`, `sheExtraOnly`, `esppCrowding`.
- Each fixture records: rooms, soft levels, cascade `DestinationSplit`, `isFundedWithoutExtra`.

Exit: cascade tests green; fixtures reusable by MV tests.

### Phase 1 — MV scorer (math only)

New module (prefer `src/utils/marginalValueGuide.ts` to avoid bloating Excess further).

```
baseline = calculatePlanTargets(plan)   // or cheaper slices if profiled later
for each feasible destination d:
  plan_d = applyProbe(plan, d, probeAmount)   // Extra routed only to d this year / as Extra monthly
  targets_d = calculatePlanTargets(plan_d)
  score(d) = primaryΔ (regime) + tieBreakΔ
rank by score; build suggested DestinationSplit by filling room in MV order
```

**Feasibility filter (reuse current constraints, do not resim illegal destinations):**

- She Extra probe → She TFSA / She RRSP / Spousal / Non-reg only (never He TFSA).  
- He / household probe → He TFSA → She TFSA → RRSPs → Non-reg as allowed.  
- Skip \(d\) if room for that wrapper is 0 (except Non-reg always open).  
- Soft RED does **not** hard-skip in MV (score should make RRSP lose); optionally mark `infeasible` only if CRA room is 0.

**Primary / tie-break (locked):**

| Regime | Primary (higher better) | Tie-break |
|---|---|---|
| Underfunded | \(-\Delta\) `monthlyPersonalSavingsNeeded` | \(-\Delta\) `shortfallFromCurrentPath` |
| Funded | \(+\Delta\) surplus spend ($/mo or annual — match engine field) | \(-\Delta\) tax+OAS drag if exposed; else note “deferred” |

**Probe:** \(\max(1000,\ \text{extraMonthly}\times 12)\) per stream; $1000 if Extra = 0.

Exit: pure functions + unit tests; Dashboard unchanged.

### Phase 2 — Wire Excess recommendations only

- `explainExcessMoney` (or thin wrapper) attaches `mvRanking` + `mvSuggestedSplit`.  
- `ExcessRoomPanel` shows MV recommendation / split; soft capacity cards stay with “diagnostic” wording.  
- Cascade split remains available as `cascadeSplit` for tests / optional muted “rule-of-thumb” line — **not** a second panel. Default hide cascade from users after copy review.

Exit: UI uses MV; deploy/projection still cascade.

### Phase 3 — Deploy cutover

**Decision: B — adopt MV cutovers** (2026-07-14).

- Ownership TFSA always fills first (`withOwnershipTfsaFirst`).
- Residual Extra/ESPP/refund follows precomputed MV destination order (`deployDiscretionaryByMvOrder`).
- MV ranking scored with `accumulate(..., { useMvDeploy: false })` to avoid recursion.
- `personInputsFromExtraAllocation` uses MV suggested splits.
- Soft-capacity cascade retained for Excess diagnostic compare + probe scoring only.

---

## Cascade vs MV comparison — decision

### Drop as a **correctness gate**

Do **not** require `mvSplit ≈ cascadeSplit` to ship.

Why that is a bad idea:

1. **MV is meant to disagree** when soft cascade still feeds RRSP (amber, borderline clawback) or prefers the “wrong” spouse vs after-tax spend. Equality would freeze the bug we are fixing.  
2. Cascade optimizes a **priority rule**; MV optimizes **engine scalars**. Different objectives → agreement is coincidence, not proof.  
3. Forcing equality makes shadow tests a tautology (“MV must clone cascade”) and blocks learning.

### Keep current path for **three useful roles**

| Role | How | Pass/fail? |
|---|---|---|
| **A. Characterization / deploy guard** | Existing cascade tests stay green while Only Excess UI moves | Yes — cascade must not regress |
| **B. Expected-agreement fixtures** | Cases where theory says same winner (e.g. open TFSA room → both pick TFSA) | Yes — assert same **top destination**, not full dollar split |
| **C. Expected-disagreement fixtures** | Soft RED or overfunded RRSP: cascade may still order RRSP before Non-reg on amber; MV should prefer Non-reg or TFSA | Yes — assert **MV ≠ cascade top** with a one-line rationale in the test name/comment |

Optional (never CI-blocking): log both rankings in a single diagnostic test for developer inspection.

### What not to do

- No Dashboard dual panels.  
- No “shadow mode” flag for users.  
- No assert on full annual $ split equality.  
- No using cascade score as MV’s objective.

---

## Test plan

### Unit — MV ranking

| Case | Expect |
|---|---|
| Open TFSA room, any regime | Top MV destination is TFSA (ownership-correct: She Extra → She TFSA) |
| TFSA full, soft GREEN, underfunded | RRSP beats Non-reg on required Extra $/mo |
| TFSA full, soft RED / clawback-heavy, funded | Non-reg (or lower clawback path) beats more RRSP on surplus spend |
| She Extra never scores He TFSA | He TFSA absent or −∞ / skipped |
| Probe size helper | Extra 0 → 1000; Extra 200/mo → 2400 |
| Regime gate | Underfunded plan uses Extra $/mo scalar even if soft green |

### Characterization — cascade (keep)

- Existing `deployDiscretionaryWithSoftLimits` / `explainExcessMoney` ownership tests.  
- Do not rewrite them to call MV.

### Agreement / disagreement matrix (small, explicit)

```
fixture                  | cascade top | MV top     | assert
-------------------------|-------------|------------|------------------
tfsaRoomOpen             | TFSA        | TFSA       | equal top
tfsaFull_green_under     | RRSP        | RRSP       | equal top (likely)
tfsaFull_red_funded      | Non-reg*    | Non-reg    | equal top if cascade already skips red
amber_borderline_funded  | RRSP?       | Non-reg?   | document whichever is intended
```

\*Today cascade skips own RRSP on RED — agreement expected. The valuable disagree cases are **amber / soft-green but RRIF path already crowded** where cascade still fills RRSP and MV should not.

Build at least **one intentional disagree fixture** before calling Phase 1 done; if none are constructible with current tax model, document why and ship agreement-only + scalar monotonicity tests instead.

### Monotonicity / sanity (stronger than cascade equality)

- Adding probe to best \(d\) must not worsen primary scalar vs baseline (within sim epsilon).  
- Ranking is stable if probe doubled (same order of top two), or document noise floor.  
- Skip destinations with 0 room → they do not appear in ranking.

### Perf budget (light)

- One `calculatePlanTargets` baseline + ≤6 destination probes per Excess refresh.  
- If too slow in Dashboard, Phase 2 may probe only feasible non-zero-room destinations and cache on plan hash — note in tasks when measured.

### UI tests

- Prefer logic tests; one smoke that Excess recommendation string/source uses `mvRanking` when present. Skip heavy DOM unless already patterned.

---

## Rollout checklist

1. Phase 0 fixtures + cascade characterization green  
2. Phase 1 scorer + agreement/disagree + monotonicity  
3. Phase 2 Excess UI swap; soft capacity copy = diagnostic  
4. Manual: funded vs underfunded households; She Extra ownership  
5. Phase 3 decision recorded (keep cascade deploy vs MV cutover)  
6. Archive `excess-mv-ranking`; merge leftovers into math-model  

---

## OpenSpec task mapping

| Phase | Tasks |
|---|---|
| 0 | Extend Excess characterization fixtures |
| 1 | MV module; feasibility; agreement/disagree/monotonicity tests; drop equality gate |
| 2 | ExcessRoomPanel + explainExcessMoney wiring |
| 3 | Deploy cutover decision (separate) |
| Archive | as in `tasks.md` |
