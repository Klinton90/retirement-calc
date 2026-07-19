import { describe, it, expect } from 'vitest';
import { calculatePlanTargets, accumulateToRetirement, simulateDecumulation } from '../utils/targetEngine';
import {
  AllocationPolicy,
  ContributionType,
  FundingRegime,
  SavingsBase,
  type RetirementPlan,
} from '../types/calculator';
import { DEFAULT_TAX_CONFIG, DEFAULT_CCB_CONFIG } from '../utils/taxCalc';
import { DEFAULT_ACCOUNT_BUCKETS, totalInvestable } from '../utils/accountBuckets';

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
    ...over,
  };
}

describe('targetEngine', () => {
  it('accumulates with TFSA-first and keeps employer match path', () => {
    const plan = basePlan();
    const b0 = accumulateToRetirement(plan, 0, 2026, AllocationPolicy.TFSA_FIRST);
    expect(totalInvestable(b0)).toBeGreaterThan(totalInvestable(DEFAULT_ACCOUNT_BUCKETS));
  });

  it('extraContributionMonthly increases nest egg at retirement (target engine)', () => {
    const base = calculatePlanTargets(basePlan(), 2026, false);
    const withExtra = calculatePlanTargets(
      {
        ...basePlan(),
        sheInput: { ...basePlan().sheInput, extraContributionMonthly: 1000 },
      },
      2026,
      false
    );
    expect(withExtra.nestEggAtRetirement).toBeGreaterThan(base.nestEggAtRetirement + 100_000);
    // She Extra after TFSA → Non-reg (or Spousal on He), not She's own RRSP
    expect(
      withExtra.bucketsAtRetirement.nonReg + withExtra.bucketsAtRetirement.tfsaShe + withExtra.bucketsAtRetirement.rrspHe
    ).toBeGreaterThan(
      base.bucketsAtRetirement.nonReg + base.bucketsAtRetirement.tfsaShe + base.bucketsAtRetirement.rrspHe
    );
  });

  it('decumulation honors RRIF mins after conversion age', () => {
    const plan = basePlan();
    const atRetire = accumulateToRetirement(plan, 2000, 2026, AllocationPolicy.TFSA_FIRST);
    const early = simulateDecumulation(plan, atRetire, 2026, 65, 65, false);
    const late = simulateDecumulation(plan, atRetire, 2026, 71, 71, false);
    expect(early.curve[0].rrifHe + early.curve[0].rrifShe).toBeGreaterThan(0);
    // At age 65 with convert@71, first year RRIF draw may be 0 (still RRSP)
    expect(late.conversionAgeHe).toBe(71);
    expect(early.yearsFunded).toBeGreaterThan(0);
  });

  it('calculatePlanTargets returns nest egg, min savings, and conversion recommendation', () => {
    const result = calculatePlanTargets(basePlan(), 2026, false);
    expect(result.nestEggAtRetirement).toBeGreaterThan(0);
    expect(result.monthlyPersonalSavingsNeeded).toBeGreaterThanOrEqual(0);
    expect(result.recommendedConversion.conversionAgeHe).toBeGreaterThanOrEqual(65);
    expect(result.recommendedConversion.conversionAgeHe).toBeLessThanOrEqual(71);
    expect(result.portfolioCurve.length).toBeGreaterThan(1);
    expect(result.solveConversionAgeHe).toBe(71);
  });

  it('ABOVE regime includes surplus spend burn-down toward ~$0 at horizon', () => {
    const result = calculatePlanTargets(basePlan(), 2026, false);
    expect(result.regime).toBe(FundingRegime.ABOVE);
    expect(result.surplusSpend).toBeDefined();
    expect(result.surplusSpend!.extraMonthlyToday).toBeGreaterThan(100);
    const last = result.surplusSpend!.depletePortfolioCurve.at(-1)!;
    const baseLast = result.portfolioCurve.at(-1)!;
    expect(last).toBeLessThan(baseLast * 0.35);
    expect(result.surplusSpend!.annualExtraCurve[0]).toBeGreaterThan(0);
  });

  it('always reports required nest egg for target spend → ~$0 (≤ projected when funded)', () => {
    const result = calculatePlanTargets(basePlan(), 2026, false);
    expect(result.requiredNestEggToZero).toBeGreaterThan(0);
    expect(result.requiredNestEggToZeroCurve.length).toBe(result.portfolioCurve.length);
    expect(result.requiredNestEggToZero).toBeLessThanOrEqual(result.nestEggAtRetirement + 1);
    // Funded ABOVE: true min-to-zero should be meaningfully below projected path
    expect(result.requiredNestEggToZero).toBeLessThan(result.nestEggAtRetirement * 0.95);
    const end = result.requiredNestEggToZeroCurve.at(-1)!;
    expect(end).toBeLessThan(result.requiredNestEggToZero * 0.15);
  });

  it('nest-egg → $0 band: all-TFSA ≤ your-mix ≤ all-RRSP', () => {
    const result = calculatePlanTargets(basePlan(), 2026, false);
    const b = result.nestEggToZeroBand;
    expect(b.allTfsa).toBeGreaterThan(0);
    expect(b.allRrsp).toBeGreaterThan(0);
    expect(b.yourMix).toBeCloseTo(result.requiredNestEggToZero, 0);
    // Tax-free wrapper needs less face value than taxable RRSP
    expect(b.allTfsa).toBeLessThan(b.allRrsp * 0.95);
    // Mixed path sits in the band (allow tiny binary-search noise)
    expect(b.yourMix).toBeGreaterThanOrEqual(b.allTfsa - 1);
    expect(b.yourMix).toBeLessThanOrEqual(b.allRrsp + 1);
  });

  it('exposes bucket curves that sum to the portfolio curve', () => {
    const result = calculatePlanTargets(basePlan(), 2026, false);
    expect(result.bucketCurves.tfsa.length).toBe(result.portfolioCurve.length);
    for (let i = 0; i < result.portfolioCurve.length; i++) {
      const sum =
        result.bucketCurves.tfsa[i] +
        result.bucketCurves.rrsp[i] +
        result.bucketCurves.nonReg[i];
      expect(sum).toBeCloseTo(result.portfolioCurve[i], 0);
    }
    const b = result.bucketsAtRetirement;
    expect(b.tfsaHe + b.tfsaShe + b.rrspHe + b.rrspShe + b.nonReg).toBeCloseTo(
      result.nestEggAtRetirement,
      0
    );
  });

  it('NEAR (funded, thin terminal) still reports surplus burn-down headroom', () => {
    // High spend → funded but terminal in NEAR band; surplus must not disappear.
    // Keep salary growth at prior CPI-linked pace so this case stays funded/NEAR.
    // Zero refund reinvest so the band stays NEAR (refund path thickens the nest egg).
    const result = calculatePlanTargets(
      {
        ...basePlan(),
        desiredRetirementSpendMonthly: 12000,
        salaryGrowthRate: 0.02,
        esppRefundSaveRate: 0,
      },
      2026,
      false
    );
    expect(result.regime).toBe(FundingRegime.NEAR);
    expect(result.surplusSpend).toBeDefined();
    expect(result.surplusSpend!.kind).toBe('surplus');
  });

  it('projected nest egg is always current path (not capped to the funding solve)', () => {
    const rich = basePlan();
    const thin = {
      tfsaHe: 40000,
      tfsaShe: 10000,
      rrspHe: 60000,
      rrspShe: 20000,
      nonReg: 0,
      cashExcluded: 0,
    };
    const result = calculatePlanTargets(
      {
        ...rich,
        desiredRetirementSpendMonthly: 14000,
        accountBuckets: thin,
        currentSavings: totalInvestable(thin),
        heInput: {
          ...rich.heInput,
          age: 55,
          retirementAge: 65,
          esppEmployeeRate: 0,
          esppEmployerRate: 0,
          rrspEmployeeValue: 0,
          rrspEmployerRate: 0,
        },
        sheInput: {
          ...rich.sheInput,
          age: 55,
          retirementAge: 65,
          rrspEmployeeValue: 0,
          rrspEmployerRate: 0,
        },
      },
      2026,
      false
    );
    expect(result.isFundedWithoutExtra).toBe(false);
    expect(result.projectedNestEggAtRetirement).toBeLessThan(result.nestEggAtRetirement);
    expect(result.shortfallFromCurrentPath).toBeCloseTo(
      result.nestEggAtRetirement - result.projectedNestEggAtRetirement,
      0
    );
    const pb = result.projectedBucketsAtRetirement;
    expect(pb.tfsaHe + pb.tfsaShe + pb.rrspHe + pb.rrspShe + pb.nonReg).toBeCloseTo(
      result.projectedNestEggAtRetirement,
      0
    );
  });

  it('below target: required path is nest egg at target spend (not a lower affordable spend)', () => {
    const rich = basePlan();
    // Force shortfall: high spend, little starting capital, near retirement
    const thin = {
      tfsaHe: 40000,
      tfsaShe: 10000,
      rrspHe: 60000,
      rrspShe: 20000,
      nonReg: 0,
      cashExcluded: 0,
    };
    const result = calculatePlanTargets(
      {
        ...rich,
        desiredRetirementSpendMonthly: 14000,
        accountBuckets: thin,
        currentSavings: totalInvestable(thin),
        heInput: { ...rich.heInput, age: 55, retirementAge: 65, esppEmployeeRate: 0, esppEmployerRate: 0, rrspEmployeeValue: 0, rrspEmployerRate: 0 },
        sheInput: { ...rich.sheInput, age: 55, retirementAge: 65, rrspEmployeeValue: 0, rrspEmployerRate: 0 },
      },
      2026,
      false
    );
    expect(result.isFundedWithoutExtra).toBe(false);
    expect(result.surplusSpend?.kind).toBe('required');
    expect(result.currentPathPortfolioCurve).toBeDefined();
    expect(result.currentPathPortfolioCurve!.length).toBe(result.portfolioCurve.length);
    // Required path starts higher (solved nest egg) than current path
    expect(result.surplusSpend!.depletePortfolioCurve[0]).toBeGreaterThan(
      result.currentPathPortfolioCurve![0] + 1000
    );
    // Same target spend on both — required path lasts; current dies earlier or ends lower
    const reqLast = result.surplusSpend!.depletePortfolioCurve.at(-1)!;
    const curLast = result.currentPathPortfolioCurve!.at(-1)!;
    expect(reqLast).toBeGreaterThanOrEqual(0);
    expect(curLast).toBeLessThanOrEqual(reqLast + 1);
  });

  it('UNDER still returns affordable → $0 path for chart comparison', () => {
    // Already at retirement + thin nest egg: Extra $/mo cannot invent wealth, so
    // conversion stays UNDER and we still emit an affordable → $0 spend path.
    const thin = {
      tfsaHe: 50000,
      tfsaShe: 20000,
      rrspHe: 80000,
      rrspShe: 30000,
      nonReg: 0,
      cashExcluded: 0,
    };
    const result = calculatePlanTargets(
      {
        ...basePlan(),
        desiredRetirementSpendMonthly: 20000,
        accountBuckets: thin,
        currentSavings: totalInvestable(thin),
        heInput: {
          ...basePlan().heInput,
          age: 65,
          retirementAge: 65,
          esppEmployeeRate: 0,
          esppEmployerRate: 0,
          rrspEmployeeValue: 0,
          rrspEmployerRate: 0,
        },
        sheInput: {
          ...basePlan().sheInput,
          age: 65,
          retirementAge: 65,
          rrspEmployeeValue: 0,
          rrspEmployerRate: 0,
        },
      },
      2026,
      false
    );
    expect(result.regime).toBe(FundingRegime.UNDER);
    expect(result.surplusSpend).toBeDefined();
    expect(result.surplusSpend!.kind).toBe('affordable');
    expect(result.surplusSpend!.totalMonthlyToday).toBeGreaterThan(0);
    expect(result.surplusSpend!.totalMonthlyToday).toBeLessThan(20000);
  });

  it('Extra $/mo solve is not capped at $50k when more is needed', () => {
    // Near retirement, thin balances, high spend — needs well above the old $50k ceiling.
    const thin = {
      tfsaHe: 10000,
      tfsaShe: 5000,
      rrspHe: 20000,
      rrspShe: 10000,
      nonReg: 0,
      cashExcluded: 0,
    };
    const result = calculatePlanTargets(
      {
        ...basePlan(),
        desiredRetirementSpendMonthly: 25000,
        accountBuckets: thin,
        currentSavings: totalInvestable(thin),
        heInput: {
          ...basePlan().heInput,
          age: 64,
          retirementAge: 65,
          esppEmployeeRate: 0,
          esppEmployerRate: 0,
          rrspEmployeeValue: 0,
          rrspEmployerRate: 0,
        },
        sheInput: {
          ...basePlan().sheInput,
          age: 64,
          retirementAge: 65,
          rrspEmployeeValue: 0,
          rrspEmployerRate: 0,
        },
      },
      2026,
      false
    );
    expect(result.isFundedWithoutExtra).toBe(false);
    expect(result.fundingSolveReached).toBe(true);
    expect(result.monthlyPersonalSavingsNeeded).toBeGreaterThan(50000);
    expect(result.surplusSpend?.kind).toBe('required');
    expect(result.surplusSpend?.extraMonthlyToday).toBe(
      result.monthlyPersonalSavingsNeeded
    );
  });

  it('solves monthly Extra from the cash-aware current path', () => {
    const plan = basePlan({ desiredRetirementSpendMonthly: 10000 });
    const result = calculatePlanTargets(plan, 2026, false, {
      accumulate: (p, monthly, year) => {
        const full = accumulateToRetirement(p, monthly, year, AllocationPolicy.TFSA_FIRST);
        // Simulate leave/cash cuts: live path keeps ~55% of idealized wealth.
        const f = 0.55;
        return {
          tfsaHe: full.tfsaHe * f,
          tfsaShe: full.tfsaShe * f,
          rrspHe: full.rrspHe * f,
          rrspShe: full.rrspShe * f,
          nonReg: full.nonReg * f,
          cashExcluded: full.cashExcluded,
        };
      },
    });
    expect(result.isFundedWithoutExtra).toBe(false);
    expect(result.fundingSolveReached).toBe(true);
    expect(result.monthlyPersonalSavingsNeeded).toBeGreaterThan(0);
    expect(result.projectedNestEggAtRetirement).toBeLessThan(
      result.nestEggToZeroBand.yourMix
    );
  });

  it('does not flip to unreachable when Extra search finds a fundable bound', () => {
    // Near-retire thin nest egg: Extra is modest but the [low, high] midpoint often
    // still fails — UI must keep the known-good high, not "> $X could not fund".
    const thin = {
      tfsaHe: 80000,
      tfsaShe: 40000,
      rrspHe: 120000,
      rrspShe: 60000,
      nonReg: 0,
      cashExcluded: 0,
    };
    const result = calculatePlanTargets(
      {
        ...basePlan(),
        desiredRetirementSpendMonthly: 10000,
        accountBuckets: thin,
        currentSavings: totalInvestable(thin),
        heInput: {
          ...basePlan().heInput,
          age: 60,
          retirementAge: 65,
          esppEmployeeRate: 0,
          esppEmployerRate: 0,
          rrspEmployeeValue: 0,
          rrspEmployerRate: 0,
        },
        sheInput: {
          ...basePlan().sheInput,
          age: 60,
          retirementAge: 65,
          startYearInCanada: 2020,
          cppStartYear: 2020,
          rrspEmployeeValue: 0,
          rrspEmployerRate: 0,
        },
      },
      2026,
      false
    );
    expect(result.isFundedWithoutExtra).toBe(false);
    expect(result.fundingSolveReached).toBe(true);
    expect(result.monthlyPersonalSavingsNeeded).toBeGreaterThan(0);
    expect(result.monthlyPersonalSavingsNeeded).toBeLessThan(100_000);
  });
});
