import { describe, it, expect } from 'vitest';
import {
  calculatePersonPension,
  calculateHouseholdPension,
  calculatePersonPensionForAge,
} from '../utils/pensionCalc';
import { type PersonInput, ContributionType } from '../types/calculator';

describe('Pension Calculations', () => {
  const heInput: PersonInput = {
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

  const sheInput: PersonInput = {
    name: 'She',
    age: 38,
    salary: 82000,
    startYearInCanada: 2022,
    retirementAge: 65,
    extraIncomeMonthly: 0,
    rrspEmployeeType: ContributionType.PERCENTAGE,
    rrspEmployeeValue: 2,
    rrspEmployerRate: 2,
    esppEmployeeRate: 0,
    esppEmployerRate: 0,
    otherSavingsTfsaMonthly: 0,
    otherSavingsRrspMonthly: 1000,
  };

  describe('calculatePersonPension', () => {
    it('should calculate full pension for He at age 65 (40 years residency, 40 years CPP)', () => {
      const result = calculatePersonPension(heInput, 2026);
      
      expect(result.residencyYears).toBe(40); // 2055 - 2015 = 40
      expect(result.oasMultiplier).toBe(1.0);
      expect(result.oasMonthly).toBeCloseTo(743.05, 2);
      
      expect(result.contributionYears).toBe(40); // 2055 - 2015 = 40
      expect(result.cppMultiplier).toBe(1.0);
      expect(result.cppMonthly).toBeCloseTo(1507.65, 2);
      
      expect(result.totalPensionAnnual).toBeCloseTo((743.05 + 1507.65) * 12, 1);
    });

    it('should calculate prorated pension for She at age 65 (31 years residency, 31 years CPP)', () => {
      const result = calculatePersonPension(sheInput, 2026);
      
      expect(result.residencyYears).toBe(31); // 2053 - 2022 = 31
      expect(result.oasMultiplier).toBe(0.775); // 31 / 40
      expect(result.oasMonthly).toBeCloseTo(743.05 * 0.775, 2);
      
      expect(result.contributionYears).toBe(31); // 2053 - 2022 = 31
      expect(result.cppMultiplier).toBeCloseTo(31 / 39, 4); // 31/39
      expect(result.cppMonthly).toBeCloseTo(1507.65 * (31 / 39), 2);
    });

    it('should adjust CPP downwards for early retirement (e.g. age 60)', () => {
      const earlyHe = { ...heInput, retirementAge: 60 };
      const result = calculatePersonPension(earlyHe, 2026);
      
      // Early retirement age 60 is 5 years early. Reduction rate is 7.2% per year, so 36% reduction.
      // Contributory years: 2050 - 2015 = 35 years.
      // Base CPP multiplier: 35 / 39 = 0.8974.
      // Base CPP monthly: 1507.65 * 0.8974 = 1352.92.
      // Reduced CPP monthly: 1352.92 * (1 - 0.36) = 865.87.
      expect(result.cppMonthly).toBeCloseTo(1507.65 * (35 / 39) * 0.64, 1);
      
      // OAS is not available until age 65, so if they retire early, in the year of retirement (age 60), OAS is 0.
      expect(result.oasMonthly).toBe(0);
    });

    it('should adjust CPP upwards for delayed retirement (e.g. age 70)', () => {
      const lateHe = { ...heInput, retirementAge: 70 };
      const result = calculatePersonPension(lateHe, 2026);
      
      // Delayed retirement age 70 is 5 years late. Increase rate is 8.4% per year, so 42% increase.
      // Contributory years: 2060 - 2015 = 45 years (capped at 100% target, multiplier = 1.0).
      // Base CPP monthly: 1507.65 * 1.0 = 1507.65.
      // Increased CPP monthly: 1507.65 * (1 + 0.42) = 2140.86.
      expect(result.cppMonthly).toBeCloseTo(1507.65 * 1.42, 1);
      
      // OAS delayed retirement by 5 years (60 months) at 0.6% per month = 36% increase.
      expect(result.oasMonthly).toBeCloseTo(743.05 * 1.36, 1);
    });
  });

  describe('calculatePersonPensionForAge', () => {
    it('pays $0 OAS before age 65 (age-60 snapshot)', () => {
      const earlyHe = { ...heInput, retirementAge: 60 };
      const result = calculatePersonPensionForAge(earlyHe, 2026, 60);
      expect(result.oasMonthly).toBe(0);
      // CPP is claimed at 60 (reduced 36%), so it is paid from age 60.
      expect(result.cppMonthly).toBeCloseTo(1507.65 * (35 / 39) * 0.64, 1);
    });

    it('pays OAS at age 65 even when retirementAge is 60', () => {
      const earlyHe = { ...heInput, retirementAge: 60 };
      const result = calculatePersonPensionForAge(earlyHe, 2026, 65);
      // Residency 40 years -> full OAS base, no 75+ bump yet.
      expect(result.oasMonthly).toBeCloseTo(743.05, 2);
      // CPP still reflects the age-60 claim (reduced), paid throughout retirement.
      expect(result.cppMonthly).toBeCloseTo(1507.65 * (35 / 39) * 0.64, 1);
    });

    it('applies the +10% OAS increase from age 75', () => {
      const result = calculatePersonPensionForAge(heInput, 2026, 75);
      expect(result.oasMonthly).toBeCloseTo(743.05 * 1.1, 2);
    });

    it('pays $0 CPP before the claim age', () => {
      const lateHe = { ...heInput, retirementAge: 70 };
      const at68 = calculatePersonPensionForAge(lateHe, 2026, 68);
      expect(at68.cppMonthly).toBe(0);
      // OAS is still paid from 65 regardless of the later CPP claim.
      expect(at68.oasMonthly).toBeCloseTo(743.05, 2);

      const at70 = calculatePersonPensionForAge(lateHe, 2026, 70);
      // Claimed at 70 -> +42% (contribution years capped at target).
      expect(at70.cppMonthly).toBeCloseTo(1507.65 * 1.42, 1);
    });

    it('uses cppStartYear for contribution years when provided', () => {
      // He arrived 2015 but only started CPP contributions in 2020.
      const withCppStart = { ...heInput, cppStartYear: 2020 };
      const result = calculatePersonPensionForAge(withCppStart, 2026, 65);
      // birthYear 1990, claim age 65 -> claimYear 2055; contribStart 2020 -> 35 years.
      expect(result.contributionYears).toBe(35);
      expect(result.cppMultiplier).toBeCloseTo(35 / 39, 4);
      // OAS residency still based on startYearInCanada (2015 -> 40 years -> full).
      expect(result.oasMonthly).toBeCloseTo(743.05, 2);
    });
  });

  describe('calculateHouseholdPension', () => {
    it('should calculate household pension sum correctly', () => {
      const result = calculateHouseholdPension(heInput, sheInput, 2026);
      const heP = calculatePersonPension(heInput, 2026);
      const sheP = calculatePersonPension(sheInput, 2026);
      
      expect(result.totalHouseholdPensionAnnual).toBe(heP.totalPensionAnnual + sheP.totalPensionAnnual);
    });
  });
});
