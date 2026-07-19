import { describe, it, expect } from 'vitest';
import {
  DEFAULT_LIFE_EXPECTANCY_DELTA,
  monthlyFromWealthGap,
  resolveRetirementHorizon,
} from '../utils/retirementHorizon';

describe('monthlyFromWealthGap', () => {
  it('returns 0 for non-positive gap or years', () => {
    expect(monthlyFromWealthGap(0, 20, 0.05)).toBe(0);
    expect(monthlyFromWealthGap(-1_000, 20, 0.05)).toBe(0);
    expect(monthlyFromWealthGap(100_000, 0, 0.05)).toBe(0);
  });

  it('uses gap/months when return is ~0', () => {
    expect(monthlyFromWealthGap(120_000, 10, 0)).toBeCloseTo(1_000, 6);
  });

  it('matches FV-of-annuity inversion for a known case', () => {
    // 20y @ 5%: monthly that grows to $100k
    const pmt = monthlyFromWealthGap(100_000, 20, 0.05);
    const months = 20 * 12;
    const rm = Math.pow(1.05, 1 / 12) - 1;
    const fv = pmt * (Math.pow(1 + rm, months) - 1) / rm;
    expect(fv).toBeCloseTo(100_000, 4);
    expect(pmt).toBeGreaterThan(0);
    expect(pmt).toBeLessThan(100_000 / months); // compounding beats flat
  });
});

describe('resolveRetirementHorizon', () => {
  const he = { age: 36, retirementAge: 65 };

  it('defaults to 20 retirement years (not 30)', () => {
    const h = resolveRetirementHorizon({ heInput: he });
    expect(DEFAULT_LIFE_EXPECTANCY_DELTA).toBe(20);
    expect(h.retirementYears).toBe(20);
    expect(h.firstRetireAgeHe).toBe(65);
    expect(h.lastFundedAgeHe).toBe(84);
    expect(h.terminalAgeHe).toBe(85);
    expect(h.yearsToRetirement).toBe(29);
    // Ages 36..84 inclusive = 49 years; loop t < 49
    expect(h.projectionYearsFromNow).toBe(49);
    expect(h.defaultSurvivorYearIndex).toBe(10);
    expect(h.survivorYearIndex).toBe(10);
  });

  it('honors explicit delta and survivorYearIndex', () => {
    const h = resolveRetirementHorizon({
      heInput: he,
      lifeExpectancyDelta: 4,
      survivorYearIndex: 1,
    });
    expect(h.retirementYears).toBe(4);
    expect(h.lastFundedAgeHe).toBe(68);
    expect(h.terminalAgeHe).toBe(69);
    expect(h.survivorYearIndex).toBe(1);
    expect(h.defaultSurvivorYearIndex).toBe(2);
  });

  it('matches runProjection length: last row age === lastFundedAgeHe', () => {
    // Contract both engines must honor — no phantom terminalAge year.
    const h = resolveRetirementHorizon({
      heInput: { age: 65, retirementAge: 65 },
      lifeExpectancyDelta: 20,
    });
    expect(h.projectionYearsFromNow).toBe(20);
    expect(h.lastFundedAgeHe).toBe(84);
    expect(h.terminalAgeHe).toBe(85);
  });
});
