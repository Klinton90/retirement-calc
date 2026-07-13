import {
  type TaxConfig,
  type CcbConfig,
  type PersonInput,
  type PersonTaxResult,
  type HouseholdTaxResult,
  SavingsBase,
  ContributionType,
  type ChildInput,
} from '../types/calculator';
import {
  DEFAULT_TAX_CONFIG,
  DEFAULT_CCB_CONFIG,
  calculateBracketTax,
  calculateOntarioHealthPremium,
} from './taxRates';
import { calculateCcb } from './ccbCalc';

export {
  DEFAULT_TAX_CONFIG,
  DEFAULT_CCB_CONFIG,
  calculateBracketTax,
  calculateOntarioHealthPremium,
  calculateCcb,
};

export function calculatePersonTax(
  input: PersonInput,
  taxConfig: TaxConfig = DEFAULT_TAX_CONFIG,
  depositEsppToRrsp: boolean = false,
  overrideOtherSavingsRrspMonthly?: number,
  isBaseline: boolean = false
): PersonTaxResult {
  const {
    salary,
    rrspEmployeeType,
    rrspEmployeeValue,
    rrspEmployerRate,
    esppEmployeeRate,
    esppEmployerRate,
    otherSavingsTfsaMonthly,
    otherSavingsRrspMonthly,
    extraIncomeMonthly,
  } = input;

  const otherRrspMonthly = overrideOtherSavingsRrspMonthly !== undefined
    ? overrideOtherSavingsRrspMonthly
    : (otherSavingsRrspMonthly || 0);

  const annualExtraIncome = (extraIncomeMonthly || 0) * 12;

  // 1. Calculate CPP contributions
  let cpp2Contribution = 0;
  let cppTotalContribution = 0;
  
  const cppContributoryEarnings = Math.max(0, Math.min(salary, taxConfig.cppYmpe) - taxConfig.cppExemption);
  cppTotalContribution = Math.min(taxConfig.cppMaxContribution, cppContributoryEarnings * taxConfig.cppRate);
  
  const cppBaseRate = 0.0495;
  const cppEnhancedRate = 0.0100;
  const cppBaseForCredit = (cppTotalContribution * cppBaseRate) / taxConfig.cppRate;
  const cppEnhancedDeduction = (cppTotalContribution * cppEnhancedRate) / taxConfig.cppRate;

  if (salary > taxConfig.cppYmpe) {
    const cpp2Earnings = Math.min(salary, taxConfig.cppYame) - taxConfig.cppYmpe;
    cpp2Contribution = Math.min(taxConfig.cpp2MaxContribution, cpp2Earnings * taxConfig.cpp2Rate);
  }
  cppTotalContribution += cpp2Contribution;

  // 2. Calculate EI Premiums
  const eiPremium = Math.min(taxConfig.eiMaxPremium, salary * taxConfig.eiRate);

  // 3. Calculate RRSP Deduction
  let rrspEmployeeDeduction = 0;
  if (rrspEmployeeType === ContributionType.PERCENTAGE) {
    rrspEmployeeDeduction = (salary * rrspEmployeeValue) / 100;
  } else {
    rrspEmployeeDeduction = rrspEmployeeValue * 12;
  }
  rrspEmployeeDeduction += otherRrspMonthly * 12;
  
  const maxRrspLimit = 33720 + (input.carryForwardRrspRoom ?? 0);
  rrspEmployeeDeduction = Math.min(maxRrspLimit, rrspEmployeeDeduction);

  // 4. Calculate ESPP Employee Contribution
  const esppEmployeeContribution = (salary * esppEmployeeRate) / 100;
  const esppEmployerContribution = (salary * esppEmployerRate) / 100;

  let esppToRrspDeduction = 0;
  if (depositEsppToRrsp) {
    const combinedRrsp = rrspEmployeeDeduction + esppEmployeeContribution + esppEmployerContribution;
    const cappedCombined = Math.min(maxRrspLimit, combinedRrsp);
    esppToRrspDeduction = cappedCombined - rrspEmployeeDeduction;
  }

  // 5. Calculate Taxable Income
  const totalRrspDeductions = rrspEmployeeDeduction + esppToRrspDeduction;
  const cppDeductions = cppEnhancedDeduction + cpp2Contribution;
  const taxableIncome = Math.max(0, salary + annualExtraIncome - (totalRrspDeductions + cppDeductions));

  // 6. Calculate Income Tax before credits
  const federalTaxBeforeCredits = calculateBracketTax(taxableIncome, taxConfig.federalBrackets);
  const provincialTaxBeforeCredits = calculateBracketTax(taxableIncome, taxConfig.ontarioBrackets);

  // 7. Calculate Basic Personal Amount (BPA) Clawback
  let federalBpa = taxConfig.federalBpaMax;
  if (taxableIncome > taxConfig.federalBpaThreshold1) {
    const bpaClawbackRate = (taxConfig.federalBpaMax - taxConfig.federalBpaMin) / (taxConfig.federalBpaThreshold2 - taxConfig.federalBpaThreshold1);
    federalBpa = Math.max(
      taxConfig.federalBpaMin,
      taxConfig.federalBpaMax - (taxableIncome - taxConfig.federalBpaThreshold1) * bpaClawbackRate
    );
  }

  // 8. Calculate Non-Refundable Tax Credits
  const federalCredits = (federalBpa + cppBaseForCredit + eiPremium) * 0.15;
  const provincialCredits = (taxConfig.ontarioBpa + cppBaseForCredit + eiPremium) * 0.0505;

  // 9. Calculate Net Income Tax
  const federalTaxPayable = Math.max(0, federalTaxBeforeCredits - federalCredits);
  let provincialTaxBasic = Math.max(0, provincialTaxBeforeCredits - provincialCredits);

  let ontarioSurtax = 0;
  if (provincialTaxBasic > 6823) {
    ontarioSurtax += (provincialTaxBasic - 6823) * 0.36;
  }
  if (provincialTaxBasic > 8731) {
    ontarioSurtax += (provincialTaxBasic - 8731) * 0.20;
  }
  const provincialTaxPayable = provincialTaxBasic + ontarioSurtax;

  const ontarioHealthPremium = calculateOntarioHealthPremium(taxableIncome);
  const totalIncomeTax = federalTaxPayable + provincialTaxPayable + ontarioHealthPremium;
  const totalDeductions = cppTotalContribution + eiPremium + totalIncomeTax + rrspEmployeeDeduction + esppEmployeeContribution;
  const takeHomePay = salary + annualExtraIncome - (cppTotalContribution + eiPremium + totalIncomeTax);

  // Actual Savings
  const rrspEmployerContribution = (salary * rrspEmployerRate) / 100;
  const actualSavings =
    rrspEmployeeDeduction +
    rrspEmployerContribution +
    esppEmployeeContribution +
    esppEmployerContribution +
    (otherSavingsTfsaMonthly || 0) * 12;

  let taxSavings = 0;
  const hasEsppToRrsp = depositEsppToRrsp && (input.esppEmployeeRate > 0 || input.esppEmployerRate > 0);
  const hasOtherRrsp = (otherRrspMonthly || 0) > 0;
  if ((hasEsppToRrsp || hasOtherRrsp) && !isBaseline) {
    const baseline = calculatePersonTax(input, taxConfig, false, 0, true);
    taxSavings = Math.max(0, baseline.totalIncomeTax - totalIncomeTax);
  }

  return {
    salary,
    cppBaseContribution: cppBaseForCredit,
    cpp2Contribution,
    cppTotalContribution,
    eiPremium,
    rrspEmployeeDeduction,
    esppEmployeeContribution,
    taxableIncome,
    federalTaxBeforeCredits,
    provincialTaxBeforeCredits,
    federalBpa,
    federalCredits,
    provincialCredits,
    federalTaxPayable,
    provincialTaxPayable,
    ontarioSurtax,
    ontarioHealthPremium,
    totalIncomeTax,
    totalDeductions,
    takeHomePay,
    actualSavings,
    taxSavings,
    totalRrspDeduction: totalRrspDeductions,
  };
}

export function calculateHouseholdTax(
  heInput: PersonInput,
  sheInput: PersonInput,
  children: ChildInput[],
  savingsBase: SavingsBase,
  savingsTargetRate: number,
  taxConfig: TaxConfig = DEFAULT_TAX_CONFIG,
  ccbConfig: CcbConfig = DEFAULT_CCB_CONFIG,
  depositEsppToRrsp: boolean = false,
  spousalRrspMonthly: number = 0,
  heCarryForwardRrspRoom: number = 0
): HouseholdTaxResult {
  let heResult = calculatePersonTax(heInput, taxConfig, depositEsppToRrsp);
  let sheResult = calculatePersonTax(sheInput, taxConfig, depositEsppToRrsp);

  let optimizedSpousalMonthly = 0;

  if (spousalRrspMonthly > 0) {
    const maxRrspLimit = 33720;
    const heRrspRoom = Math.min(maxRrspLimit, heInput.salary * 0.18) + heCarryForwardRrspRoom;
    const heOwnRrspDeductions = heResult.totalRrspDeduction ?? 0;
    const heRemainingRoom = Math.max(0, heRrspRoom - heOwnRrspDeductions);
    
    const spousalContributionAnnual = Math.min(spousalRrspMonthly * 12, heRemainingRoom);
    optimizedSpousalMonthly = spousalContributionAnnual / 12;
    
    const sheOwnRrspOverride = Math.max(0, sheInput.otherSavingsRrspMonthly - optimizedSpousalMonthly);
    
    // Re-run with optimized spousal split
    heResult = calculatePersonTax(heInput, taxConfig, depositEsppToRrsp, (heInput.otherSavingsRrspMonthly || 0) + optimizedSpousalMonthly);
    sheResult = calculatePersonTax(sheInput, taxConfig, depositEsppToRrsp, sheOwnRrspOverride);
  }

  const afni = heResult.taxableIncome + sheResult.taxableIncome;
  const ccbBenefit = calculateCcb(children, afni, ccbConfig);

  const totalHouseholdGross = heInput.salary + (heInput.extraIncomeMonthly || 0) * 12 + sheInput.salary + (sheInput.extraIncomeMonthly || 0) * 12;
  const totalHouseholdNet = heResult.takeHomePay + sheResult.takeHomePay + ccbBenefit;
  const totalHouseholdActualSavings = heResult.actualSavings + sheResult.actualSavings;

  let savingsTargetAmount = 0;
  if (savingsBase === SavingsBase.GROSS) {
    savingsTargetAmount = totalHouseholdGross * savingsTargetRate;
  } else {
    savingsTargetAmount = totalHouseholdNet * savingsTargetRate;
  }

  const savingsDrift = totalHouseholdActualSavings - savingsTargetAmount;
  const actualSavingsRate = totalHouseholdGross > 0 ? totalHouseholdActualSavings / totalHouseholdGross : 0;

  return {
    he: heResult,
    she: sheResult,
    ccbBenefit,
    totalHouseholdGross,
    totalHouseholdNet,
    totalHouseholdActualSavings,
    savingsTargetAmount,
    savingsDrift,
    actualSavingsRate,
    spousalContributionMonthly: optimizedSpousalMonthly,
  };
}


