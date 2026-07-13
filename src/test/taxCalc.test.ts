import { describe, it, expect } from 'vitest';
import {
  calculateBracketTax,
  calculateOntarioHealthPremium,
  calculatePersonTax,
  calculateCcb,
  calculateHouseholdTax,
} from '../utils/taxCalc';
import {
  type PersonInput,
  ContributionType,
  SavingsBase,
  type ChildInput,
} from '../types/calculator';

describe('Tax Calculations', () => {
  describe('calculateBracketTax', () => {
    const brackets = [
      { threshold: 10000, rate: 0.10 },
      { threshold: 20000, rate: 0.20 },
      { threshold: Infinity, rate: 0.30 },
    ];

    it('should calculate tax correctly for income within the first bracket', () => {
      expect(calculateBracketTax(5000, brackets)).toBe(500); // 5000 * 0.10
    });

    it('should calculate tax correctly for income crossing into the second bracket', () => {
      expect(calculateBracketTax(15000, brackets)).toBe(2000); // 10000 * 0.10 + 5000 * 0.20
    });

    it('should calculate tax correctly for income crossing into the third bracket', () => {
      expect(calculateBracketTax(25000, brackets)).toBe(4500); // 10000 * 0.10 + 10000 * 0.20 + 5000 * 0.30
    });
  });

  describe('calculateOntarioHealthPremium', () => {
    it('should be $0 for income <= 20000', () => {
      expect(calculateOntarioHealthPremium(15000)).toBe(0);
      expect(calculateOntarioHealthPremium(20000)).toBe(0);
    });

    it('should calculate correct premium for income between 20000 and 25000', () => {
      expect(calculateOntarioHealthPremium(22000)).toBe(120); // (22000 - 20000) * 0.06 = 120
      expect(calculateOntarioHealthPremium(25000)).toBe(300); // (25000 - 20000) * 0.06 = 300
    });

    it('should calculate correct premium for income above 200000', () => {
      expect(calculateOntarioHealthPremium(250000)).toBe(900);
    });
  });

  describe('calculatePersonTax', () => {
    it('should calculate tax and savings for a high earner (He)', () => {
      const input: PersonInput = {
        name: 'He',
        age: 36,
        salary: 168000,
        startYearInCanada: 2015,
        retirementAge: 65,
        extraIncomeMonthly: 0,
        rrspEmployeeType: ContributionType.PERCENTAGE,
        rrspEmployeeValue: 3, // 3%
        rrspEmployerRate: 3, // 3%
        esppEmployeeRate: 10, // 10%
        esppEmployerRate: 1.5, // 1.5%
        otherSavingsTfsaMonthly: 0,
        otherSavingsRrspMonthly: 0,
      };

      const result = calculatePersonTax(input);

      // Verify CPP Total (Max CPP 2026 is 4230.45 + Max CPP2 is 416.00 = 4646.45)
      expect(result.cppTotalContribution).toBeCloseTo(4646.45, 1);
      // Verify Max EI (1123.07)
      expect(result.eiPremium).toBeCloseTo(1123.07, 1);
      // RRSP Deduction is 3% of 168000 = 5040
      expect(result.rrspEmployeeDeduction).toBe(5040);
      // ESPP Employee is 10% of 168000 = 16800
      expect(result.esppEmployeeContribution).toBe(16800);
      
      // Net income should be positive
      expect(result.takeHomePay).toBeGreaterThan(0);
      expect(result.totalIncomeTax).toBeGreaterThan(0);
      
      // Actual savings should include: employee rrsp (5040) + employer rrsp (5040) + employee espp (16800) + employer espp (2520) = 29400
      expect(result.actualSavings).toBe(29400);
    });
  });

  describe('calculateCcb', () => {
    const config = {
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

    it('should return 0 when no children', () => {
      expect(calculateCcb([], 50000, config)).toBe(0);
    });

    it('should return maximum benefit when family net income is below threshold1', () => {
      const children: ChildInput[] = [
        { id: '1', age: 3 }, // under 6: max 8157
      ];
      expect(calculateCcb(children, 30000, config)).toBe(8157);
    });

    it('should reduce benefit when family net income exceeds threshold1 but is below threshold2', () => {
      const children: ChildInput[] = [
        { id: '1', age: 3 },
      ];
      // Income = 50000, excess over 38237 is 11763
      // Clawback is 11763 * 7% = 823.41
      // Net benefit = 8157 - 823.41 = 7333.59
      expect(calculateCcb(children, 50000, config)).toBeCloseTo(7333.59, 1);
    });
  });

  describe('calculateHouseholdTax', () => {
    it('should calculate correct savings rate and drift', () => {
      const he: PersonInput = {
        name: 'He',
        age: 36,
        salary: 168000,
        startYearInCanada: 2015,
        retirementAge: 65,
        extraIncomeMonthly: 0,
        rrspEmployeeType: ContributionType.PERCENTAGE,
        rrspEmployeeValue: 3,
        rrspEmployerRate: 3,
        esppEmployeeRate: 10,
        esppEmployerRate: 1.5,
        otherSavingsTfsaMonthly: 0,
        otherSavingsRrspMonthly: 0,
      };

      const she: PersonInput = {
        name: 'She',
        age: 38,
        salary: 82000,
        startYearInCanada: 2022,
        retirementAge: 65,
        extraIncomeMonthly: 0,
        rrspEmployeeType: ContributionType.FLAT,
        rrspEmployeeValue: 263.33, // $400/month total - $136.67 match = $263.33 own
        rrspEmployerRate: 2, // 2%
        esppEmployeeRate: 0,
        esppEmployerRate: 0,
        otherSavingsTfsaMonthly: 0,
        otherSavingsRrspMonthly: 1000, // $1000/month = 12000/year to RRSP
      };

      const children: ChildInput[] = [];

      const result = calculateHouseholdTax(
        he,
        she,
        children,
        SavingsBase.GROSS,
        0.20 // 20% target savings rate
      );

      // Total gross income = 168000 + 82000 = 250000
      expect(result.totalHouseholdGross).toBe(250000);
      
      // Target savings amount = 20% of 250000 = 50000
      expect(result.savingsTargetAmount).toBe(50000);

      // He actual savings:
      // Employee RRSP: 3% of 168000 = 5040
      // Employer RRSP: 3% of 168000 = 5040
      // Employee ESPP: 10% of 168000 = 16800
      // Employer ESPP: 1.5% of 168000 = 2520
      // Total He = 29400
      
      // She actual savings:
      // Employee RRSP: 263.33 * 12 = 3159.96
      // Employer RRSP: 2% of 82000 = 1640
      // Other savings: 1000 * 12 = 12000
      // Total She = 3159.96 + 1640 + 12000 = 16799.96 (~16800)
      
      // Combined savings = 29400 + 16800 = 46200
      expect(result.totalHouseholdActualSavings).toBeCloseTo(46200, 0);
      
      // Drift = 46200 - 50000 = -3800
      expect(result.savingsDrift).toBeCloseTo(-3800, 0);
      expect(result.actualSavingsRate).toBeCloseTo(46200 / 250000, 4);
    });
  });
});
