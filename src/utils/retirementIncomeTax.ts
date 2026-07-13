import type { TaxConfig } from '../types/calculator';
import { calculateBracketTax, calculateOntarioHealthPremium } from './taxRates';

/**
 * Income tax for retirement income (federal + Ontario + surtax + Ontario Health
 * Premium). Unlike {@link calculatePersonTax}, there are NO CPP/EI contributions
 * or their associated credits — retirement income (RRIF, OAS, CPP, non-registered)
 * is not subject to CPP/EI.
 *
 * Reuses the same bracket / OHP helpers as the working-years tax engine so the
 * two stay consistent.
 *
 * Not financial advice — see docs/explanation/math-model.md.
 */

/**
 * Computes total income tax on retirement taxable income for one individual.
 *
 * Credits are the Basic Personal Amounts only (federal BPA is clawed back at
 * high income, mirroring the working-years engine).
 */
export function calculateRetirementIncomeTax(taxableIncome: number, taxConfig: TaxConfig): number {
  const income = Math.max(0, taxableIncome);

  const federalTaxBeforeCredits = calculateBracketTax(income, taxConfig.federalBrackets);
  const provincialTaxBeforeCredits = calculateBracketTax(income, taxConfig.ontarioBrackets);

  // Federal Basic Personal Amount (with high-income clawback).
  let federalBpa = taxConfig.federalBpaMax;
  if (income > taxConfig.federalBpaThreshold1) {
    const bpaClawbackRate =
      (taxConfig.federalBpaMax - taxConfig.federalBpaMin) /
      (taxConfig.federalBpaThreshold2 - taxConfig.federalBpaThreshold1);
    federalBpa = Math.max(
      taxConfig.federalBpaMin,
      taxConfig.federalBpaMax - (income - taxConfig.federalBpaThreshold1) * bpaClawbackRate
    );
  }

  const federalCredits = federalBpa * 0.15;
  const provincialCredits = taxConfig.ontarioBpa * 0.0505;

  const federalTaxPayable = Math.max(0, federalTaxBeforeCredits - federalCredits);
  const provincialTaxBasic = Math.max(0, provincialTaxBeforeCredits - provincialCredits);

  let ontarioSurtax = 0;
  if (provincialTaxBasic > 6823) {
    ontarioSurtax += (provincialTaxBasic - 6823) * 0.36;
  }
  if (provincialTaxBasic > 8731) {
    ontarioSurtax += (provincialTaxBasic - 8731) * 0.2;
  }
  const provincialTaxPayable = provincialTaxBasic + ontarioSurtax;

  const ontarioHealthPremium = calculateOntarioHealthPremium(income);

  return federalTaxPayable + provincialTaxPayable + ontarioHealthPremium;
}

export interface HouseholdRetirementTaxResult {
  heTax: number;
  sheTax: number;
  totalTax: number;
  heTaxableAfterSplit: number;
  sheTaxableAfterSplit: number;
}

/**
 * Computes household retirement income tax, optionally applying pension income
 * splitting of RRIF-eligible income between spouses.
 *
 * @param heTaxable  He's total taxable retirement income (oasCppOther + rrif).
 * @param sheTaxable She's total taxable retirement income (oasCppOther + rrif).
 * @param heRrifEligible  He's RRIF-eligible (splittable) portion of `heTaxable`.
 * @param sheRrifEligible She's RRIF-eligible (splittable) portion of `sheTaxable`.
 * @param taxConfig Tax configuration.
 * @param splitRrif When true, the combined RRIF-eligible income is split 50/50
 *   between spouses (only the RRIF portion moves — OAS/CPP/other stay with the
 *   person who earned them).
 *
 * Note: Canadian pension income splitting allows allocating up to 50% of
 * eligible pension income to a spouse. A simple even split of the *combined*
 * eligible amount respects that cap (each person keeps at least 50% of their own)
 * and is the v1 heuristic used here.
 */
export function calculateHouseholdRetirementTax(
  heTaxable: number,
  sheTaxable: number,
  heRrifEligible: number,
  sheRrifEligible: number,
  taxConfig: TaxConfig,
  splitRrif: boolean
): HouseholdRetirementTaxResult {
  let heTaxableAfterSplit = heTaxable;
  let sheTaxableAfterSplit = sheTaxable;

  if (splitRrif) {
    // Non-RRIF (OAS/CPP/other) portions must stay with each person.
    const heNonRrif = heTaxable - heRrifEligible;
    const sheNonRrif = sheTaxable - sheRrifEligible;

    // Split the combined RRIF-eligible income evenly.
    const combinedRrifEligible = heRrifEligible + sheRrifEligible;
    const halfRrif = combinedRrifEligible / 2;

    heTaxableAfterSplit = heNonRrif + halfRrif;
    sheTaxableAfterSplit = sheNonRrif + halfRrif;
  }

  const heTax = calculateRetirementIncomeTax(heTaxableAfterSplit, taxConfig);
  const sheTax = calculateRetirementIncomeTax(sheTaxableAfterSplit, taxConfig);

  return {
    heTax,
    sheTax,
    totalTax: heTax + sheTax,
    heTaxableAfterSplit,
    sheTaxableAfterSplit,
  };
}
