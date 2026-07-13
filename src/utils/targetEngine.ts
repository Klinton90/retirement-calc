/**
 * Target engine — source of truth for nest egg / min contribution cards.
 * See docs/explanation/math-model.md.
 */
import {
  AllocationPolicy,
  ContributionType,
  FundingRegime,
  type RetirementPlan,
  type AccountBuckets,
} from '../types/calculator';
import {
  resolveBuckets,
  totalInvestable,
  growBuckets,
  cloneBuckets,
  redepositExcess,
} from './accountBuckets';
import { deployAnnualContributions, resolveAnnualTfsaLimit, type RoomState } from './contributionPolicy';
import { rrifMinimumWithdrawal } from './rrifCalc';
import { calculatePersonPensionForAge, DEFAULT_PENSION_CONFIG } from './pensionCalc';
import { calculateHouseholdRetirementTax } from './retirementIncomeTax';
import { oasClawback, DEFAULT_OAS_CLAWBACK_THRESHOLD, DEFAULT_OAS_CLAWBACK_RATE } from './oasClawback';
import { DEFAULT_TAX_CONFIG } from './taxRates';

const MAX_RRSP_ANNUAL = 33720;

export interface DecumulationYearResult {
  ageHe: number;
  ageShe: number;
  spend: number;
  pensionGross: number;
  tax: number;
  portfolioStart: number;
  portfolioEnd: number;
  shortfall: number;
  rrifHe: number;
  rrifShe: number;
}

export interface ConversionScenarioResult {
  conversionAgeHe: number;
  conversionAgeShe: number;
  yearsFunded: number;
  horizonYears: number;
  terminalWealth: number;
  totalTaxPaid: number;
  totalOasClawback: number;
  regime: FundingRegime;
  curve: DecumulationYearResult[];
  score: number;
}

export interface TargetEngineResult {
  nestEggAtRetirement: number;
  monthlyPersonalSavingsNeeded: number;
  isFundedWithoutExtra: boolean;
  shortfallFromCurrentPath: number;
  firstYearPensionGross: number;
  regime: FundingRegime;
  recommendedConversion: ConversionScenarioResult;
  runnersUp: ConversionScenarioResult[];
  /** Top conversion scenarios from the 65–71×65–71 grid (recommended first). */
  conversionRanking: ConversionScenarioResult[];
  solveConversionAgeHe: number;
  solveConversionAgeShe: number;
  allocationPolicy: AllocationPolicy;
  portfolioCurve: number[];
  annualSpendCurve: number[];
  bucketsAtRetirement: AccountBuckets;
  /**
   * When current path cannot fund target spend: portfolio under target spend with $0 extra savings
   * (dies early). Chart solid line uses this; green dashed = required path (`portfolioCurve`).
   */
  currentPathPortfolioCurve?: number[];
  /**
   * Deplete-to-~$0 reference: surplus (spend more) when funded; required nest-egg path when
   * below target; affordable max spend only if even the solved nest egg is UNDER.
   */
  surplusSpend?: SurplusSpendResult;
}

/** Deplete-to-near-zero / required-path reference for the Min Savings chart. */
export interface SurplusSpendResult {
  /** $/mo vs plan target (today's $): positive = extra capacity; negative = affordability gap. */
  extraMonthlyToday: number;
  /** Absolute spend $/mo (today's $) on the reference path. */
  totalMonthlyToday: number;
  /** Portfolio path under reference spend (n+1 points, last ≈ 0 when funded). */
  depletePortfolioCurve: number[];
  /** Total annual spend each retirement year under reference path (n points). */
  depleteSpendCurve: number[];
  /** Annual $ vs target spend curve (positive = extra pull; negative = cut vs target). */
  annualExtraCurve: number[];
  terminalWealth: number;
  /**
   * surplus = funded, spend more → $0;
   * required = below: min nest egg at *target* spend → $0 (compare to current path);
   * affordable = even solved nest egg UNDER — max spend that still → $0.
   */
  kind: 'surplus' | 'required' | 'affordable';
}

function inflatePensionConfig(mult: number) {
  return {
    ...DEFAULT_PENSION_CONFIG,
    maxCppMonthly: DEFAULT_PENSION_CONFIG.maxCppMonthly * mult,
    maxOasMonthly: DEFAULT_PENSION_CONFIG.maxOasMonthly * mult,
  };
}

function inflateTax(taxConfig: typeof DEFAULT_TAX_CONFIG, mult: number) {
  return {
    ...taxConfig,
    federalBrackets: taxConfig.federalBrackets.map(b => ({
      threshold: b.threshold === Infinity ? Infinity : b.threshold * mult,
      rate: b.rate,
    })),
    ontarioBrackets: taxConfig.ontarioBrackets.map(b => ({
      threshold: b.threshold === Infinity ? Infinity : b.threshold * mult,
      rate: b.rate,
    })),
    federalBpaMax: taxConfig.federalBpaMax * mult,
    federalBpaMin: taxConfig.federalBpaMin * mult,
    federalBpaThreshold1: taxConfig.federalBpaThreshold1 * mult,
    federalBpaThreshold2: taxConfig.federalBpaThreshold2 * mult,
    ontarioBpa: taxConfig.ontarioBpa * mult,
    cppYmpe: taxConfig.cppYmpe * mult,
    cppYame: taxConfig.cppYame * mult,
  };
}

function rrifAgeFor(personAge: number, spouseAge: number, useYounger: boolean): number {
  return useYounger ? Math.min(personAge, spouseAge) : personAge;
}

/**
 * Simulate retirement years only from given starting buckets.
 */
export function simulateDecumulation(
  plan: RetirementPlan,
  startBuckets: AccountBuckets,
  currentYear: number,
  conversionAgeHe: number,
  conversionAgeShe: number,
  useMandatorySpend: boolean
): Omit<ConversionScenarioResult, 'regime' | 'score'> {
  const horizon = Math.max(1, plan.lifeExpectancyDelta ?? 20);
  const spendMonthly = useMandatorySpend
    ? plan.mandatoryRetirementSpendMonthly
    : plan.desiredRetirementSpendMonthly;
  const r = plan.investmentReturnRate;
  const g = plan.inflationRate;
  const taxConfig0 = plan.taxConfig || DEFAULT_TAX_CONFIG;
  const useYounger = plan.useYoungerSpouseRrifAge ?? false;
  const survivorOn = plan.survivorToggle ?? false;
  const survivorAt = plan.survivorYearIndex ?? Math.floor(horizon / 2);
  const inflateTfsa = !!plan.inflateAnnualTfsaLimit;

  let buckets = cloneBuckets(startBuckets);
  let inflationMult = Math.pow(1 + g, Math.max(0, plan.heInput.retirementAge - plan.heInput.age));
  // startBuckets already at retirement in nominal $; spend also needs to be at retirement dollars
  const firstYearSpend = spendMonthly * 12 * inflationMult;

  let spend = firstYearSpend;
  let yearsFunded = 0;
  let totalTax = 0;
  let totalClawback = 0;
  const curve: DecumulationYearResult[] = [];
  let tfsaRoomHe = 0;
  let tfsaRoomShe = 0;

  for (let i = 0; i < horizon; i++) {
    const ageHe = plan.heInput.retirementAge + i;
    const ageShe = plan.sheInput.retirementAge + i;
    const yearTax = inflateTax(taxConfig0, inflationMult);
    const yearPensionCfg = inflatePensionConfig(inflationMult);
    const portfolioStart = totalInvestable(buckets);

    const heAlive = !(survivorOn && i >= survivorAt); // crude: kill He for stress
    const sheAlive = true;

    const hePen = heAlive
      ? calculatePersonPensionForAge(plan.heInput, currentYear, ageHe, yearPensionCfg, yearTax)
      : { oasAnnual: 0, cppAnnual: 0, totalPensionAnnual: 0, residencyYears: 0, contributionYears: 0, oasMultiplier: 0, cppMultiplier: 0, oasMonthly: 0, cppMonthly: 0 };
    const shePen = sheAlive
      ? calculatePersonPensionForAge(plan.sheInput, currentYear, ageShe, yearPensionCfg, yearTax)
      : { oasAnnual: 0, cppAnnual: 0, totalPensionAnnual: 0, residencyYears: 0, contributionYears: 0, oasMultiplier: 0, cppMultiplier: 0, oasMonthly: 0, cppMonthly: 0 };

    let heOas = hePen.oasAnnual;
    let sheOas = shePen.oasAnnual;
    const heCpp = hePen.cppAnnual;
    const sheCpp = shePen.cppAnnual;

    const heConverted = ageHe >= conversionAgeHe;
    const sheConverted = ageShe >= conversionAgeShe;
    const heRrifAge = rrifAgeFor(ageHe, ageShe, useYounger);
    const sheRrifAge = rrifAgeFor(ageShe, ageHe, useYounger);
    const rrifMinHe = heConverted ? rrifMinimumWithdrawal(buckets.rrspHe, heRrifAge) : 0;
    const rrifMinShe = sheConverted ? rrifMinimumWithdrawal(buckets.rrspShe, sheRrifAge) : 0;

    // Binary search gross RRIF/RRSP draws above mins so net covers spend
    let low = 0;
    let high = spend * 3 + totalInvestable(buckets) + 1;
    let bestTax = 0;
    let bestShortfall = spend;
    let bestBuckets = cloneBuckets(buckets);
    let bestRrifHe = 0;
    let bestRrifShe = 0;
    let bestClaw = 0;

    for (let iter = 0; iter < 18; iter++) {
      const extra = (low + high) / 2;
      const trial = cloneBuckets(buckets);

      let drawHe = Math.min(trial.rrspHe, rrifMinHe);
      let drawShe = Math.min(trial.rrspShe, rrifMinShe);
      trial.rrspHe -= drawHe;
      trial.rrspShe -= drawShe;

      let extraLeft = extra;
      // Order: RRIF mins (done) → TFSA tax-free bridge (only what's needed) → extra taxable RRSP → non-reg
      let tfsaDraw = 0;
      // Rough net from mins+pension before TFSA (ignore tax precision for sizing bridge)
      const roughNetMins = heCpp + sheCpp + heOas + sheOas + drawHe + drawShe;
      let bridgeNeed = Math.max(0, spend - roughNetMins);
      if (bridgeNeed > 0) {
        const th = Math.min(trial.tfsaHe, bridgeNeed);
        trial.tfsaHe -= th;
        tfsaDraw += th;
        bridgeNeed -= th;
        const ts = Math.min(trial.tfsaShe, bridgeNeed);
        trial.tfsaShe -= ts;
        tfsaDraw += ts;
        bridgeNeed -= ts;
      }
      const takeRrsp = (who: 'he' | 'she', amt: number) => {
        if (who === 'he') {
          const t = Math.min(trial.rrspHe, amt);
          trial.rrspHe -= t;
          drawHe += t;
          return t;
        }
        const t = Math.min(trial.rrspShe, amt);
        trial.rrspShe -= t;
        drawShe += t;
        return t;
      };
      while (extraLeft > 1e-6 && (trial.rrspHe > 0 || trial.rrspShe > 0)) {
        const preferHe = trial.rrspHe >= trial.rrspShe;
        const got = takeRrsp(preferHe ? 'he' : 'she', extraLeft);
        if (got < 1e-9) break;
        extraLeft -= got;
      }
      let nonRegDraw = 0;
      if (extraLeft > 0) {
        nonRegDraw = Math.min(trial.nonReg, extraLeft);
        trial.nonReg -= nonRegDraw;
        extraLeft -= nonRegDraw;
      }

      const heRrifEligible = ageHe >= 65 ? drawHe : 0;
      const sheRrifEligible = ageShe >= 65 ? drawShe : 0;

      const heIncomeForClaw = heCpp + heOas + drawHe;
      const sheIncomeForClaw = sheCpp + sheOas + drawShe;
      const heClaw = oasClawback(heOas, heIncomeForClaw, DEFAULT_OAS_CLAWBACK_THRESHOLD * inflationMult, DEFAULT_OAS_CLAWBACK_RATE);
      const sheClaw = oasClawback(sheOas, sheIncomeForClaw, DEFAULT_OAS_CLAWBACK_THRESHOLD * inflationMult, DEFAULT_OAS_CLAWBACK_RATE);
      const heOasNet = heClaw.oasAfter;
      const sheOasNet = sheClaw.oasAfter;

      const heOther = heCpp + heOasNet;
      const sheOther = sheCpp + sheOasNet;
      const canSplit = ageHe >= 65 && ageShe >= 65 && heAlive && sheAlive;
      // v1: 50% of non-reg withdrawal treated as taxable (crude CG inclusion)
      const nonRegTaxable = nonRegDraw * 0.5;
      const taxRes = calculateHouseholdRetirementTax(
        heOther + drawHe + nonRegTaxable / 2,
        sheOther + drawShe + nonRegTaxable / 2,
        heRrifEligible,
        sheRrifEligible,
        yearTax,
        canSplit
      );

      const grossCash = heOasNet + sheOasNet + heCpp + sheCpp + drawHe + drawShe + tfsaDraw + nonRegDraw;
      const netCash = grossCash - taxRes.totalTax;
      const shortfall = Math.max(0, spend - netCash);

      if (shortfall <= 0.5 && netCash > spend + 1) {
        const surplus = netCash - spend;
        const yrTfsa = resolveAnnualTfsaLimit(plan.annualTfsaLimit, inflateTfsa, inflationMult);
        Object.assign(trial, redepositExcess(trial, surplus, tfsaRoomHe + yrTfsa, tfsaRoomShe + yrTfsa));
      }

      if (shortfall > 0.5) {
        low = extra;
      } else {
        high = extra;
        bestTax = taxRes.totalTax;
        bestShortfall = shortfall;
        bestBuckets = trial;
        bestRrifHe = drawHe;
        bestRrifShe = drawShe;
        bestClaw = heClaw.clawback + sheClaw.clawback;
      }
    }

    // Unfunded year: still apply max draw so portfolio depletes (don't leave untouched balances)
    if (bestShortfall > 0.5) {
      const trial = cloneBuckets(buckets);
      let drawHe = Math.min(trial.rrspHe, Math.max(rrifMinHe, trial.rrspHe));
      let drawShe = Math.min(trial.rrspShe, Math.max(rrifMinShe, trial.rrspShe));
      // Drain all registered + TFSA + non-reg
      drawHe = trial.rrspHe;
      drawShe = trial.rrspShe;
      trial.rrspHe = 0;
      trial.rrspShe = 0;
      const tfsaDraw = trial.tfsaHe + trial.tfsaShe;
      trial.tfsaHe = 0;
      trial.tfsaShe = 0;
      const nonRegDraw = trial.nonReg;
      trial.nonReg = 0;
      const heClaw = oasClawback(heOas, heCpp + heOas + drawHe, DEFAULT_OAS_CLAWBACK_THRESHOLD * inflationMult, DEFAULT_OAS_CLAWBACK_RATE);
      const sheClaw = oasClawback(sheOas, sheCpp + sheOas + drawShe, DEFAULT_OAS_CLAWBACK_THRESHOLD * inflationMult, DEFAULT_OAS_CLAWBACK_RATE);
      const canSplit = ageHe >= 65 && ageShe >= 65 && heAlive && sheAlive;
      const taxRes = calculateHouseholdRetirementTax(
        heCpp + heClaw.oasAfter + drawHe + nonRegDraw * 0.25,
        sheCpp + sheClaw.oasAfter + drawShe + nonRegDraw * 0.25,
        ageHe >= 65 ? drawHe : 0,
        ageShe >= 65 ? drawShe : 0,
        yearTax,
        canSplit
      );
      const netCash =
        heClaw.oasAfter + sheClaw.oasAfter + heCpp + sheCpp + drawHe + drawShe + tfsaDraw + nonRegDraw - taxRes.totalTax;
      bestTax = taxRes.totalTax;
      bestShortfall = Math.max(0, spend - netCash);
      bestBuckets = trial;
      bestRrifHe = drawHe;
      bestRrifShe = drawShe;
      bestClaw = heClaw.clawback + sheClaw.clawback;
    }

    // Grow remaining
    const after = growBuckets(bestBuckets, r);
    const yrTfsaGrant = resolveAnnualTfsaLimit(plan.annualTfsaLimit, inflateTfsa, inflationMult);
    tfsaRoomHe += yrTfsaGrant;
    tfsaRoomShe += yrTfsaGrant;

    const portfolioEnd = totalInvestable(after);
    if (bestShortfall <= 1) yearsFunded += 1;

    curve.push({
      ageHe,
      ageShe,
      spend,
      pensionGross: hePen.totalPensionAnnual + shePen.totalPensionAnnual,
      tax: bestTax,
      portfolioStart,
      portfolioEnd,
      shortfall: bestShortfall,
      rrifHe: bestRrifHe,
      rrifShe: bestRrifShe,
    });

    totalTax += bestTax;
    totalClawback += bestClaw;
    buckets = after;
    spend *= 1 + g;
    inflationMult *= 1 + g;
  }

  return {
    conversionAgeHe,
    conversionAgeShe,
    yearsFunded,
    horizonYears: horizon,
    terminalWealth: totalInvestable(buckets),
    totalTaxPaid: totalTax,
    totalOasClawback: totalClawback,
    curve,
  };
}

function classifyRegime(
  result: Omit<ConversionScenarioResult, 'regime' | 'score'>,
  nearSlackYears: number,
  lastSpend: number
): FundingRegime {
  if (result.yearsFunded < result.horizonYears) return FundingRegime.UNDER;
  const slack = nearSlackYears * Math.max(1, lastSpend);
  if (result.terminalWealth <= slack) return FundingRegime.NEAR;
  return FundingRegime.ABOVE;
}

function scoreScenario(result: Omit<ConversionScenarioResult, 'regime' | 'score'>, regime: FundingRegime): number {
  // Higher is better
  if (regime === FundingRegime.UNDER) {
    return result.yearsFunded * 1e12 - result.totalTaxPaid;
  }
  if (regime === FundingRegime.NEAR) {
    return 1e15 - result.totalTaxPaid - result.totalOasClawback * 2;
  }
  return 1e15 + result.terminalWealth - result.totalTaxPaid - result.totalOasClawback * 2;
}

/** Accumulate from today to retirement with flat personal monthly savings (today's $), match kept. */
export function accumulateToRetirement(
  plan: RetirementPlan,
  personalMonthlyToday: number,
  _currentYear: number,
  policy: AllocationPolicy
): AccountBuckets {
  let buckets = resolveBuckets(plan);
  let rooms: RoomState = {
    tfsaHe: plan.heInput.carryForwardTfsaRoom ?? 0,
    tfsaShe: plan.sheInput.carryForwardTfsaRoom ?? 0,
    rrspHe: plan.heInput.carryForwardRrspRoom ?? 0,
    rrspShe: plan.sheInput.carryForwardRrspRoom ?? 0,
  };
  const years = Math.max(
    0,
    Math.max(plan.heInput.retirementAge - plan.heInput.age, plan.sheInput.retirementAge - plan.sheInput.age)
  );
  const r = plan.investmentReturnRate;
  const g = plan.inflationRate;
  const inflateTfsa = !!plan.inflateAnnualTfsaLimit;
  let inflationMult = 1;

  for (let t = 0; t < years; t++) {
    const ageHe = plan.heInput.age + t;
    const ageShe = plan.sheInput.age + t;
    const heWorking = ageHe < plan.heInput.retirementAge;
    const sheWorking = ageShe < plan.sheInput.retirementAge;

    // Jan 1 TFSA grant for years after the starting year (carry-forward already has year-0 limit)
    if (t > 0) {
      const yrTfsa = resolveAnnualTfsaLimit(plan.annualTfsaLimit, inflateTfsa, inflationMult);
      rooms = {
        ...rooms,
        tfsaHe: rooms.tfsaHe + yrTfsa,
        tfsaShe: rooms.tfsaShe + yrTfsa,
      };
    }

    const heSalary = heWorking ? plan.heInput.salary * inflationMult : 0;
    const sheSalary = sheWorking ? plan.sheInput.salary * inflationMult : 0;
    const matchHe = heSalary * ((plan.heInput.rrspEmployerRate || 0) / 100);
    const matchShe = sheSalary * ((plan.sheInput.rrspEmployerRate || 0) / 100);
    const heEmp = heWorking
      ? plan.heInput.rrspEmployeeType === ContributionType.PERCENTAGE
        ? heSalary * (plan.heInput.rrspEmployeeValue / 100)
        : plan.heInput.rrspEmployeeValue * 12 * inflationMult
      : 0;
    const sheEmp = sheWorking
      ? plan.sheInput.rrspEmployeeType === ContributionType.PERCENTAGE
        ? sheSalary * (plan.sheInput.rrspEmployeeValue / 100)
        : plan.sheInput.rrspEmployeeValue * 12 * inflationMult
      : 0;

    const espp = heWorking
      ? heSalary * ((plan.heInput.esppEmployeeRate || 0) / 100) +
        heSalary * ((plan.heInput.esppEmployerRate || 0) / 100)
      : 0;

    // Extra personal monthly only while at least one is working
    const personalExtra =
      heWorking || sheWorking ? personalMonthlyToday * 12 * inflationMult + espp : 0;

    // RRSP new room from this year's income — credited for use as we go (simplified)
    const newRrspHe = heWorking ? Math.min(MAX_RRSP_ANNUAL * inflationMult, heSalary * 0.18) : 0;
    const newRrspShe = sheWorking ? Math.min(MAX_RRSP_ANNUAL * inflationMult, sheSalary * 0.18) : 0;
    rooms = {
      ...rooms,
      rrspHe: rooms.rrspHe + newRrspHe,
      rrspShe: rooms.rrspShe + newRrspShe,
    };

    const deployed = deployAnnualContributions({
      personalInvestable: personalExtra,
      payrollRrspHe: heEmp,
      payrollRrspShe: sheEmp,
      employerMatchHe: matchHe,
      employerMatchShe: matchShe,
      policy,
      rooms,
      buckets: growBuckets(buckets, r), // grow opening balance; contributions earn from next year
    });
    buckets = deployed.buckets;
    rooms = deployed.rooms;
    inflationMult *= 1 + g;
  }

  return buckets;
}

function evaluateConversionGrid(
  plan: RetirementPlan,
  bucketsAtRetire: AccountBuckets,
  currentYear: number,
  useMandatory: boolean
): ConversionScenarioResult[] {
  const nearSlack = plan.nearRegimeSlackYears ?? 3;
  const results: ConversionScenarioResult[] = [];
  for (let ch = 65; ch <= 71; ch++) {
    for (let cs = 65; cs <= 71; cs++) {
      const raw = simulateDecumulation(plan, bucketsAtRetire, currentYear, ch, cs, useMandatory);
      const lastSpend = raw.curve.length ? raw.curve[raw.curve.length - 1].spend : 0;
      const regime = classifyRegime(raw, nearSlack, lastSpend);
      results.push({ ...raw, regime, score: scoreScenario(raw, regime) });
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results;
}

function curveFromDecumulation(dec: Omit<ConversionScenarioResult, 'regime' | 'score'>): {
  portfolioCurve: number[];
  annualSpendCurve: number[];
} {
  const portfolioCurve = dec.curve.map(c => c.portfolioStart);
  if (dec.curve.length) {
    portfolioCurve.push(dec.curve[dec.curve.length - 1].portfolioEnd);
  }
  return {
    portfolioCurve,
    annualSpendCurve: dec.curve.map(c => c.spend),
  };
}

function withSpendMonthly(
  plan: RetirementPlan,
  monthlyToday: number,
  useMandatorySpend: boolean
): RetirementPlan {
  return {
    ...plan,
    desiredRetirementSpendMonthly: useMandatorySpend
      ? plan.desiredRetirementSpendMonthly
      : monthlyToday,
    mandatoryRetirementSpendMonthly: useMandatorySpend
      ? monthlyToday
      : plan.mandatoryRetirementSpendMonthly,
  };
}

/**
 * Binary-search max constant extra monthly spend (today's $) so the horizon stays funded
 * and the portfolio is drawn down toward ~$0.
 */
export function solveMaxSurplusSpend(
  plan: RetirementPlan,
  bucketsAtRetire: AccountBuckets,
  currentYear: number,
  conversionAgeHe: number,
  conversionAgeShe: number,
  useMandatorySpend: boolean,
  baseAnnualSpendCurve: number[]
): SurplusSpendResult | undefined {
  const baseMonthly = useMandatorySpend
    ? plan.mandatoryRetirementSpendMonthly
    : plan.desiredRetirementSpendMonthly;

  const trial = (extraMonthlyToday: number) =>
    simulateDecumulation(
      withSpendMonthly(plan, baseMonthly + extraMonthlyToday, useMandatorySpend),
      bucketsAtRetire,
      currentYear,
      conversionAgeHe,
      conversionAgeShe,
      useMandatorySpend
    );

  const baseDec = trial(0);
  if (baseDec.yearsFunded < baseDec.horizonYears) return undefined;

  let low = 0;
  let high = Math.max(5000, baseMonthly);
  let guard = 0;
  while (guard++ < 12) {
    const hi = trial(high);
    if (hi.yearsFunded < hi.horizonYears) break;
    high *= 2;
    if (high > 500000) break;
  }

  let bestExtra = 0;
  let bestDec = baseDec;
  for (let i = 0; i < 28; i++) {
    const mid = (low + high) / 2;
    const dec = trial(mid);
    if (dec.yearsFunded >= dec.horizonYears) {
      low = mid;
      bestExtra = mid;
      bestDec = dec;
    } else {
      high = mid;
    }
  }

  // Even ~$0 extra: still return a →$0 reference path for the chart.
  const { portfolioCurve, annualSpendCurve } = curveFromDecumulation(bestDec);
  const annualExtraCurve = annualSpendCurve.map(
    (spend, i) => spend - (baseAnnualSpendCurve[i] ?? 0)
  );

  return {
    extraMonthlyToday: bestExtra,
    totalMonthlyToday: baseMonthly + bestExtra,
    depletePortfolioCurve: portfolioCurve,
    depleteSpendCurve: annualSpendCurve,
    annualExtraCurve,
    terminalWealth: bestDec.terminalWealth,
    kind: 'surplus',
  };
}

/**
 * UNDER at target spend: max constant monthly spend (today's $) that still funds the
 * horizon on this nest egg, burned toward ~$0 — chart comparison vs unaffordable target.
 */
export function solveMaxAffordableSpend(
  plan: RetirementPlan,
  bucketsAtRetire: AccountBuckets,
  currentYear: number,
  conversionAgeHe: number,
  conversionAgeShe: number,
  useMandatorySpend: boolean,
  baseAnnualSpendCurve: number[]
): SurplusSpendResult | undefined {
  const targetMonthly = useMandatorySpend
    ? plan.mandatoryRetirementSpendMonthly
    : plan.desiredRetirementSpendMonthly;

  const trial = (monthlyToday: number) =>
    simulateDecumulation(
      withSpendMonthly(plan, monthlyToday, useMandatorySpend),
      bucketsAtRetire,
      currentYear,
      conversionAgeHe,
      conversionAgeShe,
      useMandatorySpend
    );

  const atTarget = trial(targetMonthly);
  if (atTarget.yearsFunded >= atTarget.horizonYears) {
    return undefined;
  }

  let low = 0;
  let high = targetMonthly;
  let bestMonthly = 0;
  let bestDec = trial(0);
  for (let i = 0; i < 28; i++) {
    const mid = (low + high) / 2;
    const dec = trial(mid);
    if (dec.yearsFunded >= dec.horizonYears) {
      low = mid;
      bestMonthly = mid;
      bestDec = dec;
    } else {
      high = mid;
    }
  }

  if (bestMonthly < 1) return undefined;

  const burn = solveMaxSurplusSpend(
    withSpendMonthly(plan, bestMonthly, useMandatorySpend),
    bucketsAtRetire,
    currentYear,
    conversionAgeHe,
    conversionAgeShe,
    useMandatorySpend,
    bestDec.curve.map(c => c.spend)
  );
  const totalMonthly = burn ? burn.totalMonthlyToday : bestMonthly;
  const portfolioCurve = burn
    ? burn.depletePortfolioCurve
    : curveFromDecumulation(bestDec).portfolioCurve;
  const depleteSpendCurve = burn
    ? burn.depleteSpendCurve
    : curveFromDecumulation(bestDec).annualSpendCurve;

  return {
    extraMonthlyToday: totalMonthly - targetMonthly,
    totalMonthlyToday: totalMonthly,
    depletePortfolioCurve: portfolioCurve,
    depleteSpendCurve,
    annualExtraCurve: depleteSpendCurve.map(
      (spend, i) => spend - (baseAnnualSpendCurve[i] ?? 0)
    ),
    terminalWealth: burn?.terminalWealth ?? bestDec.terminalWealth,
    kind: 'affordable',
  };
}

/**
 * Two-step target solve:
 * 1) Min personal $/mo under conversion @71
 * 2) Re-rank conversion grid at solved wealth
 */
export function calculatePlanTargets(
  plan: RetirementPlan,
  currentYear: number = new Date().getFullYear(),
  useMandatorySpend: boolean = false
): TargetEngineResult {
  const policy = plan.allocationPolicy ?? AllocationPolicy.TFSA_FIRST;

  const fundedAt = (monthly: number) => {
    const b = accumulateToRetirement(plan, monthly, currentYear, policy);
    const dec = simulateDecumulation(plan, b, currentYear, 71, 71, useMandatorySpend);
    return { buckets: b, dec, ok: dec.yearsFunded >= dec.horizonYears };
  };

  const base = fundedAt(0);
  let monthly = 0;
  let solvedBuckets = base.buckets;
  let solvedDec = base.dec;

  if (!base.ok) {
    let low = 0;
    let high = 50000;
    for (let i = 0; i < 28; i++) {
      const mid = (low + high) / 2;
      const trial = fundedAt(mid);
      if (trial.ok) {
        high = mid;
        solvedBuckets = trial.buckets;
        solvedDec = trial.dec;
      } else {
        low = mid;
      }
    }
    monthly = (low + high) / 2;
    const final = fundedAt(monthly);
    solvedBuckets = final.buckets;
    solvedDec = final.dec;
  }

  const grid = evaluateConversionGrid(plan, solvedBuckets, currentYear, useMandatorySpend);
  const recommended = grid[0];
  const runnersUp = grid.slice(1, 3);
  const conversionRanking = grid.slice(0, 7);

  const nestEgg = totalInvestable(solvedBuckets);
  const firstPen = solvedDec.curve[0]?.pensionGross ?? 0;
  const { portfolioCurve, annualSpendCurve } = curveFromDecumulation(solvedDec);
  const { portfolioCurve: currentPathPortfolioCurve } = curveFromDecumulation(base.dec);

  // Path with $0 extra personal beyond payroll — shortfall vs nest egg
  const shortfall = Math.max(0, nestEgg - totalInvestable(base.buckets));

  const targetMonthly = useMandatorySpend
    ? plan.mandatoryRetirementSpendMonthly
    : plan.desiredRetirementSpendMonthly;

  let surplusSpend: SurplusSpendResult | undefined;

  if (!base.ok && recommended.yearsFunded >= recommended.horizonYears) {
    // Below target: green dashed = required nest egg at *target* spend → ~$0
    // (solid chart line should be currentPathPortfolioCurve — see MinSavingsPanel).
    surplusSpend = {
      kind: 'required',
      extraMonthlyToday: 0,
      totalMonthlyToday: targetMonthly,
      depletePortfolioCurve: portfolioCurve,
      depleteSpendCurve: annualSpendCurve,
      annualExtraCurve: annualSpendCurve.map(() => 0),
      terminalWealth: recommended.terminalWealth,
    };
  } else if (recommended.yearsFunded >= recommended.horizonYears) {
    surplusSpend = solveMaxSurplusSpend(
      plan,
      solvedBuckets,
      currentYear,
      recommended.conversionAgeHe,
      recommended.conversionAgeShe,
      useMandatorySpend,
      annualSpendCurve
    );
  } else {
    // Even the solved nest egg cannot fund target — max affordable → $0 reference.
    surplusSpend = solveMaxAffordableSpend(
      plan,
      solvedBuckets,
      currentYear,
      recommended.conversionAgeHe,
      recommended.conversionAgeShe,
      useMandatorySpend,
      annualSpendCurve
    );
  }

  return {
    nestEggAtRetirement: nestEgg,
    monthlyPersonalSavingsNeeded: monthly,
    isFundedWithoutExtra: base.ok,
    shortfallFromCurrentPath: shortfall,
    firstYearPensionGross: firstPen,
    regime: recommended.regime,
    recommendedConversion: recommended,
    runnersUp,
    conversionRanking,
    solveConversionAgeHe: 71,
    solveConversionAgeShe: 71,
    allocationPolicy: policy,
    portfolioCurve,
    annualSpendCurve,
    bucketsAtRetirement: solvedBuckets,
    currentPathPortfolioCurve: base.ok ? undefined : currentPathPortfolioCurve,
    surplusSpend,
  };
}

/** @deprecated Demoted — use calculatePlanTargets. Kept for tests that still import it. */
export { calculatePlanTargets as calculateMinimumNestEggReplacement };
