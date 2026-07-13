import { describe, it, expect } from 'vitest';
import { explainEsppAllocation } from '../utils/esppAllocationGuide';
import { AllocationPolicy, ContributionType, SavingsBase, type RetirementPlan } from '../types/calculator';
import { DEFAULT_TAX_CONFIG, DEFAULT_CCB_CONFIG } from '../utils/taxCalc';
import { DEFAULT_ACCOUNT_BUCKETS, totalInvestable } from '../utils/accountBuckets';
import { calculatePlanTargets } from '../utils/targetEngine';

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

describe('esppAllocationGuide', () => {
  it('splits ESPP sale cash TFSA-first before RRSP when room exists', () => {
    const g = explainEsppAllocation(basePlan());
    expect(g.esppCashAnnual).toBeCloseTo(168000 * 0.115, 0);
    expect(g.underTfsaFirst.toTfsa).toBeGreaterThan(0);
    expect(g.underTfsaFirst.toTfsa + g.underTfsaFirst.toRrsp + g.underTfsaFirst.toNonReg).toBeCloseTo(
      g.esppCashAnnual,
      0
    );
    expect(g.suggestedPolicy).toBe(AllocationPolicy.TFSA_FIRST);
  });

  it('with zero TFSA room, ESPP sale goes to RRSP then non-reg under either policy', () => {
    const g = explainEsppAllocation(
      basePlan({
        heInput: {
          ...basePlan().heInput,
          carryForwardTfsaRoom: 0,
        },
        sheInput: {
          ...basePlan().sheInput,
          carryForwardTfsaRoom: 0,
        },
      })
    );
    expect(g.underTfsaFirst.toTfsa).toBe(0);
    expect(g.underRrspFirst.toTfsa).toBe(0);
    expect(g.underTfsaFirst.toRrsp).toBeGreaterThan(0);
    expect(g.underRrspFirst.toRrsp).toBe(g.underTfsaFirst.toRrsp);
  });
});

describe('conversionRanking', () => {
  it('returns ranked conversion table rows', () => {
    const t = calculatePlanTargets(basePlan(), 2026, false);
    expect(t.conversionRanking.length).toBeGreaterThanOrEqual(3);
    expect(t.conversionRanking[0].conversionAgeHe).toBe(t.recommendedConversion.conversionAgeHe);
    expect(t.conversionRanking[0].conversionAgeShe).toBe(t.recommendedConversion.conversionAgeShe);
  });
});
