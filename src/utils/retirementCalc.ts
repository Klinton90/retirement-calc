import {
  type RetirementPlan,
  type ProjectionYear,
  FactorType,
  type HouseholdTaxResult,
  type ChildInput,
  type TaxConfig,
  type CcbConfig,
  AllocationPolicy,
} from '../types/calculator';
import { calculateHouseholdTax, calculatePersonTax, DEFAULT_TAX_CONFIG, DEFAULT_CCB_CONFIG } from './taxCalc';
import { calculatePersonPensionForAge } from './pensionCalc';
import { calculatePlanTargets } from './targetEngine';
import {
  totalInvestable,
  resolveBuckets,
  growBuckets,
  cloneBuckets,
  redepositExcess,
} from './accountBuckets';
import { rrifMinimumWithdrawal } from './rrifCalc';
import { calculateHouseholdRetirementTax } from './retirementIncomeTax';
import { oasClawback, DEFAULT_OAS_CLAWBACK_THRESHOLD, DEFAULT_OAS_CLAWBACK_RATE } from './oasClawback';
import { deployAnnualContributions, resolveAnnualTfsaLimit } from './contributionPolicy';

/**
 * Runs a year-by-year financial projection for the household from the current year
 * until He (the primary member) reaches age 95.
 * 
 * @param plan The full retirement plan input configuration
 * @param currentYear The current calendar year (default 2026)
 * @param useMandatoryOnly If true, simulates using ONLY mandatory expenses/retirement spending.
 */
export function runProjection(
  plan: RetirementPlan,
  currentYear: number = 2026,
  useMandatoryOnly: boolean = false,
  additionalSavingsMonthly: number = 0
): ProjectionYear[] {
  const projection: ProjectionYear[] = [];
  
  const startHeAge = plan.heInput.age;
  const startSheAge = plan.sheInput.age;
  const lifeExpectancyDelta = plan.lifeExpectancyDelta ?? 30;
  const targetYears = Math.max(1, (plan.heInput.retirementAge + lifeExpectancyDelta) - startHeAge);
  
  let buckets = resolveBuckets(plan);
  let portfolio = totalInvestable(buckets);
  let inflationMultiplier = 1.0;

  const activeChildren: ChildInput[] = plan.children.map(c => ({ ...c }));

  const taxConfigToUse = plan.taxConfig || DEFAULT_TAX_CONFIG;
  const ccbConfigToUse = plan.ccbConfig || DEFAULT_CCB_CONFIG;
  const conversionAgeHe = plan.conversionAgeHe ?? 71;
  const conversionAgeShe = plan.conversionAgeShe ?? 71;
  const allocationPolicy = plan.allocationPolicy ?? AllocationPolicy.TFSA_FIRST;
  const inflateTfsa = !!plan.inflateAnnualTfsaLimit;

  let pendingRefund = 0;

  let heRrspRoomRemaining = plan.heInput.carryForwardRrspRoom ?? 0;
  let sheRrspRoomRemaining = plan.sheInput.carryForwardRrspRoom ?? 0;
  let heTfsaRoomRemaining = plan.heInput.carryForwardTfsaRoom ?? 0;
  let sheTfsaRoomRemaining = plan.sheInput.carryForwardTfsaRoom ?? 0;

  for (let t = 0; t <= targetYears; t++) {
    const year = currentYear + t;
    const ageHe = startHeAge + t;
    const ageShe = startSheAge + t;

    const heRetired = ageHe >= plan.heInput.retirementAge;
    const sheRetired = ageShe >= plan.sheInput.retirementAge;
    const bothRetired = heRetired && sheRetired;

    // New TFSA room is granted Jan 1 — apply at start of each year after year 0.
    // Year 0 carry-forward already includes the current calendar year's limit.
    // Default: flat nominal CAD (CRA does not CPI-index TFSA); optional inflate flag.
    if (t > 0) {
      const annualTfsaLimit = resolveAnnualTfsaLimit(
        plan.annualTfsaLimit,
        inflateTfsa,
        inflationMultiplier
      );
      heTfsaRoomRemaining += annualTfsaLimit;
      sheTfsaRoomRemaining += annualTfsaLimit;
    }

    // 1. Determine active factors for this year
    let currentInflationRate = plan.inflationRate;
    let heSalaryFactor = 1.0;
    let sheSalaryFactor = 1.0;
    let extraExpenses = 0;
    let portfolioMultiplier = 1.0;

    for (const factor of plan.factors) {
      if (!factor.isActive) continue;
      const isAgeInRangeHe = ageHe >= factor.startAgeHe && ageHe < factor.startAgeHe + factor.durationYears;

      if (isAgeInRangeHe) {
        switch (factor.type) {
          case FactorType.INFLATION:
            currentInflationRate = factor.value / 100;
            break;
          case FactorType.BLACK_SWAN:
            if (factor.value < 100 && factor.value > 0) {
              portfolioMultiplier = 1.0 - (factor.value / 100);
            } else {
              extraExpenses += factor.value * inflationMultiplier;
            }
            break;
          case FactorType.CHILD:
            extraExpenses += factor.value * inflationMultiplier;
            break;
          case FactorType.CUSTOM:
            if (factor.value < 0) {
              extraExpenses += Math.abs(factor.value) * inflationMultiplier;
            } else {
              extraExpenses -= factor.value * inflationMultiplier;
            }
            break;
        }
      }
    }

    // Update children's ages for this year
    const currentChildrenAges = activeChildren.map(c => {
      const birthAgeHe = c.birthAgeHe ?? (startHeAge - c.age);
      const childAgeInYear = ageHe - birthAgeHe;
      return {
        id: c.id,
        age: childAgeInYear,
      };
    });

    // Calculate automatic parental leave salary reductions tied to child birth years
    let sheTotalPaidLeaveMonths = 0;
    let sheTotalUnpaidLeaveMonths = 0;
    let heTotalPaidLeaveMonths = 0;

    if (!heRetired || !sheRetired) {
      for (const child of currentChildrenAges) {
        if (child.age >= 0) {
          const childConfig = plan.children.find(c => c.id === child.id);
          // She parental leave: paid for first 12 months (EI + topup), unpaid for months 13+
          const sheLeaveMonthsTotal = childConfig?.sheLeaveMonths ?? 12;
          const sheLeaveMonthsInThisYear = Math.min(12, Math.max(0, sheLeaveMonthsTotal - child.age * 12));
          
          const shePaidMonthsInThisYear = Math.min(12, Math.max(0, Math.min(12, sheLeaveMonthsTotal) - child.age * 12));
          const sheUnpaidMonthsInThisYear = sheLeaveMonthsInThisYear - shePaidMonthsInThisYear;

          sheTotalPaidLeaveMonths += shePaidMonthsInThisYear;
          sheTotalUnpaidLeaveMonths += sheUnpaidMonthsInThisYear;

          // He parental leave: paid via company top-up target only (no EI since She uses it)
          const heLeaveMonthsTotal = childConfig?.heLeaveMonths ?? 2;
          const heLeaveMonthsInThisYear = Math.min(12, Math.max(0, heLeaveMonthsTotal - child.age * 12));
          heTotalPaidLeaveMonths += heLeaveMonthsInThisYear;
        }
      }
    }

    // Cap total leave months in a single year to 12
    const shePaidMonths = Math.min(12, sheTotalPaidLeaveMonths);
    const sheUnpaidMonths = Math.min(12 - shePaidMonths, sheTotalUnpaidLeaveMonths);
    const hePaidMonths = Math.min(12, heTotalPaidLeaveMonths);

    // Apply She salary factor
    if (shePaidMonths > 0 || sheUnpaidMonths > 0) {
      const workingMonths = 12 - (shePaidMonths + sheUnpaidMonths);
      const workingIncomeFraction = workingMonths / 12;
      
      const baseSalary = plan.sheInput.salary * inflationMultiplier;
      if (baseSalary > 0) {
        const maxEiEarnings = (taxConfigToUse.eiMaxPremium / taxConfigToUse.eiRate) * inflationMultiplier;
        const annualEiBenefit = Math.min(baseSalary, maxEiEarnings) * 0.55;
        const topupTarget = plan.parentalLeaveConfig?.sheTopupTargetRate ?? 0.70;
        const paidIncomeFraction = Math.max(annualEiBenefit / baseSalary, topupTarget) * (shePaidMonths / 12);
        sheSalaryFactor = workingIncomeFraction + paidIncomeFraction;
      } else {
        sheSalaryFactor = 0;
      }
    }

    // Apply He salary factor
    if (hePaidMonths > 0) {
      const workingMonths = 12 - hePaidMonths;
      const workingIncomeFraction = workingMonths / 12;
      
      const baseSalary = plan.heInput.salary * inflationMultiplier;
      if (baseSalary > 0) {
        const topupTarget = plan.parentalLeaveConfig?.heTopupTargetRate ?? 0.00;
        const paidIncomeFraction = topupTarget * (hePaidMonths / 12);
        heSalaryFactor = workingIncomeFraction + paidIncomeFraction;
      } else {
        heSalaryFactor = 0;
      }
    }

    // 2. Calculate inflated salaries and expenses
    const inflatedHeSalary = heRetired ? 0 : plan.heInput.salary * inflationMultiplier * heSalaryFactor;
    const inflatedSheSalary = sheRetired ? 0 : plan.sheInput.salary * inflationMultiplier * sheSalaryFactor;
    const includeExtra = plan.includeExtraIncome ?? true;
    const inflatedHeExtra = heRetired || !includeExtra ? 0 : plan.heInput.extraIncomeMonthly * inflationMultiplier;
    const inflatedSheExtra = sheRetired || !includeExtra ? 0 : plan.sheInput.extraIncomeMonthly * inflationMultiplier;

    // Filter expenses by mandatory vs realistic
    const activeExpensesList = useMandatoryOnly 
      ? plan.expenses.filter(e => e.isMandatory)
      : plan.expenses;

    const baseMonthlyExpenses = activeExpensesList.reduce((sum, exp) => sum + exp.amount, 0);
    let annualExpenses = baseMonthlyExpenses * 12 * inflationMultiplier;

    // Replace working expenses with correct retirement spend target
    if (bothRetired) {
      const retirementSpendMonthly = useMandatoryOnly 
        ? plan.mandatoryRetirementSpendMonthly 
        : plan.desiredRetirementSpendMonthly;
      annualExpenses = retirementSpendMonthly * 12 * inflationMultiplier;
    }

    annualExpenses += extraExpenses;

    // Calculate age-tiered child costs (only up to age 21, inflated to match future costs of living)
    let childCostsAnnual = 0;
    for (const child of currentChildrenAges) {
      if (child.age < 0) continue;
      let monthlyCost = 0;
      if (child.age <= 4) {
        monthlyCost = useMandatoryOnly ? plan.childCostConfig.age0To4Mandatory : plan.childCostConfig.age0To4Realistic;
      } else if (child.age <= 11) {
        monthlyCost = useMandatoryOnly ? plan.childCostConfig.age5To11Mandatory : plan.childCostConfig.age5To11Realistic;
      } else if (child.age <= 17) {
        monthlyCost = useMandatoryOnly ? plan.childCostConfig.age12To17Mandatory : plan.childCostConfig.age12To17Realistic;
      } else if (child.age <= 21) {
        monthlyCost = useMandatoryOnly ? plan.childCostConfig.age18To21Mandatory : plan.childCostConfig.age18To21Realistic;
      }
      childCostsAnnual += monthlyCost * 12 * inflationMultiplier;
    }
    annualExpenses += childCostsAnnual;

    // 3. Run Tax and Pension Calculations
    let taxResult: HouseholdTaxResult;
    let pensionIncome = 0;

    const yearTaxConfig = inflateTaxConfig(taxConfigToUse, inflationMultiplier);
    const yearCcbConfig = inflateCcbConfig(ccbConfigToUse, inflationMultiplier);

    // Salary-only baselines (extra income = 0) — used to isolate the salary column in the table
    let heNetSalaryOnly = 0;
    let sheNetSalaryOnly = 0;
    let heExtraIncomeNet = 0;
    let sheExtraIncomeNet = 0;

    if (!heRetired || !sheRetired) {
      const currentHeInput = {
        ...plan.heInput,
        salary: inflatedHeSalary,
        extraIncomeMonthly: heRetired || !includeExtra ? 0 : plan.heInput.extraIncomeMonthly * inflationMultiplier,
        rrspEmployeeValue: heRetired ? 0 : plan.heInput.rrspEmployeeValue,
        esppEmployeeRate: heRetired ? 0 : plan.heInput.esppEmployeeRate,
      };

      const currentSheInput = {
        ...plan.sheInput,
        salary: inflatedSheSalary,
        extraIncomeMonthly: sheRetired || !includeExtra ? 0 : plan.sheInput.extraIncomeMonthly * inflationMultiplier,
        rrspEmployeeValue: sheRetired ? 0 : plan.sheInput.rrspEmployeeValue,
        esppEmployeeRate: sheRetired ? 0 : plan.sheInput.esppEmployeeRate,
      };

      const spousalRrspMonthly = (plan.optimizeSpousalRrsp && !heRetired && !sheRetired) ? (plan.spousalRrspMonthly || 0) : 0;

      taxResult = calculateHouseholdTax(
        currentHeInput,
        currentSheInput,
        currentChildrenAges,
        plan.savingsBase,
        plan.savingsTargetRate,
        yearTaxConfig,
        yearCcbConfig,
        plan.depositEsppToRrsp ?? false,
        spousalRrspMonthly,
        heRrspRoomRemaining
      );

      // Compute salary-only net independently so the column is stable when toggling extra income.
      // Extra income net = (full takeHome − taxSavings) − salary-only takeHome
      // This properly captures the marginal tax drag that extra income places on salary.
      if (!heRetired) {
        const heBaseline = calculatePersonTax(
          { ...currentHeInput, extraIncomeMonthly: 0 },
          yearTaxConfig,
          plan.depositEsppToRrsp ?? false,
          (currentHeInput.otherSavingsRrspMonthly || 0) + (taxResult.spousalContributionMonthly || 0)
        );
        heNetSalaryOnly = heBaseline.takeHomePay - (taxResult.he.taxSavings ?? 0);
        heExtraIncomeNet = (taxResult.he.takeHomePay - (taxResult.he.taxSavings ?? 0)) - heNetSalaryOnly;
      }
      if (!sheRetired) {
        const sheBaseline = calculatePersonTax(
          { ...currentSheInput, extraIncomeMonthly: 0 },
          yearTaxConfig,
          plan.depositEsppToRrsp ?? false,
          Math.max(0, (currentSheInput.otherSavingsRrspMonthly || 0) - (taxResult.spousalContributionMonthly || 0))
        );
        sheNetSalaryOnly = sheBaseline.takeHomePay - (taxResult.she.taxSavings ?? 0);
        sheExtraIncomeNet = (taxResult.she.takeHomePay - (taxResult.she.taxSavings ?? 0)) - sheNetSalaryOnly;
      }
    } else {
      taxResult = createZeroHouseholdTaxResult(inflatedHeSalary, inflatedSheSalary);
    }


    // Pension — age-specific (OAS from 65 even if retired earlier)
    let hePenAnnual = 0;
    let shePenAnnual = 0;
    let heOasAnnual = 0;
    let sheOasAnnual = 0;
    let heCppAnnual = 0;
    let sheCppAnnual = 0;
    if (heRetired || sheRetired) {
      const yearPensionCfg = inflatePensionConfig(inflationMultiplier);
      if (heRetired) {
        const hp = calculatePersonPensionForAge(plan.heInput, currentYear, ageHe, yearPensionCfg, yearTaxConfig);
        hePenAnnual = hp.totalPensionAnnual;
        heOasAnnual = hp.oasAnnual;
        heCppAnnual = hp.cppAnnual;
        pensionIncome += hePenAnnual;
      }
      if (sheRetired) {
        const sp = calculatePersonPensionForAge(plan.sheInput, currentYear, ageShe, yearPensionCfg, yearTaxConfig);
        shePenAnnual = sp.totalPensionAnnual;
        sheOasAnnual = sp.oasAnnual;
        sheCppAnnual = sp.cppAnnual;
        pensionIncome += shePenAnnual;
      }
    }

    // 4. Decumulation & Progressive Tax Solver in Retirement
    let drawdownGross = 0;
    let drawdownNet = 0;
    let retirementTax = 0;
    let pensionNet = 0;
    let grossIncome = inflatedHeSalary + (heRetired ? 0 : inflatedHeExtra * 12) + inflatedSheSalary + (sheRetired ? 0 : inflatedSheExtra * 12) + pensionIncome;
    let netIncome = 0;
    let unallocatedCash = 0;
    let tfsaDraw = 0;
    let nonRegDrawAmt = 0;
    let portfolioDrawTotal = 0;
    let portfolioStartBeforeDraw = 0;
    let heRrspDrawAmt = 0;
    let sheRrspDrawAmt = 0;
    let heTfsaDrawAmt = 0;
    let sheTfsaDrawAmt = 0;
    let contribToTfsa = 0;
    let contribToRrsp = 0;
    let contribToNonReg = 0;

    const additionalSavingsAnnual = additionalSavingsMonthly * 12 * inflationMultiplier;
    const refundSaveRate = plan.esppRefundSaveRate ?? 0.50;
    const reinvestedRefund = bothRetired ? 0 : (refundSaveRate * pendingRefund);
    const totalSavingsThisYear = bothRetired ? 0 : (taxResult.totalHouseholdActualSavings + additionalSavingsAnnual + reinvestedRefund);

    const currentYearTaxSavings = (taxResult.he.taxSavings ?? 0) + (taxResult.she.taxSavings ?? 0);

    if (!bothRetired) {
      pensionNet = pensionIncome * 0.85;
      netIncome = taxResult.he.takeHomePay + taxResult.she.takeHomePay + taxResult.ccbBenefit + pensionNet - currentYearTaxSavings + pendingRefund;
      unallocatedCash = netIncome - totalSavingsThisYear - annualExpenses;
    } else {
      // Bucket-aware retirement: RRIF mins → TFSA bridge → taxable RRSP → non-reg; RRIF-only split
      portfolioStartBeforeDraw = totalInvestable(buckets);
      const heConverted = ageHe >= conversionAgeHe;
      const sheConverted = ageShe >= conversionAgeShe;
      const rrifMinHe = heConverted ? rrifMinimumWithdrawal(buckets.rrspHe, ageHe) : 0;
      const rrifMinShe = sheConverted ? rrifMinimumWithdrawal(buckets.rrspShe, ageShe) : 0;

      let low = 0;
      let high = annualExpenses * 3 + totalInvestable(buckets) + 1;
      let bestTax = 0;
      let bestDrawHe = Math.min(buckets.rrspHe, rrifMinHe);
      let bestDrawShe = Math.min(buckets.rrspShe, rrifMinShe);
      let bestTfsaHe = 0;
      let bestTfsaShe = 0;
      let bestNonReg = 0;
      let bestTrial = cloneBuckets(buckets);
      let bestNet = 0;

      for (let iter = 0; iter < 18; iter++) {
        const extra = (low + high) / 2;
        const t = cloneBuckets(buckets);
        let dHe = Math.min(t.rrspHe, rrifMinHe);
        let dShe = Math.min(t.rrspShe, rrifMinShe);
        t.rrspHe -= dHe;
        t.rrspShe -= dShe;

        const roughNet = heCppAnnual + sheCppAnnual + heOasAnnual + sheOasAnnual + dHe + dShe;
        let bridgeNeed = Math.max(0, annualExpenses - roughNet);
        // TFSA bridge policy: He first, then She (not a fixed %)
        let tfsaHeTaken = 0;
        let tfsaSheTaken = 0;
        const th = Math.min(t.tfsaHe, bridgeNeed);
        t.tfsaHe -= th;
        tfsaHeTaken += th;
        bridgeNeed -= th;
        const ts = Math.min(t.tfsaShe, bridgeNeed);
        t.tfsaShe -= ts;
        tfsaSheTaken += ts;

        let rem = extra;
        // Extra RRSP policy: repeatedly take from the larger remaining RRSP (not fixed %)
        while (rem > 1e-6 && (t.rrspHe > 0 || t.rrspShe > 0)) {
          if (t.rrspHe >= t.rrspShe) {
            const take = Math.min(t.rrspHe, rem);
            t.rrspHe -= take;
            dHe += take;
            rem -= take;
          } else {
            const take = Math.min(t.rrspShe, rem);
            t.rrspShe -= take;
            dShe += take;
            rem -= take;
          }
        }
        let nonRegTaken = 0;
        if (rem > 0) {
          nonRegTaken = Math.min(t.nonReg, rem);
          t.nonReg -= nonRegTaken;
        }

        const heClaw = oasClawback(
          heOasAnnual,
          heCppAnnual + heOasAnnual + dHe,
          DEFAULT_OAS_CLAWBACK_THRESHOLD * inflationMultiplier,
          DEFAULT_OAS_CLAWBACK_RATE
        );
        const sheClaw = oasClawback(
          sheOasAnnual,
          sheCppAnnual + sheOasAnnual + dShe,
          DEFAULT_OAS_CLAWBACK_THRESHOLD * inflationMultiplier,
          DEFAULT_OAS_CLAWBACK_RATE
        );
        const canSplit = ageHe >= 65 && ageShe >= 65;
        const nonRegTaxable = nonRegTaken * 0.5;
        const taxRes = calculateHouseholdRetirementTax(
          heCppAnnual + heClaw.oasAfter + dHe + nonRegTaxable / 2,
          sheCppAnnual + sheClaw.oasAfter + dShe + nonRegTaxable / 2,
          ageHe >= 65 ? dHe : 0,
          ageShe >= 65 ? dShe : 0,
          yearTaxConfig,
          canSplit
        );
        const netCash =
          heClaw.oasAfter +
          sheClaw.oasAfter +
          heCppAnnual +
          sheCppAnnual +
          dHe +
          dShe +
          tfsaHeTaken +
          tfsaSheTaken +
          nonRegTaken -
          taxRes.totalTax;
        const shortfall = Math.max(0, annualExpenses - netCash);

        if (shortfall > 0.5) {
          low = extra;
        } else {
          high = extra;
          bestTax = taxRes.totalTax;
          bestDrawHe = dHe;
          bestDrawShe = dShe;
          bestTfsaHe = tfsaHeTaken;
          bestTfsaShe = tfsaSheTaken;
          bestNonReg = nonRegTaken;
          bestTrial = t;
          bestNet = netCash;
          if (netCash > annualExpenses + 1) {
            Object.assign(
              bestTrial,
              redepositExcess(
                t,
                netCash - annualExpenses,
                heTfsaRoomRemaining,
                sheTfsaRoomRemaining
              )
            );
          }
        }
      }

      buckets = bestTrial;
      const rrspDraw = bestDrawHe + bestDrawShe;
      const tfsaTotal = bestTfsaHe + bestTfsaShe;
      drawdownGross = rrspDraw;
      retirementTax = bestTax;
      heRrspDrawAmt = bestDrawHe;
      sheRrspDrawAmt = bestDrawShe;
      heTfsaDrawAmt = bestTfsaHe;
      sheTfsaDrawAmt = bestTfsaShe;
      tfsaDraw = tfsaTotal;
      nonRegDrawAmt = bestNonReg;
      portfolioDrawTotal = rrspDraw + tfsaTotal + bestNonReg;
      // Taxable gross (TFSA excluded — tax-free)
      grossIncome = pensionIncome + rrspDraw + bestNonReg * 0.5;
      // Actual cash available after tax — identity: pension + draws − tax ≈ spend when funded
      netIncome = bestNet;
      const taxableBase = Math.max(1e-9, pensionIncome + rrspDraw + bestNonReg * 0.5);
      pensionNet = Math.max(0, pensionIncome - (pensionIncome / taxableBase) * retirementTax);
      drawdownNet = Math.max(0, rrspDraw + bestNonReg - (retirementTax - (pensionIncome - pensionNet)));
      unallocatedCash = 0;
    }

    // Growth step — for retirement, portfolioStart is pre-draw; buckets already post-draw
    const portfolioStart = bothRetired ? portfolioStartBeforeDraw : totalInvestable(buckets);
    let portfolioEnd = bothRetired ? totalInvestable(buckets) : portfolioStart;
    let investmentGain = 0;

    if (!bothRetired) {
      const netContribution = totalSavingsThisYear + Math.min(0, unallocatedCash);

      // Returns on opening balance only — this year's contributions do not earn a full-year return.
      buckets = growBuckets(buckets, plan.investmentReturnRate);
      if (portfolioMultiplier !== 1) {
        buckets = {
          ...buckets,
          tfsaHe: buckets.tfsaHe * portfolioMultiplier,
          tfsaShe: buckets.tfsaShe * portfolioMultiplier,
          rrspHe: buckets.rrspHe * portfolioMultiplier,
          rrspShe: buckets.rrspShe * portfolioMultiplier,
          nonReg: buckets.nonReg * portfolioMultiplier,
        };
      }
      investmentGain = totalInvestable(buckets) - portfolioStart;

      if (netContribution >= 0) {
        // Payroll RRSP = employee deduction (+ ESPP→RRSP if that toggle is on). Employer match is separate.
        const hePayroll = taxResult.he.totalRrspDeduction ?? 0;
        const shePayroll = taxResult.she.totalRrspDeduction ?? 0;
        const heMatch = inflatedHeSalary * ((plan.heInput.rrspEmployerRate || 0) / 100);
        const sheMatch = inflatedSheSalary * ((plan.sheInput.rrspEmployerRate || 0) / 100);
        // Discretionary = ESPP sale cash + other TFSA/manual savings etc. (not payroll/match)
        const discretionary = Math.max(
          0,
          netContribution - hePayroll - shePayroll - heMatch - sheMatch
        );
        const rooms = {
          tfsaHe: heTfsaRoomRemaining,
          tfsaShe: sheTfsaRoomRemaining,
          rrspHe: heRrspRoomRemaining,
          rrspShe: sheRrspRoomRemaining,
        };
        const deployed = deployAnnualContributions({
          personalInvestable: discretionary,
          payrollRrspHe: hePayroll,
          payrollRrspShe: shePayroll,
          employerMatchHe: heMatch,
          employerMatchShe: sheMatch,
          policy: allocationPolicy,
          rooms,
          buckets,
        });
        buckets = deployed.buckets;
        heTfsaRoomRemaining = deployed.rooms.tfsaHe;
        sheTfsaRoomRemaining = deployed.rooms.tfsaShe;
        heRrspRoomRemaining = deployed.rooms.rrspHe;
        sheRrspRoomRemaining = deployed.rooms.rrspShe;
        contribToTfsa = deployed.toTfsa;
        contribToRrsp = deployed.toRrsp;
        contribToNonReg = deployed.toNonReg;
      } else {
        // Deficit: draw from non-reg → TFSA → RRSP (after growth)
        let need = -netContribution;
        const take = (field: 'nonReg' | 'tfsaHe' | 'tfsaShe' | 'rrspHe' | 'rrspShe') => {
          const t = Math.min(buckets[field], need);
          buckets[field] -= t;
          need -= t;
        };
        take('nonReg');
        take('tfsaHe');
        take('tfsaShe');
        take('rrspHe');
        take('rrspShe');
      }
      portfolioEnd = totalInvestable(buckets);
      portfolio = Math.max(0, portfolioEnd);
    } else {
      buckets = growBuckets(buckets, plan.investmentReturnRate);
      if (portfolioMultiplier !== 1) {
        buckets = {
          ...buckets,
          tfsaHe: buckets.tfsaHe * portfolioMultiplier,
          tfsaShe: buckets.tfsaShe * portfolioMultiplier,
          rrspHe: buckets.rrspHe * portfolioMultiplier,
          rrspShe: buckets.rrspShe * portfolioMultiplier,
          nonReg: buckets.nonReg * portfolioMultiplier,
        };
      }
      portfolioEnd = totalInvestable(buckets);
      // Start was pre-draw; end is post-draw + growth. Gain = end − (start − total draws).
      investmentGain = portfolioEnd - (portfolioStart - portfolioDrawTotal);
      portfolio = portfolioEnd;
    }
    // New RRSP room from this year's earned income (available going into next year).
    // TFSA annual limit is applied at the *start* of the following year (see loop head).
    const maxRrspLimit = 33720 * inflationMultiplier;
    const newHeRrspRoom = heRetired ? 0 : Math.min(maxRrspLimit, inflatedHeSalary * 0.18);
    const newSheRrspRoom = sheRetired ? 0 : Math.min(maxRrspLimit, inflatedSheSalary * 0.18);
    heRrspRoomRemaining += newHeRrspRoom;
    sheRrspRoomRemaining += newSheRrspRoom;

    projection.push({
      year,
      ageHe,
      ageShe,
      grossIncome,
      netIncome,
      actualSavings: totalSavingsThisYear,
      ccbBenefit: bothRetired ? 0 : taxResult.ccbBenefit,
      childCosts: childCostsAnnual,
      expenses: annualExpenses,
      pensionIncome,
      pensionNet,
      hePensionGross: hePenAnnual,
      shePensionGross: shePenAnnual,
      drawdownGross,
      drawdownNet,
      retirementTax,
      tfsaDraw,
      heRrspDraw: heRrspDrawAmt,
      sheRrspDraw: sheRrspDrawAmt,
      heTfsaDraw: heTfsaDrawAmt,
      sheTfsaDraw: sheTfsaDrawAmt,
      heRrspDrawShare:
        heRrspDrawAmt + sheRrspDrawAmt > 0
          ? heRrspDrawAmt / (heRrspDrawAmt + sheRrspDrawAmt)
          : undefined,
      heTfsaDrawShare:
        heTfsaDrawAmt + sheTfsaDrawAmt > 0
          ? heTfsaDrawAmt / (heTfsaDrawAmt + sheTfsaDrawAmt)
          : undefined,
      nonRegDraw: nonRegDrawAmt,
      portfolioDrawTotal,
      portfolioStart,
      portfolioEnd: portfolio,
      investmentGain,
      savingsDrift: bothRetired ? 0 : (totalSavingsThisYear - taxResult.savingsTargetAmount),
      isRetired: bothRetired,
      unallocatedCash,
      heTakeHomePay: heNetSalaryOnly,
      sheTakeHomePay: sheNetSalaryOnly,
      heExtraIncomeNet,
      sheExtraIncomeNet,
      taxSavingsPending: pendingRefund,
      savingsTargetAmount: bothRetired ? 0 : taxResult.savingsTargetAmount,
      contribToTfsa,
      contribToRrsp,
      contribToNonReg,
      heRrspRoomRemaining,
      sheRrspRoomRemaining,
      heTfsaRoomRemaining,
      sheTfsaRoomRemaining,
    });

    inflationMultiplier *= (1 + currentInflationRate);
    pendingRefund = currentYearTaxSavings;
  }

  return projection;
}

function inflateTaxConfig(config: TaxConfig, multiplier: number): TaxConfig {
  return {
    ...config,
    federalBrackets: config.federalBrackets.map(b => ({
      threshold: b.threshold === Infinity ? Infinity : b.threshold * multiplier,
      rate: b.rate,
    })),
    ontarioBrackets: config.ontarioBrackets.map(b => ({
      threshold: b.threshold === Infinity ? Infinity : b.threshold * multiplier,
      rate: b.rate,
    })),
    federalBpaMax: config.federalBpaMax * multiplier,
    federalBpaMin: config.federalBpaMin * multiplier,
    federalBpaThreshold1: config.federalBpaThreshold1 * multiplier,
    federalBpaThreshold2: config.federalBpaThreshold2 * multiplier,
    ontarioBpa: config.ontarioBpa * multiplier,
    cppYmpe: config.cppYmpe * multiplier,
    cppYame: config.cppYame * multiplier,
    cppMaxContribution: config.cppMaxContribution * multiplier,
    cpp2MaxContribution: config.cpp2MaxContribution * multiplier,
    eiMaxEarnings: config.eiMaxEarnings * multiplier,
    eiMaxPremium: config.eiMaxPremium * multiplier,
  };
}

function inflateCcbConfig(config: CcbConfig, multiplier: number): CcbConfig {
  return {
    ...config,
    maxUnder6: config.maxUnder6 * multiplier,
    max6To17: config.max6To17 * multiplier,
    threshold1: config.threshold1 * multiplier,
    threshold2: config.threshold2 * multiplier,
  };
}

function inflatePensionConfig(multiplier: number) {
  return {
    maxCppMonthly: 1507.65 * multiplier,
    maxOasMonthly: 743.05 * multiplier,
    cppContributoryYearsTarget: 39,
    oasResidencyYearsTarget: 40,
    oasMinResidencyYears: 10,
  };
}

function createZeroHouseholdTaxResult(heSalary: number, sheSalary: number): HouseholdTaxResult {
  const zeroPerson = (salary: number) => ({
    salary,
    cppBaseContribution: 0,
    cpp2Contribution: 0,
    cppTotalContribution: 0,
    eiPremium: 0,
    rrspEmployeeDeduction: 0,
    esppEmployeeContribution: 0,
    taxableIncome: 0,
    federalTaxBeforeCredits: 0,
    provincialTaxBeforeCredits: 0,
    federalBpa: 0,
    federalCredits: 0,
    provincialCredits: 0,
    federalTaxPayable: 0,
    provincialTaxPayable: 0,
    ontarioSurtax: 0,
    ontarioHealthPremium: 0,
    totalIncomeTax: 0,
    totalDeductions: 0,
    takeHomePay: 0,
    actualSavings: 0,
  });

  return {
    he: zeroPerson(heSalary),
    she: zeroPerson(sheSalary),
    ccbBenefit: 0,
    totalHouseholdGross: heSalary + sheSalary,
    totalHouseholdNet: 0,
    totalHouseholdActualSavings: 0,
    savingsTargetAmount: 0,
    savingsDrift: 0,
    actualSavingsRate: 0,
  };
}

/**
 * Computes the minimum retirement nest egg (lump sum) required at retirement date
 * so that the portfolio reaches exactly $0 at the end of `postRetirementYears`,
 * given a target spending level, an inflation rate (spend grows annually), and
 * an investment return rate (portfolio grows on remaining balance).
 *
 * Government pension income (CPP + OAS, in today's dollars) reduces the net drawdown
 * required from the portfolio each year. Both spend and pension are assumed to grow
 * at the same inflation rate, so the net drawdown also grows at that rate.
 *
 * Uses the Present-Value-of-a-Growing-Annuity formula (end-of-year cash flows):
 *   PV = A * [1 - ((1+g)/(1+r))^n] / (r - g)    when r ≠ g
 *   PV = A * n                                     when r = g
 * where A = first-year net drawdown from portfolio, r = investment return, g = inflation.
 *
 * Simulation uses end-of-year model: portfolio grows first, then withdrawal is taken.
 * This is consistent with the PV formula and produces portfolioCurve[n] ≈ 0.
 *
 * @param retireSpendMonthly   Target gross monthly spend in today's dollars
 * @param postRetirementYears  Number of years in retirement (portfolio must last this long)
 * @param inflationRate        Annual inflation rate (e.g. 0.02 for 2%)
 * @param investmentReturnRate Annual portfolio return rate (e.g. 0.05 for 5%)
 * @param yearsToRetirement    Working years remaining until first retirement year
 * @param currentSavings       Current portfolio balance (today's dollars)
 * @param monthlyPensionNet    Combined CPP + OAS monthly income in today's dollars (default 0)
 */
export interface MinNestEggResult {
  nestEgg: number;               // Required lump sum AT retirement (nominal future dollars)
  monthlySavingsNeeded: number;  // Constant monthly savings from today to hit the nest egg
  portfolioCurve: number[];      // Portfolio balance at start of each post-retirement year (n+1 points, last ≈ 0)
  annualSpendCurve: number[];    // Gross inflation-adjusted annual spend per post-retirement year (n points)
  shortfallFromCurrent: number;  // nestEgg minus FV of current savings at retirement (0 if already funded)
}

export interface MinSavingsRequiredResult {
  monthlySavingsNeeded: number;
  nestEgg: number;
  portfolioCurve: number[];
  annualSpendCurve: number[];
  shortfallFromCurrent: number;
  isFunded: boolean;
  firstYearPensionGross: number;
  projection: ProjectionYear[];
  regime?: import('../types/calculator').FundingRegime;
  recommendedConversion?: import('./targetEngine').ConversionScenarioResult;
  runnersUp?: import('./targetEngine').ConversionScenarioResult[];
  allocationPolicy?: import('../types/calculator').AllocationPolicy;
}

export function calculateMinSavingsRequired(
  plan: RetirementPlan,
  currentYear: number,
  useMandatoryOnly: boolean
): MinSavingsRequiredResult {
  const targets = calculatePlanTargets(plan, currentYear, useMandatoryOnly);
  const projection = runProjection(
    {
      ...plan,
      currentSavings: totalInvestable(resolveBuckets(plan)),
      allocationPolicy: plan.allocationPolicy ?? AllocationPolicy.TFSA_FIRST,
    },
    currentYear,
    useMandatoryOnly,
    targets.monthlyPersonalSavingsNeeded
  );

  return {
    monthlySavingsNeeded: targets.monthlyPersonalSavingsNeeded,
    nestEgg: targets.nestEggAtRetirement,
    portfolioCurve: targets.portfolioCurve,
    annualSpendCurve: targets.annualSpendCurve,
    shortfallFromCurrent: targets.shortfallFromCurrentPath,
    isFunded: targets.isFundedWithoutExtra,
    firstYearPensionGross: targets.firstYearPensionGross,
    projection,
    // Extended fields consumed by UI when present
    ...( {
      regime: targets.regime,
      recommendedConversion: targets.recommendedConversion,
      runnersUp: targets.runnersUp,
      allocationPolicy: targets.allocationPolicy,
      surplusSpend: targets.surplusSpend,
      currentPathPortfolioCurve: targets.currentPathPortfolioCurve,
    } as object),
  };
}

/** @deprecated Closed-form ignored pension and disagreed with simulation — use calculatePlanTargets. */
export function calculateMinimumNestEgg(
  retireSpendMonthly: number,
  postRetirementYears: number,
  inflationRate: number,
  investmentReturnRate: number,
  yearsToRetirement: number,
  currentSavings: number,
  _monthlyPensionNet: number = 0
): MinNestEggResult {
  // Demoted sanity stub: grow-annuity without pension (explicitly labeled by callers if used).
  const n = Math.max(1, Math.round(postRetirementYears));
  const r = investmentReturnRate;
  const g = inflationRate;
  const inflationFactor = Math.pow(1 + g, yearsToRetirement);
  const firstYearAnnualSpend = retireSpendMonthly * 12 * inflationFactor;
  let nestEgg: number;
  if (Math.abs(r - g) < 1e-9) {
    nestEgg = firstYearAnnualSpend * n;
  } else {
    nestEgg = firstYearAnnualSpend * (1 - Math.pow((1 + g) / (1 + r), n)) / (r - g);
  }
  nestEgg = Math.max(0, nestEgg);
  const fvCurrentSavings = currentSavings * Math.pow(1 + r, yearsToRetirement);
  const shortfallFromCurrent = Math.max(0, nestEgg - fvCurrentSavings);
  let monthlySavingsNeeded = 0;
  if (yearsToRetirement > 0 && shortfallFromCurrent > 0) {
    const months = yearsToRetirement * 12;
    const rm = Math.pow(1 + r, 1 / 12) - 1;
    monthlySavingsNeeded = rm < 1e-12
      ? shortfallFromCurrent / months
      : shortfallFromCurrent * rm / (Math.pow(1 + rm, months) - 1);
  }
  const portfolioCurve: number[] = [];
  const annualSpendCurve: number[] = [];
  let balance = nestEgg;
  let spend = firstYearAnnualSpend;
  for (let i = 0; i < n; i++) {
    portfolioCurve.push(Math.max(0, balance));
    annualSpendCurve.push(spend);
    balance = Math.max(0, balance - spend) * (1 + r);
    spend *= (1 + g);
  }
  portfolioCurve.push(Math.max(0, balance));
  return {
    nestEgg,
    monthlySavingsNeeded,
    portfolioCurve,
    annualSpendCurve,
    shortfallFromCurrent,
  };
}


export function solveRequiredSavings(
  plan: RetirementPlan,
  useMandatoryOnly: boolean
): { currentSavingsMonthly: number; requiredSavingsMonthly: number; additionalSavingsMonthly: number } {
  // 1. Calculate current monthly savings today (initial year)
  const tempPlan = { ...plan };
  const firstYearResult = runProjection(tempPlan, 2026, useMandatoryOnly, 0);
  const currentSavingsAnnual = firstYearResult[0].actualSavings;
  const currentSavingsMonthly = currentSavingsAnnual / 12;

  // 2. Solve for additional monthly savings A (in today's dollars)
  let low = -200000;
  let high = 200000;
  
  for (let i = 0; i < 30; i++) {
    const mid = (low + high) / 2;
    const results = runProjection(plan, 2026, useMandatoryOnly, mid);
    const lastYear = results[results.length - 1];
    
    if (lastYear.portfolioEnd > 0) {
      high = mid;
    } else {
      low = mid;
    }
  }
  
  const solvedAdditional = (low + high) / 2;
  const requiredSavingsMonthly = Math.max(0, currentSavingsMonthly + solvedAdditional);
  const additionalSavingsMonthly = requiredSavingsMonthly - currentSavingsMonthly;

  return {
    currentSavingsMonthly,
    requiredSavingsMonthly,
    additionalSavingsMonthly,
  };
}
