import { describe, it, expect } from 'vitest';
import {
  runProjection,
  solveRequiredSavings,
  calculateMinimumNestEgg,
  calculateMinSavingsRequired,
  bucketsAtRetirementFromProjection,
} from '../utils/retirementCalc';
import { calculatePlanTargets } from '../utils/targetEngine';
import {
  type RetirementPlan,
  ContributionType,
  SavingsBase,
  FactorType,
  AllocationPolicy,
  SurvivorWho,
} from '../types/calculator';
import { DEFAULT_TAX_CONFIG, DEFAULT_CCB_CONFIG } from '../utils/taxCalc';

describe('Retirement Projections', () => {
  const defaultPlan: RetirementPlan = {
    heInput: {
      name: 'He',
      age: 36,
      salary: 168000,
      startYearInCanada: 2015,
      cppStartYear: 2015,
      retirementAge: 65,
      extraIncomeMonthly: 0,
      rrspEmployeeType: ContributionType.PERCENTAGE,
      rrspEmployeeValue: 3,
      rrspEmployerRate: 3,
      esppEmployeeRate: 10,
      esppEmployerRate: 1.5,
      otherSavingsTfsaMonthly: 0,
      otherSavingsRrspMonthly: 0,
    },
    sheInput: {
      name: 'She',
      age: 38,
      salary: 82000,
      startYearInCanada: 2022,
      cppStartYear: 2022,
      retirementAge: 65,
      extraIncomeMonthly: 0,
      rrspEmployeeType: ContributionType.FLAT,
      rrspEmployeeValue: 263.33,
      rrspEmployerRate: 2,
      esppEmployeeRate: 0,
      esppEmployerRate: 0,
      otherSavingsTfsaMonthly: 0,
      otherSavingsRrspMonthly: 1000,
    },
    children: [],
    expenses: [
      { id: '1', label: 'Mortgage', amount: 2250, isMandatory: true },
      { id: '2', label: 'Property Tax', amount: 310, isMandatory: true },
      { id: '3', label: 'Food', amount: 1300, isMandatory: true },
    ],
    factors: [],
    savingsBase: SavingsBase.GROSS,
    savingsTargetRate: 0.20,
    investmentReturnRate: 0.05,
    inflationRate: 0.02,
    desiredRetirementSpendMonthly: 5000,
    mandatoryRetirementSpendMonthly: 3500,
    currentSavings: 0,
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
    parentalLeaveConfig: {
      heTopupTargetRate: 0.00,
      sheTopupTargetRate: 0.70,
    },
  };

  it('should run a projection for the full horizon (retirement = lifeExpectancyDelta years)', () => {
    const results = runProjection(defaultPlan, 2026);

    // defaultPlan omits lifeExpectancyDelta → DEFAULT_LIFE_EXPECTANCY_DELTA (20).
    // Ages 36..84 inclusive = 49 rows; retirement years = 20 (65..84). Terminal
    // label age is 85 (not modeled). Must match simulateDecumulation via
    // resolveRetirementHorizon — no phantom extra final year.
    expect(results).toHaveLength(49);
    expect(results[results.length - 1].ageHe).toBe(84);
    const retiredYears = results.filter(r => r.isRetired).length;
    expect(retiredYears).toBe(20);

    // First year should start at 2026
    expect(results[0].year).toBe(2026);
    expect(results[0].ageHe).toBe(36);
    expect(results[0].ageShe).toBe(38);
    expect(results[0].isRetired).toBe(false);
    
    // In retirement (He reaches 65 in 2055)
    // Years to retirement = 65 - 36 = 29. Result index 29 is year 2055.
    const year65 = results[29];
    expect(year65.ageHe).toBe(65);
    expect(year65.isRetired).toBe(true);
    expect(year65.grossIncome).toBeCloseTo(year65.pensionIncome + year65.drawdownGross, 1);
  });

  it('should apply maternity leave factor to She salary', () => {
    const planWithMaternity: RetirementPlan = {
      ...defaultPlan,
      children: [
        {
          id: 'baby',
          age: -1,
          birthAgeHe: 37,
          sheLeaveMonths: 12,
          heLeaveMonths: 2,
        },
      ],
    };

    const results = runProjection(planWithMaternity, 2026);

    // He is 36 in 2026 (index 0) - She salary should be full (baby is age -1)
    // He is 37 in 2027 (index 1) - She salary should be reduced to 70% (top-up target, baby is age 0)
    //                             - He salary should be reduced to 10 months (2 months leave at 0% top-up target)

    const year2026 = results[0];
    const year2027 = results[1];

    // Check She gross income in 2026: salary 82000
    // Check She gross income in 2027: salary 82000 * 1.01 (salary growth) * 0.7 (top-up target) = 57974
    // Let's verify He salary is normal in 2026: 168000
    expect(year2026.grossIncome).toBeCloseTo(168000 + 82000, -2);
    
    // In 2027, He gross is 168000 * 1.01 * 10/12 = 141400. She is 82000 * 1.01 * 0.7 = 57974. Total = 199374
    expect(year2027.grossIncome).toBeCloseTo(141400 + 57974, -2);
  });

  it('grows salary at salaryGrowthRate, not inflationRate', () => {
    const plan: RetirementPlan = {
      ...defaultPlan,
      expenses: [],
      inflationRate: 0.05,
      salaryGrowthRate: 0.01,
      depositEsppToRrsp: false,
      heInput: {
        ...defaultPlan.heInput,
        esppEmployeeRate: 0,
        esppEmployerRate: 0,
        rrspEmployeeValue: 0,
        rrspEmployerRate: 0,
      },
      sheInput: {
        ...defaultPlan.sheInput,
        rrspEmployeeValue: 0,
        rrspEmployerRate: 0,
        otherSavingsRrspMonthly: 0,
      },
    };
    const years = runProjection(plan, 2026);
    const startGross = 168000 + 82000;
    expect(years[0].grossIncome).toBeCloseTo(startGross, 0);
    expect(years[1].grossIncome).toBeCloseTo(startGross * 1.01, 0);
    expect(years[1].grossIncome).toBeLessThan(startGross * 1.04);
  });

  it('should apply black swan portfolio drop', () => {
    const planWithBlackSwan: RetirementPlan = {
      ...defaultPlan,
      factors: [
        {
          id: 'swan',
          type: FactorType.BLACK_SWAN,
          label: 'Market Crash',
          value: 30, // 30% portfolio drop
          startAgeHe: 40, // when He is 40 (year 2030, index 4)
          durationYears: 1,
          isActive: true,
        },
      ],
    };

    const resultsWithoutCrash = runProjection(defaultPlan, 2026);
    const resultsWithCrash = runProjection(planWithBlackSwan, 2026);

    // He is 40 at index 4 (year 2030)
    // Portfolio end in index 4 should be lower in crash scenario
    expect(resultsWithCrash[4].portfolioEnd).toBeLessThan(resultsWithoutCrash[4].portfolioEnd);
  });

  it('should calculate child age dynamically and apply correct costs based on birthAgeHe', () => {
    const planWithChild: RetirementPlan = {
      ...defaultPlan,
      children: [
        {
          id: 'future-child',
          age: 0, // Planned child starts with age 0 today in state
          birthAgeHe: 38, // Planned to be born when He is 38 (year 2028, index 2)
        },
      ],
      childCostConfig: {
        age0To4Mandatory: 500,
        age0To4Realistic: 1000,
        age5To11Mandatory: 0,
        age5To11Realistic: 0,
        age12To17Mandatory: 0,
        age12To17Realistic: 0,
        age18To21Mandatory: 0,
        age18To21Realistic: 0,
      },
    };

    const results = runProjection(planWithChild, 2026);

    // Year 2026 (index 0): He is 36. Child is unborn (age 36 - 38 = -2). Child costs should be 0.
    expect(results[0].childCosts).toBe(0);

    // Year 2027 (index 1): He is 37. Child is unborn (age 37 - 38 = -1). Child costs should be 0.
    expect(results[1].childCosts).toBe(0);

    // Year 2028 (index 2): He is 38. Child is born (age 38 - 38 = 0).
    // Child costs should be: 1000 * 12 * inflationMultiplier.
    // In year 2028 (2 years of inflation at 2%): inflationMultiplier is 1.02^2 = 1.0404.
    expect(results[2].childCosts).toBeCloseTo(12000 * Math.pow(1.02, 2), 1);
  });

  it('cuts voluntary savings then raids portfolio for residual cash shortfall', () => {
    const planWithDeficit: RetirementPlan = {
      ...defaultPlan,
      expenses: [
        { id: '1', label: 'Huge Mortgage', amount: 15000, isMandatory: true },
      ],
      currentSavings: 100000,
    };

    const results = runProjection(planWithDeficit, 2026);

    const year2026 = results[0];
    expect(year2026.unallocatedCash).toBeLessThan(0);
    // Free cash negative → personal contribs cut to 0, residual shortfall raided.
    expect(year2026.shortfallRaided).toBeGreaterThan(0);
    expect(year2026.actualSavings).toBe(0);
    // Grown opening minus raid (no personal contribs land).
    expect(year2026.portfolioEnd).toBeLessThan(100000 * 1.05);
    expect(year2026.investmentGain).toBeCloseTo(100000 * 0.05, 1);
  });

  it('returns apply to opening balance only — not this year’s contributions', () => {
    const plan: RetirementPlan = {
      ...defaultPlan,
      expenses: [],
      investmentReturnRate: 0.05,
      currentSavings: 200000,
      accountBuckets: {
        tfsaHe: 100000,
        tfsaShe: 0,
        rrspHe: 100000,
        rrspShe: 0,
        nonReg: 0,
        cashExcluded: 0,
      },
      depositEsppToRrsp: false,
    };
    const y0 = runProjection(plan, 2026)[0];
    expect(y0.portfolioStart).toBeCloseTo(200000, 0);
    expect(y0.investmentGain).toBeCloseTo(200000 * 0.05, 0);
    // End = grown opening + invested contributions − any shortfall raid
    expect(y0.portfolioEnd).toBeCloseTo(
      y0.portfolioStart +
        y0.investmentGain +
        y0.actualSavings -
        (y0.shortfallRaided ?? 0),
      0
    );
    expect(y0.investmentGain).toBeLessThan(y0.actualSavings); // sanity: gain ≠ ~5% of contrib-heavy pile
  });

  it('should calculate minimum required savings to prevent running out of money', () => {
    const planToSolve: RetirementPlan = {
      ...defaultPlan,
      desiredRetirementSpendMonthly: 15000,
      currentSavings: 0,
      accountBuckets: {
        tfsaHe: 0, tfsaShe: 0, rrspHe: 0, rrspShe: 0, nonReg: 0, cashExcluded: 0,
      },
      heInput: {
        ...defaultPlan.heInput,
        rrspEmployeeValue: 0,
        rrspEmployerRate: 0,
        esppEmployeeRate: 0,
        esppEmployerRate: 0,
      },
      sheInput: {
        ...defaultPlan.sheInput,
        rrspEmployeeValue: 0,
        rrspEmployerRate: 0,
        otherSavingsRrspMonthly: 0,
      },
      lifeExpectancyDelta: 20,
    };

    const solved = solveRequiredSavings(planToSolve, false);
    expect(solved.requiredSavingsMonthly).toBeGreaterThan(0);

    const resultsWithMoreSavings = runProjection(planToSolve, 2026, false, solved.additionalSavingsMonthly);
    const lastYear = resultsWithMoreSavings[resultsWithMoreSavings.length - 1];
    expect(lastYear.portfolioEnd).toBeGreaterThanOrEqual(0);
  });

  it('nest egg at retirement tracks cash-aware plan targets (same projection path)', () => {
    const plan: RetirementPlan = {
      ...defaultPlan,
      heInput: {
        ...defaultPlan.heInput,
        extraContributionMonthly: 500,
        carryForwardTfsaRoom: 20000,
        carryForwardRrspRoom: 10000,
      },
      sheInput: {
        ...defaultPlan.sheInput,
        otherSavingsRrspMonthly: 0,
        extraContributionMonthly: 400,
        carryForwardTfsaRoom: 15000,
        carryForwardRrspRoom: 5000,
      },
      accountBuckets: {
        tfsaHe: 50000,
        tfsaShe: 40000,
        rrspHe: 80000,
        rrspShe: 30000,
        nonReg: 0,
        cashExcluded: 0,
      },
      currentSavings: 200000,
      annualTfsaLimit: 7000,
      lifeExpectancyDelta: 20,
      depositEsppToRrsp: false,
    };
    const targets = calculatePlanTargets(plan, 2026, false, {
      accumulate: (p, m, y) => bucketsAtRetirementFromProjection(p, m, y, false),
    });
    const withConv: RetirementPlan = {
      ...plan,
      conversionAgeHe: targets.recommendedConversion.conversionAgeHe,
      conversionAgeShe: targets.recommendedConversion.conversionAgeShe,
    };
    const proj = runProjection(withConv, 2026, false);
    const retireRow = proj.find(r => r.ageHe === plan.heInput.retirementAge);
    expect(retireRow).toBeDefined();
    // Opening wealth at retirement year should match target-engine current-path nest egg.
    expect(retireRow!.portfolioStart).toBeCloseTo(targets.projectedNestEggAtRetirement, -3);
  });

  it('child costs + leave lower projected nest egg vs child-free path', () => {
    const noChild = { ...defaultPlan, children: [] as RetirementPlan['children'] };
    const withChild: RetirementPlan = {
      ...defaultPlan,
      childCostConfig: {
        age0To4Mandatory: 800,
        age0To4Realistic: 2000,
        age5To11Mandatory: 400,
        age5To11Realistic: 1000,
        age12To17Mandatory: 400,
        age12To17Realistic: 1000,
        age18To21Mandatory: 200,
        age18To21Realistic: 500,
      },
      children: [
        {
          id: 'c1',
          age: -1,
          birthAgeHe: defaultPlan.heInput.age + 1,
          sheLeaveMonths: 12,
          heLeaveMonths: 2,
        },
      ],
    };
    const nestNo = calculatePlanTargets(noChild, 2026, false, {
      accumulate: (p, m, y) => bucketsAtRetirementFromProjection(p, m, y, false),
    }).projectedNestEggAtRetirement;
    const nestYes = calculatePlanTargets(withChild, 2026, false, {
      accumulate: (p, m, y) => bucketsAtRetirementFromProjection(p, m, y, false),
    }).projectedNestEggAtRetirement;
    expect(nestYes).toBeLessThan(nestNo);

    const leaveWith = runProjection(withChild, 2026, false).find(
      r => r.ageHe === defaultPlan.heInput.age + 1
    )!;
    const leaveNo = runProjection(noChild, 2026, false).find(
      r => r.ageHe === defaultPlan.heInput.age + 1
    )!;
    expect(leaveWith.childCosts).toBeGreaterThan(0);
    // Leave + daycare reduce what can actually be invested that year
    expect(leaveWith.actualSavings).toBeLessThan(leaveNo.actualSavings);
  });

  it('should calculate tax savings and apply reinvested refund when depositing ESPP to RRSP', () => {
    const planWithEsppToRrsp: RetirementPlan = {
      ...defaultPlan,
      heInput: {
        ...defaultPlan.heInput,
        esppEmployeeRate: 10,
        esppEmployerRate: 1.5,
      },
      depositEsppToRrsp: true,
      esppRefundSaveRate: 0.50,
    };

    const resultsBaseline = runProjection({ ...planWithEsppToRrsp, depositEsppToRrsp: false }, 2026);
    const resultsDeposit = runProjection(planWithEsppToRrsp, 2026);

    const secondYearDeposit = resultsDeposit[1];
    const secondYearBaseline = resultsBaseline[1];

    expect(secondYearDeposit.netIncome).toBeGreaterThan(secondYearBaseline.netIncome);
    expect(secondYearDeposit.actualSavings).toBeGreaterThan(secondYearBaseline.actualSavings);
  });

  it('should calculate minimum required savings using the full plan projection', () => {
    const planToSolve: RetirementPlan = {
      ...defaultPlan,
      desiredRetirementSpendMonthly: 12000,
      currentSavings: 0,
      accountBuckets: {
        tfsaHe: 0,
        tfsaShe: 0,
        rrspHe: 0,
        rrspShe: 0,
        nonReg: 0,
        cashExcluded: 0,
      },
      heInput: {
        ...defaultPlan.heInput,
        rrspEmployeeValue: 0,
        rrspEmployerRate: 0,
        esppEmployeeRate: 0,
        esppEmployerRate: 0,
        carryForwardRrspRoom: 0,
        carryForwardTfsaRoom: 0,
      },
      sheInput: {
        ...defaultPlan.sheInput,
        rrspEmployeeValue: 0,
        rrspEmployerRate: 0,
        otherSavingsRrspMonthly: 0,
        carryForwardRrspRoom: 0,
        carryForwardTfsaRoom: 0,
      },
      lifeExpectancyDelta: 20,
    };

    const result = calculateMinSavingsRequired(planToSolve, 2026, false);
    expect(result.monthlySavingsNeeded).toBeGreaterThan(0);
    // nestEgg field = projected on current path (may be ~0 with no payroll/Extra);
    // solved path is exposed as solvedNestEggAtRetirement when UI needs funding solve.
    const solved = (result as { solvedNestEggAtRetirement?: number }).solvedNestEggAtRetirement ?? 0;
    expect(solved).toBeGreaterThan(0);
    expect(result.portfolioCurve[0]).toBeCloseTo(solved, -1);
    expect(result.portfolioCurve[result.portfolioCurve.length - 1]).toBeGreaterThanOrEqual(0);
  });

  it('TFSA-first (ESPP sale): fills TFSA room then RRSP/non-reg — not lifestyle spend', () => {
    const plan: RetirementPlan = {
      ...defaultPlan,
      expenses: [],
      annualTfsaLimit: 7000,
      allocationPolicy: AllocationPolicy.TFSA_FIRST,
      // Match Dashboard default: ESPP sold → discretionary cash (not forced into RRSP)
      depositEsppToRrsp: false,
      currentSavings: 0,
      accountBuckets: {
        tfsaHe: 0,
        tfsaShe: 0,
        rrspHe: 0,
        rrspShe: 0,
        nonReg: 0,
        cashExcluded: 0,
      },
      heInput: {
        ...defaultPlan.heInput,
        carryForwardTfsaRoom: 7000,
        carryForwardRrspRoom: 200000,
        esppEmployeeRate: 10,
        esppEmployerRate: 1.5,
      },
      sheInput: {
        ...defaultPlan.sheInput,
        carryForwardTfsaRoom: 0,
        carryForwardRrspRoom: 50000,
        otherSavingsRrspMonthly: 0,
      },
    };
    const y0 = runProjection(plan, 2026)[0];
    expect(y0.contribToTfsa ?? 0).toBeCloseTo(7000, 0);
    expect(y0.heTfsaRoomRemaining ?? 0).toBeLessThan(100);
    // Overflow after TFSA still invested (RRSP and/or non-reg) — not dropped as spend
    expect((y0.contribToRrsp ?? 0) + (y0.contribToNonReg ?? 0)).toBeGreaterThan(5000);
    expect(
      (y0.contribToTfsa ?? 0) + (y0.contribToRrsp ?? 0) + (y0.contribToNonReg ?? 0)
    ).toBeCloseTo(y0.actualSavings, -1);
  });

  it('retired cash identity: pension + draws − tax ≈ net cash ≈ spend', () => {
    const plan: RetirementPlan = {
      ...defaultPlan,
      desiredRetirementSpendMonthly: 10000,
      lifeExpectancyDelta: 20,
      heInput: { ...defaultPlan.heInput, age: 65, retirementAge: 65 },
      sheInput: { ...defaultPlan.sheInput, age: 65, retirementAge: 65 },
      accountBuckets: {
        tfsaHe: 400000,
        tfsaShe: 200000,
        rrspHe: 800000,
        rrspShe: 300000,
        nonReg: 0,
        cashExcluded: 0,
      },
      currentSavings: 1700000,
    };
    const retired = runProjection(plan, 2026).find(r => r.isRetired);
    expect(retired).toBeDefined();
    const r = retired!;
    const draws = (r.drawdownGross ?? 0) + (r.tfsaDraw ?? 0) + (r.nonRegDraw ?? 0);
    expect(r.portfolioDrawTotal ?? 0).toBeCloseTo(draws, 0);
    const rebuilt = r.pensionIncome + draws - r.retirementTax;
    expect(rebuilt).toBeCloseTo(r.netIncome, -1);
    expect(r.netIncome).toBeGreaterThanOrEqual(r.expenses - 2);
    expect(r.portfolioStart).toBeGreaterThan(r.portfolioEnd - r.investmentGain);
    expect((r.hePensionGross ?? 0) + (r.shePensionGross ?? 0)).toBeCloseTo(r.pensionIncome, 0);
    expect((r.heRrspDraw ?? 0) + (r.sheRrspDraw ?? 0)).toBeCloseTo(r.drawdownGross, 0);
    expect((r.heTfsaDraw ?? 0) + (r.sheTfsaDraw ?? 0)).toBeCloseTo(r.tfsaDraw ?? 0, 0);
    if ((r.heRrspDraw ?? 0) + (r.sheRrspDraw ?? 0) > 0) {
      expect(r.heRrspDrawShare).toBeGreaterThanOrEqual(0);
      expect(r.heRrspDrawShare).toBeLessThanOrEqual(1);
    }
  });

  it('applies survivor stress to Plot 1 pensions, splitting, and portfolio path', () => {
    const base: RetirementPlan = {
      ...defaultPlan,
      desiredRetirementSpendMonthly: 10000,
      lifeExpectancyDelta: 4,
      survivorYearIndex: 1,
      heInput: { ...defaultPlan.heInput, age: 65, retirementAge: 65 },
      sheInput: { ...defaultPlan.sheInput, age: 65, retirementAge: 65 },
      accountBuckets: {
        tfsaHe: 400000,
        tfsaShe: 200000,
        rrspHe: 800000,
        rrspShe: 300000,
        nonReg: 0,
        cashExcluded: 0,
      },
      currentSavings: 1700000,
    };

    const bothAlive = runProjection({ ...base, survivorToggle: false }, 2026);
    const survivor = runProjection({ ...base, survivorToggle: true }, 2026);
    const halfSpend = runProjection(
      { ...base, survivorToggle: true, survivorSpendFactor: 0.5 },
      2026
    );
    const sheDeceased = runProjection(
      {
        ...base,
        survivorToggle: true,
        survivorWho: SurvivorWho.SHE,
      },
      2026
    );
    const aliveAt65 = bothAlive.find(r => r.ageHe === 65)!;
    const stressedAt65 = survivor.find(r => r.ageHe === 65)!;
    const aliveAt66 = bothAlive.find(r => r.ageHe === 66)!;
    const stressedAt66 = survivor.find(r => r.ageHe === 66)!;
    const halfAt66 = halfSpend.find(r => r.ageHe === 66)!;
    const sheDeceasedAt66 = sheDeceased.find(
      r => r.ageHe === 66
    )!;

    // Stress starts at retirement index 1, so the retirement-year row is unchanged.
    expect(stressedAt65.pensionIncome).toBeCloseTo(aliveAt65.pensionIncome, 2);
    expect(stressedAt65.expenses).toBeCloseTo(aliveAt65.expenses, 2);

    // Match targetEngine's crude survivor model: He's OAS + own CPP stop, She's remains.
    expect(stressedAt66.hePensionGross).toBe(0);
    expect(stressedAt66.shePensionGross).toBeGreaterThan(0);
    expect(aliveAt66.hePensionGross).toBeGreaterThan(0);

    // CPP survivor benefit: She's pension after He dies exceeds her own-alone
    // pension (she gains 60% of his CPP, capped), but stays below the couple's total.
    const sheOwnAlive = aliveAt66.shePensionGross!;
    expect(stressedAt66.shePensionGross).toBeGreaterThan(sheOwnAlive);
    expect(stressedAt66.shePensionGross).toBeLessThan(
      aliveAt66.hePensionGross! + aliveAt66.shePensionGross!
    );

    // Post-death the survivor spends the default 70% of the couple's target.
    expect(stressedAt66.expenses).toBeCloseTo(aliveAt66.expenses * 0.70, 0);
    // Factor is configurable.
    expect(halfAt66.expenses).toBeCloseTo(aliveAt66.expenses * 0.5, 0);
    expect(sheDeceasedAt66.shePensionGross).toBe(0);
    expect(sheDeceasedAt66.hePensionGross).toBeGreaterThanOrEqual(
      aliveAt66.hePensionGross!
    );
  });

  it('underfunded retirement years max-drain — portfolio does not rebound after shortfall', () => {
    // Small nest egg + high spend so the portfolio runs out mid-horizon.
    const plan: RetirementPlan = {
      ...defaultPlan,
      desiredRetirementSpendMonthly: 12000,
      lifeExpectancyDelta: 20,
      investmentReturnRate: 0.05,
      inflationRate: 0.02,
      heInput: { ...defaultPlan.heInput, age: 65, retirementAge: 65 },
      sheInput: { ...defaultPlan.sheInput, age: 65, retirementAge: 65 },
      accountBuckets: {
        tfsaHe: 50000,
        tfsaShe: 50000,
        rrspHe: 200000,
        rrspShe: 100000,
        nonReg: 0,
        cashExcluded: 0,
      },
      currentSavings: 400000,
    };
    const retired = runProjection(plan, 2026).filter(r => r.isRetired);
    expect(retired.length).toBeGreaterThan(5);

    const firstShort = retired.findIndex(r => r.netIncome + 1 < r.expenses);
    expect(firstShort).toBeGreaterThanOrEqual(0);

    const shortYear = retired[firstShort];
    // Must still produce real cash (not the old bug of netIncome = 0 / RRIF-mins only).
    expect(shortYear.netIncome).toBeGreaterThan(shortYear.pensionIncome * 0.5);
    expect(shortYear.portfolioDrawTotal ?? 0).toBeGreaterThan(0);
    // Residual after the underfunded draw should be tiny vs opening balance.
    expect(shortYear.portfolioEnd).toBeLessThan(shortYear.portfolioStart * 0.35);

    // Once shortfall begins, Plot 1 opening balances must not climb again.
    for (let i = firstShort + 1; i < retired.length; i++) {
      expect(retired[i].portfolioStart).toBeLessThanOrEqual(retired[i - 1].portfolioStart + 1);
    }
  });
});

describe('calculateMinimumNestEgg', () => {
  it('should compute a positive nest egg for standard inputs', () => {
    const result = calculateMinimumNestEgg(
      5000,  // $5,000/mo spend
      25,    // 25-year retirement
      0.02,  // 2% inflation
      0.05,  // 5% return
      29,    // 29 years to retirement
      0      // no current savings
    );
    expect(result.nestEgg).toBeGreaterThan(0);
    expect(result.monthlySavingsNeeded).toBeGreaterThan(0);
  });

  it('portfolio depletion curve should start near nestEgg and end near 0', () => {
    const result = calculateMinimumNestEgg(4000, 20, 0.02, 0.05, 20, 0);
    // First element is the nest egg (start of retirement)
    expect(result.portfolioCurve[0]).toBeCloseTo(result.nestEgg, -1);
    // Last element should be approximately 0 (fully depleted)
    const last = result.portfolioCurve[result.portfolioCurve.length - 1];
    expect(last).toBeCloseTo(0, -3);
  });

  it('depletion curve should have postRetirementYears + 1 data points', () => {
    const postYears = 30;
    const result = calculateMinimumNestEgg(3500, postYears, 0.025, 0.06, 25, 0);
    expect(result.portfolioCurve).toHaveLength(postYears + 1);
    expect(result.annualSpendCurve).toHaveLength(postYears);
  });

  it('should report zero shortfall when current savings already covers the nest egg', () => {
    // Massive current savings — FV will exceed nest egg
    const result = calculateMinimumNestEgg(
      5000, 20, 0.02, 0.05, 10,
      10_000_000 // $10M already saved
    );
    expect(result.shortfallFromCurrent).toBe(0);
    expect(result.monthlySavingsNeeded).toBe(0);
  });

  it('annualSpendCurve should grow at the inflation rate each year', () => {
    const inflation = 0.03;
    const result = calculateMinimumNestEgg(5000, 10, inflation, 0.06, 15, 0);
    for (let i = 1; i < result.annualSpendCurve.length; i++) {
      const expectedGrowth = result.annualSpendCurve[i - 1] * (1 + inflation);
      expect(result.annualSpendCurve[i]).toBeCloseTo(expectedGrowth, 2);
    }
  });

  it('handles edge case when return rate equals inflation rate (no division by zero)', () => {
    const rate = 0.03;
    const result = calculateMinimumNestEgg(4000, 20, rate, rate, 20, 0);
    // When r === g: nest egg = firstYearSpend * n
    const expectedNestEgg = 4000 * 12 * Math.pow(1 + rate, 20) * 20;
    expect(result.nestEgg).toBeCloseTo(expectedNestEgg, -2);
  });

  it('higher inflation should require a larger nest egg', () => {
    const base = calculateMinimumNestEgg(5000, 25, 0.02, 0.05, 20, 0);
    const high = calculateMinimumNestEgg(5000, 25, 0.05, 0.05, 20, 0);
    expect(high.nestEgg).toBeGreaterThan(base.nestEgg);
  });

  it('higher investment return should reduce required nest egg', () => {
    const lowReturn = calculateMinimumNestEgg(5000, 25, 0.02, 0.03, 20, 0);
    const highReturn = calculateMinimumNestEgg(5000, 25, 0.02, 0.07, 20, 0);
    expect(highReturn.nestEgg).toBeLessThan(lowReturn.nestEgg);
  });
});

