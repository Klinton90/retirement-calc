# ADR 0003: Excess advisor — marginal value over soft-capacity cascade

- Status: Accepted
- Date: 2026-07-14
- Updated: 2026-07-18 (funded objective made tax-consistent — see §Decision.2)
- Updated: 2026-07-19 (RRSP-tier probe sized to post-TFSA residual; refund credited only on the amount that actually lands in an RRSP — see §Decision.2)
- Updated: 2026-07-19 (live-path RRSP refund = post-deploy × marginal × slider, lagged; see §Decision.8)
- Relates: [`docs/explanation/math-model.md`](../explanation/math-model.md) §3.3; archive [`docs/specs/archive/2026-07-14-excess-mv-ranking/`](../specs/archive/2026-07-14-excess-mv-ranking/)

## Context

The Excess / room advisor implements a locked **TFSA → preferred RRSP → Non-reg** cascade gated by soft RRIF-headroom traffic lights (GREEN / AMBER / RED vs OAS clawback path at 71). That cascade is a reasonable bang-bang *default*, but the product intent is **highest after-tax retirement payoff** for Extra / ESPP dollars — not “fill RRSP until red.”

Soft capacity correctly captures that blind RRSP maxing is harmful (forced RRIF minima + OAS clawback). It does **not** define ROI. Shipping a second parallel “ROI optimizer” UI alongside Excess would create two competing truths for the same dollar.

## Decision

1. **Evolve Excess in place** — one Excess / room advisor. Do **not** add a permanent parallel optimization track in the UI.
2. **Define “highest ROI” as marginal value (MV)** of the next Extra dollar under ownership/room constraints:
   - **Underfunded** (`!isFundedWithoutExtra`): minimize required Extra $/mo (`monthlyPersonalSavingsNeeded`); tie-break nest-egg shortfall.
   - **Funded / tax framing**: maximize **after-tax** terminal wealth at fixed target spend (surplus-capacity proxy; avoids nested Extra Spend binary-search in ranking); tie-break tax + OAS drag.
   - **Tax consistency (fixed 2026-07-18):** the probe must compare destinations on a like-for-like after-tax basis. Two corrections in `mvObjectiveSnapshot` / `accumulateToRetirement`:
     - **Contribution side:** an RRSP probe credits the contributor's tax refund (contributed amount × working marginal rate) and reinvests it (→ non-reg). Extra is after-tax cash, so without the refund the probe deposited equal *gross* dollars everywhere. The refund is credited **only on the amount that actually lands in an RRSP** — the part that spilled to non-reg because room was exhausted was never deducted, so crediting it too over-rewards a room-limited destination (e.g. own RRSP) and let it wrongly beat a room-ample one (e.g. Spousal via the primary's larger room). *(fixed 2026-07-19)*
     - **Withdrawal side:** terminal RRSP face still owes deferred tax, so it is haircut by the scenario's effective retirement rate (`(totalTaxPaid + totalOasClawback) / totalRrifWithdrawn`, clamped ≤ 0.6). Non-reg/TFSA terminal counts near face.
     - Net effect is the classic rule **RRSP wins iff refund rate > withdrawal rate**: green RRIF headroom (low withdrawal rate) favors RRSP over non-reg; red / overfunded (clawback) favors non-reg. The prior proxy taxed RRSP on RRIF withdrawal with no offsetting refund *and* counted RRSP terminal at pre-tax face, so non-reg beat RRSP even with green headroom (the reported bug).
   - **Probe size (fixed 2026-07-19):** the ranking exists to order the **RRSP tier** (own RRSP vs Spousal vs Non-reg). Ownership TFSA always fills first (`withOwnershipTfsaFirst`), so only the pool left *after* TFSA reaches that tier. The probe is therefore the **post-TFSA residual**: \(\max(1000,\ \text{stream pool} - \text{available TFSA room (both accounts)})\), floored at $1,000/yr. Probing with the full pool oversaturated RRSP well past green RRIF headroom, where the RRSP destinations flatten and a room-limited one (Spousal, which consumes the primary's room) could wrongly lose to the stream's own RRSP. The **displayed** suggested split still deploys the full pool (`extra × 12`); only the *scoring* probe is the residual.
   - **Perf:** MV deploy orders ranked once and cached (`resolveMvDeployOrders`); never re-rank inside each accumulate binary-search trial.
3. **Soft capacity stays as diagnostic / explanation**, not the primary controller of recommendations once MV ships. Headroom @71 still explains why MV(RRSP) falls.
4. **Cascade deploy → MV cutovers (Phase 3B, 2026-07-14):** `accumulateToRetirement` and `runProjection` route Extra/ESPP/refund by **ownership TFSA first**, then precomputed MV destination order (ranked once with cascade-only scoring to avoid recursion). Soft-capacity cascade remains for characterization and MV probe scoring, but its competing split is **not displayed** in the Dashboard. `personInputsFromExtraAllocation` uses MV suggested splits.
5. Soft capacity stays as **diagnostic / explanation** in Excess UI (headroom @71), not the deploy controller.
6. Temporary shadow/agreement tests only — not a second Dashboard panel.
7. **Ownership constraints are symmetric** as settled by
   [ADR 0006](0006-symmetric-earner-roles.md): each person's stream may fill either TFSA,
   personal RRSP is owner-only, cross-spouse RRSP is spousal-only, and each person's ESPP
   stays on that person's MV path.
8. **Live-path RRSP tax refund (fixed 2026-07-19):** whenever after-tax Extra or ESPP proceeds
   **land in an RRSP** (own or spousal) — or payroll ESPP when `depositEsppToRrsp` is on —
   engines credit `deposit × contributor marginal rate`, then redeploy
   `gross × esppRefundSaveRate` **next year** via the same MV cascade
   (`estimateRrspRefund` in both `runProjection` and `accumulateToRetirement`).
   The slider is always visible; the payroll checkbox only chooses the ESPP vehicle.
   The old checkbox-gated `cash × 0.4 × rate` elect is removed (single mechanism).
   **MV probe ranking** still credits a **full** refund (no slider) so Spousal vs own RRSP
   comparison stays tax-consistent.

## Consequences

- Docs and Excess copy must stop implying soft capacity *is* the tax optimum; frame it as RRIF/OAS headroom until MV lands.
- Implementation work lived in OpenSpec-lite change `excess-mv-ranking` (archived when shipped).
- Spousal / ESPP advisors remain helpers; they must not invent a second ranking of the same Extra dollar.
- **No user `AllocationPolicy` TFSA/RRSP-first toggle** — Extra path is ownership TFSA + MV; engines coerce `TFSA_FIRST`.
- The MV probe (post-TFSA residual, floored at `$1,000/yr`) is an internal ranking probe, not a contribution. When entered Extra is `$0`, the Extra-routing UI shows no dollars; it never renders the probe as a suggested deposit. ESPP has its own subsection.

## Rejected alternatives

| Alternative | Why rejected |
|---|---|
| Permanent dual UI (cascade panel + ROI panel) | Competing recommendations; trust debt |
| Classical DE / closed-form extrema for whole plan | Tax, clawback, RRIF ages, ownership → non-smooth hybrid system; simulation + MV is the honest tool |
| Always max RRSP after TFSA | Contradicts OAS/RRIF soft-capacity insight |
| Replace soft capacity UI entirely day one | Loses a clear diagnostic users already see; demote after MV stable |
| User-facing TFSA-first / RRSP-first allocation toggle | Superseded by ownership TFSA + MV; toggle removed from UI |
