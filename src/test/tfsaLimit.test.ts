import { describe, it, expect } from 'vitest';
import { resolveAnnualTfsaLimit } from '../utils/contributionPolicy';

describe('resolveAnnualTfsaLimit', () => {
  it('defaults to flat nominal $7000 even when inflation multiplier grows', () => {
    expect(resolveAnnualTfsaLimit(undefined, undefined, 1.5)).toBe(7000);
    expect(resolveAnnualTfsaLimit(7000, false, 1.5)).toBe(7000);
  });

  it('scales with CPI only when inflate flag is on', () => {
    expect(resolveAnnualTfsaLimit(7000, true, 1.5)).toBeCloseTo(10500, 5);
  });
});
