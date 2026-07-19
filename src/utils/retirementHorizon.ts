import type { RetirementPlan } from '../types/calculator';

/**
 * Canonical post-retirement horizon length when `plan.lifeExpectancyDelta` is unset.
 * Must stay in sync with docs (`math-model.md` §2) and Dashboard defaults.
 * Never use a different fallback (e.g. 30) in engines — that recreates the 20-vs-21 miss.
 */
export const DEFAULT_LIFE_EXPECTANCY_DELTA = 20;

export type HorizonPlanSlice = Pick<RetirementPlan, 'lifeExpectancyDelta' | 'survivorYearIndex'> & {
  heInput: Pick<RetirementPlan['heInput'], 'age' | 'retirementAge'>;
};

export interface RetirementHorizon {
  /** Years of retirement both engines model (= delta). Loop `i < retirementYears`. */
  retirementYears: number;
  /** He's age in the first retirement year. */
  firstRetireAgeHe: number;
  /** He's age in the last modeled retirement year (`first + years - 1`). */
  lastFundedAgeHe: number;
  /**
   * Label / terminal age (`first + years`) — "→ $0 @ ~85", "Lasts to Age 85+".
   * Not a funded year; the portfolio is intended ~$0 *at* this age.
   */
  terminalAgeHe: number;
  /** Working years until first retirement year (0 if already retired). */
  yearsToRetirement: number;
  /**
   * `runProjection` length: calendar years from current age through
   * `lastFundedAgeHe` inclusive → loop `t < projectionYearsFromNow`.
   */
  projectionYearsFromNow: number;
  /** Mid-horizon index when `survivorYearIndex` is unset. */
  defaultSurvivorYearIndex: number;
  /** Resolved survivor event index into the retirement horizon. */
  survivorYearIndex: number;
}

/**
 * Single source of truth for retirement horizon arithmetic.
 * Both `runProjection` and `simulateDecumulation` (and UI "to ~85" labels) must
 * derive years/ages from here so they cannot drift (20 vs 21 years, ??20 vs ??30).
 */
export function resolveRetirementHorizon(plan: HorizonPlanSlice): RetirementHorizon {
  const retirementYears = Math.max(1, plan.lifeExpectancyDelta ?? DEFAULT_LIFE_EXPECTANCY_DELTA);
  const firstRetireAgeHe = plan.heInput.retirementAge;
  const lastFundedAgeHe = firstRetireAgeHe + retirementYears - 1;
  const terminalAgeHe = firstRetireAgeHe + retirementYears;
  const yearsToRetirement = Math.max(0, firstRetireAgeHe - plan.heInput.age);
  const projectionYearsFromNow = Math.max(1, lastFundedAgeHe - plan.heInput.age + 1);
  const defaultSurvivorYearIndex = Math.floor(retirementYears / 2);
  const survivorYearIndex = plan.survivorYearIndex ?? defaultSurvivorYearIndex;

  return {
    retirementYears,
    firstRetireAgeHe,
    lastFundedAgeHe,
    terminalAgeHe,
    yearsToRetirement,
    projectionYearsFromNow,
    defaultSurvivorYearIndex,
    survivorYearIndex,
  };
}

/**
 * Closed-form monthly contribution that grows to `gapDollars` at retirement
 * under constant annual return `annualReturnRate`. Diagnostic only — not a
 * funding engine (see Extra Gap card wealth-gap columns vs backsolve).
 *
 * Same annuity math as the demoted `calculateMinimumNestEgg` stub.
 * Returns 0 when gap ≤ 0 or yearsToRetirement ≤ 0.
 */
export function monthlyFromWealthGap(
  gapDollars: number,
  yearsToRetirement: number,
  annualReturnRate: number
): number {
  if (!(gapDollars > 0) || !(yearsToRetirement > 0)) return 0;
  const months = yearsToRetirement * 12;
  const rm = Math.pow(1 + annualReturnRate, 1 / 12) - 1;
  if (rm < 1e-12) return gapDollars / months;
  return gapDollars * rm / (Math.pow(1 + rm, months) - 1);
}
