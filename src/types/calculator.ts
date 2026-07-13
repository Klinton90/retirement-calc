export enum FamilyMember {
  HE = 'HE',
  SHE = 'SHE',
}

export enum SavingsBase {
  GROSS = 'GROSS',
  NET = 'NET',
}

export enum FactorType {
  INFLATION = 'INFLATION',
  CHILD = 'CHILD',
  MATERNITY_LEAVE = 'MATERNITY_LEAVE',
  PATERNITY_LEAVE = 'PATERNITY_LEAVE',
  BLACK_SWAN = 'BLACK_SWAN',
  CUSTOM = 'CUSTOM',
}

export enum ContributionType {
  PERCENTAGE = 'PERCENTAGE',
  FLAT = 'FLAT',
}

export enum AllocationPolicy {
  TFSA_FIRST = 'TFSA_FIRST',
  RRSP_FIRST = 'RRSP_FIRST',
}

export enum FundingRegime {
  UNDER = 'UNDER',
  NEAR = 'NEAR',
  ABOVE = 'ABOVE',
}

/** Investable account ledger. ESPP is not a bucket — it is a contribution source. */
export interface AccountBuckets {
  tfsaHe: number;
  tfsaShe: number;
  rrspHe: number;
  rrspShe: number;
  nonReg: number;
  /** Earmarked cash (e.g. reno) — excluded from investment growth / retirement funding. */
  cashExcluded: number;
}

export interface TaxBracket {
  threshold: number;
  rate: number;
}

export interface TaxConfig {
  federalBrackets: TaxBracket[];
  ontarioBrackets: TaxBracket[];
  federalBpaMax: number;
  federalBpaMin: number;
  federalBpaThreshold1: number;
  federalBpaThreshold2: number;
  ontarioBpa: number;
  cppRate: number;
  cppYmpe: number;
  cppYame: number;
  cpp2Rate: number;
  cppExemption: number;
  cppMaxContribution: number;
  cpp2MaxContribution: number;
  eiRate: number;
  eiMaxEarnings: number;
  eiMaxPremium: number;
}

export interface PensionConfig {
  maxCppMonthly: number;
  maxOasMonthly: number;
  cppContributoryYearsTarget: number;
  oasResidencyYearsTarget: number;
  oasMinResidencyYears: number;
}

export interface CcbConfig {
  maxUnder6: number;
  max6To17: number;
  threshold1: number;
  threshold2: number;
  reduction1ChildTier1: number;
  reduction1ChildTier2: number;
  reduction2ChildrenTier1: number;
  reduction2ChildrenTier2: number;
  reduction3ChildrenTier1: number;
  reduction3ChildrenTier2: number;
  reduction4PlusChildrenTier1: number;
  reduction4PlusChildrenTier2: number;
}

export interface PersonInput {
  name: string;
  age: number;
  salary: number;
  startYearInCanada: number;
  cppStartYear?: number; // year CPP contributions began; falls back to startYearInCanada. OAS residency always uses startYearInCanada.
  retirementAge: number;
  extraIncomeMonthly: number; // monthly side-hustle, rental, or dividend income
  
  // RRSP
  rrspEmployeeType: ContributionType;
  rrspEmployeeValue: number; // percentage or monthly flat amount
  rrspEmployerRate: number; // percentage matching
  
  // ESPP
  esppEmployeeRate: number; // percentage
  esppEmployerRate: number; // percentage matching
  
  // Other savings
  otherSavingsTfsaMonthly: number;
  otherSavingsRrspMonthly: number;

  // Registered Room Carry-forwards
  carryForwardRrspRoom?: number;
  carryForwardTfsaRoom?: number;
}

export interface ExpenseInput {
  id: string;
  label: string;
  amount: number; // monthly amount
  isMandatory: boolean; // true for minimal/need, false for realistic/want
}

export interface ChildInput {
  id: string;
  age: number;
  birthAgeHe?: number; // Father's age at birth (optional)
  sheLeaveMonths?: number;
  heLeaveMonths?: number;
}

export interface FactorInput {
  id: string;
  type: FactorType;
  label: string;
  value: number; // depending on type: percentage or dollar amount
  startAgeHe: number; // start age for He
  durationYears: number;
  isActive: boolean;
}

export interface ChildCostConfig {
  age0To4Mandatory: number; // Daycare age basic needs ($/mo)
  age0To4Realistic: number; // Daycare age realistic wants ($/mo)
  age5To11Mandatory: number; // School age basic needs ($/mo)
  age5To11Realistic: number; // School age realistic wants ($/mo)
  age12To17Mandatory: number; // Teenager basic needs ($/mo)
  age12To17Realistic: number; // Teenager realistic wants ($/mo)
  age18To21Mandatory: number; // University basic needs ($/mo)
  age18To21Realistic: number; // University realistic wants ($/mo)
}

export interface ParentalLeaveConfig {
  heTopupTargetRate: number; // target total salary top-up rate for He, e.g. 0.90 for 90%
  sheTopupTargetRate: number; // target total salary top-up rate for She, e.g. 0.93 for 93%
}

export interface RetirementPlan {
  heInput: PersonInput;
  sheInput: PersonInput;
  children: ChildInput[];
  expenses: ExpenseInput[];
  factors: FactorInput[];
  savingsBase: SavingsBase;
  savingsTargetRate: number; // default 0.20 (20%)
  investmentReturnRate: number; // default 0.05 (5%)
  inflationRate: number; // default 0.02 (2%)
  desiredRetirementSpendMonthly: number; // realistic retirement spend (wants)
  mandatoryRetirementSpendMonthly: number; // minimal retirement spend (needs)
  /** @deprecated Prefer accountBuckets; kept for migration / blended display. */
  currentSavings: number;
  accountBuckets?: AccountBuckets;
  allocationPolicy?: AllocationPolicy;
  /** Age at which each person converts RRSP→RRIF for the contribution backsolve path (default 71). */
  conversionAgeHe?: number;
  conversionAgeShe?: number;
  /** Use younger spouse age for RRIF minimum factors when true. */
  useYoungerSpouseRrifAge?: boolean;
  /** Optional survivor stress (default off). */
  survivorToggle?: boolean;
  survivorYearIndex?: number; // year index into retirement horizon when one spouse dies
  nearRegimeSlackYears?: number; // terminal wealth / annual spend band for NEAR vs ABOVE
  /** Annual new TFSA room per person (nominal CAD). Default 7000. */
  annualTfsaLimit?: number;
  /**
   * If true, scale annualTfsaLimit by the inflation multiplier each year.
   * Default false — CRA sets TFSA limits ad hoc (not CPI-indexed); flat nominal is the better base case.
   */
  inflateAnnualTfsaLimit?: boolean;
  taxConfig: TaxConfig;
  ccbConfig: CcbConfig;
  childCostConfig: ChildCostConfig;
  parentalLeaveConfig: ParentalLeaveConfig;
  lifeExpectancyDelta?: number;
  includeExtraIncome?: boolean;
  depositEsppToRrsp?: boolean;
  esppRefundSaveRate?: number;
  spousalRrspMonthly?: number;
  optimizeSpousalRrsp?: boolean;
  targetTaxAdvantageThreshold?: number;
}

export interface PersonTaxResult {
  salary: number;
  cppBaseContribution: number;
  cpp2Contribution: number;
  cppTotalContribution: number;
  eiPremium: number;
  rrspEmployeeDeduction: number;
  esppEmployeeContribution: number; // after-tax
  taxableIncome: number;
  federalTaxBeforeCredits: number;
  provincialTaxBeforeCredits: number;
  federalBpa: number;
  federalCredits: number;
  provincialCredits: number;
  federalTaxPayable: number;
  provincialTaxPayable: number;
  ontarioSurtax: number;
  ontarioHealthPremium: number;
  totalIncomeTax: number;
  totalDeductions: number; // cpp + ei + total tax
  takeHomePay: number;
  actualSavings: number; // rrsp employee + rrsp employer + espp employee + espp employer + other
  taxSavings?: number; // tax refund generated from ESPP-to-RRSP deposit
  totalRrspDeduction?: number;
}

export interface HouseholdTaxResult {
  he: PersonTaxResult;
  she: PersonTaxResult;
  ccbBenefit: number;
  totalHouseholdGross: number;
  totalHouseholdNet: number;
  totalHouseholdActualSavings: number;
  savingsTargetAmount: number;
  savingsDrift: number;
  actualSavingsRate: number;
  spousalContributionMonthly?: number;
}

export interface ProjectionYear {
  year: number;
  ageHe: number;
  ageShe: number;
  grossIncome: number;
  /** Working: take-home + benefits. Retired: net cash available after tax (pension + all portfolio draws − tax). */
  netIncome: number;
  actualSavings: number;
  ccbBenefit: number;
  childCosts: number; // annual cost of children
  expenses: number;
  pensionIncome: number; // gross CPP+OAS (household)
  pensionNet: number; // pension gross less its share of retirement tax (display approx)
  /** Per-person gross CPP+OAS this year. */
  hePensionGross?: number;
  shePensionGross?: number;
  /** Taxable RRSP/RRIF gross withdrawals (He+She). */
  drawdownGross: number;
  /** @deprecated Prefer tfsaDraw + clearer retirement identity; kept for older UI. */
  drawdownNet: number;
  retirementTax: number; // tax paid in retirement
  /** Tax-free TFSA withdrawals this year (retirement), household total. */
  tfsaDraw?: number;
  /** Per-person retirement draws (gross). */
  heRrspDraw?: number;
  sheRrspDraw?: number;
  heTfsaDraw?: number;
  sheTfsaDraw?: number;
  /** He share of household RRSP/RRIF draw (0–1). Dynamic: mins + “prefer larger balance” policy. */
  heRrspDrawShare?: number;
  /** He share of household TFSA draw (0–1). Dynamic: He-first bridge policy. */
  heTfsaDrawShare?: number;
  /** Non-registered withdrawals this year (retirement). */
  nonRegDraw?: number;
  /** Total portfolio principal withdrawn = RRSP/RRIF + TFSA + non-reg. */
  portfolioDrawTotal?: number;
  portfolioStart: number;
  portfolioEnd: number;
  investmentGain: number;
  savingsDrift: number;
  isRetired: boolean;
  unallocatedCash: number; // unallocated surplus cash today
  heTakeHomePay: number;      // He's net salary pay (salary portion only, excl extra income & ESPP/RRSP refund)
  sheTakeHomePay: number;     // She's net salary pay (salary portion only)
  heExtraIncomeNet: number;   // He's after-tax extra income contribution to net flow
  sheExtraIncomeNet: number;  // She's after-tax extra income contribution to net flow
  taxSavingsPending: number;  // Tax refund received from previous year
  savingsTargetAmount: number; // Formula savings target amount (e.g. 20% of gross/net)
  /** Working years: where this year's savings were deployed (after policy). */
  contribToTfsa?: number;
  contribToRrsp?: number;
  contribToNonReg?: number;
  heRrspRoomRemaining?: number;
  sheRrspRoomRemaining?: number;
  heTfsaRoomRemaining?: number;
  sheTfsaRoomRemaining?: number;
}
