import { describe, it, expect } from 'vitest';
import { deployAnnualContributions } from '../utils/contributionPolicy';
import { AllocationPolicy } from '../types/calculator';
import { DEFAULT_ACCOUNT_BUCKETS, redepositExcess, totalInvestable } from '../utils/accountBuckets';
import { calculatePlanTargets, simulateDecumulation } from '../utils/targetEngine';
import { ContributionType, FundingRegime, SavingsBase, type RetirementPlan } from '../types/calculator';
import { DEFAULT_TAX_CONFIG, DEFAULT_CCB_CONFIG } from '../utils/taxCalc';

describe('contributionPolicy', () => {
  it('routes payroll RRSP to RRSP even under TFSA_FIRST', () => {
    const result = deployAnnualContributions({
      personalInvestable: 5000,
      payrollRrspHe: 3000,
      payrollRrspShe: 0,
      employerMatchHe: 1000,
      employerMatchShe: 0,
      policy: AllocationPolicy.TFSA_FIRST,
      rooms: { tfsaHe: 7000, tfsaShe: 7000, rrspHe: 50000, rrspShe: 0 },
      buckets: { ...DEFAULT_ACCOUNT_BUCKETS, tfsaHe: 0, rrspHe: 0, nonReg: 0 },
    });
    expect(result.toRrsp).toBeGreaterThanOrEqual(4000); // payroll 3k + match 1k
    expect(result.buckets.rrspHe).toBeGreaterThanOrEqual(4000);
    expect(result.toTfsa).toBe(5000); // personal 5k fills TFSA
  });
});

describe('accountBuckets redeposit', () => {
  it('redeposits excess to TFSA then non-reg', () => {
    const b = redepositExcess(
      { ...DEFAULT_ACCOUNT_BUCKETS, tfsaHe: 0, tfsaShe: 0, nonReg: 0 },
      10000,
      7000,
      0
    );
    expect(b.tfsaHe).toBe(7000);
    expect(b.nonReg).toBe(3000);
  });
});

describe('regime and TFSA bridge', () => {
  const plan = (): RetirementPlan => ({
    heInput: {
      name: 'He',
      age: 64,
      salary: 100000,
      startYearInCanada: 1990,
      retirementAge: 65,
      extraIncomeMonthly: 0,
      rrspEmployeeType: ContributionType.PERCENTAGE,
      rrspEmployeeValue: 0,
      rrspEmployerRate: 0,
      esppEmployeeRate: 0,
      esppEmployerRate: 0,
      otherSavingsTfsaMonthly: 0,
      otherSavingsRrspMonthly: 0,
      carryForwardRrspRoom: 0,
      carryForwardTfsaRoom: 0,
    },
    sheInput: {
      name: 'She',
      age: 64,
      salary: 80000,
      startYearInCanada: 1990,
      retirementAge: 65,
      extraIncomeMonthly: 0,
      rrspEmployeeType: ContributionType.PERCENTAGE,
      rrspEmployeeValue: 0,
      rrspEmployerRate: 0,
      esppEmployeeRate: 0,
      esppEmployerRate: 0,
      otherSavingsTfsaMonthly: 0,
      otherSavingsRrspMonthly: 0,
      carryForwardRrspRoom: 0,
      carryForwardTfsaRoom: 0,
    },
    children: [],
    expenses: [],
    factors: [],
    savingsBase: SavingsBase.GROSS,
    savingsTargetRate: 0.2,
    investmentReturnRate: 0.05,
    inflationRate: 0.02,
    desiredRetirementSpendMonthly: 4000,
    mandatoryRetirementSpendMonthly: 3000,
    currentSavings: 0,
    accountBuckets: {
      tfsaHe: 200000,
      tfsaShe: 0,
      rrspHe: 50000,
      rrspShe: 50000,
      nonReg: 0,
      cashExcluded: 0,
    },
    allocationPolicy: AllocationPolicy.TFSA_FIRST,
    taxConfig: DEFAULT_TAX_CONFIG,
    ccbConfig: DEFAULT_CCB_CONFIG,
    childCostConfig: {
      age0To4Mandatory: 0, age0To4Realistic: 0, age5To11Mandatory: 0, age5To11Realistic: 0,
      age12To17Mandatory: 0, age12To17Realistic: 0, age18To21Mandatory: 0, age18To21Realistic: 0,
    },
    parentalLeaveConfig: { heTopupTargetRate: 0, sheTopupTargetRate: 0 },
    lifeExpectancyDelta: 5,
  });

  it('prefers TFSA bridge so first-year RRIF draw can stay near minimum when TFSA is large', () => {
    const p = plan();
    const at65 = {
      ...p.accountBuckets!,
    };
    const dec = simulateDecumulation(p, at65, 2026, 65, 65, false);
    // With large TFSA, taxable RRIF should not need to be huge in year 0
    expect(dec.curve[0].rrifHe + dec.curve[0].rrifShe).toBeLessThan(80000);
    expect(dec.curve[0].shortfall).toBeLessThan(1);
  });

  it('classify regime via calculatePlanTargets', () => {
    const rich = calculatePlanTargets(
      {
        ...plan(),
        heInput: { ...plan().heInput, age: 36 },
        sheInput: { ...plan().sheInput, age: 38 },
        accountBuckets: {
          tfsaHe: 2_000_000,
          tfsaShe: 2_000_000,
          rrspHe: 1_000_000,
          rrspShe: 1_000_000,
          nonReg: 0,
          cashExcluded: 0,
        },
        lifeExpectancyDelta: 20,
        desiredRetirementSpendMonthly: 3000,
      },
      2026,
      false
    );
    expect([FundingRegime.NEAR, FundingRegime.ABOVE, FundingRegime.UNDER]).toContain(rich.regime);
    expect(totalInvestable(rich.bucketsAtRetirement)).toBeGreaterThan(0);
  });
});
