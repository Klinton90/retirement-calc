/**
 * Live-path RRSP tax-refund estimate — post-deploy deposits × contributor marginal rate.
 * Slider (`esppRefundSaveRate`) is the reinvestment fraction; remainder is spent.
 * Distinct from the MV probe, which credits a full refund for ranking only.
 */
import { FamilyMember, type TaxConfig } from '../types/calculator';
import { DEFAULT_TAX_CONFIG, marginalIncomeTaxRate } from './taxRates';

export interface RrspRefundDeposits {
  /** Own-RRSP deposits attributed to He (Extra/ESPP-sale → He RRSP). */
  heOwn: number;
  /** Own-RRSP deposits attributed to She. */
  sheOwn: number;
  /** Spousal RRSP deposits (primary deducts; secondary owns). */
  spousal: number;
  /** Payroll ESPP→RRSP for He when depositEsppToRrsp is on. */
  hePayrollEspp?: number;
  /** Payroll ESPP→RRSP for She when depositEsppToRrsp is on. */
  shePayrollEspp?: number;
}

export interface RrspRefundEstimate {
  /** Total tax refund before reinvestment slider. */
  gross: number;
  /** gross × reinvestRate — amount to redeploy. */
  reinvested: number;
  /** Gross refund by contributor (before slider). */
  byContributorGross: { he: number; she: number };
  /** Reinvested amount by contributor (after slider). */
  byContributorReinvested: { he: number; she: number };
}

export function estimateRrspRefund(params: {
  deposits: RrspRefundDeposits;
  heSalary: number;
  sheSalary: number;
  spousalContributor?: FamilyMember;
  taxConfig?: TaxConfig;
  /** Fraction of gross refund that is saved/redeployed (default 0.5). */
  reinvestRate?: number;
}): RrspRefundEstimate {
  const spousalContributor = params.spousalContributor ?? FamilyMember.HE;
  const taxConfig = params.taxConfig ?? DEFAULT_TAX_CONFIG;
  const reinvestRate = Math.min(1, Math.max(0, params.reinvestRate ?? 0.5));
  const d = params.deposits;

  const heRate = marginalIncomeTaxRate(Math.max(0, params.heSalary), taxConfig);
  const sheRate = marginalIncomeTaxRate(Math.max(0, params.sheSalary), taxConfig);

  const hePayroll = Math.max(0, d.hePayrollEspp ?? 0);
  const shePayroll = Math.max(0, d.shePayrollEspp ?? 0);
  const heOwn = Math.max(0, d.heOwn) + hePayroll;
  const sheOwn = Math.max(0, d.sheOwn) + shePayroll;
  const spousal = Math.max(0, d.spousal);

  let heGross = heOwn * heRate;
  let sheGross = sheOwn * sheRate;
  if (spousal > 0) {
    if (spousalContributor === FamilyMember.HE) heGross += spousal * heRate;
    else sheGross += spousal * sheRate;
  }

  const gross = heGross + sheGross;
  return {
    gross,
    reinvested: gross * reinvestRate,
    byContributorGross: { he: heGross, she: sheGross },
    byContributorReinvested: {
      he: heGross * reinvestRate,
      she: sheGross * reinvestRate,
    },
  };
}
