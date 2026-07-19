/**
 * Target engine — source of truth for nest egg / min contribution cards.
 * See docs/explanation/math-model.md.
 */
import {
  AllocationPolicy,
  ContributionType,
  FamilyMember,
  FundingRegime,
  MvDestination,
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
import { deployAnnualContributions, resolveAnnualTfsaLimit, preferDiscretionaryRrspOwner, type RoomState } from './contributionPolicy';
import { rrifMinimumWithdrawal } from './rrifCalc';
import { calculatePersonPensionForAge, DEFAULT_PENSION_CONFIG, survivorCombinedCppAnnual } from './pensionCalc';
import { resolveRetirementHorizon } from './retirementHorizon';
import { calculateHouseholdRetirementTax } from './retirementIncomeTax';
import { oasClawback, DEFAULT_OAS_CLAWBACK_THRESHOLD, DEFAULT_OAS_CLAWBACK_RATE } from './oasClawback';
import { DEFAULT_TAX_CONFIG, marginalIncomeTaxRate } from './taxRates';
import {
  computeSoftCapacity,
  deployDiscretionaryWithSoftLimits,
  resolveExtraContributionMonthly,
} from './excessMoneyGuide';
import { depositForcedDestination } from './mvDeposit';
import { deployDiscretionaryByMvOrder } from './mvDeployPolicy';
import { resolveMvDeployOrders, type MvDeployOrders } from './mvDeployOrders';
import {
  resolveEarnerRoles,
  resolveSurvivorDeceased,
  otherMember,
} from './earnerRoles';
import { estimateRrspRefund } from './rrspRefund';

const MAX_RRSP_ANNUAL = 33720;

export interface DecumulationYearResult {
  ageHe: number;
  ageShe: number;
  spend: number;
  pensionGross: number;
  tax: number;
  portfolioStart: number;
  portfolioEnd: number;
  /** Face-value bucket starts (same year as portfolioStart). */
  tfsaStart: number;
  rrspStart: number;
  nonRegStart: number;
  /** Face-value bucket ends after draws + growth (same year as portfolioEnd). */
  tfsaEnd: number;
  rrspEnd: number;
  nonRegEnd: number;
  shortfall: number;
  rrifHe: number;
  rrifShe: number;
}

/** Per-account face-value curves (n+1 points, aligned with portfolioCurve). */
export interface BucketCurves {
  tfsa: number[];
  rrsp: number[];
  nonReg: number[];
}

/**
 * Min nest-egg face values that fund target spend → ~$0 under different wrappers.
 * All figures are nominal account balances at retirement (not after-tax liquidation).
 */
export interface NestEggToZeroBand {
  /** Scaled solved/projected mix. */
  yourMix: number;
  /** 100% TFSA — tax-free withdrawals (lower bound). */
  allTfsa: number;
  /** 100% RRSP/RRIF — fully taxable withdrawals (upper bound). */
  allRrsp: number;
  yourMixCurve: number[];
  allTfsaCurve: number[];
  allRrspCurve: number[];
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
  /**
   * Face-value portfolio at retirement on the **current** accumulation path
   * (payroll + Extra/ESPP as entered — $0 solver personal). Always the projected egg.
   */
  projectedNestEggAtRetirement: number;
  /** Bucket split for `projectedNestEggAtRetirement`. */
  projectedBucketsAtRetirement: AccountBuckets;
  /**
   * Nest egg on the funding solve (may add personal $/mo when current path is short).
   * Used for shortfall / conversion grid / →$0 band scaling — not the main UI nest-egg card.
   */
  nestEggAtRetirement: number;
  /**
   * @deprecated Prefer `nestEggToZeroBand.yourMix`. Min nest egg on scaled solved mix → ~$0.
   */
  requiredNestEggToZero: number;
  /** Portfolio path for `requiredNestEggToZero` under target spend (n+1 points). */
  requiredNestEggToZeroCurve: number[];
  /**
   * Tax-geometry band for target spend → ~$0 at horizon (nominal face value @ retirement):
   * allTfsa (lower) ≤ yourMix ≤ allRrsp (upper).
   */
  nestEggToZeroBand: NestEggToZeroBand;
  monthlyPersonalSavingsNeeded: number;
  /**
   * False only if Extra-$/mo search could not fund conversion @71 even after
   * expanding past any practical amount (safety max). Not a $50k product cap.
   */
  fundingSolveReached: boolean;
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
  /** Bucket face-value curves aligned with `portfolioCurve` (solved / recommended path). */
  bucketCurves: BucketCurves;
  bucketsAtRetirement: AccountBuckets;
  /**
   * When current path cannot fund target spend: portfolio under target spend with $0 extra savings
   * (dies early). Chart solid line uses this; green dashed = required path (`portfolioCurve`).
   */
  currentPathPortfolioCurve?: number[];
  /** Bucket curves aligned with `currentPathPortfolioCurve` when present. */
  currentPathBucketCurves?: BucketCurves;
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
  const h = resolveRetirementHorizon(plan);
  const horizon = h.retirementYears;
  const spendMonthly = useMandatorySpend
    ? plan.mandatoryRetirementSpendMonthly
    : plan.desiredRetirementSpendMonthly;
  const r = plan.investmentReturnRate;
  const g = plan.inflationRate;
  const taxConfig0 = plan.taxConfig || DEFAULT_TAX_CONFIG;
  const useYounger = plan.useYoungerSpouseRrifAge ?? false;
  const survivorOn = plan.survivorToggle ?? false;
  const survivorAt = h.survivorYearIndex;
  const survivorSpendFactor = plan.survivorSpendFactor ?? 0.70;
  const roles = resolveEarnerRoles(plan);
  const deceased = resolveSurvivorDeceased(plan);
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
    const tfsaStart = buckets.tfsaHe + buckets.tfsaShe;
    const rrspStart = buckets.rrspHe + buckets.rrspShe;
    const nonRegStart = buckets.nonReg;

    const survivorEvent = survivorOn && i >= survivorAt;
    const heAlive = !(survivorEvent && deceased === FamilyMember.HE);
    const sheAlive = !(survivorEvent && deceased === FamilyMember.SHE);
    // After the survivor event a single survivor spends less than the couple.
    const yearSpend = spend * (survivorEvent ? survivorSpendFactor : 1);

    // Both-alive pensions; survivor logic layered on top below.
    const hePenFull = calculatePersonPensionForAge(plan.heInput, currentYear, ageHe, yearPensionCfg, yearTax);
    const shePenFull = calculatePersonPensionForAge(plan.sheInput, currentYear, ageShe, yearPensionCfg, yearTax);

    let heOas: number;
    let sheOas: number;
    let heCpp: number;
    let sheCpp: number;
    if (heAlive && sheAlive) {
      heOas = hePenFull.oasAnnual;
      sheOas = shePenFull.oasAnnual;
      heCpp = hePenFull.cppAnnual;
      sheCpp = shePenFull.cppAnnual;
    } else if (sheAlive) {
      heOas = 0;
      heCpp = 0;
      sheOas = shePenFull.oasAnnual;
      sheCpp = survivorCombinedCppAnnual(
        shePenFull.cppAnnual,
        hePenFull.cppAnnual,
        yearPensionCfg.maxCppMonthly * 12
      );
    } else {
      sheOas = 0;
      sheCpp = 0;
      heOas = hePenFull.oasAnnual;
      heCpp = survivorCombinedCppAnnual(
        hePenFull.cppAnnual,
        shePenFull.cppAnnual,
        yearPensionCfg.maxCppMonthly * 12
      );
    }

    const heConverted = ageHe >= conversionAgeHe;
    const sheConverted = ageShe >= conversionAgeShe;
    const heRrifAge = rrifAgeFor(ageHe, ageShe, useYounger);
    const sheRrifAge = rrifAgeFor(ageShe, ageHe, useYounger);
    const rrifMinHe = heConverted ? rrifMinimumWithdrawal(buckets.rrspHe, heRrifAge) : 0;
    const rrifMinShe = sheConverted ? rrifMinimumWithdrawal(buckets.rrspShe, sheRrifAge) : 0;

    // Binary search gross RRIF/RRSP draws above mins so net covers spend
    let low = 0;
    let high = yearSpend * 3 + totalInvestable(buckets) + 1;
    let bestTax = 0;
    let bestShortfall = yearSpend;
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
      let bridgeNeed = Math.max(0, yearSpend - roughNetMins);
      if (bridgeNeed > 0) {
        const first =
          trial.tfsaHe === trial.tfsaShe
            ? roles.secondary
            : trial.tfsaHe > trial.tfsaShe
              ? FamilyMember.HE
              : FamilyMember.SHE;
        for (const who of [first, otherMember(first)]) {
          const key =
            who === FamilyMember.HE ? 'tfsaHe' : 'tfsaShe';
          const take = Math.min(trial[key], bridgeNeed);
          trial[key] -= take;
          tfsaDraw += take;
          bridgeNeed -= take;
        }
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
      // Residual (e.g. all-TFSA nest egg): more tax-free draws when taxable buckets are empty
      if (extraLeft > 0) {
        const first =
          trial.tfsaHe === trial.tfsaShe
            ? roles.secondary
            : trial.tfsaHe > trial.tfsaShe
              ? FamilyMember.HE
              : FamilyMember.SHE;
        for (const who of [first, otherMember(first)]) {
          const key =
            who === FamilyMember.HE ? 'tfsaHe' : 'tfsaShe';
          const take = Math.min(trial[key], extraLeft);
          trial[key] -= take;
          tfsaDraw += take;
          extraLeft -= take;
        }
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
      const shortfall = Math.max(0, yearSpend - netCash);

      if (shortfall <= 0.5 && netCash > yearSpend + 1) {
        const surplus = netCash - yearSpend;
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
      bestShortfall = Math.max(0, yearSpend - netCash);
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
      spend: yearSpend,
      pensionGross: heOas + heCpp + sheOas + sheCpp,
      tax: bestTax,
      portfolioStart,
      portfolioEnd,
      tfsaStart,
      rrspStart,
      nonRegStart,
      tfsaEnd: after.tfsaHe + after.tfsaShe,
      rrspEnd: after.rrspHe + after.rrspShe,
      nonRegEnd: after.nonReg,
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
  policy: AllocationPolicy,
  opts?: {
    useMvDeploy?: boolean;
    /** Precomputed orders — required for perf when called in a binary search loop. */
    mvOrders?: MvDeployOrders;
  }
): AccountBuckets {
  const useMvDeploy = opts?.useMvDeploy !== false;

  // Phase 3B: use caller-supplied orders, else resolve once (cached).
  let heOrder: MvDestination[] | null = null;
  let sheOrder: MvDestination[] | null = null;
  if (useMvDeploy) {
    const orders = opts?.mvOrders ?? resolveMvDeployOrders(plan, _currentYear);
    heOrder = orders.heOrder;
    sheOrder = orders.sheOrder;
  }

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
  const salaryG = plan.salaryGrowthRate ?? 0.01;
  const inflateTfsa = !!plan.inflateAnnualTfsaLimit;
  const roles = resolveEarnerRoles(plan);
  let inflationMult = 1;
  let salaryMult = 1;
  /** Lagged gross RRSP tax refund by contributor (year N → redeploy year N+1). */
  let pendingHeRefundGross = 0;
  let pendingSheRefundGross = 0;
  const refundReinvestRate = plan.esppRefundSaveRate ?? 0.5;

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

    const heSalary = heWorking ? plan.heInput.salary * salaryMult : 0;
    const sheSalary = sheWorking ? plan.sheInput.salary * salaryMult : 0;
    const matchHe = heSalary * ((plan.heInput.rrspEmployerRate || 0) / 100);
    const matchShe = sheSalary * ((plan.sheInput.rrspEmployerRate || 0) / 100);
    const heEmp = heWorking
      ? plan.heInput.rrspEmployeeType === ContributionType.PERCENTAGE
        ? heSalary * (plan.heInput.rrspEmployeeValue / 100)
        : plan.heInput.rrspEmployeeValue * 12 * salaryMult
      : 0;
    const sheEmp = sheWorking
      ? plan.sheInput.rrspEmployeeType === ContributionType.PERCENTAGE
        ? sheSalary * (plan.sheInput.rrspEmployeeValue / 100)
        : plan.sheInput.rrspEmployeeValue * 12 * salaryMult
      : 0;

    const heExtraMo = heWorking ? resolveExtraContributionMonthly(plan.heInput) : 0;
    const sheExtraMo = sheWorking ? resolveExtraContributionMonthly(plan.sheInput) : 0;
    const heExtraAnnual = heExtraMo * 12 * inflationMult;
    const sheExtraAnnual = sheExtraMo * 12 * inflationMult;

    const heEsppCash = heWorking
      ? heSalary * ((plan.heInput.esppEmployeeRate || 0) / 100) +
        heSalary * ((plan.heInput.esppEmployerRate || 0) / 100)
      : 0;
    const sheEsppCash = sheWorking
      ? sheSalary * ((plan.sheInput.esppEmployeeRate || 0) / 100) +
        sheSalary * ((plan.sheInput.esppEmployerRate || 0) / 100)
      : 0;
    const depositEspp = !!plan.depositEsppToRrsp;
    const heEsppToPayroll = depositEspp ? heEsppCash : 0;
    const sheEsppToPayroll = depositEspp ? sheEsppCash : 0;
    const heEsppSale = depositEspp ? 0 : heEsppCash;
    const sheEsppSale = depositEspp ? 0 : sheEsppCash;

    // Lagged RRSP refund reinvestment (Extra + ESPP that landed in RRSP last year).
    const heRefundRedeposit = heWorking
      ? pendingHeRefundGross * refundReinvestRate
      : 0;
    const sheRefundRedeposit = sheWorking
      ? pendingSheRefundGross * refundReinvestRate
      : 0;

    // Backsolve personal monthly (today's $) joins discretionary after TFSA race (never lifestyle)
    const solverExtra = heWorking || sheWorking ? personalMonthlyToday * 12 * inflationMult : 0;

    // RRSP new room from this year's income — credited for use as we go (simplified)
    const newRrspHe = heWorking ? Math.min(MAX_RRSP_ANNUAL * inflationMult, heSalary * 0.18) : 0;
    const newRrspShe = sheWorking ? Math.min(MAX_RRSP_ANNUAL * inflationMult, sheSalary * 0.18) : 0;
    rooms = {
      ...rooms,
      rrspHe: rooms.rrspHe + newRrspHe,
      rrspShe: rooms.rrspShe + newRrspShe,
    };

    const grown = growBuckets(buckets, r); // grow opening balance; contributions earn from next year

    // Soft capacity He+She — uses opening RRSP before this year's discretionary
    const softHe = computeSoftCapacity(FamilyMember.HE, plan.heInput, grown.rrspHe, plan, _currentYear + t);
    const softShe = computeSoftCapacity(FamilyMember.SHE, plan.sheInput, grown.rrspShe, plan, _currentYear + t);
    const preferRrsp =
      preferDiscretionaryRrspOwner({
        softHe: softHe.level,
        softShe: softShe.level,
        heSalary,
        sheSalary,
      }) ?? FamilyMember.HE;

    const payrollDeploy = deployAnnualContributions({
      personalInvestable: 0,
      payrollRrspHe: heEmp + heEsppToPayroll,
      payrollRrspShe: sheEmp + sheEsppToPayroll,
      employerMatchHe: matchHe,
      employerMatchShe: matchShe,
      policy,
      rooms,
      buckets: grown,
      preferRrsp,
    });
    buckets = payrollDeploy.buckets;
    rooms = payrollDeploy.rooms;

    const solverExtraHe =
      roles.primary === FamilyMember.HE ? solverExtra : 0;
    const solverExtraShe =
      roles.primary === FamilyMember.SHE ? solverExtra : 0;
    let discHeOwn = 0;
    let discSheOwn = 0;
    let discSpousal = 0;
    if (useMvDeploy && heOrder && sheOrder) {
      const disc = deployDiscretionaryByMvOrder({
        heExtraAnnual: heExtraAnnual + solverExtraHe,
        sheExtraAnnual: sheExtraAnnual + solverExtraShe,
        heEsppSaleAnnual: heEsppSale,
        sheEsppSaleAnnual: sheEsppSale,
        heRefundRedepositAnnual: heRefundRedeposit,
        sheRefundRedepositAnnual: sheRefundRedeposit,
        rooms,
        buckets,
        heOrder,
        sheOrder,
        spousalContributor: roles.primary,
      });
      buckets = disc.buckets;
      rooms = disc.rooms;
      discHeOwn = disc.heSplit.toRrspOwn;
      discSheOwn = disc.sheSplit.toRrspOwn;
      discSpousal = disc.toSpousal;
    } else {
      const disc = deployDiscretionaryWithSoftLimits({
        heExtraAnnual: heExtraAnnual + solverExtraHe,
        sheExtraAnnual: sheExtraAnnual + solverExtraShe,
        heEsppSaleAnnual: heEsppSale,
        sheEsppSaleAnnual: sheEsppSale,
        heRefundRedepositAnnual: heRefundRedeposit,
        sheRefundRedepositAnnual: sheRefundRedeposit,
        rooms,
        buckets,
        softCapacityHe: softHe.level,
        softCapacityShe: softShe.level,
        heSalary,
        sheSalary,
        optimizeSpousal: !!plan.optimizeSpousalRrsp && sheWorking && heWorking,
        spousalContributor: roles.primary,
      });
      buckets = disc.buckets;
      rooms = disc.rooms;
      discHeOwn = disc.heSplit.toRrspOwn;
      discSheOwn = disc.sheSplit.toRrspOwn;
      discSpousal = disc.toSpousal;
    }

    const refundEst = estimateRrspRefund({
      deposits: {
        heOwn: discHeOwn,
        sheOwn: discSheOwn,
        spousal: discSpousal,
        hePayrollEspp: heEsppToPayroll,
        shePayrollEspp: sheEsppToPayroll,
      },
      heSalary,
      sheSalary,
      spousalContributor: roles.primary,
      taxConfig: plan.taxConfig ?? DEFAULT_TAX_CONFIG,
      reinvestRate: refundReinvestRate,
    });
    pendingHeRefundGross = heWorking ? refundEst.byContributorGross.he : 0;
    pendingSheRefundGross = sheWorking ? refundEst.byContributorGross.she : 0;

    // Excess MV probe: recurring annual deposit forced into one destination (not cascade).
    const probe = plan.mvProbe;
    if (probe && probe.annualToday > 0) {
      const streamWorking =
        probe.stream === FamilyMember.HE ? heWorking : sheWorking;
      if (streamWorking) {
        const forced = depositForcedDestination(
          buckets,
          rooms,
          probe.destination,
          probe.annualToday * inflationMult,
          roles.primary
        );
        buckets = forced.buckets;
        rooms = forced.rooms;

        // Extra is after-tax cash, but an RRSP contribution returns a tax refund
        // (deduction × contributor marginal rate) that gets reinvested. Without this
        // credit the probe deposits equal gross dollars everywhere, then RRSP alone is
        // taxed on RRIF withdrawal — so RRSP can never rank above non-reg even with
        // green RRIF headroom. Reinvest the refund into non-reg for a fair comparison.
        // Only the portion that actually lands in an RRSP earns a refund — the part that
        // spilled to non-reg (room exhausted) was never deducted. Crediting the spill too
        // over-rewards a room-limited destination (e.g. own RRSP) and lets it wrongly beat
        // a room-ample one (e.g. Spousal via the primary's larger room).
        const rrspContributor =
          probe.destination === MvDestination.RRSP_HE
            ? FamilyMember.HE
            : probe.destination === MvDestination.RRSP_SHE
              ? FamilyMember.SHE
              : probe.destination === MvDestination.SPOUSAL
                ? roles.primary
                : null;
        const rrspContribution = forced.deposited - forced.spilledToNonReg;
        if (rrspContributor && rrspContribution > 0) {
          const contributorSalary =
            rrspContributor === FamilyMember.HE ? heSalary : sheSalary;
          const mRate = marginalIncomeTaxRate(
            Math.max(0, contributorSalary),
            plan.taxConfig ?? DEFAULT_TAX_CONFIG
          );
          const refund = rrspContribution * mRate;
          if (refund > 0) {
            buckets = { ...buckets, nonReg: buckets.nonReg + refund };
          }
        }
      }
    }

    inflationMult *= 1 + g;
    salaryMult *= 1 + salaryG;
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
  bucketCurves: BucketCurves;
} {
  const portfolioCurve = dec.curve.map(c => c.portfolioStart);
  const tfsa = dec.curve.map(c => c.tfsaStart);
  const rrsp = dec.curve.map(c => c.rrspStart);
  const nonReg = dec.curve.map(c => c.nonRegStart);
  if (dec.curve.length) {
    const last = dec.curve[dec.curve.length - 1];
    portfolioCurve.push(last.portfolioEnd);
    tfsa.push(last.tfsaEnd);
    rrsp.push(last.rrspEnd);
    nonReg.push(last.nonRegEnd);
  }
  return {
    portfolioCurve,
    annualSpendCurve: dec.curve.map(c => c.spend),
    bucketCurves: { tfsa, rrsp, nonReg },
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

function scaleInvestableBuckets(b: AccountBuckets, factor: number): AccountBuckets {
  return {
    tfsaHe: b.tfsaHe * factor,
    tfsaShe: b.tfsaShe * factor,
    rrspHe: b.rrspHe * factor,
    rrspShe: b.rrspShe * factor,
    nonReg: b.nonReg * factor,
    cashExcluded: b.cashExcluded,
  };
}

/** He share of investable wealth (non-reg split 50/50). */
function personInvestableShares(b: AccountBuckets): { he: number; she: number } {
  const he = b.tfsaHe + b.rrspHe + b.nonReg * 0.5;
  const she = b.tfsaShe + b.rrspShe + b.nonReg * 0.5;
  const t = he + she;
  if (t <= 0) return { he: 0.5, she: 0.5 };
  return { he: he / t, she: she / t };
}

function bucketsAllTfsa(total: number, shares: { he: number; she: number }): AccountBuckets {
  return {
    tfsaHe: total * shares.he,
    tfsaShe: total * shares.she,
    rrspHe: 0,
    rrspShe: 0,
    nonReg: 0,
    cashExcluded: 0,
  };
}

function bucketsAllRrsp(total: number, shares: { he: number; she: number }): AccountBuckets {
  return {
    tfsaHe: 0,
    tfsaShe: 0,
    rrspHe: total * shares.he,
    rrspShe: total * shares.she,
    nonReg: 0,
    cashExcluded: 0,
  };
}

/**
 * Binary-search min nest egg (face value) that funds the horizon under a bucket builder.
 */
export function solveMinNestEggToZero(
  plan: RetirementPlan,
  buildBuckets: (total: number) => AccountBuckets,
  currentYear: number,
  conversionAgeHe: number,
  conversionAgeShe: number,
  useMandatorySpend: boolean,
  seedTotal: number = 2_000_000
): { nestEgg: number; portfolioCurve: number[]; terminalWealth: number } {
  const empty = { nestEgg: 0, portfolioCurve: [0], terminalWealth: 0 };
  if (seedTotal < 0) return empty;

  const trial = (total: number) =>
    simulateDecumulation(
      plan,
      buildBuckets(Math.max(0, total)),
      currentYear,
      conversionAgeHe,
      conversionAgeShe,
      useMandatorySpend
    );

  let low = 0;
  let high = Math.max(1, seedTotal);
  let guard = 0;
  while (guard++ < 16) {
    const hi = trial(high);
    if (hi.yearsFunded >= hi.horizonYears) break;
    high *= 2;
    if (high > 50_000_000) break;
  }

  const hiCheck = trial(high);
  if (hiCheck.yearsFunded < hiCheck.horizonYears) {
    const { portfolioCurve } = curveFromDecumulation(hiCheck);
    return { nestEgg: high, portfolioCurve, terminalWealth: hiCheck.terminalWealth };
  }

  let bestTotal = high;
  let bestDec = hiCheck;
  for (let i = 0; i < 28; i++) {
    const mid = (low + high) / 2;
    const dec = trial(mid);
    if (dec.yearsFunded >= dec.horizonYears) {
      high = mid;
      bestTotal = mid;
      bestDec = dec;
    } else {
      low = mid;
    }
  }

  const { portfolioCurve } = curveFromDecumulation(bestDec);
  return {
    nestEgg: bestTotal,
    portfolioCurve,
    terminalWealth: bestDec.terminalWealth,
  };
}

/**
 * Min nest egg on the reference mix (scaled) that funds target spend → ~$0.
 */
export function solveRequiredNestEggToZero(
  plan: RetirementPlan,
  referenceBuckets: AccountBuckets,
  currentYear: number,
  conversionAgeHe: number,
  conversionAgeShe: number,
  useMandatorySpend: boolean
): { nestEgg: number; portfolioCurve: number[]; terminalWealth: number } {
  const baseTotal = totalInvestable(referenceBuckets);
  if (baseTotal <= 0) {
    return { nestEgg: 0, portfolioCurve: [0], terminalWealth: 0 };
  }
  return solveMinNestEggToZero(
    plan,
    total => scaleInvestableBuckets(referenceBuckets, total / baseTotal),
    currentYear,
    conversionAgeHe,
    conversionAgeShe,
    useMandatorySpend,
    baseTotal
  );
}

/**
 * Tax-geometry band: all-TFSA ≤ your-mix ≤ all-RRSP for target spend → ~$0.
 */
export function solveNestEggToZeroBand(
  plan: RetirementPlan,
  referenceBuckets: AccountBuckets,
  currentYear: number,
  conversionAgeHe: number,
  conversionAgeShe: number,
  useMandatorySpend: boolean
): NestEggToZeroBand {
  const shares = personInvestableShares(referenceBuckets);
  const seed = Math.max(totalInvestable(referenceBuckets), 500_000);

  const mix = solveRequiredNestEggToZero(
    plan,
    referenceBuckets,
    currentYear,
    conversionAgeHe,
    conversionAgeShe,
    useMandatorySpend
  );
  const tfsa = solveMinNestEggToZero(
    plan,
    total => bucketsAllTfsa(total, shares),
    currentYear,
    conversionAgeHe,
    conversionAgeShe,
    useMandatorySpend,
    seed
  );
  const rrsp = solveMinNestEggToZero(
    plan,
    total => bucketsAllRrsp(total, shares),
    currentYear,
    conversionAgeHe,
    conversionAgeShe,
    useMandatorySpend,
    seed
  );

  return {
    yourMix: mix.nestEgg,
    allTfsa: tfsa.nestEgg,
    allRrsp: rrsp.nestEgg,
    yourMixCurve: mix.portfolioCurve,
    allTfsaCurve: tfsa.portfolioCurve,
    allRrspCurve: rrsp.portfolioCurve,
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
 * Optional override for the **current-path** nest-egg / funded check.
 * Dashboard passes cash-aware projection so children / leave reduce projected wealth.
 *
 * The Extra-$/mo funding binary-search always uses idealized `accumulateToRetirement`
 * so Solver Extra is assumed investable (otherwise cash cuts make Extra undeployable
 * and the search falsely sticks at a hard ceiling).
 */
export type PlanAccumulateFn = (
  plan: RetirementPlan,
  personalMonthlyToday: number,
  currentYear: number
) => AccountBuckets;

/**
 * Two-step target solve:
 * 1) Min personal $/mo under conversion @71 (idealized Extra — no hard $50k cap)
 * 2) Re-rank conversion grid at solved wealth
 */
export function calculatePlanTargets(
  plan: RetirementPlan,
  currentYear: number = new Date().getFullYear(),
  useMandatorySpend: boolean = false,
  opts?: { accumulate?: PlanAccumulateFn }
): TargetEngineResult {
  const policy = AllocationPolicy.TFSA_FIRST;
  // Rank MV once for this solve — do not re-rank inside every binary-search accumulate.
  const mvOrders = resolveMvDeployOrders(plan, currentYear);

  const accumulateIdealized = (p: RetirementPlan, monthly: number, year: number) =>
    accumulateToRetirement(p, monthly, year, policy, {
      useMvDeploy: true,
      mvOrders,
    });

  // Current-path projection (may be cash-aware from Dashboard).
  const accumulateCurrent = opts?.accumulate ?? accumulateIdealized;

  const decumulateAt71 = (buckets: AccountBuckets) =>
    simulateDecumulation(plan, buckets, currentYear, 71, 71, useMandatorySpend);

  const baseBuckets = accumulateCurrent(plan, 0, currentYear);
  const baseDec = decumulateAt71(baseBuckets);
  const baseOk = baseDec.yearsFunded >= baseDec.horizonYears;

  // Start from the realistic current-path buckets. Add only the marginal
  // wealth generated by solver Extra, which is assumed investable.
  const idealizedBaseBuckets = accumulateIdealized(plan, 0, currentYear);
  const fundedAt = (monthly: number) => {
    const withExtra = accumulateIdealized(plan, monthly, currentYear);
    const b: AccountBuckets = {
      tfsaHe: Math.max(0, baseBuckets.tfsaHe + withExtra.tfsaHe - idealizedBaseBuckets.tfsaHe),
      tfsaShe: Math.max(0, baseBuckets.tfsaShe + withExtra.tfsaShe - idealizedBaseBuckets.tfsaShe),
      rrspHe: Math.max(0, baseBuckets.rrspHe + withExtra.rrspHe - idealizedBaseBuckets.rrspHe),
      rrspShe: Math.max(0, baseBuckets.rrspShe + withExtra.rrspShe - idealizedBaseBuckets.rrspShe),
      nonReg: Math.max(0, baseBuckets.nonReg + withExtra.nonReg - idealizedBaseBuckets.nonReg),
      cashExcluded: baseBuckets.cashExcluded,
    };
    const dec = decumulateAt71(b);
    return { buckets: b, dec, ok: dec.yearsFunded >= dec.horizonYears };
  };

  // Safety only — never shown as "the answer". Expand until funded.
  const SOLVE_EXPAND_MAX = 1_000_000;

  let monthly = 0;
  let solvedBuckets = baseBuckets;
  let solvedDec = baseDec;
  let fundingSolveReached = baseOk;

  if (!baseOk) {
    let low = 0;
    let high = 5_000;
    // Expand upper bound until @71 funds (no $50k product cap).
    let guard = 0;
    while (guard++ < 24) {
      const hi = fundedAt(high);
      if (hi.ok) {
        solvedBuckets = hi.buckets;
        solvedDec = hi.dec;
        fundingSolveReached = true;
        break;
      }
      low = high;
      high *= 2;
      if (high > SOLVE_EXPAND_MAX) break;
    }

    if (fundingSolveReached) {
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
      // Use last known-good upper bound — midpoint of [low, high] often still fails
      // and would incorrectly flip fundingSolveReached / show "> $X could not fund".
      monthly = high;
      const final = fundedAt(monthly);
      solvedBuckets = final.buckets;
      solvedDec = final.dec;
      fundingSolveReached = final.ok;
    } else {
      // Truly unreachable even at expand max — report the max tried, flag not reached.
      monthly = SOLVE_EXPAND_MAX;
      const final = fundedAt(monthly);
      solvedBuckets = final.buckets;
      solvedDec = final.dec;
      fundingSolveReached = final.ok;
    }
  }

  const grid = evaluateConversionGrid(plan, solvedBuckets, currentYear, useMandatorySpend);
  const recommended = grid[0];
  const runnersUp = grid.slice(1, 3);
  const conversionRanking = grid.slice(0, 7);

  const nestEgg = totalInvestable(solvedBuckets);
  const firstPen = solvedDec.curve[0]?.pensionGross ?? 0;
  const {
    portfolioCurve,
    annualSpendCurve,
    bucketCurves,
  } = curveFromDecumulation(solvedDec);
  const {
    portfolioCurve: currentPathPortfolioCurve,
    bucketCurves: currentPathBucketCurves,
  } = curveFromDecumulation(baseDec);

  // Nest-egg gap: funding-solve wealth vs current-path projected wealth.
  const shortfall = Math.max(0, nestEgg - totalInvestable(baseBuckets));

  const targetMonthly = useMandatorySpend
    ? plan.mandatoryRetirementSpendMonthly
    : plan.desiredRetirementSpendMonthly;

  let surplusSpend: SurplusSpendResult | undefined;

  if (!baseOk && recommended.yearsFunded >= recommended.horizonYears) {
    // Below target: green dashed = required nest egg at *target* spend → ~$0
    surplusSpend = {
      kind: 'required',
      extraMonthlyToday: monthly,
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

  // Tax-geometry band: all-TFSA ≤ your-mix ≤ all-RRSP for target spend → ~$0.
  const nestEggToZeroBand = solveNestEggToZeroBand(
    plan,
    solvedBuckets,
    currentYear,
    recommended.conversionAgeHe,
    recommended.conversionAgeShe,
    useMandatorySpend
  );

  return {
    projectedNestEggAtRetirement: totalInvestable(baseBuckets),
    projectedBucketsAtRetirement: baseBuckets,
    nestEggAtRetirement: nestEgg,
    requiredNestEggToZero: nestEggToZeroBand.yourMix,
    requiredNestEggToZeroCurve: nestEggToZeroBand.yourMixCurve,
    nestEggToZeroBand,
    monthlyPersonalSavingsNeeded: monthly,
    fundingSolveReached,
    isFundedWithoutExtra: baseOk,
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
    bucketCurves,
    bucketsAtRetirement: solvedBuckets,
    currentPathPortfolioCurve: baseOk ? undefined : currentPathPortfolioCurve,
    currentPathBucketCurves: baseOk ? undefined : currentPathBucketCurves,
    surplusSpend,
  };
}

/** @deprecated Demoted — use calculatePlanTargets. Kept for tests that still import it. */
export { calculatePlanTargets as calculateMinimumNestEggReplacement };
