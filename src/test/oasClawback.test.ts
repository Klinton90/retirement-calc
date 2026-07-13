import { describe, it, expect } from 'vitest';
import {
  oasClawback,
  DEFAULT_OAS_CLAWBACK_THRESHOLD,
  DEFAULT_OAS_CLAWBACK_RATE,
} from '../utils/oasClawback';

describe('oasClawback', () => {
  it('applies no clawback below the threshold', () => {
    const result = oasClawback(8000, 50000);
    expect(result.clawback).toBe(0);
    expect(result.oasAfter).toBe(8000);
  });

  it('claws back 15% of income above the threshold', () => {
    const income = DEFAULT_OAS_CLAWBACK_THRESHOLD + 10000;
    const result = oasClawback(8000, income);
    expect(result.clawback).toBeCloseTo(10000 * DEFAULT_OAS_CLAWBACK_RATE, 6); // 1500
    expect(result.oasAfter).toBeCloseTo(8000 - 1500, 6);
  });

  it('caps the clawback at the OAS received (full recovery)', () => {
    const income = DEFAULT_OAS_CLAWBACK_THRESHOLD + 200000;
    const result = oasClawback(8000, income);
    expect(result.clawback).toBe(8000);
    expect(result.oasAfter).toBe(0);
  });

  it('supports configurable threshold and rate', () => {
    const result = oasClawback(5000, 100000, 80000, 0.1);
    expect(result.clawback).toBeCloseTo((100000 - 80000) * 0.1, 6); // 2000
    expect(result.oasAfter).toBeCloseTo(3000, 6);
  });

  it('handles non-positive OAS gracefully', () => {
    const result = oasClawback(0, 200000);
    expect(result.clawback).toBe(0);
    expect(result.oasAfter).toBe(0);
  });
});
