# Math model (living)

Status: research-complete; evolving source of truth for domain behavior  
Audience: implementers + agents  
Not financial advice.

Supersedes chat archaeology and deprecated `GEMINI.md`. Settled tradeoffs also recorded under `docs/decisions/`.

---

## 1. Product intent

Periodic (6–12 month) **review tool**, not a life crystal ball.

Primary outputs (**cards / target numbers**):
- Required nest egg at retirement (today’s $ and/or nominal — both labeled)
- Minimum required contribution today ($/mo) — **option C**
- Suggested contribution allocation (TFSA / matched RRSP / discretionary RRSP / non-reg)
- RRSP→RRIF conversion **recommendation** (with runners-up)
- Regime label: under / near / above target

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
| Inflation | 2% |
| Portfolio return | 5% nominal (~2.9% real) |
| Post-retirement horizon | **20 years** (~to age 85) |
| TFSA new room | $7,000 / person / year |
| RRSP room | 18% earned income to annual dollar max + carry-forward |
| He RRSP | 3% employee + 3% employer match |
| She RRSP | 2% employee + 2% employer match |
| He ESPP | 10% + 1.5% employer; **sell immediately**; redeploy to registered accounts |
| He parental top-up | 0 (conservative) |
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
2. Fill TFSA room  
3. Discretionary RRSP vs TFSA/non-reg (brackets + projected RRIF/OAS)  
4. Overflow → non-reg  

ESPP cash follows this policy. Spousal RRSP stays as optimizer.

### 3.4 Decumulation

1. Inflate spend  
2. CPP and OAS **independently by age that year**  
3. Tax-aware gap after pension  
4. RRIF min if converted else flexible RRSP  
5. `max(spend_gap, RRIF_min)`; TFSA tax-free bridging  
5b. Forced RRIF excess → redeposit TFSA→non-reg  
6. No salary CPP/EI path on pension/RRIF  

**Splitting:** RRIF ≥65 only (50%). OAS never. CPP ≠ RRIF split mechanic.

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

---

## 4. Pensions & tax constraints

- OAS from 65 per year; clawback per person (~$91k, 15%); +10% from 75  
- Separate residency start vs CPP contribution start  
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

Horizon/buffer labeling; full-convert ≠ partial optimum; non-reg tax simplification; near-band must be configurable; existing mono-portfolio code debt.

---

## 8. Success criteria

Min contribution answers the 10k / 20y / bucket-aware question; allocation and conversion recommendations move sensibly by regime; tests cover RRIF, OAS-by-age, TFSA untaxed, RRIF-only split, excess redeposit, regime scorer.

---

## 9. AI judge (2026-07-12)

[plan validation](75394fa1-742e-4737-bb61-de3d751ca45c) — **GO-WITH-FIXES**; amendments incorporated here.
