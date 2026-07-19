import React, { useState, useEffect, useMemo } from 'react';
import {
  type PersonInput,
  type ChildInput,
  type ExpenseInput,
  type FactorInput,
  SavingsBase,
  FactorType,
  type RetirementPlan,
  type TaxConfig,
  type CcbConfig,
  type ChildCostConfig,
  type ParentalLeaveConfig,
  AllocationPolicy,
  type AccountBuckets,
} from '../../../types/calculator';
import { calculateHouseholdTax, marginalIncomeTaxRate } from '../../../utils/taxCalc';
import {
  runProjection,
  bucketsAtRetirementFromProjection,
} from '../../../utils/retirementCalc';
import {
  LOCAL_STORAGE_KEY,
  DEFAULT_TAX_CONFIG,
  DEFAULT_CCB_CONFIG,
  DEFAULT_CHILD_COST,
  DEFAULT_PARENTAL_LEAVE,
  INITIAL_HE,
  INITIAL_SHE,
  INITIAL_EXPENSES,
  DEFAULT_ACCOUNT_BUCKETS,
  totalInvestable,
} from '../../../utils/taxRates';
import { calculatePlanTargets } from '../../../utils/targetEngine';
import { resolveEarnerRoles } from '../../../utils/earnerRoles';
import {
  explainExcessMoney,
  personInputsFromExtraAllocation,
  resolveExtraContributionMonthly,
} from '../../../utils/excessMoneyGuide';
import { SummaryCards } from './components/SummaryCards';
import { MetricStrip } from './components/MetricStrip';
import { InputSection } from './components/InputSection';
import { FactorsSection } from './components/FactorsSection';
import { ProjectionChart } from './components/ProjectionChart';
import { DetailsTable } from './components/DetailsTable';
import { Settings } from '../Settings/Settings';
import { Header } from '../../shared/Header';
import { ScenarioSelector } from './components/ScenarioSelector';
import { MinSavingsPanel } from './components/MinSavingsPanel';
import { ConversionGuidePanel } from './components/ConversionGuidePanel';
import { ExcessRoomPanel } from './components/ExcessRoomPanel';
import { withCppStartYear } from '../../../utils/personInputMigrate';
import {
  analyzeRetirementShortfall,
  solveEarliestJointRetirement,
  solveExtraForReadiness,
} from '../../../utils/retirementShortfall';
import {
  DEFAULT_LIFE_EXPECTANCY_DELTA,
  resolveRetirementHorizon,
} from '../../../utils/retirementHorizon';

export const Dashboard: React.FC = () => {
  const getSavedData = () => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to parse localStorage data', e);
    }
    return null;
  };

  const savedData = getSavedData();

  // 1. Initialize State with safe merges for backward compatibility
  const [heInput, setHeInput] = useState<PersonInput>(() => {
    if (savedData?.heInput) {
      const merged = { ...INITIAL_HE, ...savedData.heInput };
      if (merged.otherSavingsTfsaMonthly === undefined && merged.otherSavingsRrspMonthly === undefined) {
        const oldVal = (savedData.heInput as { otherSavingsMonthly?: number }).otherSavingsMonthly || 0;
        merged.otherSavingsTfsaMonthly = oldVal;
        merged.otherSavingsRrspMonthly = 0;
      }
      if (merged.extraContributionMonthly === undefined) {
        merged.extraContributionMonthly =
          (merged.otherSavingsTfsaMonthly || 0) + (merged.otherSavingsRrspMonthly || 0);
      }
      return withCppStartYear(merged);
    }
    return INITIAL_HE;
  });

  const [sheInput, setSheInput] = useState<PersonInput>(() => {
    if (savedData?.sheInput) {
      const merged = { ...INITIAL_SHE, ...savedData.sheInput };
      if (merged.otherSavingsTfsaMonthly === undefined && merged.otherSavingsRrspMonthly === undefined) {
        const oldVal = (savedData.sheInput as { otherSavingsMonthly?: number }).otherSavingsMonthly || 0;
        merged.otherSavingsTfsaMonthly = 0;
        merged.otherSavingsRrspMonthly = oldVal;
      }
      if (merged.extraContributionMonthly === undefined) {
        merged.extraContributionMonthly =
          (merged.otherSavingsTfsaMonthly || 0) + (merged.otherSavingsRrspMonthly || 0);
      }
      return withCppStartYear(merged);
    }
    return INITIAL_SHE;
  });
  const [children, setChildren] = useState<ChildInput[]>(() => savedData?.children || []);
  const [expenses, setExpenses] = useState<ExpenseInput[]>(() => savedData?.expenses || INITIAL_EXPENSES);
  const [factors, setFactors] = useState<FactorInput[]>(() => {
    const rawFactors: FactorInput[] = savedData?.factors || [];
    return rawFactors.filter(f => f.type !== FactorType.MATERNITY_LEAVE && f.type !== FactorType.PATERNITY_LEAVE);
  });
  const [savingsBase, setSavingsBase] = useState<SavingsBase>(() => savedData?.savingsBase || SavingsBase.GROSS);
  const [savingsTargetRate, setSavingsTargetRate] = useState<number>(() => savedData?.savingsTargetRate ?? 0.20);
  const [investmentReturnRate, setInvestmentReturnRate] = useState<number>(() => savedData?.investmentReturnRate ?? 0.05);
  const [inflationRate, setInflationRate] = useState<number>(() => savedData?.inflationRate ?? 0.02);
  const [salaryGrowthRate, setSalaryGrowthRate] = useState<number>(() => savedData?.salaryGrowthRate ?? 0.01);
  const [desiredRetirementSpendMonthly, setDesiredRetirementSpendMonthly] = useState<number>(() => savedData?.desiredRetirementSpendMonthly ?? 10000);
  const [mandatoryRetirementSpendMonthly, setMandatoryRetirementSpendMonthly] = useState<number>(() => savedData?.mandatoryRetirementSpendMonthly ?? 7000);
  const [accountBuckets, setAccountBuckets] = useState<AccountBuckets>(() => savedData?.accountBuckets ?? {
    ...DEFAULT_ACCOUNT_BUCKETS,
    ...(savedData?.currentSavings && !savedData?.accountBuckets
      ? {}
      : {}),
  });
  const [currentSavings, setCurrentSavings] = useState<number>(() =>
    savedData?.currentSavings ?? totalInvestable(savedData?.accountBuckets ?? DEFAULT_ACCOUNT_BUCKETS)
  );
  const [allocationPolicy] = useState<AllocationPolicy>(AllocationPolicy.TFSA_FIRST);
  const [survivorToggle, setSurvivorToggle] = useState<boolean>(() => savedData?.survivorToggle ?? false);
  const [survivorSpendFactor, setSurvivorSpendFactor] = useState<number>(() => savedData?.survivorSpendFactor ?? 0.70);
  const [taxConfig, setTaxConfig] = useState<TaxConfig>(() => ({ ...DEFAULT_TAX_CONFIG, ...savedData?.taxConfig }));
  const [ccbConfig, setCcbConfig] = useState<CcbConfig>(() => ({ ...DEFAULT_CCB_CONFIG, ...savedData?.ccbConfig }));
  const [childCostConfig, setChildCostConfig] = useState<ChildCostConfig>(() => ({ ...DEFAULT_CHILD_COST, ...savedData?.childCostConfig }));
  const [parentalLeaveConfig, setParentalLeaveConfig] = useState<ParentalLeaveConfig>(() => ({ ...DEFAULT_PARENTAL_LEAVE, ...savedData?.parentalLeaveConfig }));
  const [lifeExpectancyDelta, setLifeExpectancyDelta] = useState<number>(
    () => savedData?.lifeExpectancyDelta ?? DEFAULT_LIFE_EXPECTANCY_DELTA
  );
  const [includeExtraIncome, setIncludeExtraIncome] = useState<boolean>(() => savedData?.includeExtraIncome ?? true);
  const [depositEsppToRrsp, setDepositEsppToRrsp] = useState<boolean>(() => savedData?.depositEsppToRrsp ?? false);
  const [esppRefundSaveRate, setEsppRefundSaveRate] = useState<number>(() => savedData?.esppRefundSaveRate ?? 0.50);
  const [annualTfsaLimit, setAnnualTfsaLimit] = useState<number>(() => savedData?.annualTfsaLimit ?? 7000);
  const [inflateAnnualTfsaLimit, setInflateAnnualTfsaLimit] = useState<boolean>(() => savedData?.inflateAnnualTfsaLimit ?? false);
  const [optimizeSpousalRrsp, setOptimizeSpousalRrsp] = useState<boolean>(() => savedData?.optimizeSpousalRrsp ?? false);
  const [spousalRrspMonthly, setSpousalRrspMonthly] = useState<number>(() => savedData?.spousalRrspMonthly ?? 0);

  // UI state
  const [activeScenario, setActiveScenario] = useState<'realistic' | 'mandatory'>('realistic');
  const [activeTab, setActiveTab] = useState<'planner' | 'taxSettings'>('planner');

  // Save to localStorage on changes
  useEffect(() => {
    const dataToStore = {
      heInput,
      sheInput,
      children,
      expenses,
      factors,
      savingsBase,
      savingsTargetRate,
      investmentReturnRate,
      inflationRate,
      salaryGrowthRate,
      desiredRetirementSpendMonthly,
      mandatoryRetirementSpendMonthly,
      currentSavings: totalInvestable(accountBuckets),
      accountBuckets,
      allocationPolicy,
      survivorToggle,
      survivorSpendFactor,
      taxConfig,
      ccbConfig,
      childCostConfig,
      parentalLeaveConfig,
      lifeExpectancyDelta,
      includeExtraIncome,
      depositEsppToRrsp,
      esppRefundSaveRate,
      annualTfsaLimit,
      inflateAnnualTfsaLimit,
      optimizeSpousalRrsp,
      spousalRrspMonthly,
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataToStore));
  }, [
    heInput,
    sheInput,
    children,
    expenses,
    factors,
    savingsBase,
    savingsTargetRate,
    investmentReturnRate,
    inflationRate,
    salaryGrowthRate,
    desiredRetirementSpendMonthly,
    mandatoryRetirementSpendMonthly,
    currentSavings,
    accountBuckets,
    allocationPolicy,
    survivorToggle,
    survivorSpendFactor,
    taxConfig,
    ccbConfig,
    childCostConfig,
    parentalLeaveConfig,
    lifeExpectancyDelta,
    includeExtraIncome,
    depositEsppToRrsp,
    esppRefundSaveRate,
    annualTfsaLimit,
    inflateAnnualTfsaLimit,
    optimizeSpousalRrsp,
    spousalRrspMonthly,
  ]);

  const resetToDefaults = () => {
    if (window.confirm('Are you sure you want to reset all configurations to prompt defaults?')) {
      setHeInput(INITIAL_HE);
      setSheInput(INITIAL_SHE);
      setChildren([]);
      setExpenses(INITIAL_EXPENSES);
      setFactors([]);
      setSavingsBase(SavingsBase.GROSS);
      setSavingsTargetRate(0.20);
      setInvestmentReturnRate(0.05);
      setInflationRate(0.02);
      setSalaryGrowthRate(0.01);
      setDesiredRetirementSpendMonthly(10000);
      setMandatoryRetirementSpendMonthly(7000);
      setAccountBuckets(DEFAULT_ACCOUNT_BUCKETS);
      setCurrentSavings(totalInvestable(DEFAULT_ACCOUNT_BUCKETS));
      setSurvivorToggle(false);
      setTaxConfig(DEFAULT_TAX_CONFIG);
      setCcbConfig(DEFAULT_CCB_CONFIG);
      setChildCostConfig(DEFAULT_CHILD_COST);
      setParentalLeaveConfig(DEFAULT_PARENTAL_LEAVE);
      setLifeExpectancyDelta(20);
      setIncludeExtraIncome(true);
      setDepositEsppToRrsp(false);
      setEsppRefundSaveRate(0.50);
      setAnnualTfsaLimit(7000);
      setInflateAnnualTfsaLimit(false);
      setOptimizeSpousalRrsp(false);
      setSpousalRrspMonthly(0);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  };

  const currentYear = new Date().getFullYear();

  const planBase: RetirementPlan = {
    heInput,
    sheInput,
    children,
    expenses,
    factors,
    savingsBase,
    savingsTargetRate,
    investmentReturnRate,
    inflationRate,
    salaryGrowthRate,
    desiredRetirementSpendMonthly,
    mandatoryRetirementSpendMonthly,
    currentSavings: totalInvestable(accountBuckets),
    accountBuckets,
    allocationPolicy,
    survivorToggle,
    survivorSpendFactor,
    annualTfsaLimit,
    inflateAnnualTfsaLimit,
    taxConfig,
    ccbConfig,
    childCostConfig,
    parentalLeaveConfig,
    lifeExpectancyDelta,
    includeExtraIncome,
    depositEsppToRrsp,
    esppRefundSaveRate,
    optimizeSpousalRrsp,
    spousalRrspMonthly,
  };

  const guideLive = useMemo(
    () => explainExcessMoney(planBase, { currentYear }),
    // planBase fields are primitives/state — rebuild when any planner input changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      heInput,
      sheInput,
      children,
      expenses,
      factors,
      savingsBase,
      savingsTargetRate,
      investmentReturnRate,
      inflationRate,
      salaryGrowthRate,
      desiredRetirementSpendMonthly,
      mandatoryRetirementSpendMonthly,
      accountBuckets,
      allocationPolicy,
      survivorToggle,
      survivorSpendFactor,
      annualTfsaLimit,
      inflateAnnualTfsaLimit,
      taxConfig,
      depositEsppToRrsp,
      esppRefundSaveRate,
      optimizeSpousalRrsp,
      includeExtraIncome,
      lifeExpectancyDelta,
      currentYear,
    ]
  );
  const allocated = useMemo(
    () => personInputsFromExtraAllocation(planBase, guideLive),
    // guideLive already tracks plan inputs; avoid planBase identity churn
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [guideLive]
  );
  const effectiveSpousalMonthly = optimizeSpousalRrsp
    ? (guideLive.combinedMvRouting?.toSpousal ??
        guideLive.mvHe.suggestedSplit.toSpousal +
          guideLive.mvShe.suggestedSplit.toSpousal) /
      12
    : 0;
  const earnerRoles = resolveEarnerRoles(planBase);

  const heForEngines = {
    ...allocated.heInput,
    extraContributionMonthly: resolveExtraContributionMonthly(heInput),
    extraIncomeMonthly: includeExtraIncome ? heInput.extraIncomeMonthly : 0,
  };
  const sheForEngines = {
    ...allocated.sheInput,
    extraContributionMonthly: resolveExtraContributionMonthly(sheInput),
    extraIncomeMonthly: includeExtraIncome ? sheInput.extraIncomeMonthly : 0,
  };

  const currentHouseholdTax = useMemo(
    () =>
      calculateHouseholdTax(
        heForEngines,
        sheForEngines,
        children.filter(ch => (ch.birthAgeHe ?? (heInput.age - ch.age)) <= heInput.age),
        savingsBase,
        savingsTargetRate,
        taxConfig,
        ccbConfig,
        depositEsppToRrsp,
        effectiveSpousalMonthly,
        heInput.carryForwardRrspRoom ?? 0,
        sheInput.carryForwardRrspRoom ?? 0,
        earnerRoles.primary
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [heForEngines, sheForEngines, children, savingsBase, savingsTargetRate, taxConfig, ccbConfig, depositEsppToRrsp, effectiveSpousalMonthly]
  );

  const plan: RetirementPlan = useMemo(
    () => ({
      ...planBase,
      heInput: {
        ...allocated.heInput,
        extraContributionMonthly: resolveExtraContributionMonthly(heInput),
        extraIncomeMonthly: heInput.extraIncomeMonthly,
      },
      sheInput: {
        ...allocated.sheInput,
        extraContributionMonthly: resolveExtraContributionMonthly(sheInput),
        extraIncomeMonthly: sheInput.extraIncomeMonthly,
      },
      includeExtraIncome,
      spousalRrspMonthly: effectiveSpousalMonthly,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [planBase, allocated, heInput, sheInput, includeExtraIncome, effectiveSpousalMonthly]
  );

  const planTargets = useMemo(() => {
    const useMandatory = activeScenario === 'mandatory';
    // Nest egg starts on the cash-aware path (children/leave). The target engine
    // adds marginal solver Extra to that same baseline and expands uncapped.
    return calculatePlanTargets(plan, currentYear, useMandatory, {
      accumulate: (p, monthly, year) =>
        bucketsAtRetirementFromProjection(p, monthly, year, useMandatory),
    });
  }, [plan, currentYear, activeScenario]);

  // Projection viewer uses the same recommended conversion ages as Min Savings / target engine.
  const planForProjection: RetirementPlan = useMemo(
    () => ({
      ...plan,
      conversionAgeHe: planTargets.recommendedConversion.conversionAgeHe,
      conversionAgeShe: planTargets.recommendedConversion.conversionAgeShe,
    }),
    [plan, planTargets.recommendedConversion.conversionAgeHe, planTargets.recommendedConversion.conversionAgeShe]
  );

  const realisticProjection = useMemo(
    () => runProjection(planForProjection, currentYear, false),
    [planForProjection, currentYear]
  );
  const mandatoryProjection = useMemo(
    () => runProjection(planForProjection, currentYear, true),
    [planForProjection, currentYear]
  );
  const activeProjection = activeScenario === 'realistic' ? realisticProjection : mandatoryProjection;

  // Reuse planTargets — avoid a second calculatePlanTargets inside calculateMinSavingsRequired
  const minSavingsResult = useMemo(() => {
    const useMandatory = activeScenario === 'mandatory';
    const projection = runProjection(
      planForProjection,
      currentYear,
      useMandatory,
      planTargets.monthlyPersonalSavingsNeeded
    );
    return {
      monthlySavingsNeeded: planTargets.monthlyPersonalSavingsNeeded,
      nestEgg: planTargets.projectedNestEggAtRetirement,
      portfolioCurve: planTargets.portfolioCurve,
      annualSpendCurve: planTargets.annualSpendCurve,
      shortfallFromCurrent: planTargets.shortfallFromCurrentPath,
      isFunded: planTargets.isFundedWithoutExtra,
      firstYearPensionGross: planTargets.firstYearPensionGross,
      projection,
      regime: planTargets.regime,
      recommendedConversion: planTargets.recommendedConversion,
      runnersUp: planTargets.runnersUp,
      allocationPolicy: planTargets.allocationPolicy,
      surplusSpend: planTargets.surplusSpend,
      currentPathPortfolioCurve: planTargets.currentPathPortfolioCurve,
      currentPathBucketCurves: planTargets.currentPathBucketCurves,
      requiredNestEggToZero: planTargets.requiredNestEggToZero,
      requiredNestEggToZeroCurve: planTargets.requiredNestEggToZeroCurve,
      nestEggToZeroBand: planTargets.nestEggToZeroBand,
      bucketCurves: planTargets.bucketCurves,
      bucketsAtRetirement: planTargets.bucketsAtRetirement,
      projectedNestEggAtRetirement: planTargets.projectedNestEggAtRetirement,
      projectedBucketsAtRetirement: planTargets.projectedBucketsAtRetirement,
      solvedNestEggAtRetirement: planTargets.nestEggAtRetirement,
    };
  }, [planForProjection, currentYear, activeScenario, planTargets]);

  // Retirement Readiness must follow the active projection (Plot 1), not the
  // conversion-grid winner on the *solved* nest egg — that path assumes the
  // extra monthly savings and would claim "lasts to horizon" while current path depletes.
  const endAgeHorizon = resolveRetirementHorizon({
    heInput,
    lifeExpectancyDelta,
  }).terminalAgeHe;
  // Shared with the Retirement Monthly Deficit card so the two never disagree at
  // the horizon boundary: a gap in the *final* year (age == last funded year) is a
  // real shortfall, not "lasts to horizon+".
  const retirementShortfall = analyzeRetirementShortfall(activeProjection);
  const lastsFullHorizon = retirementShortfall.lastsFullHorizon;
  const yearsSecure = retirementShortfall.firstShortfallAge ?? endAgeHorizon;
  const currentSavingsMonthly = (activeProjection[0]?.actualSavings ?? 0) / 12;

  // Extra $/mo that turns Retirement Readiness green (viewer path) — distinct from backsolve.
  const readinessExtra = useMemo(() => {
    if (lastsFullHorizon) return { monthly: 0, reached: true as const };
    return solveExtraForReadiness(
      planForProjection,
      currentYear,
      activeScenario === 'mandatory'
    );
  }, [planForProjection, currentYear, activeScenario, lastsFullHorizon]);

  const readinessNestEgg = useMemo(() => {
    if (!readinessExtra.reached) return null;
    return totalInvestable(
      bucketsAtRetirementFromProjection(
        planForProjection,
        readinessExtra.monthly,
        currentYear,
        activeScenario === 'mandatory'
      )
    );
  }, [planForProjection, readinessExtra, currentYear, activeScenario]);

  const earliestRetirement = useMemo(
    () =>
      solveEarliestJointRetirement(
        planForProjection,
        currentYear,
        activeScenario === 'mandatory',
        endAgeHorizon
      ),
    [planForProjection, currentYear, activeScenario, endAgeHorizon]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header activeTab={activeTab} setActiveTab={setActiveTab} resetToDefaults={resetToDefaults} />

      {activeTab === 'planner' ? (
        <main style={{ maxWidth: '1600px', margin: '0 auto', width: '100%', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="dashboard-grid" style={{ padding: 0, margin: 0, maxWidth: 'none', width: '100%' }}>
            <aside style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <ScenarioSelector
                activeScenario={activeScenario}
                setActiveScenario={setActiveScenario}
                includeExtraIncome={includeExtraIncome}
                setIncludeExtraIncome={setIncludeExtraIncome}
              />
               <InputSection
                heInput={heInput}
                sheInput={sheInput}
                children={children}
                expenses={expenses}
                savingsBase={savingsBase}
                savingsTargetRate={savingsTargetRate}
                investmentReturnRate={investmentReturnRate}
                inflationRate={inflationRate}
                salaryGrowthRate={salaryGrowthRate}
                desiredRetirementSpendMonthly={desiredRetirementSpendMonthly}
                mandatoryRetirementSpendMonthly={mandatoryRetirementSpendMonthly}
                currentSavings={currentSavings}
                lifeExpectancyDelta={lifeExpectancyDelta}
                depositEsppToRrsp={depositEsppToRrsp}
                esppRefundSaveRate={esppRefundSaveRate}
                activeScenario={activeScenario}
                includeExtraIncome={includeExtraIncome}
                optimizeSpousalRrsp={optimizeSpousalRrsp}
                setHeInput={setHeInput}
                setSheInput={setSheInput}
                setChildren={setChildren}
                setExpenses={setExpenses}
                setSavingsBase={setSavingsBase}
                setSavingsTargetRate={setSavingsTargetRate}
                setInvestmentReturnRate={setInvestmentReturnRate}
                setInflationRate={setInflationRate}
                setSalaryGrowthRate={setSalaryGrowthRate}
                setDesiredRetirementSpendMonthly={setDesiredRetirementSpendMonthly}
                setMandatoryRetirementSpendMonthly={setMandatoryRetirementSpendMonthly}
                setCurrentSavings={(v) => {
                  setCurrentSavings(v);
                  setAccountBuckets(prev => {
                    const t = totalInvestable(prev) || 1;
                    const scale = v / t;
                    return {
                      tfsaHe: prev.tfsaHe * scale,
                      tfsaShe: prev.tfsaShe * scale,
                      rrspHe: prev.rrspHe * scale,
                      rrspShe: prev.rrspShe * scale,
                      nonReg: prev.nonReg * scale,
                      cashExcluded: prev.cashExcluded,
                    };
                  });
                }}
                setLifeExpectancyDelta={setLifeExpectancyDelta}
                setDepositEsppToRrsp={setDepositEsppToRrsp}
                setEsppRefundSaveRate={setEsppRefundSaveRate}
                annualTfsaLimit={annualTfsaLimit}
                setAnnualTfsaLimit={setAnnualTfsaLimit}
                inflateAnnualTfsaLimit={inflateAnnualTfsaLimit}
                setInflateAnnualTfsaLimit={setInflateAnnualTfsaLimit}
                survivorToggle={survivorToggle}
                setSurvivorToggle={setSurvivorToggle}
                survivorSpendFactor={survivorSpendFactor}
                setSurvivorSpendFactor={setSurvivorSpendFactor}
                setOptimizeSpousalRrsp={(enable) => {
                  setOptimizeSpousalRrsp(enable);
                  if (!enable) setSpousalRrspMonthly(0);
                }}
              />
              <FactorsSection factors={factors} setFactors={setFactors} heAge={heInput.age} />
            </aside>

            <section style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <MinSavingsPanel
                plan={plan}
                activeScenario={activeScenario}
                planTargets={planTargets}
                yearsSecure={yearsSecure}
                lastsFullHorizon={lastsFullHorizon}
                currentSavingsMonthly={currentSavingsMonthly}
                readinessExtraMonthly={readinessExtra.monthly}
                readinessExtraReached={readinessExtra.reached}
                readinessNestEgg={readinessNestEgg}
                earliestRetirement={earliestRetirement}
                showOutlook
                showPlanBasis={false}
              />

              <SummaryCards
                householdTax={currentHouseholdTax}
                savingsBase={savingsBase}
                savingsTargetRate={savingsTargetRate}
                unallocatedCash={activeProjection[0].unallocatedCash}
                ccbBenefitMonthly={activeProjection[0].ccbBenefit / 12}
                childCostsMonthly={activeProjection[0].childCosts / 12}
              />

              <MetricStrip
                projection={activeProjection}
                effectiveTaxRateHe={currentHouseholdTax.he.salary > 0 ? currentHouseholdTax.he.totalIncomeTax / currentHouseholdTax.he.salary : 0}
                effectiveTaxRateShe={currentHouseholdTax.she.salary > 0 ? currentHouseholdTax.she.totalIncomeTax / currentHouseholdTax.she.salary : 0}
                marginalTaxRateHe={marginalIncomeTaxRate(currentHouseholdTax.he.taxableIncome, taxConfig, {
                  cppBaseForCredit: currentHouseholdTax.he.cppBaseContribution,
                  eiPremium: currentHouseholdTax.he.eiPremium,
                })}
                marginalTaxRateShe={marginalIncomeTaxRate(currentHouseholdTax.she.taxableIncome, taxConfig, {
                  cppBaseForCredit: currentHouseholdTax.she.cppBaseContribution,
                  eiPremium: currentHouseholdTax.she.eiPremium,
                })}
                totalHouseholdGross={currentHouseholdTax.totalHouseholdGross}
                totalIncomeTaxHe={currentHouseholdTax.he.totalIncomeTax}
                totalIncomeTaxShe={currentHouseholdTax.she.totalIncomeTax}
              />

              <MinSavingsPanel
                plan={plan}
                activeScenario={activeScenario}
                planTargets={planTargets}
                yearsSecure={yearsSecure}
                lastsFullHorizon={lastsFullHorizon}
                currentSavingsMonthly={currentSavingsMonthly}
                readinessExtraMonthly={readinessExtra.monthly}
                readinessExtraReached={readinessExtra.reached}
                readinessNestEgg={readinessNestEgg}
                earliestRetirement={earliestRetirement}
                showOutlook={false}
                showPlanBasis
              />

              <ProjectionChart
                realisticData={realisticProjection}
                mandatoryData={mandatoryProjection}
                earliestRetireAgeHe={
                  earliestRetirement.lastsAtEntered && earliestRetirement.yearsEarlier > 0
                    ? earliestRetirement.heRetireAge
                    : undefined
                }
                minSavingsData={minSavingsResult.projection.map((row, idx) => {
                  // Post-retire: same series as Min Savings green dashed (Portfolio → $0).
                  // Values are start-of-year balances (curve[i]); Plot 1 uses plot1PortfolioBalance
                  // so Realistic/Mandatory retired points use portfolioStart too.
                  // Pre-retire: keep accumulation path on the full-life chart.
                  const deplete = planTargets.surplusSpend?.depletePortfolioCurve;
                  const curve =
                    deplete && deplete.length > 0
                      ? deplete
                      : !planTargets.isFundedWithoutExtra &&
                          planTargets.currentPathPortfolioCurve?.length
                        ? planTargets.currentPathPortfolioCurve
                        : planTargets.portfolioCurve;
                  if (row.isRetired && curve.length > 0) {
                    const retireIdx = minSavingsResult.projection.findIndex(r => r.isRetired);
                    const i = idx - retireIdx;
                    // Same index as Min Savings Year i / depletePortfolioCurve[i]
                    // (do not use i+1 — that shifted Plot 1 one year ahead of the green →$0 line).
                    if (i >= 0 && i < curve.length) {
                      return {
                        ...row,
                        portfolioEnd: curve[i] ?? row.portfolioEnd,
                        portfolioStart: curve[i] ?? row.portfolioStart,
                      };
                    }
                  }
                  return row;
                })}
                activeScenario={activeScenario}
                retirementAgeHe={heInput.retirementAge}
              />

              <ConversionGuidePanel
                ranking={planTargets.conversionRanking ?? [planTargets.recommendedConversion, ...(planTargets.runnersUp ?? [])]}
                regime={planTargets.regime}
                endAge={resolveRetirementHorizon({ heInput, lifeExpectancyDelta }).terminalAgeHe}
              />

              <ExcessRoomPanel
                plan={plan}
                currentYear={currentYear}
                isFundedWithoutExtra={planTargets.isFundedWithoutExtra}
                excessGuide={guideLive}
                onOptimizeSpousal={(enable, monthly) => {
                  setOptimizeSpousalRrsp(enable);
                  setSpousalRrspMonthly(monthly);
                }}
              />
            </section>
          </div>

          <DetailsTable data={activeProjection} />
        </main>
      ) : (
        <Settings
          taxConfig={taxConfig}
          setTaxConfig={setTaxConfig}
          ccbConfig={ccbConfig}
          setCcbConfig={setCcbConfig}
          childCostConfig={childCostConfig}
          setChildCostConfig={setChildCostConfig}
          parentalLeaveConfig={parentalLeaveConfig}
          setParentalLeaveConfig={setParentalLeaveConfig}
        />
      )}
    </div>
  );
};
export default Dashboard;
