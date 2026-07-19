import { describe, it, expect } from 'vitest';
import {
  AllocationPolicy,
  ContributionType,
  SavingsBase,
  type ProjectionYear,
  type RetirementPlan,
} from '../types/calculator';
import { DEFAULT_ACCOUNT_BUCKETS, totalInvestable } from '../utils/accountBuckets';
import { DEFAULT_CCB_CONFIG, DEFAULT_TAX_CONFIG } from '../utils/taxCalc';
import { resolveRetirementHorizon } from '../utils/retirementHorizon';
import {
  analyzeRetirementShortfall,
  binarySearchMonthlyExtra,
  maxJointYearsEarlier,
  planWithJointYearsEarlier,
  RETIREMENT_SHORTFALL_EPS,
  solveEarliestJointRetirement,
} from '../utils/retirementShortfall';

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

// Minimal ProjectionYear factory — only the fields the analyzer reads matter.
const row = (
  ageHe: number,
  isRetired: boolean,
  expenses: number,
  netIncome: number
): ProjectionYear =>
  ({
    ageHe,
    isRetired,
    expenses,
    netIncome,
  }) as unknown as ProjectionYear;

describe('binarySearchMonthlyExtra', () => {
  it('returns 0 when already ok at $0', () => {
    expect(binarySearchMonthlyExtra(() => true)).toEqual({ monthly: 0, reached: true });
  });

  it('finds the threshold of a step predicate', () => {
    const r = binarySearchMonthlyExtra(m => m >= 146.5, { startHigh: 500 });
    expect(r.reached).toBe(true);
    expect(r.monthly).toBeGreaterThanOrEqual(146.5);
    expect(r.monthly).toBeLessThan(147);
  });

  it('reports unreachable when expand max fails', () => {
    const r = binarySearchMonthlyExtra(() => false, { expandMax: 1_000, startHigh: 100 });
    expect(r.reached).toBe(false);
    expect(r.monthly).toBe(1_000);
  });
});

describe('analyzeRetirementShortfall', () => {
  it('reports fully funded when every retired year is covered', () => {
    const proj = [
      row(64, false, 0, 0),
      row(65, true, 100000, 100000),
      row(66, true, 102000, 102000),
    ];
    const r = analyzeRetirementShortfall(proj);
    expect(r.lastsFullHorizon).toBe(true);
    expect(r.firstShortfallAge).toBeNull();
    expect(r.worstShortfallAge).toBeNull();
    expect(r.worstAnnualGap).toBe(0);
  });

  it('flags a gap in the FINAL horizon year (boundary case)', () => {
    // Funded through 84, gap only at the last year (85). This is the case that
    // previously showed "Lasts to 85+" and "Shortfall at 85" simultaneously.
    const proj = [
      row(83, true, 300000, 300000),
      row(84, true, 305000, 305000),
      row(85, true, 310000, 165724), // ~$12,023/mo gap
    ];
    const r = analyzeRetirementShortfall(proj);
    expect(r.lastsFullHorizon).toBe(false);
    expect(r.firstShortfallAge).toBe(85);
    expect(r.worstShortfallAge).toBe(85);
    expect(Math.round(r.worstAnnualGap / 12)).toBe(12023);
  });

  it('separates first vs worst shortfall age when the gap widens', () => {
    const proj = [
      row(83, true, 300000, 300000),
      row(84, true, 305000, 200000), // gap 105k
      row(85, true, 310000, 57000), // gap 253k (worst)
    ];
    const r = analyzeRetirementShortfall(proj);
    expect(r.firstShortfallAge).toBe(84);
    expect(r.worstShortfallAge).toBe(85);
  });

  it('treats sub-eps float noise as fully funded', () => {
    const proj = [
      row(65, true, 100000, 100000 - (RETIREMENT_SHORTFALL_EPS - 1)),
    ];
    expect(analyzeRetirementShortfall(proj).lastsFullHorizon).toBe(true);
  });

  it('ignores pre-retirement years', () => {
    const proj = [
      row(40, false, 999999, 0), // huge working-year "gap" must not count
      row(65, true, 100000, 100000),
    ];
    expect(analyzeRetirementShortfall(proj).lastsFullHorizon).toBe(true);
  });
});

describe('solveEarliestJointRetirement', () => {
  it('planWithJointYearsEarlier preserves age gap and holds terminal', () => {
    const plan = basePlan({
      heInput: { ...basePlan().heInput, retirementAge: 65 },
      sheInput: { ...basePlan().sheInput, retirementAge: 63 },
    });
    const terminal = resolveRetirementHorizon(plan).terminalAgeHe; // 85
    const trial = planWithJointYearsEarlier(plan, 4, terminal);
    expect(trial.heInput.retirementAge).toBe(61);
    expect(trial.sheInput.retirementAge).toBe(59);
    expect(trial.heInput.retirementAge - trial.sheInput.retirementAge).toBe(2);
    expect(resolveRetirementHorizon(trial).terminalAgeHe).toBe(terminal);
    expect(trial.lifeExpectancyDelta).toBe(terminal - 61);
  });

  it('maxJointYearsEarlier is limited by the tighter spouse', () => {
    const plan = basePlan({
      heInput: { ...basePlan().heInput, age: 36, retirementAge: 65 },
      sheInput: { ...basePlan().sheInput, age: 55, retirementAge: 65 },
    });
    // She: 65 - 56 = 9; He: 65 - 37 = 28 → min = 9
    expect(maxJointYearsEarlier(plan)).toBe(9);
  });

  it('funded surplus fixture can retire earlier jointly', () => {
    const plan = basePlan();
    const enteredTerminal = resolveRetirementHorizon(plan).terminalAgeHe;
    const r = solveEarliestJointRetirement(plan, 2026, false);
    expect(r.lastsAtEntered).toBe(true);
    expect(r.yearsEarlier).toBeGreaterThan(0);
    expect(r.heRetireAge).toBe(plan.heInput.retirementAge - r.yearsEarlier);
    expect(r.sheRetireAge).toBe(plan.sheInput.retirementAge - r.yearsEarlier);
    expect(r.terminalAgeHe).toBe(enteredTerminal);
    // Probe at reported earliest still lasts; one year earlier (if room) does not.
    const atEarliest = planWithJointYearsEarlier(plan, r.yearsEarlier, enteredTerminal);
    expect(resolveRetirementHorizon(atEarliest).terminalAgeHe).toBe(enteredTerminal);
  });

  it('underfunded path reports yearsEarlier 0 / not lasting', () => {
    const plan = basePlan({
      desiredRetirementSpendMonthly: 50000,
      accountBuckets: {
        tfsaHe: 10000,
        tfsaShe: 5000,
        rrspHe: 20000,
        rrspShe: 10000,
        nonReg: 0,
        cashExcluded: 0,
      },
      currentSavings: 45000,
    });
    const r = solveEarliestJointRetirement(plan, 2026, false);
    expect(r.lastsAtEntered).toBe(false);
    expect(r.yearsEarlier).toBe(0);
    expect(r.heRetireAge).toBe(plan.heInput.retirementAge);
    expect(r.sheRetireAge).toBe(plan.sheInput.retirementAge);
  });

  it('mandatory (lower) spend allows earlier or equal stop vs realistic', () => {
    const plan = basePlan();
    const realistic = solveEarliestJointRetirement(plan, 2026, false);
    const mandatory = solveEarliestJointRetirement(plan, 2026, true);
    expect(mandatory.lastsAtEntered).toBe(true);
    expect(mandatory.yearsEarlier).toBeGreaterThanOrEqual(realistic.yearsEarlier);
  });
});
