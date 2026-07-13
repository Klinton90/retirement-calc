import type { PersonInput, PensionConfig, TaxConfig } from '../types/calculator';
import { DEFAULT_TAX_CONFIG } from './taxCalc';

export const DEFAULT_PENSION_CONFIG: PensionConfig = {
  maxCppMonthly: 1507.65, // Max CPP monthly benefit at age 65 for 2026
  maxOasMonthly: 743.05,  // Max OAS monthly benefit at age 65-74 for 2026
  cppContributoryYearsTarget: 39, // Years of max contributions needed for 100% CPP
  oasResidencyYearsTarget: 40,    // Years of residency needed for 100% OAS
  oasMinResidencyYears: 10,       // Minimum years of residency in Canada to receive OAS
};

export interface PersonPensionResult {
  residencyYears: number;
  contributionYears: number;
  oasMultiplier: number;
  cppMultiplier: number;
  oasMonthly: number;
  oasAnnual: number;
  cppMonthly: number;
  cppAnnual: number;
  totalPensionAnnual: number;
}

export interface HouseholdPensionResult {
  he: PersonPensionResult;
  she: PersonPensionResult;
  totalHouseholdPensionAnnual: number;
}

/**
 * Calculates the expected retirement pension (CPP and OAS) for an individual.
 * 
 * @param input The person's input configuration
 * @param currentYear The current calendar year (default 2026)
 * @param pensionConfig The pension configuration constants
 * @param taxConfig The tax configuration constants (for YMPE comparison)
 */
export function calculatePersonPension(
  input: PersonInput,
  currentYear: number = 2026,
  pensionConfig: PensionConfig = DEFAULT_PENSION_CONFIG,
  taxConfig: TaxConfig = DEFAULT_TAX_CONFIG
): PersonPensionResult {
  const birthYear = currentYear - input.age;
  const retirementYear = birthYear + input.retirementAge;

  // 1. Calculate Residency Years for OAS
  const residencyYears = Math.max(0, retirementYear - input.startYearInCanada);
  
  let oasMultiplier = 0;
  if (residencyYears >= pensionConfig.oasResidencyYearsTarget) {
    oasMultiplier = 1.0;
  } else if (residencyYears >= pensionConfig.oasMinResidencyYears) {
    oasMultiplier = residencyYears / pensionConfig.oasResidencyYearsTarget;
  }

  const oasMonthly = pensionConfig.maxOasMonthly * oasMultiplier;

  // 2. Calculate Contribution Years for CPP
  // Contributory years start from startYearInCanada (or age 18, whichever is later) to retirementYear
  const age18Year = birthYear + 18;
  const cppStartYear = Math.max(input.startYearInCanada, age18Year);
  const contributionYears = Math.max(0, retirementYear - cppStartYear);

  // Estimate earnings ratio to YMPE (if earnings are above YMPE, they contribute maximum)
  const ympeRatio = Math.min(1.0, input.salary / taxConfig.cppYmpe);

  const cppMultiplier = Math.min(1.0, contributionYears / pensionConfig.cppContributoryYearsTarget) * ympeRatio;
  
  // Base CPP benefit at age 65
  let cppMonthly = pensionConfig.maxCppMonthly * cppMultiplier;

  // Adjust CPP for early/late retirement
  // CPP is reduced by 0.6% per month (7.2% per year) before age 65 (down to age 60)
  // CPP is increased by 0.7% per month (8.4% per year) after age 65 (up to age 70)
  const ageDiff = input.retirementAge - 65;
  if (ageDiff < 0) {
    // Early retirement (clamped to max reduction at age 60, i.e., 36% reduction)
    const monthlyReductionRate = 0.006;
    const monthsEarly = Math.min(60, Math.abs(ageDiff) * 12);
    cppMonthly = cppMonthly * (1.0 - monthsEarly * monthlyReductionRate);
  } else if (ageDiff > 0) {
    // Delayed retirement (clamped to max increase at age 70, i.e., 42% increase)
    const monthlyIncreaseRate = 0.007;
    const monthsLate = Math.min(60, ageDiff * 12);
    cppMonthly = cppMonthly * (1.0 + monthsLate * monthlyIncreaseRate);
  }

  // Adjust OAS for early/late retirement
  // OAS cannot be taken before age 65.
  // OAS is increased by 0.6% per month (7.2% per year) if delayed up to age 70.
  let adjustedOasMonthly = oasMonthly;
  if (input.retirementAge < 65) {
    // If they retire before 65, they receive $0 OAS until they turn 65,
    // but in this pension projection, we represent the pension available *during* retirement.
    // If they are under 65, their pension is 0. If they are >= 65, they get OAS.
    // So here we calculate the amount they will receive once they reach 65.
    adjustedOasMonthly = 0; 
  } else if (input.retirementAge > 65) {
    const oasMonthlyIncreaseRate = 0.006;
    const oasMonthsLate = Math.min(60, (input.retirementAge - 65) * 12);
    adjustedOasMonthly = oasMonthly * (1.0 + oasMonthsLate * oasMonthlyIncreaseRate);
  }

  const cppAnnual = cppMonthly * 12;
  const adjustedOasAnnual = adjustedOasMonthly * 12;
  const totalPensionAnnual = cppAnnual + adjustedOasAnnual;

  return {
    residencyYears,
    contributionYears,
    oasMultiplier,
    cppMultiplier,
    oasMonthly: adjustedOasMonthly,
    oasAnnual: adjustedOasAnnual,
    cppMonthly,
    cppAnnual,
    totalPensionAnnual,
  };
}

/**
 * Calculates the CPP/OAS a person receives during a specific calendar age in
 * retirement (as opposed to a single "at retirement" snapshot).
 *
 * This is the age-aware primitive used by the year-by-year retirement engine.
 * Unlike {@link calculatePersonPension}, it returns the pension actually payable
 * at `ageThisYear` rather than assuming payment begins at `retirementAge`.
 *
 * Rules (v1):
 * - OAS: $0 before age 65; from age 65 pay the residency-prorated base amount.
 *   From age 75, apply the +10% OAS increase. OAS residency is always based on
 *   `startYearInCanada`. (Voluntary OAS deferral increases are NOT modelled in
 *   v1 — OAS simply begins at 65.)
 * - CPP: claimed at `input.retirementAge` clamped to 60..70. Before the claim
 *   age CPP is $0; from the claim age it is the earned base amount with the
 *   standard early (−0.6%/mo) or late (+0.7%/mo) adjustment relative to 65.
 *   CPP contribution years start at `cppStartYear` (falling back to
 *   `startYearInCanada`), not before age 18.
 *
 * @param input The person's input configuration
 * @param currentYear The current calendar year (used to derive birth year)
 * @param ageThisYear The person's age during the projection year being evaluated
 * @param pensionConfig The pension configuration constants
 * @param taxConfig The tax configuration constants (for YMPE comparison)
 */
export function calculatePersonPensionForAge(
  input: PersonInput,
  currentYear: number,
  ageThisYear: number,
  pensionConfig: PensionConfig = DEFAULT_PENSION_CONFIG,
  taxConfig: TaxConfig = DEFAULT_TAX_CONFIG
): PersonPensionResult {
  const birthYear = currentYear - input.age;

  // --- OAS: residency proration (always based on startYearInCanada) ---
  // Residency is measured up to the year the person turns 65 (OAS start age).
  const yearTurns65 = birthYear + 65;
  const residencyYears = Math.max(0, yearTurns65 - input.startYearInCanada);

  let oasMultiplier = 0;
  if (residencyYears >= pensionConfig.oasResidencyYearsTarget) {
    oasMultiplier = 1.0;
  } else if (residencyYears >= pensionConfig.oasMinResidencyYears) {
    oasMultiplier = residencyYears / pensionConfig.oasResidencyYearsTarget;
  }

  let oasMonthly = 0;
  if (ageThisYear >= 65) {
    oasMonthly = pensionConfig.maxOasMonthly * oasMultiplier;
    if (ageThisYear >= 75) {
      oasMonthly *= 1.1; // OAS increases 10% at age 75
    }
  }

  // --- CPP: contribution years and claim-age adjustment ---
  const cppContribStartYear = input.cppStartYear ?? input.startYearInCanada;
  const age18Year = birthYear + 18;
  const contributionStartYear = Math.max(cppContribStartYear, age18Year);

  // CPP claim age is the person's retirement age, clamped to the legal 60..70 window.
  const claimAge = Math.max(60, Math.min(70, input.retirementAge));
  const claimYear = birthYear + claimAge;
  const contributionYears = Math.max(0, claimYear - contributionStartYear);

  const ympeRatio = Math.min(1.0, input.salary / taxConfig.cppYmpe);
  const cppMultiplier =
    Math.min(1.0, contributionYears / pensionConfig.cppContributoryYearsTarget) * ympeRatio;

  // Base CPP at 65, then apply early/late adjustment relative to the claim age.
  let cppMonthly = pensionConfig.maxCppMonthly * cppMultiplier;
  const claimAgeDiff = claimAge - 65;
  if (claimAgeDiff < 0) {
    const monthsEarly = Math.min(60, Math.abs(claimAgeDiff) * 12);
    cppMonthly *= 1.0 - monthsEarly * 0.006;
  } else if (claimAgeDiff > 0) {
    const monthsLate = Math.min(60, claimAgeDiff * 12);
    cppMonthly *= 1.0 + monthsLate * 0.007;
  }

  // CPP is only paid once the person reaches the claim age.
  if (ageThisYear < claimAge) {
    cppMonthly = 0;
  }

  const cppAnnual = cppMonthly * 12;
  const oasAnnual = oasMonthly * 12;
  const totalPensionAnnual = cppAnnual + oasAnnual;

  return {
    residencyYears,
    contributionYears,
    oasMultiplier,
    cppMultiplier,
    oasMonthly,
    oasAnnual,
    cppMonthly,
    cppAnnual,
    totalPensionAnnual,
  };
}

/**
 * Calculates the total government pension for a household.
 */
export function calculateHouseholdPension(
  heInput: PersonInput,
  sheInput: PersonInput,
  currentYear: number = 2026,
  pensionConfig: PensionConfig = DEFAULT_PENSION_CONFIG,
  taxConfig: TaxConfig = DEFAULT_TAX_CONFIG
): HouseholdPensionResult {
  const hePension = calculatePersonPension(heInput, currentYear, pensionConfig, taxConfig);
  const shePension = calculatePersonPension(sheInput, currentYear, pensionConfig, taxConfig);

  return {
    he: hePension,
    she: shePension,
    totalHouseholdPensionAnnual: hePension.totalPensionAnnual + shePension.totalPensionAnnual,
  };
}
