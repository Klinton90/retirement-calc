import { describe, it, expect } from 'vitest';
import { FamilyMember } from '../types/calculator';
import { estimateRrspRefund } from '../utils/rrspRefund';
import { DEFAULT_TAX_CONFIG, marginalIncomeTaxRate } from '../utils/taxRates';
import { accumulateToRetirement } from '../utils/targetEngine';
import { AllocationPolicy } from '../types/calculator';
import { basePlan } from './fixtures/excessMvFixtures';

describe('estimateRrspRefund', () => {
  it('own RRSP uses account owner marginal rate', () => {
    const heSalary = 168_000;
    const sheSalary = 82_000;
    const heRate = marginalIncomeTaxRate(heSalary, DEFAULT_TAX_CONFIG);
    const sheRate = marginalIncomeTaxRate(sheSalary, DEFAULT_TAX_CONFIG);
    const est = estimateRrspRefund({
      deposits: { heOwn: 10_000, sheOwn: 5_000, spousal: 0 },
      heSalary,
      sheSalary,
      reinvestRate: 1,
    });
    expect(est.gross).toBeCloseTo(10_000 * heRate + 5_000 * sheRate, 0);
    expect(est.reinvested).toBeCloseTo(est.gross, 0);
    expect(est.byContributorGross.he).toBeCloseTo(10_000 * heRate, 0);
    expect(est.byContributorGross.she).toBeCloseTo(5_000 * sheRate, 0);
  });

  it('spousal uses primary earner marginal rate', () => {
    const heSalary = 168_000;
    const sheSalary = 82_000;
    const heRate = marginalIncomeTaxRate(heSalary, DEFAULT_TAX_CONFIG);
    const est = estimateRrspRefund({
      deposits: { heOwn: 0, sheOwn: 0, spousal: 11_292 },
      heSalary,
      sheSalary,
      spousalContributor: FamilyMember.HE,
      reinvestRate: 0.5,
    });
    expect(est.byContributorGross.he).toBeCloseTo(11_292 * heRate, 0);
    expect(est.byContributorGross.she).toBe(0);
    expect(est.reinvested).toBeCloseTo(est.gross * 0.5, 0);
  });

  it('TFSA / zero RRSP deposits → zero refund', () => {
    const est = estimateRrspRefund({
      deposits: { heOwn: 0, sheOwn: 0, spousal: 0 },
      heSalary: 168_000,
      sheSalary: 82_000,
      reinvestRate: 0.5,
    });
    expect(est.gross).toBe(0);
    expect(est.reinvested).toBe(0);
  });

  it('slider 0 / 100 clamps reinvested', () => {
    const base = {
      deposits: { heOwn: 20_000, sheOwn: 0, spousal: 0 },
      heSalary: 168_000,
      sheSalary: 82_000,
    };
    const none = estimateRrspRefund({ ...base, reinvestRate: 0 });
    const all = estimateRrspRefund({ ...base, reinvestRate: 1 });
    expect(none.reinvested).toBe(0);
    expect(all.reinvested).toBeCloseTo(all.gross, 0);
    expect(all.gross).toBeGreaterThan(0);
  });

  it('payroll ESPP counts toward contributor own deposit', () => {
    const heSalary = 168_000;
    const heRate = marginalIncomeTaxRate(heSalary, DEFAULT_TAX_CONFIG);
    const est = estimateRrspRefund({
      deposits: {
        heOwn: 0,
        sheOwn: 0,
        spousal: 0,
        hePayrollEspp: 19_320,
      },
      heSalary,
      sheSalary: 82_000,
      reinvestRate: 1,
    });
    expect(est.byContributorGross.he).toBeCloseTo(19_320 * heRate, 0);
  });
});

describe('live-path RRSP refund reinvestment', () => {
  it('checkbox OFF + TFSA full: ESPP→RRSP nest egg rises when slider > 0', () => {
    const plan0 = basePlan({
      depositEsppToRrsp: false,
      esppRefundSaveRate: 0,
      heInput: {
        ...basePlan().heInput,
        carryForwardTfsaRoom: 0,
        esppEmployeeRate: 10,
        esppEmployerRate: 1.5,
        extraContributionMonthly: 0,
      },
      sheInput: {
        ...basePlan().sheInput,
        carryForwardTfsaRoom: 0,
        extraContributionMonthly: 0,
      },
    });
    const plan50 = { ...plan0, esppRefundSaveRate: 0.5 };
    const a = accumulateToRetirement(plan0, 0, 2026, AllocationPolicy.TFSA_FIRST);
    const b = accumulateToRetirement(plan50, 0, 2026, AllocationPolicy.TFSA_FIRST);
    const tot = (x: typeof a) =>
      x.tfsaHe + x.tfsaShe + x.rrspHe + x.rrspShe + x.nonReg;
    expect(tot(b)).toBeGreaterThan(tot(a));
  });

  it('Extra → Spousal refund uses He marginal (optimize on)', () => {
    const plan = basePlan({
      optimizeSpousalRrsp: true,
      esppRefundSaveRate: 1,
      depositEsppToRrsp: false,
      heInput: {
        ...basePlan().heInput,
        carryForwardTfsaRoom: 0,
        esppEmployeeRate: 0,
        esppEmployerRate: 0,
        extraContributionMonthly: 0,
      },
      sheInput: {
        ...basePlan().sheInput,
        carryForwardTfsaRoom: 0,
        extraContributionMonthly: 1000,
      },
    });
    const withRefund = accumulateToRetirement(plan, 0, 2026, AllocationPolicy.TFSA_FIRST);
    const noRefund = accumulateToRetirement(
      { ...plan, esppRefundSaveRate: 0 },
      0,
      2026,
      AllocationPolicy.TFSA_FIRST
    );
    const tot = (x: typeof withRefund) =>
      x.tfsaHe + x.tfsaShe + x.rrspHe + x.rrspShe + x.nonReg;
    expect(tot(withRefund)).toBeGreaterThan(tot(noRefund));
  });
});
