import { describe, it, expect } from 'vitest';
import {
  SoftCapacityLevel,
  softCapacityLevel,
  deployDiscretionaryWithSoftLimits,
  explainExcessMoney,
  resolveExtraContributionMonthly,
  SOFT_CAPACITY_GREEN_HEADROOM,
} from '../utils/excessMoneyGuide';
import { preferDiscretionaryRrspOwner } from '../utils/contributionPolicy';
import { AllocationPolicy, ContributionType, FamilyMember, SavingsBase, type RetirementPlan } from '../types/calculator';
import { DEFAULT_TAX_CONFIG, DEFAULT_CCB_CONFIG } from '../utils/taxCalc';
import { DEFAULT_ACCOUNT_BUCKETS, totalInvestable } from '../utils/accountBuckets';
import { accumulateToRetirement, calculatePlanTargets } from '../utils/targetEngine';

function basePlan(over: Partial<RetirementPlan> = {}): RetirementPlan {
  return {
    heInput: {
      name: 'He',
      age: 36,
      salary: 168000,
      startYearInCanada: 2013,
      cppStartYear: 2014,
      retirementAge: 65,
      extraIncomeMonthly: 0,
      rrspEmployeeType: ContributionType.PERCENTAGE,
      rrspEmployeeValue: 3,
      rrspEmployerRate: 3,
      esppEmployeeRate: 10,
      esppEmployerRate: 1.5,
      extraContributionMonthly: 0,
      otherSavingsTfsaMonthly: 0,
      otherSavingsRrspMonthly: 0,
      carryForwardRrspRoom: 144050,
      carryForwardTfsaRoom: 11708,
    },
    sheInput: {
      name: 'She',
      age: 38,
      salary: 82000,
      startYearInCanada: 2020,
      cppStartYear: 2022,
      retirementAge: 65,
      extraIncomeMonthly: 0,
      rrspEmployeeType: ContributionType.PERCENTAGE,
      rrspEmployeeValue: 2,
      rrspEmployerRate: 2,
      esppEmployeeRate: 0,
      esppEmployerRate: 0,
      extraContributionMonthly: 0,
      otherSavingsTfsaMonthly: 0,
      otherSavingsRrspMonthly: 0,
      carryForwardRrspRoom: 46117,
      carryForwardTfsaRoom: 25000,
    },
    children: [],
    expenses: [],
    factors: [],
    savingsBase: SavingsBase.GROSS,
    savingsTargetRate: 0.2,
    investmentReturnRate: 0.05,
    inflationRate: 0.02,
    salaryGrowthRate: 0.01,
    desiredRetirementSpendMonthly: 10000,
    mandatoryRetirementSpendMonthly: 7000,
    currentSavings: totalInvestable(DEFAULT_ACCOUNT_BUCKETS),
    accountBuckets: { ...DEFAULT_ACCOUNT_BUCKETS },
    allocationPolicy: AllocationPolicy.TFSA_FIRST,
    annualTfsaLimit: 7000,
    taxConfig: DEFAULT_TAX_CONFIG,
    ccbConfig: DEFAULT_CCB_CONFIG,
    childCostConfig: {
      age0To4Mandatory: 0,
      age0To4Realistic: 0,
      age5To11Mandatory: 0,
      age5To11Realistic: 0,
      age12To17Mandatory: 0,
      age12To17Realistic: 0,
      age18To21Mandatory: 0,
      age18To21Realistic: 0,
    },
    parentalLeaveConfig: { heTopupTargetRate: 0, sheTopupTargetRate: 0 },
    lifeExpectancyDelta: 20,
    depositEsppToRrsp: false,
    optimizeSpousalRrsp: false,
    ...over,
  };
}

const softArgs = {
  softCapacityHe: SoftCapacityLevel.GREEN,
  softCapacityShe: SoftCapacityLevel.GREEN,
  heSalary: 168000,
  sheSalary: 82000,
};

describe('excessMoneyGuide', () => {
  it('resolveExtraContributionMonthly prefers new field, else sums legacy', () => {
    expect(
      resolveExtraContributionMonthly({
        ...basePlan().sheInput,
        extraContributionMonthly: 500,
        otherSavingsTfsaMonthly: 100,
        otherSavingsRrspMonthly: 200,
      })
    ).toBe(500);
    expect(
      resolveExtraContributionMonthly({
        ...basePlan().sheInput,
        extraContributionMonthly: undefined,
        otherSavingsTfsaMonthly: 100,
        otherSavingsRrspMonthly: 200,
      })
    ).toBe(300);
  });

  it('softCapacityLevel thresholds match plan defaults', () => {
    expect(softCapacityLevel(SOFT_CAPACITY_GREEN_HEADROOM)).toBe(SoftCapacityLevel.GREEN);
    expect(softCapacityLevel(0)).toBe(SoftCapacityLevel.AMBER);
    expect(softCapacityLevel(-1)).toBe(SoftCapacityLevel.RED);
  });

  it('preferDiscretionaryRrspOwner: She wins when she earns more at equal soft capacity', () => {
    expect(
      preferDiscretionaryRrspOwner({
        softHe: SoftCapacityLevel.GREEN,
        softShe: SoftCapacityLevel.GREEN,
        heSalary: 90000,
        sheSalary: 180000,
      })
    ).toBe(FamilyMember.SHE);
  });

  it('preferDiscretionaryRrspOwner: better soft capacity beats lower salary', () => {
    expect(
      preferDiscretionaryRrspOwner({
        softHe: SoftCapacityLevel.RED,
        softShe: SoftCapacityLevel.GREEN,
        heSalary: 250000,
        sheSalary: 80000,
      })
    ).toBe(FamilyMember.SHE);
  });

  it('TFSA-full spill to non-reg when both soft capacities are RED', () => {
    const rooms = { tfsaHe: 0, tfsaShe: 0, rrspHe: 100_000, rrspShe: 50_000 };
    const r = deployDiscretionaryWithSoftLimits({
      heExtraAnnual: 12_000,
      sheExtraAnnual: 0,
      heEsppSaleAnnual: 0,
      heRefundRedepositAnnual: 0,
      rooms,
      buckets: { ...DEFAULT_ACCOUNT_BUCKETS },
      ...softArgs,
      softCapacityHe: SoftCapacityLevel.RED,
      softCapacityShe: SoftCapacityLevel.RED,
      optimizeSpousal: false,
    });
    expect(r.heSplit.toRrspOwn).toBe(0);
    expect(r.sheSplit.toRrspOwn).toBe(0);
    expect(r.toNonReg).toBe(12_000);
  });

  it('He ESPP residual uses He personal RRSP, not spouse personal RRSP', () => {
    const rooms = { tfsaHe: 0, tfsaShe: 0, rrspHe: 100_000, rrspShe: 100_000 };
    const r = deployDiscretionaryWithSoftLimits({
      heExtraAnnual: 0,
      sheExtraAnnual: 0,
      heEsppSaleAnnual: 20_000,
      heRefundRedepositAnnual: 0,
      rooms,
      buckets: { ...DEFAULT_ACCOUNT_BUCKETS },
      softCapacityHe: SoftCapacityLevel.GREEN,
      softCapacityShe: SoftCapacityLevel.GREEN,
      heSalary: 80000,
      sheSalary: 200000,
      optimizeSpousal: false,
    });
    expect(r.preferredRrsp).toBe(FamilyMember.SHE);
    expect(r.heSplit.toRrspOwn).toBe(20_000);
    expect(r.sheSplit.toRrspOwn).toBe(0);
  });

  it('She Extra after TFSA: Spousal then Non-reg when He preferred and optimize on', () => {
    const rooms = { tfsaHe: 0, tfsaShe: 0, rrspHe: 5_000, rrspShe: 0 };
    const r = deployDiscretionaryWithSoftLimits({
      heExtraAnnual: 0,
      sheExtraAnnual: 12_000,
      heEsppSaleAnnual: 0,
      heRefundRedepositAnnual: 0,
      rooms,
      buckets: { ...DEFAULT_ACCOUNT_BUCKETS },
      softCapacityHe: SoftCapacityLevel.GREEN,
      softCapacityShe: SoftCapacityLevel.AMBER,
      heSalary: 168000,
      sheSalary: 82000,
      optimizeSpousal: true,
      spousalContributor: FamilyMember.HE,
    });
    // He preferred (better soft) → Spousal first for She Extra
    expect(r.sheSplit.toSpousal).toBe(5_000);
    expect(r.sheSplit.toNonReg + r.sheSplit.toRrspOwn).toBe(7_000);
  });

  it('She Extra fills She TFSA then legally spills into He TFSA', () => {
    const rooms = { tfsaHe: 12_000, tfsaShe: 24_000, rrspHe: 100_000, rrspShe: 100_000 };
    const r = deployDiscretionaryWithSoftLimits({
      heExtraAnnual: 0,
      sheExtraAnnual: 36_000,
      heEsppSaleAnnual: 0,
      heRefundRedepositAnnual: 0,
      rooms,
      buckets: { ...DEFAULT_ACCOUNT_BUCKETS },
      softCapacityHe: SoftCapacityLevel.GREEN,
      softCapacityShe: SoftCapacityLevel.GREEN,
      heSalary: 168000,
      sheSalary: 82000,
      optimizeSpousal: false,
    });
    expect(r.sheSplit.toTfsaShe).toBe(24_000);
    expect(r.sheSplit.toTfsaHe).toBe(12_000);
    expect(r.rooms.tfsaHe).toBe(0);
    expect(r.sheSplit.toTfsa + r.sheSplit.toRrspOwn + r.sheSplit.toNonReg).toBe(36_000);
  });

  it('exhaustion year appears when Extra + ESPP outrun TFSA grants', () => {
    const plan = basePlan({
      heInput: {
        ...basePlan().heInput,
        carryForwardTfsaRoom: 1000,
        esppEmployeeRate: 10,
        esppEmployerRate: 1.5,
        extraContributionMonthly: 500,
      },
      sheInput: {
        ...basePlan().sheInput,
        carryForwardTfsaRoom: 1000,
        extraContributionMonthly: 500,
      },
      annualTfsaLimit: 7000,
      depositEsppToRrsp: false,
    });
    const g = explainExcessMoney(plan, { currentYear: 2026 });
    expect(g.yearsUntilTfsaExhaustion).not.toBeNull();
    expect(g.tfsaExhaustionYear).toBeGreaterThanOrEqual(2026);
    expect(['extra', 'espp', 'refund']).toContain(g.crowdingWinner);
  });

  it('combines Extra and ESPP into one complete MV routing table', () => {
    const plan = basePlan({
      sheInput: {
        ...basePlan().sheInput,
        extraContributionMonthly: 4_000,
      },
      depositEsppToRrsp: false,
    });
    const g = explainExcessMoney(plan, { currentYear: 2026 });
    const routing = g.combinedMvRouting;

    expect(routing.hePoolAnnual).toBeCloseTo(g.esppCashAnnual);
    expect(routing.shePoolAnnual).toBe(48_000);
    expect(routing.totalPoolAnnual).toBeCloseTo(
      routing.hePoolAnnual + routing.shePoolAnnual
    );
    expect(
      routing.toTfsaHe +
        routing.toTfsaShe +
        routing.toRrspHe +
        routing.toRrspShe +
        routing.toSpousal +
        routing.toNonReg
    ).toBeCloseTo(routing.totalPoolAnnual);
  });

  it('recommendation is dynamic and states TFSA ownership + MV ranking', () => {
    const g = explainExcessMoney(
      basePlan({
        heInput: { ...basePlan().heInput, carryForwardTfsaRoom: 12_000, extraContributionMonthly: 0 },
        sheInput: { ...basePlan().sheInput, carryForwardTfsaRoom: 24_000, extraContributionMonthly: 3000 },
        optimizeSpousalRrsp: false,
      }),
      { currentYear: 2026, isFunded: true }
    );
    const rec = g.recommendation.toLowerCase();
    expect(rec).toMatch(/highest-roi|marginal|mv/);
    expect(rec).toMatch(/owner tfsa first/);
    expect(rec).toMatch(/she'?s extra/);
    expect(rec).toMatch(/tax optimization/);
    expect(g.mvShe.top).toBeDefined();
    // Cascade split still tracks room for deploy characterization
    expect(g.sheSplit.toTfsa).toBe(36_000);

    const under = explainExcessMoney(
      basePlan({
        sheInput: { ...basePlan().sheInput, extraContributionMonthly: 500 },
      }),
      { currentYear: 2026, isFunded: false }
    );
    expect(under.recommendation.toLowerCase()).toMatch(/does not yet fund|underfunded/);
    expect(under.recommendation.toLowerCase()).not.toMatch(/tax optimization framing/);
  });
});

describe('target engine Extra / soft limits alignment', () => {
  it('extraContributionMonthly increases nest egg at retirement', () => {
    const none = accumulateToRetirement(basePlan(), 0, 2026, AllocationPolicy.TFSA_FIRST);
    const withExtra = accumulateToRetirement(
      basePlan({
        sheInput: { ...basePlan().sheInput, extraContributionMonthly: 1000 },
      }),
      0,
      2026,
      AllocationPolicy.TFSA_FIRST
    );
    expect(totalInvestable(withExtra)).toBeGreaterThan(totalInvestable(none));
  });

  it('optimizeSpousalRrsp changes nest-egg mix vs She Extra alone', () => {
    const sheExtra = basePlan({
      sheInput: { ...basePlan().sheInput, extraContributionMonthly: 800 },
      optimizeSpousalRrsp: false,
    });
    const withSpousal = {
      ...sheExtra,
      optimizeSpousalRrsp: true,
    };
    const a = accumulateToRetirement(sheExtra, 0, 2026, AllocationPolicy.TFSA_FIRST);
    const b = accumulateToRetirement(withSpousal, 0, 2026, AllocationPolicy.TFSA_FIRST);
    expect(b.rrspHe).toBeGreaterThanOrEqual(a.rrspHe);
  });

  it('depositEsppToRrsp + refund rate change target nest egg vs sale-to-TFSA', () => {
    const sale = calculatePlanTargets(
      basePlan({ depositEsppToRrsp: false, esppRefundSaveRate: 0 }),
      2026,
      false
    );
    const toggle = calculatePlanTargets(
      basePlan({ depositEsppToRrsp: true, esppRefundSaveRate: 0.5 }),
      2026,
      false
    );
    expect(toggle.bucketsAtRetirement).toBeDefined();
    expect(sale.bucketsAtRetirement).toBeDefined();
    const saleMix = sale.bucketsAtRetirement!.rrspHe + sale.bucketsAtRetirement!.tfsaHe;
    const togMix = toggle.bucketsAtRetirement!.rrspHe + toggle.bucketsAtRetirement!.tfsaHe;
    expect(
      Math.abs(saleMix - togMix) > 1 ||
        Math.abs(sale.nestEggAtRetirement - toggle.nestEggAtRetirement) > 1
    ).toBe(true);
  });

  it('checkbox OFF + TFSA full: advisor estimates refund when ESPP lands in RRSP', () => {
    const plan = basePlan({
      depositEsppToRrsp: false,
      esppRefundSaveRate: 0.5,
      heInput: {
        ...basePlan().heInput,
        carryForwardTfsaRoom: 0,
        esppEmployeeRate: 10,
        esppEmployerRate: 1.5,
        extraContributionMonthly: 0,
      },
      sheInput: {
        ...basePlan().sheInput,
        carryForwardTfsaRoom: 0,
        extraContributionMonthly: 0,
      },
    });
    const g = explainExcessMoney(plan, { currentYear: 2026 });
    const rrspLanded =
      g.combinedMvRouting.toRrspHe +
      g.combinedMvRouting.toRrspShe +
      g.combinedMvRouting.toSpousal;
    expect(rrspLanded).toBeGreaterThan(0);
    expect(g.estimatedRefundRedepositAnnual).toBeGreaterThan(0);
  });
});
