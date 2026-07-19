import { describe, it, expect } from 'vitest';
import { explainEsppAllocation } from '../utils/esppAllocationGuide';
import { explainExcessMoney } from '../utils/excessMoneyGuide';
import { AllocationPolicy, ContributionType, FamilyMember, SavingsBase, type RetirementPlan } from '../types/calculator';
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
  it('locked cascade: He TFSA → She TFSA → preferred RRSP when room exists', () => {
    const g = explainEsppAllocation(basePlan());
    expect(g.esppCashAnnual).toBeCloseTo(168000 * 0.115, 0);
    expect(g.lockedCascade.toTfsaHe).toBeGreaterThan(0);
    expect(g.lockedCascade.toTfsaShe).toBeGreaterThan(0);
    expect(
      g.lockedCascade.toTfsaHe +
        g.lockedCascade.toTfsaShe +
        g.lockedCascade.toRrspHe +
        g.lockedCascade.toRrspShe +
        g.lockedCascade.toNonReg
    ).toBeCloseTo(g.esppCashAnnual, 0);
  });

  it('with zero TFSA room, ESPP sale goes to preferred RRSP then non-reg', () => {
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
    expect(g.lockedCascade.toTfsa).toBe(0);
    expect(g.lockedCascade.toRrspHe + g.lockedCascade.toRrspShe).toBeGreaterThan(0);
    expect(
      g.lockedCascade.toRrspHe + g.lockedCascade.toRrspShe + g.lockedCascade.toNonReg
    ).toBeCloseTo(g.esppCashAnnual, 0);
  });

  it('when She earns more, locked cascade prefers She RRSP after TFSA', () => {
    const g = explainEsppAllocation(
      basePlan({
        heInput: {
          ...basePlan().heInput,
          salary: 70000,
          carryForwardTfsaRoom: 0,
          carryForwardRrspRoom: 50_000,
        },
        sheInput: {
          ...basePlan().sheInput,
          salary: 200000,
          carryForwardTfsaRoom: 0,
          carryForwardRrspRoom: 50_000,
        },
        accountBuckets: { ...DEFAULT_ACCOUNT_BUCKETS, rrspHe: 50_000, rrspShe: 20_000 },
      })
    );
    expect(g.preferredRrsp).toBe(FamilyMember.SHE);
    expect(g.lockedCascade.toRrspShe).toBeGreaterThan(0);
    expect(g.lockedCascade.toRrspShe).toBeGreaterThanOrEqual(g.lockedCascade.toRrspHe);
  });

  it('She Extra fills own TFSA then spills into He TFSA', () => {
    const openingHe = 12000;
    const openingShe = 24000;
    const sheExtraMo = 3000; // 36k/yr
    const g = explainEsppAllocation(
      basePlan({
        heInput: {
          ...basePlan().heInput,
          carryForwardTfsaRoom: openingHe,
          extraContributionMonthly: 0,
        },
        sheInput: {
          ...basePlan().sheInput,
          carryForwardTfsaRoom: openingShe,
          extraContributionMonthly: sheExtraMo,
        },
      })
    );
    expect(g.extraAteTfsa).toBe(openingShe + openingHe);
    expect(g.roomsAfterExtra.tfsaHe).toBe(0);
    expect(g.roomsAfterExtra.tfsaShe).toBe(0);
    expect(g.lockedCascade.toTfsaHe).toBe(0);
  });

  it('She Extra $36k uses both spouses TFSA rooms symmetrically', () => {
    const g = explainExcessMoney(
      basePlan({
        heInput: { ...basePlan().heInput, carryForwardTfsaRoom: 12000, extraContributionMonthly: 0 },
        sheInput: { ...basePlan().sheInput, carryForwardTfsaRoom: 24000, extraContributionMonthly: 3000 },
      }),
      { currentYear: 2026 }
    );
    expect(g.sheSplit.toTfsaShe).toBe(24000);
    expect(g.sheSplit.toTfsaHe).toBe(12000);
    expect(g.sheSplit.toTfsa).toBe(36000);
    expect(g.sheSplit.toTfsa + g.sheSplit.toRrspOwn + g.sheSplit.toSpousal + g.sheSplit.toNonReg).toBe(
      36000
    );
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
