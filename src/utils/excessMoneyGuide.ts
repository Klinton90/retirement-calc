/**
 * Excess Money Advisor — soft RRSP capacity + Extra cash allocator.
 *
 * Symmetric ownership: each stream fills own TFSA, then spouse TFSA, then
 * legal own/spousal RRSP destinations by marginal value.
 *
 * Soft capacity uses RRIF-min headroom at 71 vs OAS clawback threshold.
 * Not financial advice — see docs/explanation/math-model.md §3.3.
 */

import {
  AllocationPolicy,
  ContributionType,
  FamilyMember,
  type AccountBuckets,
  type PersonInput,
  type RetirementPlan,
} from '../types/calculator';
import { resolveBuckets } from './accountBuckets';
import { type RoomState } from './contributionPolicy';
import { preferDiscretionaryRrspOwner } from './contributionPolicy';
import {
  DEFAULT_OAS_CLAWBACK_THRESHOLD,
  DEFAULT_OAS_CLAWBACK_RATE,
  oasClawback,
} from './oasClawback';
import { calculatePersonPensionForAge, DEFAULT_PENSION_CONFIG } from './pensionCalc';
import { rrifMinimumWithdrawal } from './rrifCalc';
import {
  rankMvForStream,
  emptyMvRanking,
  topDestinationLabel,
  type MvRankingResult,
} from './marginalValueGuide';
import { resolveEarnerRoles, otherMember } from './earnerRoles';
import {
  deployDiscretionaryByMvOrder,
  fallbackMvOrder,
  withOwnershipTfsaFirst,
} from './mvDeployPolicy';
import { estimateRrspRefund } from './rrspRefund';
import { DEFAULT_TAX_CONFIG } from './taxRates';

/** Headroom ≥ this → green (still prefer spousal / He RRSP). */
export const SOFT_CAPACITY_GREEN_HEADROOM = 25_000;

export enum SoftCapacityLevel {
  GREEN = 'GREEN',
  AMBER = 'AMBER',
  RED = 'RED',
}

export interface SoftCapacity {
  member: FamilyMember;
  /** clawThreshold − (CPP + OAS + RRIF_min @71). Negative = already into clawback territory. */
  headroomAt71: number;
  level: SoftCapacityLevel;
  /** Informational clawback $ if income = CPP+OAS+RRIF_min. */
  oasClawbackAt71: number;
  estimatedRrspAt71: number;
}

/** Annual CAD destinations for one Extra (or residual after TFSA) stream. */
export interface DestinationSplit {
  /** toTfsaHe + toTfsaShe */
  toTfsa: number;
  toTfsaHe: number;
  toTfsaShe: number;
  /** Spousal RRSP — primary-earner deduction / secondary-earner ownership. */
  toSpousal: number;
  toRrspOwn: number;
  toNonReg: number;
}

export type CrowdingSource = 'extra' | 'espp' | 'refund';

export interface ExcessMoneyGuideResult {
  heExtraMonthly: number;
  sheExtraMonthly: number;
  heSplit: DestinationSplit;
  sheSplit: DestinationSplit;
  /** Same Extra amounts with TFSA room forced to 0 (post-exhaustion routing). */
  heSplitAfterTfsaFull: DestinationSplit;
  sheSplitAfterTfsaFull: DestinationSplit;
  softCapacityHe: SoftCapacity;
  softCapacityShe: SoftCapacity;
  /** First calendar year when household TFSA room is exhausted after annual grants + fills; null if never in horizon. */
  tfsaExhaustionYear: number | null;
  yearsUntilTfsaExhaustion: number | null;
  crowdingWinner: CrowdingSource | null;
  esppCashAnnual: number;
  estimatedRefundRedepositAnnual: number;
  rooms: RoomState;
  recommendation: string;
  /** True when further RRSP/spousal is framed as tax optimization, not funding need. */
  isTaxOptimizationFraming: boolean;
  /** Marginal-value rankings (ADR 0003) — drive Excess recommendation copy / suggested splits. */
  mvHe: MvRankingResult;
  mvShe: MvRankingResult;
  /** Actual this-year Extra + ESPP-sale + saved-refund pools deployed together by MV. */
  combinedMvRouting: {
    hePoolAnnual: number;
    shePoolAnnual: number;
    totalPoolAnnual: number;
    toTfsaHe: number;
    toTfsaShe: number;
    toRrspHe: number;
    toRrspShe: number;
    toSpousal: number;
    toNonReg: number;
  };
}

const MAX_RRSP_ANNUAL = 33720;

/** Resolve Extra $/mo: prefer new field; else migrate old TFSA+RRSP destination fields. */
export function resolveExtraContributionMonthly(p: PersonInput): number {
  if (p.extraContributionMonthly !== undefined && p.extraContributionMonthly !== null) {
    return Math.max(0, p.extraContributionMonthly);
  }
  return Math.max(0, (p.otherSavingsTfsaMonthly || 0) + (p.otherSavingsRrspMonthly || 0));
}

export function softCapacityLevel(headroom: number): SoftCapacityLevel {
  if (headroom >= SOFT_CAPACITY_GREEN_HEADROOM) return SoftCapacityLevel.GREEN;
  if (headroom >= 0) return SoftCapacityLevel.AMBER;
  return SoftCapacityLevel.RED;
}

function payrollRrspAnnual(salary: number, type: ContributionType, value: number): number {
  return type === ContributionType.PERCENTAGE ? (salary * value) / 100 : value * 12;
}

function emptySplit(): DestinationSplit {
  return { toTfsa: 0, toTfsaHe: 0, toTfsaShe: 0, toSpousal: 0, toRrspOwn: 0, toNonReg: 0 };
}

function creditTfsa(into: DestinationSplit, who: FamilyMember, amt: number) {
  if (amt <= 0) return;
  if (who === FamilyMember.HE) into.toTfsaHe += amt;
  else into.toTfsaShe += amt;
  into.toTfsa += amt;
}

/**
 * Estimate RRSP balance at age 71: grow current + remaining payroll/match contributions.
 * Coarse — soft capacity traffic light only.
 */
function estimateRrspAt71(
  person: PersonInput,
  rrspNow: number,
  returnRate: number,
  salaryGrowth: number
): number {
  const yearsTo71 = Math.max(0, 71 - person.age);
  let bal = Math.max(0, rrspNow);
  let salary = person.salary;
  for (let y = 0; y < yearsTo71; y++) {
    bal *= 1 + returnRate;
    if (person.age + y < person.retirementAge) {
      const emp = payrollRrspAnnual(salary, person.rrspEmployeeType, person.rrspEmployeeValue);
      const match = salary * ((person.rrspEmployerRate || 0) / 100);
      bal += emp + match;
      salary *= 1 + salaryGrowth;
    }
  }
  return bal;
}

export function computeSoftCapacity(
  member: FamilyMember,
  person: PersonInput,
  rrspNow: number,
  plan: RetirementPlan,
  currentYear: number
): SoftCapacity {
  const r = plan.investmentReturnRate;
  const salaryG = plan.salaryGrowthRate ?? 0.01;
  const estimatedRrspAt71 = estimateRrspAt71(person, rrspNow, r, salaryG);
  const rrifMin = rrifMinimumWithdrawal(estimatedRrspAt71, 71);
  const yearsTo71 = Math.max(0, 71 - person.age);
  const inflationMult = Math.pow(1 + plan.inflationRate, yearsTo71);
  const penCfg = {
    ...DEFAULT_PENSION_CONFIG,
    maxCppMonthly: DEFAULT_PENSION_CONFIG.maxCppMonthly * inflationMult,
    maxOasMonthly: DEFAULT_PENSION_CONFIG.maxOasMonthly * inflationMult,
  };
  const pen = calculatePersonPensionForAge(person, currentYear + yearsTo71, 71, penCfg, plan.taxConfig);
  const threshold = DEFAULT_OAS_CLAWBACK_THRESHOLD * inflationMult;
  const incomeAtMin = pen.cppAnnual + pen.oasAnnual + rrifMin;
  const headroomAt71 = threshold - incomeAtMin;
  const claw = oasClawback(pen.oasAnnual, incomeAtMin, threshold, DEFAULT_OAS_CLAWBACK_RATE);
  return {
    member,
    headroomAt71,
    level: softCapacityLevel(headroomAt71),
    oasClawbackAt71: claw.clawback,
    estimatedRrspAt71,
  };
}

/** Consume TFSA owner-first, with legal cross-spouse spill in both directions. */
export function consumeTfsaForExtra(
  rooms: RoomState,
  heExtraAnnual: number,
  sheExtraAnnual: number,
  primary: FamilyMember = FamilyMember.HE
): { rooms: RoomState; ateTfsa: number; ateTfsaHe: number; ateTfsaShe: number } {
  const r = { ...rooms };
  let ateTfsaHe = 0;
  let ateTfsaShe = 0;

  const consume = (owner: FamilyMember, annual: number) => {
    let left = Math.max(0, annual);
    for (const who of [owner, otherMember(owner)]) {
      const room = who === FamilyMember.HE ? r.tfsaHe : r.tfsaShe;
      const take = Math.min(left, Math.max(0, room));
      if (who === FamilyMember.HE) {
        r.tfsaHe -= take;
        ateTfsaHe += take;
      } else {
        r.tfsaShe -= take;
        ateTfsaShe += take;
      }
      left -= take;
      if (left <= 0) break;
    }
  };

  const secondary = otherMember(primary);
  consume(
    secondary,
    secondary === FamilyMember.HE
      ? heExtraAnnual
      : sheExtraAnnual
  );
  consume(
    primary,
    primary === FamilyMember.HE ? heExtraAnnual : sheExtraAnnual
  );

  return { rooms: r, ateTfsa: ateTfsaHe + ateTfsaShe, ateTfsaHe, ateTfsaShe };
}

/** Precise year apply: returns updated buckets + rooms after Extra/ESPP/refund discretionary. */
export function deployDiscretionaryWithSoftLimits(params: {
  heExtraAnnual: number;
  sheExtraAnnual: number;
  heEsppSaleAnnual?: number;
  sheEsppSaleAnnual?: number;
  heRefundRedepositAnnual?: number;
  sheRefundRedepositAnnual?: number;
  rooms: RoomState;
  buckets: AccountBuckets;
  softCapacityHe: SoftCapacityLevel;
  softCapacityShe: SoftCapacityLevel;
  heSalary: number;
  sheSalary: number;
  optimizeSpousal: boolean;
  spousalContributor?: FamilyMember;
}): {
  buckets: AccountBuckets;
  rooms: RoomState;
  heSplit: DestinationSplit;
  sheSplit: DestinationSplit;
  preferredRrsp: FamilyMember | null;
  toSpousal: number;
  toTfsa: number;
  toRrsp: number;
  toNonReg: number;
} {
  const rooms = { ...params.rooms };
  const b = { ...params.buckets };
  const heSplit = emptySplit();
  const sheSplit = emptySplit();
  let toTfsa = 0;
  let toRrsp = 0;
  let toNonReg = 0;

  const preferred = preferDiscretionaryRrspOwner({
    softHe: params.softCapacityHe,
    softShe: params.softCapacityShe,
    heSalary: params.heSalary,
    sheSalary: params.sheSalary,
  });
  const spousalContributor =
    params.spousalContributor ??
    (params.sheSalary > params.heSalary
      ? FamilyMember.SHE
      : FamilyMember.HE);
  const spousalAnnuitant = otherMember(spousalContributor);

  const canOwnRrsp = (who: FamilyMember) => {
    const level = who === FamilyMember.HE ? params.softCapacityHe : params.softCapacityShe;
    return level === SoftCapacityLevel.GREEN || level === SoftCapacityLevel.AMBER;
  };

  const fillStreamTfsa = (
    owner: FamilyMember,
    amount: number,
    into: DestinationSplit
  ) => {
    let left = Math.max(0, amount);
    for (const who of [owner, otherMember(owner)]) {
      if (left <= 0) break;
      const available =
        who === FamilyMember.HE ? rooms.tfsaHe : rooms.tfsaShe;
      const take = Math.min(left, Math.max(0, available));
      if (take <= 0) continue;
      if (who === FamilyMember.HE) {
        b.tfsaHe += take;
        rooms.tfsaHe -= take;
      } else {
        b.tfsaShe += take;
        rooms.tfsaShe -= take;
      }
      creditTfsa(into, who, take);
      toTfsa += take;
      left -= take;
    }
    return left;
  };

  const fillOwnRrsp = (who: FamilyMember, left: number, into: DestinationSplit): number => {
    if (left <= 0 || !canOwnRrsp(who)) return left;
    if (who === FamilyMember.HE) {
      const toR = Math.min(left, Math.max(0, rooms.rrspHe));
      if (toR > 0) {
        b.rrspHe += toR;
        rooms.rrspHe -= toR;
        into.toRrspOwn += toR;
        toRrsp += toR;
        left -= toR;
      }
    } else {
      const toR = Math.min(left, Math.max(0, rooms.rrspShe));
      if (toR > 0) {
        b.rrspShe += toR;
        rooms.rrspShe -= toR;
        into.toRrspOwn += toR;
        toRrsp += toR;
        left -= toR;
      }
    }
    return left;
  };

  const routeResidual = (
    owner: FamilyMember,
    left: number,
    split: DestinationSplit
  ) => {
    left = fillOwnRrsp(owner, left, split);
    if (
      left > 0 &&
      params.optimizeSpousal &&
      owner === spousalAnnuitant &&
      canOwnRrsp(spousalContributor)
    ) {
      const available =
        spousalContributor === FamilyMember.HE
          ? rooms.rrspHe
          : rooms.rrspShe;
      const take = Math.min(left, Math.max(0, available));
      if (take > 0) {
        if (spousalContributor === FamilyMember.HE) {
          rooms.rrspHe -= take;
          b.rrspShe += take;
        } else {
          rooms.rrspShe -= take;
          b.rrspHe += take;
        }
        split.toSpousal += take;
        toRrsp += take;
        left -= take;
      }
    }
    if (left > 0) {
      b.nonReg += left;
      split.toNonReg += left;
      toNonReg += left;
    }
  };

  const shePool =
    params.sheExtraAnnual +
    (params.sheEsppSaleAnnual ?? 0) +
    (params.sheRefundRedepositAnnual ?? 0);
  const hePool =
    params.heExtraAnnual +
    (params.heEsppSaleAnnual ?? 0) +
    (params.heRefundRedepositAnnual ?? 0);

  const deployStream = (who: FamilyMember) => {
    const split =
      who === FamilyMember.HE ? heSplit : sheSplit;
    const pool = who === FamilyMember.HE ? hePool : shePool;
    const left = fillStreamTfsa(who, pool, split);
    routeResidual(who, left, split);
  };
  deployStream(spousalAnnuitant);
  deployStream(spousalContributor);

  return {
    buckets: b,
    rooms,
    heSplit,
    sheSplit,
    preferredRrsp: preferred,
    toSpousal: sheSplit.toSpousal + heSplit.toSpousal,
    toTfsa,
    toRrsp,
    toNonReg,
  };
}

function roomsFromPlan(plan: RetirementPlan): RoomState {
  return {
    tfsaHe: plan.heInput.carryForwardTfsaRoom ?? 0,
    tfsaShe: plan.sheInput.carryForwardTfsaRoom ?? 0,
    rrspHe: plan.heInput.carryForwardRrspRoom ?? 0,
    rrspShe: plan.sheInput.carryForwardRrspRoom ?? 0,
  };
}

function fmt(n: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * This-year Excess advisor + TFSA exhaustion scan over working years.
 */
export function explainExcessMoney(
  plan: RetirementPlan,
  opts?: { currentYear?: number; isFunded?: boolean }
): ExcessMoneyGuideResult {
  const currentYear = opts?.currentYear ?? new Date().getFullYear();
  const buckets = resolveBuckets(plan);
  const softCapacityHe = computeSoftCapacity(FamilyMember.HE, plan.heInput, buckets.rrspHe, plan, currentYear);
  const softCapacityShe = computeSoftCapacity(FamilyMember.SHE, plan.sheInput, buckets.rrspShe, plan, currentYear);

  const heExtraMonthly = resolveExtraContributionMonthly(plan.heInput);
  const sheExtraMonthly = resolveExtraContributionMonthly(plan.sheInput);
  const heExtraAnnual = heExtraMonthly * 12;
  const sheExtraAnnual = sheExtraMonthly * 12;

  const he = plan.heInput;
  const she = plan.sheInput;
  const roles = resolveEarnerRoles(plan);
  const heEsppCashAnnual =
    (he.salary * (he.esppEmployeeRate || 0)) / 100 + (he.salary * (he.esppEmployerRate || 0)) / 100;
  const sheEsppCashAnnual =
    (she.salary * (she.esppEmployeeRate || 0)) / 100 +
    (she.salary * (she.esppEmployerRate || 0)) / 100;
  const esppCashAnnual = heEsppCashAnnual + sheEsppCashAnnual;
  const depositEspp = !!plan.depositEsppToRrsp;
  const heEsppSale = depositEspp ? 0 : heEsppCashAnnual;
  const sheEsppSale = depositEspp ? 0 : sheEsppCashAnnual;

  // RRSP tax-refund reinvestment rate (localStorage key esppRefundSaveRate).
  // Advisory estimate is computed after MV deploy from dollars that land in RRSP.
  const refundRate = plan.esppRefundSaveRate ?? 0.5;

  const rooms = roomsFromPlan(plan);
  // Credit this-year earned RRSP room for advisory own-RRSP path
  const roomsWithEarn = {
    ...rooms,
    rrspHe: rooms.rrspHe + Math.min(MAX_RRSP_ANNUAL, he.salary * 0.18),
    rrspShe:
      rooms.rrspShe + Math.min(MAX_RRSP_ANNUAL, plan.sheInput.salary * 0.18),
  };

  const optimizeSpousal = !!plan.optimizeSpousalRrsp;
  const isTaxOptimizationFraming = !!opts?.isFunded;

  // MV rankings — each spouse's ESPP belongs to that spouse's stream.
  const mvHe =
    heExtraMonthly > 0 || heEsppSale > 0
      ? rankMvForStream(plan, FamilyMember.HE, { currentYear })
      : emptyMvRanking(FamilyMember.HE);
  const mvShe =
    sheExtraMonthly > 0 || sheEsppSale > 0
      ? rankMvForStream(plan, FamilyMember.SHE, { currentYear })
      : emptyMvRanking(FamilyMember.SHE);

  const allowHeSpousal =
    optimizeSpousal && roles.secondary === FamilyMember.HE;
  const allowSheSpousal =
    optimizeSpousal && roles.secondary === FamilyMember.SHE;
  const heOrder = withOwnershipTfsaFirst(
    FamilyMember.HE,
    mvHe.ranking.length
      ? mvHe.ranking.map((score) => score.destination)
      : fallbackMvOrder(FamilyMember.HE, allowHeSpousal)
  );
  const sheOrder = withOwnershipTfsaFirst(
    FamilyMember.SHE,
    mvShe.ranking.length
      ? mvShe.ranking.map((score) => score.destination)
      : fallbackMvOrder(FamilyMember.SHE, allowSheSpousal)
  );

  // First pass: Extra + ESPP sale only (refund depends on RRSP landings).
  const combinedDeploy = deployDiscretionaryByMvOrder({
    heExtraAnnual,
    sheExtraAnnual,
    heEsppSaleAnnual: heEsppSale,
    sheEsppSaleAnnual: sheEsppSale,
    heRefundRedepositAnnual: 0,
    sheRefundRedepositAnnual: 0,
    rooms: roomsWithEarn,
    buckets,
    heOrder,
    sheOrder,
    spousalContributor: roles.primary,
  });

  const refundEst = estimateRrspRefund({
    deposits: {
      heOwn: combinedDeploy.heSplit.toRrspOwn,
      sheOwn: combinedDeploy.sheSplit.toRrspOwn,
      spousal: combinedDeploy.toSpousal,
      hePayrollEspp: depositEspp ? heEsppCashAnnual : 0,
      shePayrollEspp: depositEspp ? sheEsppCashAnnual : 0,
    },
    heSalary: he.salary,
    sheSalary: she.salary,
    spousalContributor: roles.primary,
    taxConfig: plan.taxConfig ?? DEFAULT_TAX_CONFIG,
    reinvestRate: refundRate,
  });
  const heRefundRedepositAnnual = refundEst.byContributorReinvested.he;
  const sheRefundRedepositAnnual = refundEst.byContributorReinvested.she;
  const estimatedRefundRedepositAnnual = refundEst.reinvested;

  // Pool shown in cascade = Extra + ESPP sale (refund listed separately; engines lag it).
  const hePoolAnnual = heExtraAnnual + heEsppSale;
  const shePoolAnnual = sheExtraAnnual + sheEsppSale;
  const combinedMvRouting = {
    hePoolAnnual,
    shePoolAnnual,
    totalPoolAnnual: hePoolAnnual + shePoolAnnual,
    toTfsaHe:
      combinedDeploy.heSplit.toTfsaHe + combinedDeploy.sheSplit.toTfsaHe,
    toTfsaShe:
      combinedDeploy.heSplit.toTfsaShe + combinedDeploy.sheSplit.toTfsaShe,
    toRrspHe: combinedDeploy.heSplit.toRrspOwn,
    toRrspShe: combinedDeploy.sheSplit.toRrspOwn,
    toSpousal:
      combinedDeploy.heSplit.toSpousal + combinedDeploy.sheSplit.toSpousal,
    toNonReg:
      combinedDeploy.heSplit.toNonReg + combinedDeploy.sheSplit.toNonReg,
  };

  // Soft-capacity diagnostic deploy (includes estimated refund redeposit).
  const deployed = deployDiscretionaryWithSoftLimits({
    heExtraAnnual,
    sheExtraAnnual,
    heEsppSaleAnnual: heEsppSale,
    sheEsppSaleAnnual: sheEsppSale,
    heRefundRedepositAnnual,
    sheRefundRedepositAnnual,
    rooms: roomsWithEarn,
    buckets: { ...buckets },
    softCapacityHe: softCapacityHe.level,
    softCapacityShe: softCapacityShe.level,
    heSalary: he.salary,
    sheSalary: plan.sheInput.salary,
    optimizeSpousal,
    spousalContributor: roles.primary,
  });

  const zeroTfsaRooms: RoomState = {
    ...roomsWithEarn,
    tfsaHe: 0,
    tfsaShe: 0,
  };
  const afterFull = deployDiscretionaryWithSoftLimits({
    heExtraAnnual,
    sheExtraAnnual,
    heEsppSaleAnnual: heEsppSale,
    sheEsppSaleAnnual: sheEsppSale,
    heRefundRedepositAnnual,
    sheRefundRedepositAnnual,
    rooms: zeroTfsaRooms,
    buckets: { ...buckets },
    softCapacityHe: softCapacityHe.level,
    softCapacityShe: softCapacityShe.level,
    heSalary: he.salary,
    sheSalary: plan.sheInput.salary,
    optimizeSpousal,
    spousalContributor: roles.primary,
  });

  // TFSA exhaustion timeline (Extra + ESPP sale + refund compete; grants each Jan after year 0)
  const tfsaLimit = plan.annualTfsaLimit ?? 7000;
  const inflateTfsa = !!plan.inflateAnnualTfsaLimit;
  const years = Math.max(
    0,
    Math.max(plan.heInput.retirementAge - plan.heInput.age, plan.sheInput.retirementAge - plan.sheInput.age)
  );
  let scanRooms: RoomState = { ...rooms };
  let inflationMult = 1;
  let tfsaExhaustionYear: number | null = null;
  let yearsUntilTfsaExhaustion: number | null = null;
  let crowdingWinner: CrowdingSource | null = null;

  for (let t = 0; t < years; t++) {
    if (t > 0) {
      const grant = inflateTfsa ? tfsaLimit * inflationMult : tfsaLimit;
      scanRooms = {
        ...scanRooms,
        tfsaHe: scanRooms.tfsaHe + grant,
        tfsaShe: scanRooms.tfsaShe + grant,
      };
    }
    const heA = heExtraMonthly * 12 * inflationMult;
    const sheA = sheExtraMonthly * 12 * inflationMult;
    const salaryMult = Math.pow(1 + (plan.salaryGrowthRate ?? 0.01), t);
    const heEsppA = depositEspp
      ? 0
      : (he.salary *
          salaryMult *
          ((he.esppEmployeeRate || 0) +
            (he.esppEmployerRate || 0))) /
        100;
    const sheEsppA = depositEspp
      ? 0
      : (she.salary *
          salaryMult *
          ((she.esppEmployeeRate || 0) +
            (she.esppEmployerRate || 0))) /
        100;
    const esppA = heEsppA + sheEsppA;
    const refundA = estimatedRefundRedepositAnnual * salaryMult;

    const before = scanRooms.tfsaHe + scanRooms.tfsaShe;
    const afterExtra = consumeTfsaForExtra(
      scanRooms,
      heA,
      sheA,
      roles.primary
    );
    scanRooms = afterExtra.rooms;
    const afterEspp = consumeTfsaForExtra(
      scanRooms,
      heEsppA,
      sheEsppA,
      roles.primary
    );
    scanRooms = afterEspp.rooms;
    const refundHe =
      estimatedRefundRedepositAnnual > 0
        ? refundA * (heRefundRedepositAnnual / estimatedRefundRedepositAnnual)
        : 0;
    const afterRefund = consumeTfsaForExtra(
      scanRooms,
      refundHe,
      refundA - refundHe,
      roles.primary
    );
    scanRooms = afterRefund.rooms;

    const consumed = before - (scanRooms.tfsaHe + scanRooms.tfsaShe);
    if (!crowdingWinner && consumed > 0) {
      if (
        afterExtra.ateTfsa >=
        afterEspp.ateTfsa + afterRefund.ateTfsa
      )
        crowdingWinner = 'extra';
      else if (esppA >= refundA) crowdingWinner = 'espp';
      else crowdingWinner = 'refund';
    }

    const need = heA + sheA + esppA + refundA;
    if (scanRooms.tfsaHe + scanRooms.tfsaShe < 1 && need > before) {
      tfsaExhaustionYear = currentYear + t;
      yearsUntilTfsaExhaustion = t;
      if (!crowdingWinner) {
        if (heA + sheA >= esppA && heA + sheA >= refundA) crowdingWinner = 'extra';
        else if (esppA >= refundA) crowdingWinner = 'espp';
        else crowdingWinner = 'refund';
      }
      break;
    }
    inflationMult *= 1 + plan.inflationRate;
  }

  const describeDest = (s: DestinationSplit): string => {
    const bits: string[] = [];
    if (s.toTfsaHe > 0) bits.push(`He TFSA ${fmt(s.toTfsaHe)}`);
    if (s.toTfsaShe > 0) bits.push(`She TFSA ${fmt(s.toTfsaShe)}`);
    if (s.toSpousal > 0) bits.push(`Spousal ${fmt(s.toSpousal)}`);
    if (s.toRrspOwn > 0) bits.push(`own RRSP ${fmt(s.toRrspOwn)}`);
    if (s.toNonReg > 0) bits.push(`Non-reg ${fmt(s.toNonReg)}`);
    return bits.length ? `${bits.join(', ')}/yr` : 'none this year';
  };

  let recommendation: string;
  if (
    sheExtraMonthly <= 0 &&
    heExtraMonthly <= 0 &&
    heEsppSale + sheEsppSale <= 0
  ) {
    recommendation = 'No Extra cash or ESPP sale to route this year.';
  } else {
    const parts: string[] = [];
    const regimeLabel = isTaxOptimizationFraming
      ? 'funded — ranking by surplus spend capacity'
      : 'underfunded — ranking by required Extra $/mo';

    parts.push(
      `Highest-ROI routing (${regimeLabel}). Soft RRIF headroom below is diagnostic (OAS/RRIF risk), not the primary score.`
    );
    parts.push(
      'Each stream fills its owner TFSA first, then may legally spill into the spouse TFSA; RRSP routing remains ownership-aware.'
    );

    if (sheExtraMonthly > 0) {
      parts.push(
        `She's Extra (${fmt(sheExtraMonthly)}/mo): best MV = ${topDestinationLabel(mvShe.top)}; suggested ${describeDest(mvShe.suggestedSplit)}.`
      );
      if (
        !optimizeSpousal &&
        softCapacityHe.level !== SoftCapacityLevel.RED &&
        mvShe.suggestedSplit.toSpousal <= 0 &&
        mvShe.suggestedSplit.toNonReg + mvShe.suggestedSplit.toRrspOwn > 0
      ) {
        parts.push(
          `Tip: enable Spousal to let the primary earner contribute, using their room, to the secondary earner's spousal RRSP.`
        );
      }
    }

    if (heExtraMonthly > 0) {
      parts.push(
        `He's Extra (${fmt(heExtraMonthly)}/mo): best MV = ${topDestinationLabel(mvHe.top)}; suggested ${describeDest(mvHe.suggestedSplit)}.`
      );
    }
    if (heEsppSale > 0) {
      parts.push(
        `His ESPP sale ${fmt(heEsppSale)}/yr uses His best path; MV top = ${topDestinationLabel(mvHe.top)}.`
      );
    }
    if (sheEsppSale > 0) {
      parts.push(
        `Her ESPP sale ${fmt(sheEsppSale)}/yr uses Her best path; MV top = ${topDestinationLabel(mvShe.top)}.`
      );
    }

    if (yearsUntilTfsaExhaustion !== null) {
      const winner =
        crowdingWinner === 'extra'
          ? 'Extra'
          : crowdingWinner === 'espp'
            ? 'ESPP'
            : crowdingWinner === 'refund'
              ? 'refund redeposit'
              : null;
      parts.push(
        `Household TFSA room likely exhausted in ~${yearsUntilTfsaExhaustion}y (${tfsaExhaustionYear})` +
          (winner ? `, primarily from ${winner}` : '') +
          '.'
      );
    } else {
      parts.push('Household TFSA room lasts through the working-years horizon under current Extra/ESPP.');
    }

    if (isTaxOptimizationFraming) {
      parts.push(
        'Current path already funds the horizon (Min Savings: Already Funded) — further RRSP/spousal is tax optimization, not a funding gap.'
      );
    } else {
      parts.push(
        'Current path does not yet fund the horizon — use Min Savings for the required nest egg / monthly gap; MV still ranks where Extra should go to close the gap fastest.'
      );
    }
    recommendation = parts.join(' ');
  }

  return {
    heExtraMonthly,
    sheExtraMonthly,
    heSplit: deployed.heSplit,
    sheSplit: deployed.sheSplit,
    heSplitAfterTfsaFull: afterFull.heSplit,
    sheSplitAfterTfsaFull: afterFull.sheSplit,
    softCapacityHe,
    softCapacityShe,
    tfsaExhaustionYear,
    yearsUntilTfsaExhaustion,
    crowdingWinner,
    esppCashAnnual,
    estimatedRefundRedepositAnnual,
    rooms,
    recommendation,
    isTaxOptimizationFraming,
    mvHe,
    mvShe,
    combinedMvRouting,
  };
}

/** Map Extra suggested split into legacy other-savings fields for tax / projection wiring. */
export function personInputsFromExtraAllocation(
  plan: RetirementPlan,
  guide?: ExcessMoneyGuideResult
): { heInput: PersonInput; sheInput: PersonInput; recommendedSpousalMonthly: number } {
  const g = guide ?? explainExcessMoney(plan);
  // Phase 3B: wire from MV suggested splits (matches Excess UI + accumulate deploy).
  const he = g.mvHe.suggestedSplit;
  const she = g.mvShe.suggestedSplit;
  const heRrsp = he.toRrspOwn;
  const sheRrsp = she.toRrspOwn;
  const spousal = he.toSpousal + she.toSpousal;
  const heTfsaLike = he.toTfsa + he.toNonReg;
  const sheTfsaLike = she.toTfsa + she.toNonReg;
  return {
    heInput: {
      ...plan.heInput,
      extraContributionMonthly: g.heExtraMonthly,
      otherSavingsRrspMonthly: heRrsp / 12,
      otherSavingsTfsaMonthly: heTfsaLike / 12,
    },
    sheInput: {
      ...plan.sheInput,
      extraContributionMonthly: g.sheExtraMonthly,
      otherSavingsRrspMonthly: sheRrsp / 12,
      otherSavingsTfsaMonthly: sheTfsaLike / 12,
    },
    recommendedSpousalMonthly: spousal / 12,
  };
}

/** @deprecated AllocationPolicy import keep for callers that branch on policy — Extra always TFSA-first race. */
export const EXTRA_USES_POLICY = AllocationPolicy.TFSA_FIRST;
