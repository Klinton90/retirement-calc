import React, { useState } from 'react';
import {
  type PersonInput,
  type ChildInput,
  type ExpenseInput,
  SavingsBase,
} from '../../../../types/calculator';
import { User, Users, DollarSign, Settings, Sparkles } from 'lucide-react';
import { HeInputs } from './HeInputs';
import { SheInputs } from './SheInputs';
import { ChildrenInputs } from './ChildrenInputs';
import { ExpensesInputs } from './ExpensesInputs';
import { GlobalConstantsInputs } from './GlobalConstantsInputs';
import { SpousalRrspAdvisor } from './SpousalRrspAdvisor';
import { AccordionItem } from '../../../shared/AccordionItem';

interface InputSectionProps {
  heInput: PersonInput;
  sheInput: PersonInput;
  children: ChildInput[];
  expenses: ExpenseInput[];
  savingsBase: SavingsBase;
  savingsTargetRate: number;
  investmentReturnRate: number;
  inflationRate: number;
  desiredRetirementSpendMonthly: number;
  mandatoryRetirementSpendMonthly: number;
  currentSavings: number;
  lifeExpectancyDelta: number;
  depositEsppToRrsp: boolean;
  esppRefundSaveRate: number;
  activeScenario: 'realistic' | 'mandatory';
  includeExtraIncome: boolean;
  optimizeSpousalRrsp: boolean;
  targetTaxAdvantageThreshold: number;
  onSpousalPlanUpdate: (updates: {
    optimizeSpousalRrsp: boolean;
    spousalRrspMonthly: number;
    targetTaxAdvantageThreshold?: number;
  }) => void;

  setHeInput: React.Dispatch<React.SetStateAction<PersonInput>>;
  setSheInput: React.Dispatch<React.SetStateAction<PersonInput>>;
  setChildren: React.Dispatch<React.SetStateAction<ChildInput[]>>;
  setExpenses: React.Dispatch<React.SetStateAction<ExpenseInput[]>>;
  setSavingsBase: (base: SavingsBase) => void;
  setSavingsTargetRate: (rate: number) => void;
  setInvestmentReturnRate: (rate: number) => void;
  setInflationRate: (rate: number) => void;
  setDesiredRetirementSpendMonthly: (val: number) => void;
  setMandatoryRetirementSpendMonthly: (val: number) => void;
  setCurrentSavings: (val: number) => void;
  setLifeExpectancyDelta: (val: number) => void;
  setDepositEsppToRrsp: (val: boolean) => void;
  setEsppRefundSaveRate: (val: number) => void;
  annualTfsaLimit: number;
  setAnnualTfsaLimit: (val: number) => void;
  inflateAnnualTfsaLimit: boolean;
  setInflateAnnualTfsaLimit: (val: boolean) => void;
}

export const InputSection: React.FC<InputSectionProps> = ({
  heInput,
  sheInput,
  children,
  expenses,
  savingsBase,
  savingsTargetRate,
  investmentReturnRate,
  inflationRate,
  desiredRetirementSpendMonthly,
  mandatoryRetirementSpendMonthly,
  currentSavings,
  lifeExpectancyDelta,
  depositEsppToRrsp,
  esppRefundSaveRate,
  activeScenario,
  includeExtraIncome,
  optimizeSpousalRrsp,
  targetTaxAdvantageThreshold,
  onSpousalPlanUpdate,
  setHeInput,
  setSheInput,
  setChildren,
  setExpenses,
  setSavingsBase,
  setSavingsTargetRate,
  setInvestmentReturnRate,
  setInflationRate,
  setDesiredRetirementSpendMonthly,
  setMandatoryRetirementSpendMonthly,
  setCurrentSavings,
  setLifeExpectancyDelta,
  setDepositEsppToRrsp,
  setEsppRefundSaveRate,
  annualTfsaLimit,
  setAnnualTfsaLimit,
  inflateAnnualTfsaLimit,
  setInflateAnnualTfsaLimit,
}) => {
  const [openSection, setOpenSection] = useState<string>('he');

  const updatePerson = (person: 'he' | 'she', field: keyof PersonInput, val: any) => {
    const setter = person === 'he' ? setHeInput : setSheInput;
    setter(prev => ({ ...prev, [field]: val }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* 1. HE INPUTS */}
      <AccordionItem
        id="he"
        label="HE'S FINANCIALS (Primary)"
        icon={User}
        isOpen={openSection === 'he'}
        onToggle={() => setOpenSection(openSection === 'he' ? '' : 'he')}
        style={{ borderBottom: 'none' }}
      >
        <HeInputs heInput={heInput} updatePerson={updatePerson} includeExtraIncome={includeExtraIncome} />
      </AccordionItem>

      {/* 2. SHE INPUTS */}
      <AccordionItem
        id="she"
        label="SHE'S FINANCIALS (Partner)"
        icon={User}
        isOpen={openSection === 'she'}
        onToggle={() => setOpenSection(openSection === 'she' ? '' : 'she')}
      >
        <SheInputs sheInput={sheInput} updatePerson={updatePerson} includeExtraIncome={includeExtraIncome} />
      </AccordionItem>

      {/* 3. CHILDREN */}
      <AccordionItem
        id="children"
        label={`CHILDREN (${children.length})`}
        icon={Users}
        isOpen={openSection === 'children'}
        onToggle={() => setOpenSection(openSection === 'children' ? '' : 'children')}
      >
        <ChildrenInputs children={children} heInput={heInput} setChildren={setChildren} />
      </AccordionItem>

      {/* 4. EXPENSES */}
      <AccordionItem
        id="expenses"
        label={`MONTHLY LIVING EXPENSES (${expenses.length})`}
        icon={DollarSign}
        isOpen={openSection === 'expenses'}
        onToggle={() => setOpenSection(openSection === 'expenses' ? '' : 'expenses')}
      >
        <ExpensesInputs expenses={expenses} setExpenses={setExpenses} activeScenario={activeScenario} />
      </AccordionItem>

      {/* 5. PROJECTION PARAMETERS */}
      <AccordionItem
        id="settings"
        label="GLOBAL CONSTANTS & TARGETS"
        icon={Settings}
        isOpen={openSection === 'settings'}
        onToggle={() => setOpenSection(openSection === 'settings' ? '' : 'settings')}
      >
        <GlobalConstantsInputs
          savingsTargetRate={savingsTargetRate}
          setSavingsTargetRate={setSavingsTargetRate}
          currentSavings={currentSavings}
          setCurrentSavings={setCurrentSavings}
          lifeExpectancyDelta={lifeExpectancyDelta}
          setLifeExpectancyDelta={setLifeExpectancyDelta}
          savingsBase={savingsBase}
          setSavingsBase={setSavingsBase}
          investmentReturnRate={investmentReturnRate}
          setInvestmentReturnRate={setInvestmentReturnRate}
          inflationRate={inflationRate}
          setInflationRate={setInflationRate}
          desiredRetirementSpendMonthly={desiredRetirementSpendMonthly}
          setDesiredRetirementSpendMonthly={setDesiredRetirementSpendMonthly}
          mandatoryRetirementSpendMonthly={mandatoryRetirementSpendMonthly}
          setMandatoryRetirementSpendMonthly={setMandatoryRetirementSpendMonthly}
          depositEsppToRrsp={depositEsppToRrsp}
          setDepositEsppToRrsp={setDepositEsppToRrsp}
          esppRefundSaveRate={esppRefundSaveRate}
          setEsppRefundSaveRate={setEsppRefundSaveRate}
          annualTfsaLimit={annualTfsaLimit}
          setAnnualTfsaLimit={setAnnualTfsaLimit}
          inflateAnnualTfsaLimit={inflateAnnualTfsaLimit}
          setInflateAnnualTfsaLimit={setInflateAnnualTfsaLimit}
          heInput={heInput}
          activeScenario={activeScenario}
        />
      </AccordionItem>

      {/* 6. ADVANCED — Spousal RRSP (working-years tax tool; not target-engine core) */}
      <AccordionItem
        id="spousal"
        label={`ADVANCED: SPOUSAL RRSP${optimizeSpousalRrsp ? ' (ON)' : ''}`}
        icon={Sparkles}
        isOpen={openSection === 'spousal'}
        onToggle={() => setOpenSection(openSection === 'spousal' ? '' : 'spousal')}
      >
        <SpousalRrspAdvisor
          embedded
          heInput={heInput}
          sheInput={sheInput}
          optimizeSpousalRrsp={optimizeSpousalRrsp}
          depositEsppToRrsp={depositEsppToRrsp}
          includeExtraIncome={includeExtraIncome}
          targetTaxAdvantageThreshold={targetTaxAdvantageThreshold}
          onUpdatePlan={onSpousalPlanUpdate}
        />
      </AccordionItem>
    </div>
  );
};
export default InputSection;
