import React, { useState, useEffect } from 'react';
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
import { calculateHouseholdTax } from '../../../utils/taxCalc';
import { runProjection, solveRequiredSavings, calculateMinSavingsRequired } from '../../../utils/retirementCalc';
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
import { EsppAllocationGuide } from './components/EsppAllocationGuide';

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
        const oldVal = (savedData.heInput as any).otherSavingsMonthly || 0;
        merged.otherSavingsTfsaMonthly = oldVal;
        merged.otherSavingsRrspMonthly = 0;
      }
      return merged;
    }
    return INITIAL_HE;
  });

  const [sheInput, setSheInput] = useState<PersonInput>(() => {
    if (savedData?.sheInput) {
      const merged = { ...INITIAL_SHE, ...savedData.sheInput };
      if (merged.otherSavingsTfsaMonthly === undefined && merged.otherSavingsRrspMonthly === undefined) {
        const oldVal = (savedData.sheInput as any).otherSavingsMonthly || 0;
        merged.otherSavingsTfsaMonthly = 0;
        merged.otherSavingsRrspMonthly = oldVal;
      }
      return merged;
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
  const [allocationPolicy, setAllocationPolicy] = useState<AllocationPolicy>(() =>
    savedData?.allocationPolicy ?? AllocationPolicy.TFSA_FIRST
  );
  const [survivorToggle, setSurvivorToggle] = useState<boolean>(() => savedData?.survivorToggle ?? false);
  const [taxConfig, setTaxConfig] = useState<TaxConfig>(() => ({ ...DEFAULT_TAX_CONFIG, ...savedData?.taxConfig }));
  const [ccbConfig, setCcbConfig] = useState<CcbConfig>(() => ({ ...DEFAULT_CCB_CONFIG, ...savedData?.ccbConfig }));
  const [childCostConfig, setChildCostConfig] = useState<ChildCostConfig>(() => ({ ...DEFAULT_CHILD_COST, ...savedData?.childCostConfig }));
  const [parentalLeaveConfig, setParentalLeaveConfig] = useState<ParentalLeaveConfig>(() => ({ ...DEFAULT_PARENTAL_LEAVE, ...savedData?.parentalLeaveConfig }));
  const [lifeExpectancyDelta, setLifeExpectancyDelta] = useState<number>(() => savedData?.lifeExpectancyDelta ?? 20);
  const [includeExtraIncome, setIncludeExtraIncome] = useState<boolean>(() => savedData?.includeExtraIncome ?? true);
  const [depositEsppToRrsp, setDepositEsppToRrsp] = useState<boolean>(() => savedData?.depositEsppToRrsp ?? false);
  const [esppRefundSaveRate, setEsppRefundSaveRate] = useState<number>(() => savedData?.esppRefundSaveRate ?? 0.50);
  const [annualTfsaLimit, setAnnualTfsaLimit] = useState<number>(() => savedData?.annualTfsaLimit ?? 7000);
  const [inflateAnnualTfsaLimit, setInflateAnnualTfsaLimit] = useState<boolean>(() => savedData?.inflateAnnualTfsaLimit ?? false);
  const [optimizeSpousalRrsp, setOptimizeSpousalRrsp] = useState<boolean>(() => savedData?.optimizeSpousalRrsp ?? false);
  const [spousalRrspMonthly, setSpousalRrspMonthly] = useState<number>(() => savedData?.spousalRrspMonthly ?? 0);
  const [targetTaxAdvantageThreshold, setTargetTaxAdvantageThreshold] = useState<number>(() => savedData?.targetTaxAdvantageThreshold ?? 0.412);

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
      desiredRetirementSpendMonthly,
      mandatoryRetirementSpendMonthly,
      currentSavings: totalInvestable(accountBuckets),
      accountBuckets,
      allocationPolicy,
      survivorToggle,
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
      targetTaxAdvantageThreshold,
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
    desiredRetirementSpendMonthly,
    mandatoryRetirementSpendMonthly,
    currentSavings,
    accountBuckets,
    allocationPolicy,
    survivorToggle,
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
    targetTaxAdvantageThreshold,
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
      setDesiredRetirementSpendMonthly(10000);
      setMandatoryRetirementSpendMonthly(7000);
      setAccountBuckets(DEFAULT_ACCOUNT_BUCKETS);
      setCurrentSavings(totalInvestable(DEFAULT_ACCOUNT_BUCKETS));
      setAllocationPolicy(AllocationPolicy.TFSA_FIRST);
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
  const currentHeInputForTax = includeExtraIncome ? heInput : { ...heInput, extraIncomeMonthly: 0 };
  const currentSheInputForTax = includeExtraIncome ? sheInput : { ...sheInput, extraIncomeMonthly: 0 };

  const currentHouseholdTax = calculateHouseholdTax(
    currentHeInputForTax,
    currentSheInputForTax,
    children.filter(ch => (ch.birthAgeHe ?? (heInput.age - ch.age)) <= heInput.age),
    savingsBase,
    savingsTargetRate,
    taxConfig,
    ccbConfig,
    depositEsppToRrsp,
    optimizeSpousalRrsp ? spousalRrspMonthly : 0
  );

  const plan: RetirementPlan = {
    heInput,
    sheInput,
    children,
    expenses,
    factors,
    savingsBase,
    savingsTargetRate,
    investmentReturnRate,
    inflationRate,
    desiredRetirementSpendMonthly,
    mandatoryRetirementSpendMonthly,
    currentSavings: totalInvestable(accountBuckets),
    accountBuckets,
    allocationPolicy,
    survivorToggle,
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

  const planTargets = calculatePlanTargets(plan, currentYear, activeScenario === 'mandatory');
  const realisticProjection = runProjection(plan, currentYear, false);
  const mandatoryProjection = runProjection(plan, currentYear, true);
  const activeProjection = activeScenario === 'realistic' ? realisticProjection : mandatoryProjection;

  const realisticSolved = solveRequiredSavings(plan, false);
  const mandatorySolved = solveRequiredSavings(plan, true);
  const minSavingsResult = calculateMinSavingsRequired(plan, currentYear, activeScenario === 'mandatory');

  let yearsSecure = heInput.retirementAge + lifeExpectancyDelta;
  const recCurve = planTargets.recommendedConversion.curve;
  for (const row of recCurve) {
    if (row.shortfall > 1) {
      yearsSecure = row.ageHe;
      break;
    }
  }
  if (planTargets.recommendedConversion.yearsFunded >= planTargets.recommendedConversion.horizonYears) {
    yearsSecure = heInput.retirementAge + lifeExpectancyDelta;
  }

  const totalPensionAnnual = planTargets.firstYearPensionGross * 0.85; // display approx net; card labels gross elsewhere

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header activeTab={activeTab} setActiveTab={setActiveTab} resetToDefaults={resetToDefaults} />

      {activeTab === 'planner' ? (
        <main style={{ maxWidth: '1600px', margin: '0 auto', width: '100%', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="dashboard-grid" style={{ padding: 0, margin: 0, maxWidth: 'none', width: '100%' }}>
            <aside style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
               <InputSection
                heInput={heInput}
                sheInput={sheInput}
                children={children}
                expenses={expenses}
                savingsBase={savingsBase}
                savingsTargetRate={savingsTargetRate}
                investmentReturnRate={investmentReturnRate}
                inflationRate={inflationRate}
                desiredRetirementSpendMonthly={desiredRetirementSpendMonthly}
                mandatoryRetirementSpendMonthly={mandatoryRetirementSpendMonthly}
                currentSavings={currentSavings}
                lifeExpectancyDelta={lifeExpectancyDelta}
                depositEsppToRrsp={depositEsppToRrsp}
                esppRefundSaveRate={esppRefundSaveRate}
                activeScenario={activeScenario}
                includeExtraIncome={includeExtraIncome}
                optimizeSpousalRrsp={optimizeSpousalRrsp}
                targetTaxAdvantageThreshold={targetTaxAdvantageThreshold}
                onSpousalPlanUpdate={({ optimizeSpousalRrsp: opt, spousalRrspMonthly, targetTaxAdvantageThreshold: newThreshold }) => {
                  setOptimizeSpousalRrsp(opt);
                  setSpousalRrspMonthly(spousalRrspMonthly);
                  if (newThreshold !== undefined) {
                    setTargetTaxAdvantageThreshold(newThreshold);
                  }
                }}
                setHeInput={setHeInput}
                setSheInput={setSheInput}
                setChildren={setChildren}
                setExpenses={setExpenses}
                setSavingsBase={setSavingsBase}
                setSavingsTargetRate={setSavingsTargetRate}
                setInvestmentReturnRate={setInvestmentReturnRate}
                setInflationRate={setInflationRate}
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
              />
              <FactorsSection factors={factors} setFactors={setFactors} heAge={heInput.age} />
            </aside>

            <section style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <ScenarioSelector
                activeScenario={activeScenario}
                setActiveScenario={setActiveScenario}
                includeExtraIncome={includeExtraIncome}
                setIncludeExtraIncome={setIncludeExtraIncome}
              />

              <SummaryCards
                householdTax={currentHouseholdTax}
                savingsBase={savingsBase}
                savingsTargetRate={savingsTargetRate}
                yearsSecure={yearsSecure}
                totalPension={totalPensionAnnual}
                unallocatedCash={activeProjection[0].unallocatedCash}
                ccbBenefitMonthly={activeProjection[0].ccbBenefit / 12}
                childCostsMonthly={activeProjection[0].childCosts / 12}
                currentSavingsMonthly={realisticSolved.currentSavingsMonthly}
                realisticRequired={realisticSolved.requiredSavingsMonthly}
                mandatoryRequired={mandatorySolved.requiredSavingsMonthly}
                lifeExpectancyAge={heInput.retirementAge + lifeExpectancyDelta}
                minSavingsNestEgg={planTargets.nestEggAtRetirement}
                minSavingsMonthlyNeeded={planTargets.monthlyPersonalSavingsNeeded}
                minSavingsShortfall={planTargets.shortfallFromCurrentPath}
                minSavingsIsFunded={planTargets.isFundedWithoutExtra}
                yearsToRetirement={Math.max(0, heInput.retirementAge - heInput.age)}
                inflationRate={inflationRate}
                retirementAgeHe={heInput.retirementAge}
                activeScenario={activeScenario}
                fundingRegime={planTargets.regime}
                conversionAgeHe={planTargets.recommendedConversion.conversionAgeHe}
                conversionAgeShe={planTargets.recommendedConversion.conversionAgeShe}
                conversionWhy={`Solved min $ @71; recommend He@${planTargets.recommendedConversion.conversionAgeHe} / She@${planTargets.recommendedConversion.conversionAgeShe} (${planTargets.regime})`}
                lifeExpectancyDelta={lifeExpectancyDelta}
                survivorToggle={survivorToggle}
                onSurvivorToggle={setSurvivorToggle}
                allocationPolicy={allocationPolicy}
                onAllocationPolicy={setAllocationPolicy}
              />

              <MinSavingsPanel plan={plan} activeScenario={activeScenario} planTargets={planTargets} />

              <ConversionGuidePanel
                ranking={planTargets.conversionRanking ?? [planTargets.recommendedConversion, ...(planTargets.runnersUp ?? [])]}
                regime={planTargets.regime}
                endAge={heInput.retirementAge + lifeExpectancyDelta}
              />

              <EsppAllocationGuide plan={plan} onAllocationPolicy={setAllocationPolicy} />

              <MetricStrip
                projection={activeProjection}
                heCurrentAge={heInput.age}
                heRetirementAge={heInput.retirementAge}
                sheCurrentAge={sheInput.age}
                sheRetirementAge={sheInput.retirementAge}
                effectiveTaxRateHe={currentHouseholdTax.he.salary > 0 ? currentHouseholdTax.he.totalIncomeTax / currentHouseholdTax.he.salary : 0}
                effectiveTaxRateShe={currentHouseholdTax.she.salary > 0 ? currentHouseholdTax.she.totalIncomeTax / currentHouseholdTax.she.salary : 0}
                totalHouseholdGross={currentHouseholdTax.totalHouseholdGross}
                totalIncomeTaxHe={currentHouseholdTax.he.totalIncomeTax}
                totalIncomeTaxShe={currentHouseholdTax.she.totalIncomeTax}
              />

              <ProjectionChart
                realisticData={realisticProjection}
                mandatoryData={mandatoryProjection}
                minSavingsData={minSavingsResult.projection.map((row, idx) => {
                  // Overlay target-engine depletion onto projection rows where possible
                  const curve = planTargets.portfolioCurve;
                  if (row.isRetired && curve.length > 0) {
                    const retireIdx = minSavingsResult.projection.findIndex(r => r.isRetired);
                    const i = idx - retireIdx;
                    if (i >= 0 && i < curve.length) {
                      return { ...row, portfolioEnd: curve[Math.min(i + 1, curve.length - 1)] ?? row.portfolioEnd, portfolioStart: curve[i] ?? row.portfolioStart };
                    }
                  }
                  return row;
                })}
                activeScenario={activeScenario}
                retirementAgeHe={heInput.retirementAge}
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
