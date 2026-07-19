/**
 * Shared Excess / MV fixtures (Phase 0 characterization + Phase 1 MV tests).
 */
import {
  AllocationPolicy,
  ContributionType,
  SavingsBase,
  type RetirementPlan,
} from '../../types/calculator';
import { DEFAULT_ACCOUNT_BUCKETS, totalInvestable } from '../../utils/accountBuckets';
import { DEFAULT_TAX_CONFIG, DEFAULT_CCB_CONFIG } from '../../utils/taxCalc';

export function basePlan(over: Partial<RetirementPlan> = {}): RetirementPlan {
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

/** Open TFSA room — cascade and MV should both prefer TFSA. */
export function fixtureTfsaRoomOpen(): RetirementPlan {
  return basePlan({
    sheInput: {
      ...basePlan().sheInput,
      carryForwardTfsaRoom: 24_000,
      extraContributionMonthly: 500,
    },
  });
}

/** TFSA full, soft green capacity likely — expect RRSP-ish tops. */
export function fixtureTfsaFullGreen(): RetirementPlan {
  return basePlan({
    heInput: {
      ...basePlan().heInput,
      carryForwardTfsaRoom: 0,
      extraContributionMonthly: 1000,
      esppEmployeeRate: 0,
      esppEmployerRate: 0,
    },
    sheInput: {
      ...basePlan().sheInput,
      carryForwardTfsaRoom: 0,
      extraContributionMonthly: 0,
    },
  });
}

/** She Extra only — fills She TFSA first, then may spill into He TFSA. */
export function fixtureSheExtraOnly(): RetirementPlan {
  return basePlan({
    heInput: {
      ...basePlan().heInput,
      carryForwardTfsaRoom: 12_000,
      extraContributionMonthly: 0,
      esppEmployeeRate: 0,
      esppEmployerRate: 0,
    },
    sheInput: {
      ...basePlan().sheInput,
      carryForwardTfsaRoom: 24_000,
      extraContributionMonthly: 3000,
    },
  });
}

/**
 * Huge RRSP balances → soft RED likely; TFSA full.
 * Cascade skips RRSP on RED → Non-reg; MV should also prefer Non-reg (or agree).
 */
export function fixtureTfsaFullRedRrsp(): RetirementPlan {
  return basePlan({
    accountBuckets: {
      ...DEFAULT_ACCOUNT_BUCKETS,
      rrspHe: 2_500_000,
      rrspShe: 2_500_000,
    },
    heInput: {
      ...basePlan().heInput,
      carryForwardTfsaRoom: 0,
      carryForwardRrspRoom: 200_000,
      extraContributionMonthly: 2000,
      esppEmployeeRate: 0,
      esppEmployerRate: 0,
    },
    sheInput: {
      ...basePlan().sheInput,
      carryForwardTfsaRoom: 0,
      carryForwardRrspRoom: 200_000,
      extraContributionMonthly: 0,
    },
    currentSavings: 5_000_000,
  });
}

/**
 * Borderline / amber candidate for intentional MV≠cascade disagreement:
 * TFSA full, large but not extreme RRSP, Extra high, funded spend low enough to be surplus regime.
 * If both still pick RRSP, test documents agreement instead.
 */
export function fixtureAmberBorderlineFunded(): RetirementPlan {
  return basePlan({
    accountBuckets: {
      ...DEFAULT_ACCOUNT_BUCKETS,
      tfsaHe: 80_000,
      tfsaShe: 80_000,
      rrspHe: 900_000,
      rrspShe: 700_000,
      nonReg: 50_000,
    },
    heInput: {
      ...basePlan().heInput,
      age: 55,
      retirementAge: 65,
      carryForwardTfsaRoom: 0,
      carryForwardRrspRoom: 80_000,
      extraContributionMonthly: 1500,
      esppEmployeeRate: 0,
      esppEmployerRate: 0,
    },
    sheInput: {
      ...basePlan().sheInput,
      age: 55,
      retirementAge: 65,
      carryForwardTfsaRoom: 0,
      carryForwardRrspRoom: 50_000,
      extraContributionMonthly: 0,
    },
    desiredRetirementSpendMonthly: 6000,
    currentSavings: 1_810_000,
  });
}

/**
 * Spousal-RRSP residual-probe fixture (ADR 0003 probe-sizing regression).
 *
 * Mirrors a real user plan where She (secondary) has a large Extra ($4k/mo) but open TFSA
 * room, so only ~$11.3k/yr actually reaches the RRSP tier after TFSA fills. Buckets have a
 * tiny She RRSP and zero non-reg. With the OLD full-pool probe ($48k/yr) the RRSP tier
 * saturates past green headroom and She's own RRSP edges out Spousal; with the residual
 * probe, Spousal (primary's higher-rate deduction) correctly wins.
 */
export function fixtureSpousalResidual(): RetirementPlan {
  return basePlan({
    optimizeSpousalRrsp: true,
    survivorToggle: true,
    survivorSpendFactor: 0.7,
    salaryGrowthRate: 0.02,
    accountBuckets: {
      tfsaHe: 80_573,
      tfsaShe: 13_907,
      rrspHe: 94_654,
      rrspShe: 10_865,
      nonReg: 0,
      cashExcluded: 0,
    },
    heInput: {
      ...basePlan().heInput,
      carryForwardRrspRoom: 158_416,
      carryForwardTfsaRoom: 11_708,
    },
    sheInput: {
      ...basePlan().sheInput,
      rrspEmployeeType: ContributionType.FLAT,
      rrspEmployeeValue: 263.33,
      esppEmployeeRate: 0,
      esppEmployerRate: 0,
      extraContributionMonthly: 4000,
      carryForwardRrspRoom: 46_117,
      carryForwardTfsaRoom: 25_000,
    },
  });
}

/** Underfunded: high spend, empty buckets. */
export function fixtureUnderfundedTfsaRoom(): RetirementPlan {
  return basePlan({
    accountBuckets: { ...DEFAULT_ACCOUNT_BUCKETS },
    heInput: {
      ...basePlan().heInput,
      carryForwardTfsaRoom: 15_000,
      extraContributionMonthly: 200,
      esppEmployeeRate: 0,
      esppEmployerRate: 0,
    },
    sheInput: {
      ...basePlan().sheInput,
      carryForwardTfsaRoom: 15_000,
      extraContributionMonthly: 200,
    },
    desiredRetirementSpendMonthly: 18_000,
    currentSavings: 0,
  });
}
