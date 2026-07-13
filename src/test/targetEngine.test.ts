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

  it('NEAR (funded, thin terminal) still reports surplus burn-down headroom', () => {
    // High spend → funded but terminal in NEAR band; surplus must not disappear.
    const result = calculatePlanTargets(
      { ...basePlan(), desiredRetirementSpendMonthly: 12000 },
      2026,
      false
    );
    expect(result.regime).toBe(FundingRegime.NEAR);
    expect(result.surplusSpend).toBeDefined();
    expect(result.surplusSpend!.kind).toBe('surplus');
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
    // Tiny nest egg + high spend → conversion grid stays UNDER (solve cannot invent wealth).
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
    expect(result.regime).toBe(FundingRegime.UNDER);
    expect(result.surplusSpend).toBeDefined();
    expect(result.surplusSpend!.kind).toBe('affordable');
    expect(result.surplusSpend!.totalMonthlyToday).toBeGreaterThan(0);
    expect(result.surplusSpend!.totalMonthlyToday).toBeLessThan(20000);
  });
});
