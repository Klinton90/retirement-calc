import type { ProjectionYear, RetirementPlan } from '../types/calculator';
import { runProjection } from './retirementCalc';
import { resolveRetirementHorizon } from './retirementHorizon';

/**
 * Annual-dollar tolerance below which a retired-year cash gap is treated as
 * fully funded. Guards against floating-point noise flipping the readiness /
 * deficit labels. Shared so the Retirement Readiness card and the Retirement
 * Monthly Deficit card can never disagree at the horizon boundary.
 */
export const RETIREMENT_SHORTFALL_EPS = 12; // annual $

export interface RetirementShortfall {
  /** He's age at the first retired year with a cash gap, or null if none. */
  firstShortfallAge: number | null;
  /** He's age at the worst (largest) retired-year cash gap, or null if none. */
  worstShortfallAge: number | null;
  /** Largest annual gap (expenses − netIncome) across retired years, ≥ 0. */
  worstAnnualGap: number;
  /** True when every retired year through the horizon is funded. */
  lastsFullHorizon: boolean;
}

/**
 * Analyse a current-path projection for retirement cash shortfalls. Both the
 * Readiness card (depletion age) and the Monthly Deficit card (worst gap) derive
 * from this single pass so a gap in the final horizon year is reported the same
 * way by both — never "Lasts to horizon+" and "Shortfall" simultaneously.
 */
export function analyzeRetirementShortfall(
  projection: ProjectionYear[],
  epsAnnual: number = RETIREMENT_SHORTFALL_EPS
): RetirementShortfall {
  let firstShortfallAge: number | null = null;
  let worstShortfallAge: number | null = null;
  let worstAnnualGap = 0;

  for (const row of projection) {
    if (!row.isRetired) continue;
    const gap = row.expenses - row.netIncome;
    if (gap > epsAnnual) {
      if (firstShortfallAge === null) firstShortfallAge = row.ageHe;
      if (gap > worstAnnualGap) {
        worstAnnualGap = gap;
        worstShortfallAge = row.ageHe;
      }
    }
  }

  return {
    firstShortfallAge,
    worstShortfallAge,
    worstAnnualGap,
    lastsFullHorizon: firstShortfallAge === null,
  };
}

export interface MonthlyExtraSolveResult {
  /** Min additional solver Extra $/mo that satisfies the predicate (or expand max). */
  monthly: number;
  /** False if even expandMax failed. */
  reached: boolean;
}

/**
 * Expand + binary-search the smallest monthly Extra ≥ 0 that satisfies `isOk`.
 * Same shape as the ADR 0004 funding Extra search (known-good upper bound).
 */
export function binarySearchMonthlyExtra(
  isOk: (monthly: number) => boolean,
  opts?: { expandMax?: number; startHigh?: number }
): MonthlyExtraSolveResult {
  const expandMax = opts?.expandMax ?? 1_000_000;
  const startHigh = opts?.startHigh ?? 5_000;

  if (isOk(0)) return { monthly: 0, reached: true };

  let low = 0;
  let high = startHigh;
  let reached = false;
  let guard = 0;
  while (guard++ < 24) {
    if (isOk(high)) {
      reached = true;
      break;
    }
    low = high;
    high *= 2;
    if (high > expandMax) break;
  }

  if (!reached) {
    return { monthly: expandMax, reached: false };
  }

  for (let i = 0; i < 28; i++) {
    const mid = (low + high) / 2;
    if (isOk(mid)) {
      high = mid;
    } else {
      low = mid;
    }
  }
  return { monthly: high, reached: true };
}

/**
 * Min additional solver Extra $/mo so the Plot 1 / Readiness viewer path
 * (`runProjection` + `analyzeRetirementShortfall`) lasts the full horizon.
 * Distinct from the target-engine backsolve Extra.
 */
export function solveExtraForReadiness(
  plan: RetirementPlan,
  currentYear: number,
  useMandatoryOnly: boolean = false
): MonthlyExtraSolveResult {
  return binarySearchMonthlyExtra(monthly => {
    const proj = runProjection(plan, currentYear, useMandatoryOnly, monthly);
    return analyzeRetirementShortfall(proj).lastsFullHorizon;
  });
}

export interface EarliestJointRetirementResult {
  /** Max years both spouses can stop earlier while still lasting the terminal. */
  yearsEarlier: number;
  heRetireAge: number;
  sheRetireAge: number;
  /** Entered-plan terminal age held fixed across probes. */
  terminalAgeHe: number;
  /** True when entered ages already last the full horizon. */
  lastsAtEntered: boolean;
  /** Max feasible joint shift given ages (retireAge − age − 1). */
  maxYearsEarlier: number;
}

/** Largest joint yearsEarlier that keeps both retire ages ≥ age + 1. */
export function maxJointYearsEarlier(plan: RetirementPlan): number {
  const heMax = plan.heInput.retirementAge - (plan.heInput.age + 1);
  const sheMax = plan.sheInput.retirementAge - (plan.sheInput.age + 1);
  return Math.max(0, Math.min(heMax, sheMax));
}

/**
 * Clone plan with a joint stop-work shift, holding `terminalAgeHe` fixed via
 * trial `lifeExpectancyDelta` (does not mutate the caller's stored delta).
 */
export function planWithJointYearsEarlier(
  plan: RetirementPlan,
  yearsEarlier: number,
  terminalAgeHe: number
): RetirementPlan {
  const y = Math.max(0, Math.floor(yearsEarlier));
  const heRetireAge = plan.heInput.retirementAge - y;
  const sheRetireAge = plan.sheInput.retirementAge - y;
  return {
    ...plan,
    heInput: { ...plan.heInput, retirementAge: heRetireAge },
    sheInput: { ...plan.sheInput, retirementAge: sheRetireAge },
    lifeExpectancyDelta: Math.max(1, terminalAgeHe - heRetireAge),
  };
}

/**
 * Max joint years earlier both spouses can stop work while the active
 * Realistic/Mandatory viewer path still lasts to the same terminal age
 * (ADR 0007). Predicate = Readiness / Plot 1 — not @71 backsolve.
 */
export function solveEarliestJointRetirement(
  plan: RetirementPlan,
  currentYear: number,
  useMandatoryOnly: boolean = false,
  terminalAgeHeOverride?: number
): EarliestJointRetirementResult {
  const terminalAgeHe =
    terminalAgeHeOverride ?? resolveRetirementHorizon(plan).terminalAgeHe;
  const maxYears = maxJointYearsEarlier(plan);

  const lasts = (yearsEarlier: number): boolean => {
    const trial = planWithJointYearsEarlier(plan, yearsEarlier, terminalAgeHe);
    const proj = runProjection(trial, currentYear, useMandatoryOnly, 0);
    return analyzeRetirementShortfall(proj).lastsFullHorizon;
  };

  const lastsAtEntered = lasts(0);
  if (!lastsAtEntered) {
    return {
      yearsEarlier: 0,
      heRetireAge: plan.heInput.retirementAge,
      sheRetireAge: plan.sheInput.retirementAge,
      terminalAgeHe,
      lastsAtEntered: false,
      maxYearsEarlier: maxYears,
    };
  }

  if (maxYears <= 0 || lasts(maxYears)) {
    const y = lastsAtEntered ? maxYears : 0;
    return {
      yearsEarlier: y,
      heRetireAge: plan.heInput.retirementAge - y,
      sheRetireAge: plan.sheInput.retirementAge - y,
      terminalAgeHe,
      lastsAtEntered: true,
      maxYearsEarlier: maxYears,
    };
  }

  // Largest integer yearsEarlier where lasts is still true.
  let lo = 0;
  let hi = maxYears;
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (lasts(mid)) lo = mid;
    else hi = mid;
  }

  return {
    yearsEarlier: lo,
    heRetireAge: plan.heInput.retirementAge - lo,
    sheRetireAge: plan.sheInput.retirementAge - lo,
    terminalAgeHe,
    lastsAtEntered: true,
    maxYearsEarlier: maxYears,
  };
}
