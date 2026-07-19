import { describe, it, expect } from 'vitest';
import { AllocationPolicy, FamilyMember, MvDestination } from '../types/calculator';
import {
  SoftCapacityLevel,
  deployDiscretionaryWithSoftLimits,
  explainExcessMoney,
} from '../utils/excessMoneyGuide';
import {
  feasibleDestinationsForStream,
  mvProbeAnnual,
  rankMvForStream,
  topDestinationFromSplit,
  topDestinationLabel,
} from '../utils/marginalValueGuide';
import { roomsFromPlanOpening } from '../utils/marginalValueGuide';
import { DEFAULT_ACCOUNT_BUCKETS } from '../utils/accountBuckets';
import { accumulateToRetirement } from '../utils/targetEngine';
import {
  basePlan,
  fixtureAmberBorderlineFunded,
  fixtureSheExtraOnly,
  fixtureSpousalResidual,
  fixtureTfsaFullGreen,
  fixtureTfsaFullRedRrsp,
  fixtureTfsaRoomOpen,
  fixtureUnderfundedTfsaRoom,
} from './fixtures/excessMvFixtures';

describe('marginalValueGuide helpers', () => {
  it('mvProbeAnnual floors at 1000 and scales with Extra', () => {
    expect(mvProbeAnnual(0)).toBe(1000);
    expect(mvProbeAnnual(50)).toBe(1000);
    expect(mvProbeAnnual(200)).toBe(2400);
  });

  it('She stream can spill to He TFSA but not his personal RRSP', () => {
    const rooms = roomsFromPlanOpening(basePlan());
    const dest = feasibleDestinationsForStream(FamilyMember.SHE, rooms, false);
    expect(dest).toContain(MvDestination.TFSA_HE);
    expect(dest).toContain(MvDestination.TFSA_SHE);
    expect(dest).not.toContain(MvDestination.RRSP_HE);
  });
});

describe('marginalValueGuide ranking', () => {
  it('open TFSA room → MV top is TFSA (agreement with cascade)', () => {
    const plan = fixtureTfsaRoomOpen();
    const mv = rankMvForStream(plan, FamilyMember.SHE, { currentYear: 2026 });
    expect(mv.suggestedSplit.toTfsaShe).toBeGreaterThan(0);

    const cascade = explainExcessMoney(plan, { currentYear: 2026 });
    const cascadeTop = topDestinationFromSplit(cascade.sheSplit, FamilyMember.SHE);
    expect(cascadeTop).toBe(MvDestination.TFSA_SHE);
  });

  it('She Extra can rank He TFSA but never He personal RRSP', () => {
    const plan = fixtureSheExtraOnly();
    const mv = rankMvForStream(plan, FamilyMember.SHE, { currentYear: 2026 });
    expect(mv.ranking.map((r) => r.destination)).toContain(MvDestination.TFSA_HE);
    expect(mv.ranking.map((r) => r.destination)).not.toContain(MvDestination.RRSP_HE);
  });

  it('underfunded uses funding scalar (Extra $/mo) — baseline needs Extra or shortfall', () => {
    const plan = fixtureUnderfundedTfsaRoom();
    const mv = rankMvForStream(plan, FamilyMember.HE, { currentYear: 2026 });
    expect(mv.isFunded).toBe(false);
    expect(mv.baseline.monthlyPersonalSavingsNeeded).toBeGreaterThan(0);
    // Best destination should not worsen required Extra vs baseline (monotonicity)
    const bestSnap = mv.ranking[0]!.snapshot;
    expect(bestSnap.monthlyPersonalSavingsNeeded).toBeLessThanOrEqual(
      mv.baseline.monthlyPersonalSavingsNeeded + 1
    );
  });

  it('TFSA full + soft green: MV top is an RRSP or Non-reg (not TFSA)', () => {
    const plan = fixtureTfsaFullGreen();
    const mv = rankMvForStream(plan, FamilyMember.HE, { currentYear: 2026 });
    expect([MvDestination.RRSP_HE, MvDestination.NON_REG]).toContain(
      mv.top
    );

    const cascade = explainExcessMoney(plan, { currentYear: 2026 });
    const cascadeTop = topDestinationFromSplit(cascade.heSplit, FamilyMember.HE);
    // Agreement when both prefer registered vs Non-reg under green
    if (
      cascadeTop === MvDestination.RRSP_HE ||
      cascadeTop === MvDestination.RRSP_SHE ||
      cascadeTop === MvDestination.NON_REG
    ) {
      // Document agreement on registered family when cascade also skipped TFSA
      expect(mv.top === cascadeTop || mv.ranking[0]!.primaryDelta >= 0).toBe(true);
    }
  });

  it('green RRIF headroom: RRSP ranks strictly above Non-reg (refund + after-tax terminal)', () => {
    // Regression: previously the MV probe deposited equal gross dollars everywhere and
    // counted RRSP terminal at pre-tax face, so RRSP was taxed on RRIF withdrawal with no
    // offsetting refund and could never beat Non-reg — even with green RRIF headroom.
    const plan = fixtureTfsaFullGreen();
    const soft = explainExcessMoney(plan, { currentYear: 2026 });
    expect(soft.softCapacityHe.level).toBe(SoftCapacityLevel.GREEN);

    const mv = rankMvForStream(plan, FamilyMember.HE, { currentYear: 2026 });
    const rrspIdx = mv.ranking.findIndex((r) => r.destination === MvDestination.RRSP_HE);
    const nonRegIdx = mv.ranking.findIndex((r) => r.destination === MvDestination.NON_REG);
    expect(rrspIdx).toBeGreaterThanOrEqual(0);
    expect(nonRegIdx).toBeGreaterThanOrEqual(0);
    expect(rrspIdx).toBeLessThan(nonRegIdx);

    const rrsp = mv.ranking[rrspIdx]!;
    const nonReg = mv.ranking[nonRegIdx]!;
    expect(rrsp.primaryDelta).toBeGreaterThan(nonReg.primaryDelta);
  });

  it('TFSA full + huge RRSP: MV prefers Non-reg over more RRSP (cascade RED → Non-reg agreement)', () => {
    const plan = fixtureTfsaFullRedRrsp();
    const soft = explainExcessMoney(plan, { currentYear: 2026 });
    // Soft should be stressed
    expect(
      soft.softCapacityHe.level === SoftCapacityLevel.RED ||
        soft.softCapacityHe.level === SoftCapacityLevel.AMBER
    ).toBe(true);

    const mv = rankMvForStream(plan, FamilyMember.HE, { currentYear: 2026 });
    const cascadeTop = topDestinationFromSplit(soft.heSplit, FamilyMember.HE);

    // Cascade on RED skips RRSP → Non-reg; MV should not pick more RRSP as top
    expect(mv.top).not.toBe(MvDestination.RRSP_HE);
    expect(mv.top).not.toBe(MvDestination.RRSP_SHE);
    if (cascadeTop === MvDestination.NON_REG) {
      expect(mv.top).toBe(MvDestination.NON_REG);
    }
  });

  it('amber/borderline funded: record cascade vs MV tops (disagree if constructible)', () => {
    const plan = fixtureAmberBorderlineFunded();
    const cascade = explainExcessMoney(plan, { currentYear: 2026 });
    const cascadeTop = topDestinationFromSplit(cascade.heSplit, FamilyMember.HE);
    const mv = rankMvForStream(plan, FamilyMember.HE, { currentYear: 2026 });

    // Characterization — not a hard equality gate. Prefer documenting a disagree when MV
    // ranks Non-reg above He RRSP while cascade still fills RRSP (AMBER allows RRSP).
    const mvPrefersNonRegOverHeRrsp =
      mv.ranking.findIndex((r) => r.destination === MvDestination.NON_REG) <
      mv.ranking.findIndex((r) => r.destination === MvDestination.RRSP_HE);

    if (
      cascade.softCapacityHe.level === SoftCapacityLevel.AMBER &&
      cascadeTop === MvDestination.RRSP_HE &&
      mvPrefersNonRegOverHeRrsp
    ) {
      // Intentional disagreement fixture
      expect(mv.top).not.toBe(cascadeTop);
    } else {
      // If model cannot construct disagree, still assert MV is well-formed
      expect(mv.ranking.length).toBeGreaterThan(0);
      expect(topDestinationLabel(mv.top).length).toBeGreaterThan(0);
    }
  });

  it('probe is sized to the post-TFSA residual, not the full pool', () => {
    // She Extra $4k/mo = $48k/yr pool, but She TFSA (25k) + He TFSA (11.7k) = 36.7k room
    // fills first, so only ~11.3k/yr reaches the RRSP tier.
    const plan = fixtureSpousalResidual();
    const mv = rankMvForStream(plan, FamilyMember.SHE, { currentYear: 2026 });
    expect(mv.probeAnnual).toBeGreaterThan(1000);
    expect(mv.probeAnnual).toBeLessThan(48000 * 0.5); // well below the full pool
    expect(mv.probeAnnual).toBeCloseTo(48000 - (25000 + 11708), 0);
  });

  it('spousal residual regression: Spousal RRSP ranks above She own RRSP', () => {
    // Two coupled fixes make this correct under survivor stress with She's small RRSP room:
    //   1. residual probe (only the post-TFSA amount reaches the RRSP tier), and
    //   2. refund credited only on the amount that actually lands in an RRSP (not the part
    //      that spills to non-reg when room is exhausted).
    // Before the fixes, She's own (room-limited) RRSP over-earned the spill refund and beat
    // Spousal, even though Spousal captures the primary earner's higher-rate deduction.
    const plan = fixtureSpousalResidual();

    const expectSpousalWins = (probeAnnual?: number) => {
      const mv = rankMvForStream(plan, FamilyMember.SHE, {
        currentYear: 2026,
        ...(probeAnnual ? { probeAnnual } : {}),
      });
      const spousalIdx = mv.ranking.findIndex((r) => r.destination === MvDestination.SPOUSAL);
      const ownIdx = mv.ranking.findIndex((r) => r.destination === MvDestination.RRSP_SHE);
      expect(spousalIdx).toBeGreaterThanOrEqual(0);
      expect(spousalIdx).toBeLessThan(ownIdx);
      expect(mv.ranking[spousalIdx]!.primaryDelta).toBeGreaterThan(
        mv.ranking[ownIdx]!.primaryDelta
      );
    };

    // Default (residual) probe — the user's real scenario.
    expectSpousalWins();
    // Even at the full pool, the refund-spill fix keeps Spousal ahead.
    expectSpousalWins(48000);
  });

  it('monotonicity: best destination does not worsen primary scalar vs baseline', () => {
    const plan = fixtureTfsaRoomOpen();
    const mv = rankMvForStream(plan, FamilyMember.SHE, { currentYear: 2026 });
    const best = mv.ranking[0]!;
    if (mv.isFunded) {
      expect(best.snapshot.surplusExtraMonthly).toBeGreaterThanOrEqual(
        mv.baseline.surplusExtraMonthly - 1
      );
    } else {
      expect(best.snapshot.monthlyPersonalSavingsNeeded).toBeLessThanOrEqual(
        mv.baseline.monthlyPersonalSavingsNeeded + 1
      );
    }
  });
});

describe('Phase 3B MV deploy cutover', () => {
  it('TFSA full + stressed RRSP: Extra lands in Non-reg on accumulate (not more RRSP)', () => {
    const plan = fixtureTfsaFullRedRrsp();
    const none = accumulateToRetirement(
      { ...plan, heInput: { ...plan.heInput, extraContributionMonthly: 0 } },
      0,
      2026,
      AllocationPolicy.TFSA_FIRST,
      { useMvDeploy: true }
    );
    const withExtra = accumulateToRetirement(plan, 0, 2026, AllocationPolicy.TFSA_FIRST, {
      useMvDeploy: true,
    });
    // Discretionary Extra should grow Non-reg more than RRSP vs Extra=0 path
    const dNon = withExtra.nonReg - none.nonReg;
    const dRrsp = withExtra.rrspHe + withExtra.rrspShe - (none.rrspHe + none.rrspShe);
    expect(dNon).toBeGreaterThan(0);
    expect(dNon).toBeGreaterThan(dRrsp);
  });

  it('open TFSA: Extra prefers TFSA face over Non-reg on accumulate', () => {
    const plan = fixtureTfsaRoomOpen();
    // Isolate She Extra (fixture keeps He ESPP which can swamp Non-reg deltas)
    const base = {
      ...plan,
      heInput: {
        ...plan.heInput,
        esppEmployeeRate: 0,
        esppEmployerRate: 0,
        extraContributionMonthly: 0,
      },
    };
    const none = accumulateToRetirement(
      {
        ...base,
        sheInput: { ...base.sheInput, extraContributionMonthly: 0 },
      },
      0,
      2026,
      AllocationPolicy.TFSA_FIRST,
      { useMvDeploy: true }
    );
    const withExtra = accumulateToRetirement(
      {
        ...base,
        sheInput: { ...base.sheInput, extraContributionMonthly: 500 },
      },
      0,
      2026,
      AllocationPolicy.TFSA_FIRST,
      { useMvDeploy: true }
    );
    const dTfsa = withExtra.tfsaShe + withExtra.tfsaHe - (none.tfsaShe + none.tfsaHe);
    const dNon = withExtra.nonReg - none.nonReg;
    expect(dTfsa).toBeGreaterThan(dNon);
  });
});

describe('Phase 0 cascade characterization fixtures', () => {
  it('sheExtraOnly: cascade spills into He TFSA after She TFSA', () => {
    const plan = fixtureSheExtraOnly();
    const rooms = {
      tfsaHe: plan.heInput.carryForwardTfsaRoom ?? 0,
      tfsaShe: plan.sheInput.carryForwardTfsaRoom ?? 0,
      rrspHe: 100_000,
      rrspShe: 100_000,
    };
    const r = deployDiscretionaryWithSoftLimits({
      heExtraAnnual: 0,
      sheExtraAnnual: 36_000,
      heEsppSaleAnnual: 0,
      heRefundRedepositAnnual: 0,
      rooms,
      buckets: { ...DEFAULT_ACCOUNT_BUCKETS },
      softCapacityHe: SoftCapacityLevel.GREEN,
      softCapacityShe: SoftCapacityLevel.GREEN,
      heSalary: plan.heInput.salary,
      sheSalary: plan.sheInput.salary,
      optimizeSpousal: false,
    });
    expect(r.sheSplit.toTfsaHe).toBeGreaterThan(0);
    expect(r.rooms.tfsaHe).toBeLessThan(rooms.tfsaHe);
  });
});
