import { describe, it, expect } from 'vitest';
import { rrifMinimumRate, rrifMinimumWithdrawal } from '../utils/rrifCalc';

describe('rrifMinimumRate', () => {
  it('uses 1 / (90 - age) below age 71', () => {
    expect(rrifMinimumRate(65)).toBeCloseTo(1 / 25, 10); // 0.04
    expect(rrifMinimumRate(70)).toBeCloseTo(1 / 20, 10); // 0.05
    expect(rrifMinimumRate(60)).toBeCloseTo(1 / 30, 10);
  });

  it('clamps ages below 55 to the age-55 rate', () => {
    expect(rrifMinimumRate(40)).toBeCloseTo(1 / 35, 10);
    expect(rrifMinimumRate(55)).toBeCloseTo(1 / 35, 10);
  });

  it('uses the CRA prescribed factor table from age 71', () => {
    expect(rrifMinimumRate(71)).toBeCloseTo(0.0528, 10);
    expect(rrifMinimumRate(75)).toBeCloseTo(0.0582, 10);
    expect(rrifMinimumRate(80)).toBeCloseTo(0.0682, 10);
    expect(rrifMinimumRate(90)).toBeCloseTo(0.1192, 10);
    expect(rrifMinimumRate(94)).toBeCloseTo(0.1879, 10);
    expect(rrifMinimumRate(95)).toBeCloseTo(0.2, 10);
  });

  it('clamps ages above 95 to the max table factor', () => {
    expect(rrifMinimumRate(100)).toBeCloseTo(0.2, 10);
  });

  it('floors fractional ages into the table', () => {
    expect(rrifMinimumRate(71.9)).toBeCloseTo(0.0528, 10);
  });
});

describe('rrifMinimumWithdrawal', () => {
  it('applies the rate to the Jan 1 balance', () => {
    expect(rrifMinimumWithdrawal(100000, 71)).toBeCloseTo(5280, 6);
    expect(rrifMinimumWithdrawal(200000, 65)).toBeCloseTo(200000 / 25, 6);
  });

  it('returns 0 for non-positive balances', () => {
    expect(rrifMinimumWithdrawal(0, 80)).toBe(0);
    expect(rrifMinimumWithdrawal(-100, 80)).toBe(0);
  });
});
