import { describe, it, expect } from 'vitest';
import { constrainContributionsByFreeCash } from '../utils/cashConstrainedContrib';

const base = {
  heEmp: 5000,
  sheEmp: 3000,
  heEsppEmployee: 6000,
  sheEsppEmployee: 4000,
  heEsppEmployer: 900,
  sheEsppEmployer: 600,
  heMatchFull: 5000,
  sheMatchFull: 3000,
  heExtra: 2000,
  sheExtra: 1000,
  solverExtra: 0,
  heRefundRedeposit: 0,
  sheRefundRedeposit: 0,
};

describe('constrainContributionsByFreeCash', () => {
  it('passes through elections when free cash covers everything', () => {
    const c = constrainContributionsByFreeCash(100_000, base);
    expect(c.heEmp).toBe(5000);
    expect(c.heEsppEmployee + c.sheEsppEmployee).toBe(10000);
    expect(c.heExtra).toBe(2000);
    expect(c.heMatch).toBe(5000);
    expect(c.heEsppEmployer + c.sheEsppEmployer).toBe(1500);
    expect(c.raid).toBe(0);
    expect(c.personalCashUsed).toBe(5000 + 3000 + 10000 + 2000 + 1000);
    expect(c.employerCashAdded).toBe(5000 + 3000 + 1500);
  });

  it('protects RRSP employee first when budget is tight', () => {
    // Budget covers RRSP employee only (8000)
    const c = constrainContributionsByFreeCash(8000, base);
    expect(c.heEmp + c.sheEmp).toBeCloseTo(8000, 6);
    expect(c.heMatch + c.sheMatch).toBeCloseTo(8000, 6);
    expect(c.heEsppEmployee + c.sheEsppEmployee).toBe(0);
    expect(c.heEsppEmployer + c.sheEsppEmployer).toBe(0);
    expect(c.heExtra + c.sheExtra).toBe(0);
    expect(c.raid).toBe(0);
  });

  it('funds ESPP after RRSP, before Extra', () => {
    // 8000 RRSP + 5000 of 10000 ESPP — Extra cut
    const c = constrainContributionsByFreeCash(13_000, base);
    expect(c.heEmp + c.sheEmp).toBeCloseTo(8000, 6);
    expect(c.heEsppEmployee + c.sheEsppEmployee).toBeCloseTo(5000, 6);
    expect(c.heEsppEmployer + c.sheEsppEmployer).toBeCloseTo(750, 6);
    expect(c.heExtra + c.sheExtra).toBe(0);
  });

  it('raids when free cash is negative — zeros all personal + employer', () => {
    const c = constrainContributionsByFreeCash(-40_000, base);
    expect(c.personalCashUsed).toBe(0);
    expect(c.employerCashAdded).toBe(0);
    expect(c.raid).toBe(40_000);
    expect(
      c.heEmp +
        c.heEsppEmployee +
        c.sheEsppEmployee +
        c.heExtra
    ).toBe(0);
  });
});
