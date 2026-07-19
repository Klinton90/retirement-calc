import { describe, it, expect } from 'vitest';
import { withCppStartYear } from '../utils/personInputMigrate';
import { ContributionType, type PersonInput } from '../types/calculator';

describe('withCppStartYear', () => {
  const base = {
    name: 'He',
    age: 36,
    salary: 168000,
    startYearInCanada: 2015,
    retirementAge: 65,
    extraIncomeMonthly: 0,
    rrspEmployeeType: ContributionType.PERCENTAGE,
    rrspEmployeeValue: 3,
    rrspEmployerRate: 3,
    esppEmployeeRate: 0,
    esppEmployerRate: 0,
    otherSavingsTfsaMonthly: 0,
    otherSavingsRrspMonthly: 0,
  } as PersonInput;

  it('fills missing cppStartYear from arrival year', () => {
    const legacy = { ...base } as PersonInput;
    delete (legacy as { cppStartYear?: number }).cppStartYear;
    const migrated = withCppStartYear(legacy);
    expect(migrated.cppStartYear).toBe(2015);
  });

  it('preserves an existing cppStartYear', () => {
    const migrated = withCppStartYear({ ...base, cppStartYear: 2020 });
    expect(migrated.cppStartYear).toBe(2020);
  });
});
