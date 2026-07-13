import {
  type TaxBracket,
  type TaxConfig,
  type CcbConfig,
  type PersonInput,
  type ExpenseInput,
  type ChildCostConfig,
  type ParentalLeaveConfig,
  ContributionType,
} from '../types/calculator';
import { DEFAULT_ACCOUNT_BUCKETS, totalInvestable } from './accountBuckets';

export { DEFAULT_ACCOUNT_BUCKETS, totalInvestable };

export const LOCAL_STORAGE_KEY = 'retiresmart_plan_v1';

// Default Tax Configuration for 2026 tax year
export const DEFAULT_TAX_CONFIG: TaxConfig = {
  federalBrackets: [
    { threshold: 58523, rate: 0.14 },
    { threshold: 117045, rate: 0.205 },
    { threshold: 181440, rate: 0.26 },
    { threshold: 258482, rate: 0.29 },
    { threshold: Infinity, rate: 0.33 },
  ],
  ontarioBrackets: [
    { threshold: 53891, rate: 0.0505 },
    { threshold: 107785, rate: 0.0915 },
    { threshold: 150000, rate: 0.1116 },
    { threshold: 220000, rate: 0.1216 },
    { threshold: Infinity, rate: 0.1316 },
  ],
  federalBpaMax: 16452,
  federalBpaMin: 14829,
  federalBpaThreshold1: 181440,
  federalBpaThreshold2: 258482,
  ontarioBpa: 12989,
  cppRate: 0.0595, // 5.95%
  cppYmpe: 74600,
  cppYame: 85000,
  cpp2Rate: 0.04, // 4%
  cppExemption: 3500,
  cppMaxContribution: 4230.45,
  cpp2MaxContribution: 416.00,
  eiRate: 0.0163, // 1.63%
  eiMaxEarnings: 68900,
  eiMaxPremium: 1123.07,
};

// Default CCB Configuration for July 2026 - June 2027 benefit year
export const DEFAULT_CCB_CONFIG: CcbConfig = {
  maxUnder6: 8157,
  max6To17: 6883,
  threshold1: 38237,
  threshold2: 82847,
  reduction1ChildTier1: 0.07,
  reduction1ChildTier2: 0.032,
  reduction2ChildrenTier1: 0.135,
  reduction2ChildrenTier2: 0.057,
  reduction3ChildrenTier1: 0.19,
  reduction3ChildrenTier2: 0.08,
  reduction4PlusChildrenTier1: 0.23,
  reduction4PlusChildrenTier2: 0.095,
};

// Default initial state populated with USER's exact input parameters
export const INITIAL_HE: PersonInput = {
  name: 'He',
  age: 36,
  salary: 168000,
  startYearInCanada: 2013,
  cppStartYear: 2014,
  retirementAge: 65,
  extraIncomeMonthly: 500,
  rrspEmployeeType: ContributionType.PERCENTAGE,
  rrspEmployeeValue: 3,
  rrspEmployerRate: 3,
  esppEmployeeRate: 10,
  esppEmployerRate: 1.5,
  otherSavingsTfsaMonthly: 0,
  otherSavingsRrspMonthly: 0,
  carryForwardRrspRoom: 144050,
  carryForwardTfsaRoom: 11708,
};

export const INITIAL_SHE: PersonInput = {
  name: 'She',
  age: 38,
  salary: 82000,
  startYearInCanada: 2020,
  cppStartYear: 2022,
  retirementAge: 65,
  extraIncomeMonthly: 400,
  rrspEmployeeType: ContributionType.PERCENTAGE,
  rrspEmployeeValue: 2,
  rrspEmployerRate: 2,
  esppEmployeeRate: 0,
  esppEmployerRate: 0,
  otherSavingsTfsaMonthly: 0,
  otherSavingsRrspMonthly: 0,
  carryForwardRrspRoom: 46117,
  carryForwardTfsaRoom: 25000,
};

export const INITIAL_EXPENSES: ExpenseInput[] = [
  { id: '1', label: 'Mortgage + 20%', amount: 2250, isMandatory: true },
  { id: '2', label: 'Property Tax', amount: 310, isMandatory: true },
  { id: '3', label: 'Hydro', amount: 150, isMandatory: true },
  { id: '4', label: 'Gas', amount: 70, isMandatory: true },
  { id: '5', label: 'Home Insurance', amount: 100, isMandatory: true },
  { id: '6', label: '2 Car Insurance', amount: 400, isMandatory: true },
  { id: '7', label: 'Parents Help', amount: 400, isMandatory: true },
  { id: '8', label: 'Phones', amount: 120, isMandatory: true },
  { id: '9', label: 'Internet', amount: 70, isMandatory: true },
  { id: '10', label: 'Food', amount: 1300, isMandatory: true },
  { id: '11', label: 'Fuel', amount: 300, isMandatory: true },
  { id: '12', label: 'Subscriptions', amount: 200, isMandatory: false },
];

export const DEFAULT_CHILD_COST: ChildCostConfig = {
  age0To4Mandatory: 1000,   // Basic daycare + food needs
  age0To4Realistic: 2000,   // Private childcare, organic food, sports/gymnastics, clothing & toys
  age5To11Mandatory: 800,    // School age food, basic after-school care
  age5To11Realistic: 1350,   // Organic food, after-school programs, sports/music lessons, orthodontics
  age12To17Mandatory: 1000,  // Teen food, cell phone, clothing needs
  age12To17Realistic: 1600,  // Organic food, competitive sports/equipment, tech, socials, dental/health
  age18To21Mandatory: 1200,  // Local university tuition + living at home
  age18To21Realistic: 2500,  // Out-of-town university tuition + residence, food plan, books & expenses
};

export const DEFAULT_PARENTAL_LEAVE: ParentalLeaveConfig = {
  heTopupTargetRate: 0.00,
  sheTopupTargetRate: 0.00,
};

// Helper to calculate tax based on brackets
export function calculateBracketTax(taxableIncome: number, brackets: TaxBracket[]): number {
  let tax = 0;
  let previousThreshold = 0;

  for (const bracket of brackets) {
    if (taxableIncome > bracket.threshold) {
      tax += (bracket.threshold - previousThreshold) * bracket.rate;
      previousThreshold = bracket.threshold;
    } else {
      tax += (taxableIncome - previousThreshold) * bracket.rate;
      break;
    }
  }

  return tax;
}

// Calculate Ontario Health Premium
export function calculateOntarioHealthPremium(taxableIncome: number): number {
  if (taxableIncome <= 20000) {
    return 0;
  }
  
  if (taxableIncome <= 25000) {
    return Math.min(300, (taxableIncome - 20000) * 0.06);
  }
  
  if (taxableIncome <= 36000) {
    return 300 + Math.min(150, (taxableIncome - 25000) * 0.06);
  }
  
  if (taxableIncome <= 38500) {
    return 450 + Math.min(150, (taxableIncome - 36000) * 0.25);
  }
  
  if (taxableIncome <= 48000) {
    return 600;
  }
  
  if (taxableIncome <= 72000) {
    return 600 + Math.min(150, (taxableIncome - 48000) * 0.06);
  }
  
  if (taxableIncome <= 200000) {
    return 750 + Math.min(150, (taxableIncome - 72000) * 0.25);
  }
  
  return 900;
}
