# Design: Excess MV ranking

## Problem

Current Excess path (`explainExcessMoney` → `deployDiscretionaryWithSoftLimits` + soft capacity traffic lights) answers “follow ownership TFSA then soft RRSP then Non-reg.” Users (and product intent) want “highest ROI” for that same dollar. Soft capacity patches the worst RRSP mistake but is not an objective function.

## Objective (definition of ROI)

For destinations \(d \in \{\)He TFSA, She TFSA, He RRSP, She RRSP, Spousal, Non-reg\(\}\) with legal/ownership room:

\[
\mathrm{MV}(d)=\frac{\Delta\,\text{objective}}{\$1\ \text{today into }d}
\]

| Household state | Objective for \(\Delta\) |
|---|---|
| Underfunded (`!isFundedWithoutExtra`) | Progress to funded horizon (e.g. reduce shortfall / months of required Extra, or increase years funded) — same spirit as Min Savings / target engine |
| Funded / tax framing | Sustainable after-tax spend capacity at horizon, or tax + OAS clawback drag for **fixed** target spend |

Face-value portfolio growth rate is **not** ROI (same \(r\) across buckets). Deduction today vs tax/clawback later *are* part of MV.

## Architecture

```
ownership + room constraints (unchanged)
        │
        ▼
   score MV(d)  ──shadow──►  compare to cascade split (tests)
        │
        ▼
 Excess UI recommendation / suggested split   ← replace when stable
        │
 soft capacity headroom @71                   ← diagnostic only (after swap)
        │
 deployDiscretionaryWithSoftLimits            ← keep until shadow OK;
                                                then MV cutovers or keep if ≈
```

### Ownership constraints (do not reopen)

- She Extra → She TFSA only (never consumes He TFSA).
- He Extra / ESPP / refund → He TFSA → She TFSA, then registered / Non-reg.
- Overflow is never lifestyle → Non-reg residual.
- Employer match and payroll RRSP stay outside Extra MV (already locked).

### Soft capacity role after swap

- Display GREEN / AMBER / RED + `$` headroom @71 as **why RRSP ranked low**.
- Do not use traffic-light alone to choose preferred spouse / stop RRSP once MV controller ships (unless MV falls back to it as an approximation).

### Shadow / comparison phase (revised)

See [`migration.md`](./migration.md).

- **Do not** gate ship on `mvSplit ≈ cascadeSplit` (different objectives; MV must be allowed to disagree).  
- **Do** keep cascade tests as characterization/deploy guard.  
- **Do** assert **agreement on top destination** where theory says TFSA-first / green RRSP.  
- **Do** assert at least one **documented disagreement** (or document why none exists).  
- **Do** prefer monotonicity vs cascade-equality as the main correctness signal.  
- No second Dashboard panel; no user-facing shadow mode.

### UI (single Excess panel)

- Replace recommendation narrative + suggested split with MV ranking (top destination + breakdown).
- Keep “Tax optimization framing” badge when `isFundedWithoutExtra`.
- Keep TFSA exhaustion / crowding as room logistics (orthogonal to MV).

## Implementation sketch (non-binding)

1. `marginalValueGuide.ts` (or extend `excessMoneyGuide.ts`): evaluate small Extra delta routed entirely to each feasible \(d\), reuse projection / tax / OAS primitives from `targetEngine` / `retirementCalc` where possible.
2. Aggregate into recommended annual split that respects room race (may still look cascade-like when MV is monotone TFSA > RRSP > Non-reg).
3. Wire ExcessRoomPanel copy to MV result; soft capacity cards stay.
4. Optional later: teach `deployDiscretionaryWithSoftLimits` to stop RRSP when `MV(RRSP) < MV(NonReg)`.

## Risks

| Risk | Mitigation |
|---|---|
| MV expensive (many resims) | Score annual lump or coarse dollar probe; cache per plan hash; shadow first |
| Non-reg tax crude → MV noise | Document; prefer order among registered vs Non-reg only when gap large |
| Underfunded objective fights tax packing | Hard gate: funding objective until `isFundedWithoutExtra` |
| Drift vs cascade deploy | Shadow tests + ADR: UI may lead deploy until cutovers land |

## Resolved scalars (2026-07-14 — operator OK)

| Question | Decision |
|---|---|
| **Underfunded scalar** | Primary: minimize **required Extra $/mo** (`monthlyPersonalSavingsNeeded`). Tie-break: nest-egg `shortfallFromCurrentPath`. |
| **Funded scalar** | Primary: maximize **terminal wealth at fixed target spend** as a surplus-capacity proxy (full Extra Spend binary-search was too slow for MV ranking). Tie-break: tax + OAS drag. |
| **Probe size** | **$1,000 / year** baseline. If the person already has Extra, use \(\max(1000,\ \text{one month Extra}\times 12)\) so the probe tracks their scale. If Extra is $0, still rank with $1,000/yr (“if you add Extra later”). |

`MV(d)` = improvement in the primary scalar when that probe is routed entirely to destination \(d\) (subject to room/ownership), vs baseline with probe not applied (or applied to a null dump only in tests — prefer baseline = current plan).
