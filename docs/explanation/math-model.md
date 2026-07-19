# Math model (living)

Status: **implemented in code** (Phases A–D); living source of truth for domain behavior  
Audience: implementers + agents  
Not financial advice.

Implemented modules: `accountBuckets`, `contributionPolicy`, `rrifCalc`, `oasClawback`, `retirementIncomeTax`, `targetEngine`, `calculatePersonPensionForAge`. Cards use `calculatePlanTargets` (two-step conversion). UI not fully redesigned (Phase E light).

Supersedes chat archaeology and deprecated `GEMINI.md`. Settled tradeoffs also recorded under `docs/decisions/`.

---

## 1. Product intent

Periodic (6–12 month) **review tool**, not a life crystal ball.

Primary outputs (**cards / target numbers**):
- **Nest egg at retirement** — projected face value on **current inputs** (never swapped for the funding-solve floor). Engine: `projectedNestEggAtRetirement` / `projectedBucketsAtRetirement`.
- **Nest egg → $0 band** — min nest egg for *target spend → ≈$0* (all TFSA / your mix / all RRSP). Engine: `nestEggToZeroBand`.
- **Extra needed for lifestyle** — Gap **headline** = READINESS Extra (`solveExtraForReadiness`) so Plot 1 / Retirement Readiness lasts the full horizon; BACKSOLVE (`monthlyPersonalSavingsNeeded` @71/71) and wealth-gap PMTs (→$0 MIX / SOLVE EGG) are labeled diagnostics ([ADR 0004](../decisions/0004-extra-funding-solve.md)).
- Suggested Extra / ESPP allocation + soft RRSP capacity (diagnostic) / MV ranking (ADR 0003, in progress) — **ExcessRoomPanel**
- RRSP→RRIF conversion **recommendation** (with runners-up) — **ConversionGuidePanel** table (top grid ranks)
- Regime label: under / near / above target (conversion scoring only — **not** Excess “funded” framing)

Secondary: year-by-year projection charts (viewer / stress). **UI is not sacred** — tables/graphs/cards may be redesigned.

Life events (child, job change) trigger a re-run of the same target engine with updated inputs.

---

## 2. Locked household defaults (all configurable)

| Parameter | Default |
|---|---|
| Province | Ontario |
| He age / She age | 36 / 38 |
| Target retirement age | 65 both (sensitivity later) |
| Retirement spend | $10,000/mo today’s CAD (includes mortgage as **buffer**) |
| Inflation | 2% (CPI — spend, tax brackets, pensions) |
| Salary growth | **1%** (working-years wages; separate from CPI) |
| Portfolio return | 5% nominal (~2.9% real) |
| Post-retirement horizon | **20 years** (`lifeExpectancyDelta`, default via `DEFAULT_LIFE_EXPECTANCY_DELTA` / `resolveRetirementHorizon`), ages 65..84, **terminal $0 at ~85**. Both engines and UI labels derive years/ages from that helper — never invent a separate fallback (e.g. `?? 30`) or a phantom final funded year past `lastFundedAgeHe`. |
| TFSA new room | **$7,000 / person / year flat nominal** (CRA sets ad hoc; not CPI-indexed). Optional CPI inflate toggle for sensitivity only. |
| RRSP room | 18% earned income to annual dollar max + carry-forward |
| He RRSP | 3% employee + 3% employer match |
| She RRSP | 2% employee + 2% employer match |
| He ESPP | 10% + 1.5% employer; **sell immediately**; redeploy to registered accounts |
| He parental top-up | 0 (conservative) |
| He arrival / CPP work start | 2013 / 2014 (`startYearInCanada` / `cppStartYear`) |
| She arrival / CPP work start | 2020 / 2022 |
| Extra investable ($/mo, He/She) | Ownership-aware TFSA then soft RRSP / Spousal / Non-reg (§3.3); in projection **and** target engine (inflate with CPI) |
| Child | ~2027; She leave 36 months; She employer top-up 0 |
| Spousal RRSP | keep / model |
| Non-reg balances today | $0 (account type exists for overflow) |
| Currency | All model inputs in CAD |
| Survivor stress | optional toggle, **default off** |

**Explicit labels:** cards must say spend is sustained for **~20 years of retirement (to ~85)**, not lifetime.

---

## 3. Core architecture

### 3.1 Account buckets (required)

| Bucket | Tax on growth | Tax on withdrawal |
|---|---|---|
| TFSA (He/She) | none | none |
| RRSP → RRIF (He/She) | deferred | fully taxable as income |
| Non-registered | taxable (simplify v1) | gains/income (simplify v1) |
| Cash / earmarked | optional 0% | reno cash excluded from investable |

ESPP is **not** a bucket — contribution source after sale. Room trackers must gate allocation, not only display.

### 3.2 Engines (single tax reality)

1. **Target engine** (cards) — simulation-based backsolve  
2. **Projection viewer** — same tax/bucket rules  
3. Legacy `calculateMinimumNestEgg` — **remove/demote**; must not drive cards  

**Feasibility:** spend met every year + RRIF minima honored; terminal ≥ 0 (not “portfolio → 0”).

**Min-contribution label:** “$/mo today’s dollars, rises with inflation.”

### 3.3 Accumulation policy

1. Capture employer RRSP match (keep match in min *personal* solver; do not zero it)  
2. Fill TFSA room (household Extra, ESPP sale, refund redeposit race the same room)  
3. Soft RRSP capacity (**diagnostic**): per person **RRIF-min headroom @71** vs OAS clawback threshold — green ≥ ~$25k, amber 0–25k, red &lt; 0. Secondary: OAS clawback on the recommended curve (informational). Explains why further RRSP can hurt; not the definition of “highest ROI.”  
4. Discretionary routing — **overflow is never lifestyle**. Ownership and account legality are symmetric ([ADR 0006](../decisions/0006-symmetric-earner-roles.md)):

| Stream | Locked ownership / race order |
|---|---|
| **He Extra / ESPP / refund** | **He TFSA → She TFSA → He personal RRSP → role-eligible spousal RRSP → Non-reg**, with residual destinations ordered by MV |
| **She Extra / ESPP / refund** | **She TFSA → He TFSA → She personal RRSP → role-eligible spousal RRSP → Non-reg**, with residual destinations ordered by MV |

Each spouse's ESPP is computed from that spouse's salary and ESPP rates. It is after-tax Extra owned by its recipient and follows that person's MV path; neither engine pools both ESPPs into He. The role-based room race is **secondary earner first, then primary earner**, so swapping all He/She inputs mirrors outputs. Cross-spouse TFSA funding is permitted; cross-spouse RRSP funding is permitted only through a **spousal RRSP**, never the spouse's personal RRSP.

**Recommendation objective (ADR 0003):** Excess UI ranks the next Extra dollar by **marginal value (MV)** — after-tax retirement payoff under room/ownership constraints — not face-value growth and not “max RRSP until red.”

| Household state | MV objective |
|---|---|
| Underfunded (`!isFundedWithoutExtra`) | Minimize required Extra $/mo; tie-break nest-egg shortfall |
| Funded / tax framing | Maximize **after-tax** terminal wealth at fixed target spend (surplus-capacity proxy); tie-break tax + OAS |

**Probe size (fixed 2026-07-19):** the ranking only ever orders the **RRSP tier** (own RRSP vs Spousal vs Non-reg), because ownership TFSA always fills first. So the scoring probe is the **post-TFSA residual** = \(\max(1000,\ \text{stream pool} - \text{available TFSA room (both accounts)})\), floored at $1,000/yr. Probing with the full pool oversaturated RRSP past green RRIF headroom, where the RRSP destinations flatten and a room-limited Spousal (consumes the primary's room) could wrongly lose to the stream's own RRSP. The displayed suggested split still deploys the full pool. Details: [ADR 0003](../decisions/0003-excess-marginal-value.md), archived `excess-mv-ranking`.

**Tax-consistent probe (fixed 2026-07-18):** the funded objective compares destinations after tax. An RRSP probe (a) credits the contributor's refund (contributed amount × working marginal rate, reinvested to non-reg) because Extra is after-tax cash, and (b) haircuts terminal RRSP by the scenario's effective retirement rate (`(tax + OAS clawback)/RRIF withdrawn`, ≤ 0.6) because RRSP face still owes withdrawal tax. This gives **RRSP wins iff refund rate > withdrawal rate** — green RRIF headroom favors RRSP over non-reg; red/overfunded favors non-reg. The earlier proxy deposited equal gross dollars and counted RRSP terminal at pre-tax face, so non-reg beat RRSP even with green headroom. The refund is credited **only on the amount that actually lands in an RRSP** (fixed 2026-07-19) — the part that spills to non-reg when room is exhausted was never deducted, so crediting it over-rewarded a room-limited destination and let own RRSP wrongly beat Spousal.

**Implementation status:** Excess UI **and** target/projection deploy use MV cutovers (`deployDiscretionaryByMvOrder` after ownership TFSA-first). Soft capacity remains diagnostic. MV scores use cascade-only accumulate probes; funded ranking uses an **after-tax** terminal-wealth proxy (RRSP refund credited on the way in, terminal RRSP haircut on the way out; no nested Extra Spend search). Deploy orders cached via `resolveMvDeployOrders`.

Typical MV order often collapses to TFSA → RRSP (while MV(RRSP) &gt; MV(Non-reg)) → Non-reg — the cascade shape — but RRSP must stop when MV falls (clawback / RRIF floor), not merely at a traffic-light tier.

UI always shows **He TFSA vs She TFSA** separately so a stream cannot look like it put more into “TFSA” than that person’s room.

`depositEsppToRrsp` remains a separate working-years toggle: **payroll ESPP→RRSP** vs
**sell-and-redeploy** through the Extra cascade. It does **not** gate refund math.

**Live-path RRSP tax refund (fixed 2026-07-19):** any after-tax dollar that lands in an RRSP
(Extra or ESPP-sale → own/Spousal, or payroll ESPP when the checkbox is on) generates
`deposit × contributor marginal rate`. Next year, `gross × esppRefundSaveRate` is redeployed
via MV (`estimateRrspRefund`). The reinvestment slider is always visible and applies to both
Extra and ESPP landings. MV **ranking** still credits a full refund (no slider) for fair
destination comparison. See [ADR 0003](../decisions/0003-excess-marginal-value.md) §Decision.8.

**`allocationPolicy` / TFSA-first vs RRSP-first:** **not a user control.** Extra/ESPP nest-egg path ignores it (ownership TFSA + MV). Engines coerce to `TFSA_FIRST`. Enum `RRSP_FIRST` kept only for saved-plan / legacy `deployAnnualContributions` compat.

**UI:** one **Extra investable $/mo** per person. The Excess advisor shows one combined
**Extra + ESPP cascade** for this year's deployable pools (Extra + ESPP sale proceeds +
estimated RRSP tax-refund redeposit), broken out by He/She TFSA, He/She RRSP, spousal RRSP, and non-reg.
Extra and ESPP are not presented as competing allocation systems because they use the same
per-person MV path; the role-based secondary stream still races for shared room first.
When `depositEsppToRrsp` is on, ESPP deposits through payroll (sale pool = $0) and its
refund still joins the estimated redeposit. Payroll ESPP %, match, and payroll RRSP %
stay separate inputs; `esppRefundSaveRate` is the global RRSP refund reinvestment rate.

**Engines (today):** MV order via `rankMvForStream` + `deployDiscretionaryByMvOrder` (TFSA ownership first) drive nest-egg accumulation and projection. Soft-capacity cascade is kept for Excess diagnostic compare and MV probe scoring. Earner roles are stable from base gross salary: **primary = higher salary; exact tie → He**. Spousal RRSP contributor = primary (uses primary room), annuitant = secondary (balance belongs to secondary).

Crowding paths: (1) Extra fills TFSA → later spill; (2) ESPP competes for the same TFSA room.

### 3.4 Decumulation

1. Inflate spend  
2. CPP and OAS **independently by age that year**  
3. Tax-aware gap after pension  
4. RRIF min if converted else flexible RRSP  
5. `max(spend_gap, RRIF_min)`; TFSA tax-free bridging  
5b. Forced RRIF excess → redeposit TFSA→non-reg  
6. No salary CPP/EI path on pension/RRIF  

TFSA bridging draws the larger remaining TFSA first (role-based secondary tie-break), not He-first;
extra taxable RRSP draws likewise use the larger remaining RRSP. Withdrawal ownership is therefore
name-symmetric.

**Splitting:** RRIF ≥65 only (50%). OAS never. CPP ≠ RRIF split mechanic.

**Survivor stress (both engines):** optional, default off ([ADR 0005](../decisions/0005-survivor-consistency.md), [ADR 0006](../decisions/0006-symmetric-earner-roles.md)). At `survivorYearIndex` (default: horizon midpoint), the **primary earner** is deceased by default; `survivorWho` can explicitly select He or She. The deceased's OAS stops, pension splitting is disabled, and the survivor keeps their own CPP plus 60% of the deceased's CPP, capped at the max single CPP. Household assets remain available to the survivor (crude v1). Retirement **spend drops to `survivorSpendFactor` (default 0.70, UI slider 50–100%)**. `runProjection` and `simulateDecumulation` apply this identically. Whether survivor raises or lowers required wealth depends on spend reduction versus lost pension; accumulation to retirement is unchanged.

### 3.5 RRSP → RRIF

- Grid ages **65..71** (and He×She pairs); younger-spouse age election optional  
- v1: full convert only; partial = v2  
- **Two-step:** solve min $ @71 → re-rank conversion at that wealth → report both  

### 3.6 Regime scoring for “best” conversion

| Regime | Objective |
|---|---|
| Under | Maximize years funded / min shortfall |
| Near | Meet 10k; then min tax + OAS clawback |
| Above | 10k floor; optimize tax / OAS / terminal |

### 3.7 Min Savings cards + deplete-to-~$0 chart

#### Engine fields (do not conflate)

| Field | Meaning |
|---|---|
| `projectedNestEggAtRetirement` | Current path: accumulate with **$0** solver personal (payroll + Extra/ESPP as entered). On the Dashboard this uses **cash-aware** projection (leave / free-cash cuts / raids). **Always** drives the “Nest Egg at Retirement” card + bucket breakdown. |
| `nestEggAtRetirement` | Funding-solve nest egg (realistic₀ + marginal Extra wealth). Used for shortfall, conversion grid wealth, →$0 band *mix scaling* — **not** the main nest-egg card. |
| `nestEggToZeroBand` | Tax-geometry band for target spend → ≈$0 (independent of whether the current path is funded). |
| `isFundedWithoutExtra` | Current path funds the horizon (`base.ok`). Min Savings “Already Funded” **and** Excess “tax optimization” framing. |
| `monthlyPersonalSavingsNeeded` | **Design** Extra $/mo (target engine @71/71). Gap card **BACKSOLVE** column — not the Gap headline. |
| `shortfallFromCurrentPath` | Nest-egg $ gap: funding-solve wealth − projected wealth (explainer only — **not** the Gap card headline). |
| `fundingSolveReached` | True if the Extra search found a fundable @71 nest egg. If false, UI shows `>$expandMax/mo` (safety only — **not** a $50k product ceiling). |

#### Funding Extra solve ([ADR 0004](../decisions/0004-extra-funding-solve.md))

1. **Baseline** = cash-aware (or default idealized) accumulate with solver Extra = $0 → `baseBuckets`, `isFundedWithoutExtra`.
2. If baseline already funds @71 → `monthlyPersonalSavingsNeeded = 0`.
3. Else search Extra \(M\) such that  
   `buckets(M) = baseBuckets + (idealAccumulate(M) − idealAccumulate(0))`  
   funds decumulation @71. Marginal Extra wealth is assumed **investable** (the dollars the family must free up); the live path’s leave/cash cuts stay in `baseBuckets`.
4. Expand upper bound (double from a low start) until funded or hit safety max (~$1M/mo). **No $50k product cap.** Binary-search the interval; report the last **known-good** upper bound (not the midpoint — mid often still fails and would falsely show “could not fund”).
5. If still unfunded at safety max → `fundingSolveReached = false`, report the max tried with `>` in UI.

**Rejected as the sole Gap answer:** `→$0 band − projected nest egg`; idealized-only funded check that says “No Extra needed” while the live path is short; fixed $50k ceiling as the answer; BACKSOLVE @71 as Gap headline when Plot 1 / Readiness is the primary “plan OK?” light. Wealth-gap → $/mo PMTs and BACKSOLVE appear as **labeled diagnostic columns** ([ADR 0004](../decisions/0004-extra-funding-solve.md)).

#### UI cards

| Card | Question answered |
|---|---|
| **Nest egg at retirement** | What will you have at retire on **current (cash-aware) inputs**? Label never says “Required”; value never caps to the min-need / solve floor. Not the funding gate. |
| **Nest egg → $0 band** | How large a nest egg sits behind each Extra estimate? Headline = **→$0 MIX**; wrapper bar = all TFSA / your mix / all RRSP. Four columns mirror the Extra card (sorted low → high): **→$0 MIX** uses recommended conversion ages; **BACKSOLVE** and **SOLVE EGG** share `nestEggAtRetirement` @71/71; **READINESS** is the cash-aware retirement egg produced by `solveExtraForReadiness`. |
| **Extra needed for lifestyle** | Headline = **READINESS** Extra (`solveExtraForReadiness`) — additional personal **$/mo** so Plot 1 / Retirement Readiness lasts the full horizon. If unreachable: `>$…/mo`. Four-column strip (sorted low → high): **READINESS** (primary); **BACKSOLVE** = `monthlyPersonalSavingsNeeded` @71/71 (design); **→$0 MIX** / **SOLVE EGG** = `monthlyFromWealthGap` diagnostics. When Readiness green and backsolve funded: Extra Spend Capacity; when UNDER even after solve: Affordable Spend. |
| **Retirement readiness** | Primary “plan OK?” — current-path cash shortfall on the **active Plot 1 projection** via `analyzeRetirementShortfall` (`expenses − netIncome` > $12/yr eps). Success = `lastsFullHorizon` (no gap in *any* retired year, including the last) — a gap only in the final year is **depleted**, not “Lasts to 85+”. Does **not** show Extra needed (that lives on the Gap card only). |
| **Earliest comfortable retirement** | When Extra Spend Capacity is positive: max joint `yearsEarlier` both spouses can stop earlier while still lasting to the **same** `terminalAgeHe` ([ADR 0007](../decisions/0007-early-retirement-solve.md)). Spend = active scenario only. Surfaced as a chip on Extra Spend Capacity + Plot 1 EARLIEST marker (not a separate Outlook card). |
| **Retirement monthly deficit** | Same helper as readiness (`analyzeRetirementShortfall` on `runProjection`). Shows worst monthly cash gap + ages — cash-flow **cross-check** of the viewer. Not a second “how much Extra do I need?” answer. Kept deliberately; not deprecated. |

#### Earliest comfortable retirement ([ADR 0007](../decisions/0007-early-retirement-solve.md))

`solveEarliestJointRetirement` binary-searches integer `yearsEarlier ≥ 0`:

1. Shift both `retirementAge` by the same amount (clamp each to `≥ age + 1`; relative gap preserved).
2. Hold entered `terminalAgeHe` fixed by setting trial `lifeExpectancyDelta = terminalAgeHe − he.retirementAge'` (do **not** mutate the user’s stored delta).
3. Accept a trial iff `analyzeRetirementShortfall(runProjection(trial)).lastsFullHorizon` for the **active** Realistic/Mandatory spend.
4. If the entered ages already fail Readiness → report `yearsEarlier = 0` / not lasting (no fake earliest age).

CPP/OAS rules unchanged (OAS @65; CPP claim clamped 60–70). Stop-work before 60 is allowed.

#### Plot 1 (portfolio) + green dashed →$0

| State (`isFundedWithoutExtra` / surplus kind) | Solid / fill | Yellow / green dashed |
|---|---|---|
| **Funded** | Cash-aware projected nest egg at **target** spend | Same nest egg spent *harder* (surplus) until ~$0 at horizon |
| **Below target** (`surplus.kind === 'required'`) | **Current** path at target spend (runs out early) | **Solved** nest egg at the *same* target spend → ~$0 |
| **Under** (even solved nest egg fails) | Best-effort path | Max *affordable* spend that still → ~$0 |

Below-target comparison: both curves use the **same target spend**; they differ by starting wealth (projected vs solved). Plot 1 stacks **TFSA / RRSP / Non-reg** fills under the active portfolio line. Retired years use start-of-year wealth (`plot1PortfolioBalance`) so the line does not bounce after underfunded draw years.

**Survivor consistency:** see §3.4 — both engines apply the same survivor stress ([ADR 0005](../decisions/0005-survivor-consistency.md)), so the Plot 1 line, readiness/deficit, and the Extra/→$0 cards share one survivor assumption.

#### Plot 2 (cash flow)

Lines: **net income**, **total spend**, **spend + intended personal contrib** (sky dashed).  
`intendedPersonalCash` = RRSP emp + ESPP emp + He/She Extra + solver Extra + refund redeposit (before free-cash cuts).  
**Savings strain** = `netIncome − expenses − intendedPersonalCash` (= `unallocatedCashUncapped`) — tooltip only, not a Plot 2 line.

#### Nest Egg → $0 band math

Three nominal face-value solves for the same target spend / horizon / recommended conversion ages:

| Benchmark | Meaning |
|---|---|
| **All TFSA** | 100% tax-free wrapper (lower bound) |
| **Your mix** | Scaled solved TFSA/RRSP/non-reg proportions |
| **All RRSP** | 100% taxable RRIF wrapper (upper bound) |

Expect `allTfsa ≤ yourMix ≤ allRrsp`. Distinct from projected nest egg when overfunded (projected ≫ your mix) or underfunded (projected ≪ your mix). Surplus raises *spend* on the projected egg; the band answers a different question (min wealth for fixed spend → ≈$0).

**Projected nest egg UI:** TFSA / RRSP / non-reg face-value breakdown from **projected** buckets.

### 3.8 Cash-aware working years

`runProjection` / `constrainContributionsByFreeCash`:

- Leave-reduced salaries and lifestyle spend can cut voluntary contributions and, if needed, **raid** the portfolio (`shortfallRaided`).
- Working-year fields: `intendedPersonalCash`, `unallocatedCash` / `unallocatedCashUncapped`.
- **Underfunded retirement draw:** if no trial funds the year’s spend, keep the **lowest-shortfall (max-drain)** trial — do not leave RRIF-mins-only leftovers that grow after a shortfall year.

Dashboard wires cash-aware accumulate into `calculatePlanTargets` for the projected nest egg / funded check; Extra solve adds marginal idealized Extra on top ([ADR 0004](../decisions/0004-extra-funding-solve.md)).

## 4. Pensions & tax constraints

Per-person age-aware pensions: `calculatePersonPensionForAge` (projection + target engine).

| Benefit | Input | v1 rule |
|---|---|---|
| **OAS** | `startYearInCanada` (Year arrived in Canada) | Residency years = year turns 65 − arrival; full at 40y; prorate if ≥10y; $0 before 65; +10% from 75. Clawback ~$91k / 15% per person. |
| **CPP** | `cppStartYear` (Year started working) | Contribution years = claim year − max(work start, age 18); × YMPE ratio vs max; claim at retirement age clamped 60–70 with early/late factors. |

Two separate UI fields — do **not** reuse arrival for CPP. Old saved plans missing `cppStartYear` migrate to `startYearInCanada`.

- CPP enhancement (2019+) note/knob; CRDO note if leave ignored  
- Ontario + federal configurable  

---

## 5. Implementation phases

- **A** Types + ledger  
- **B1** Decumulation primitives + tests  
- **B2** Target search + conversion grid + tests  
- **C** Wire cards (labels/disclaimers)  
- **D** Contribution policy + spousal  
- **E** UI redesign (free to change)  

---

## 6. Non-goals (v1)

Monte-Carlo, full non-reg CG precision, FX, LTI, home equity, declining wants schedule. Survivor = optional toggle.

---

## 7. Tensions

Horizon/buffer labeling; full-convert ≠ partial optimum; non-reg tax simplification; near-band must be configurable; existing mono-portfolio code debt; MV deploy orders ranked once at accumulate start (not re-scored each year); funded MV uses an after-tax terminal-wealth proxy (refund credit + terminal RRSP haircut) not full Extra Spend binary-search; Extra funding solve assumes marginal Extra is investable even when the live path is cash-constrained (Gap card = monthly target, not a promise cash exists today).

---

## 8. Success criteria

Min contribution answers the 10k / 20y / bucket-aware question as **Extra $/mo on the realistic path** ([ADR 0004](../decisions/0004-extra-funding-solve.md)); allocation and conversion recommendations move sensibly by regime; tests cover RRIF, OAS-by-age, TFSA untaxed, RRIF-only split, excess redeposit, regime scorer, uncapped Extra solve (&gt;$50k when needed), cash-aware + marginal Extra. Excess “highest ROI” = MV of Extra by funding regime ([ADR 0003](../decisions/0003-excess-marginal-value.md)) — soft capacity alone is not success.

---

## 9. AI judge (2026-07-12)

[plan validation](75394fa1-742e-4737-bb61-de3d751ca45c) — **GO-WITH-FIXES**; amendments incorporated here.
