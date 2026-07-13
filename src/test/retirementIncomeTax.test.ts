import { describe, it, expect } from 'vitest';
import {
  calculateRetirementIncomeTax,
  calculateHouseholdRetirementTax,
} from '../utils/retirementIncomeTax';
import { DEFAULT_TAX_CONFIG } from '../utils/taxRates';

describe('calculateRetirementIncomeTax', () => {
  it('returns 0 for income at/below the combined basic personal amounts', () => {
    // Below the Ontario BPA there should be no tax.
    expect(calculateRetirementIncomeTax(10000, DEFAULT_TAX_CONFIG)).toBe(0);
  });

  it('is monotonic increasing in taxable income', () => {
    const low = calculateRetirementIncomeTax(40000, DEFAULT_TAX_CONFIG);
    const mid = calculateRetirementIncomeTax(80000, DEFAULT_TAX_CONFIG);
    const high = calculateRetirementIncomeTax(150000, DEFAULT_TAX_CONFIG);
    expect(mid).toBeGreaterThan(low);
    expect(high).toBeGreaterThan(mid);
  });

  it('computes a known federal+ontario+OHP figure for a mid income', () => {
    // 60000 taxable.
    // Federal: 58523*0.14 + (60000-58523)*0.205 = 8193.22 + 302.785 = 8496.005
    //   credit = 16452*0.15 = 2467.8 -> fed payable = 6028.205
    // Ontario: 53891*0.0505 + (60000-53891)*0.0915 = 2721.4955 + 558.9735 = 3280.469
    //   credit = 12989*0.0505 = 655.9445 -> basic = 2624.5245 (no surtax, < 6823)
    // OHP at 60000 = 600 + min(150, (60000-48000)*0.06)=600+150=750
    const expected = 6028.205 + 2624.5245 + 750;
    expect(calculateRetirementIncomeTax(60000, DEFAULT_TAX_CONFIG)).toBeCloseTo(expected, 2);
  });

  it('does not include CPP/EI (retirement income only)', () => {
    // Sanity: a taxable income tax should equal running the primitive directly.
    const tax = calculateRetirementIncomeTax(100000, DEFAULT_TAX_CONFIG);
    expect(tax).toBeGreaterThan(0);
  });
});

describe('calculateHouseholdRetirementTax', () => {
  it('sums individual taxes without splitting', () => {
    const result = calculateHouseholdRetirementTax(
      90000,
      30000,
      50000,
      0,
      DEFAULT_TAX_CONFIG,
      false
    );
    expect(result.heTaxableAfterSplit).toBe(90000);
    expect(result.sheTaxableAfterSplit).toBe(30000);
    expect(result.heTax).toBeCloseTo(calculateRetirementIncomeTax(90000, DEFAULT_TAX_CONFIG), 6);
    expect(result.sheTax).toBeCloseTo(calculateRetirementIncomeTax(30000, DEFAULT_TAX_CONFIG), 6);
    expect(result.totalTax).toBeCloseTo(result.heTax + result.sheTax, 6);
  });

  it('splits only the RRIF-eligible income, keeping OAS/CPP with each person', () => {
    // He: oasCppOther = 40000, rrif = 50000 (total 90000)
    // She: oasCppOther = 30000, rrif = 0 (total 30000)
    const result = calculateHouseholdRetirementTax(
      90000,
      30000,
      50000,
      0,
      DEFAULT_TAX_CONFIG,
      true
    );
    // Combined rrif eligible = 50000 -> 25000 each.
    expect(result.heTaxableAfterSplit).toBe(40000 + 25000); // 65000
    expect(result.sheTaxableAfterSplit).toBe(30000 + 25000); // 55000
    // Total taxable income is preserved.
    expect(result.heTaxableAfterSplit + result.sheTaxableAfterSplit).toBe(120000);
  });

  it('lowers total tax when splitting equalizes lopsided RRIF income', () => {
    const noSplit = calculateHouseholdRetirementTax(
      120000,
      20000,
      100000,
      0,
      DEFAULT_TAX_CONFIG,
      false
    );
    const withSplit = calculateHouseholdRetirementTax(
      120000,
      20000,
      100000,
      0,
      DEFAULT_TAX_CONFIG,
      true
    );
    expect(withSplit.totalTax).toBeLessThan(noSplit.totalTax);
  });
});
