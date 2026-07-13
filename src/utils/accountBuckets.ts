import type { AccountBuckets, RetirementPlan } from '../types/calculator';

/** User balances (CAD): He TFSA 92.7k, She TFSA 16k, He RRSP ~108.9k, She RRSP 12.5k. */
export const DEFAULT_ACCOUNT_BUCKETS: AccountBuckets = {
  tfsaHe: 92700,
  tfsaShe: 16000,
  rrspHe: 108900,
  rrspShe: 12500,
  nonReg: 0,
  cashExcluded: 0,
};

export function totalInvestable(b: AccountBuckets): number {
  return b.tfsaHe + b.tfsaShe + b.rrspHe + b.rrspShe + b.nonReg;
}

export function cloneBuckets(b: AccountBuckets): AccountBuckets {
  return { ...b };
}

/** Migrate legacy single currentSavings into buckets if accountBuckets missing. */
export function resolveBuckets(plan: RetirementPlan): AccountBuckets {
  if (plan.accountBuckets) {
    return cloneBuckets(plan.accountBuckets);
  }
  const total = plan.currentSavings || 0;
  if (total <= 0) return cloneBuckets(DEFAULT_ACCOUNT_BUCKETS);
  // Split legacy pile proportionally to default weights
  const d = DEFAULT_ACCOUNT_BUCKETS;
  const w = totalInvestable(d) || 1;
  return {
    tfsaHe: (total * d.tfsaHe) / w,
    tfsaShe: (total * d.tfsaShe) / w,
    rrspHe: (total * d.rrspHe) / w,
    rrspShe: (total * d.rrspShe) / w,
    nonReg: (total * d.nonReg) / w,
    cashExcluded: 0,
  };
}

export function growBuckets(b: AccountBuckets, rate: number): AccountBuckets {
  const g = 1 + rate;
  return {
    tfsaHe: b.tfsaHe * g,
    tfsaShe: b.tfsaShe * g,
    rrspHe: b.rrspHe * g,
    rrspShe: b.rrspShe * g,
    nonReg: b.nonReg * g,
    cashExcluded: b.cashExcluded,
  };
}

export function redepositExcess(b: AccountBuckets, afterTaxCash: number, tfsaRoomHe: number, tfsaRoomShe: number): AccountBuckets {
  let cash = Math.max(0, afterTaxCash);
  const out = cloneBuckets(b);
  const toHe = Math.min(cash, Math.max(0, tfsaRoomHe));
  out.tfsaHe += toHe;
  cash -= toHe;
  const toShe = Math.min(cash, Math.max(0, tfsaRoomShe));
  out.tfsaShe += toShe;
  cash -= toShe;
  out.nonReg += cash;
  return out;
}

/**
 * Withdraw to meet netNeedAfterPension, honoring RRIF mins on converted accounts.
 * Order: RRIF mins first (taxable), then TFSA for remaining net need, then extra RRSP/RRIF, then non-reg.
 */
export interface WithdrawResult {
  buckets: AccountBuckets;
  rrifHe: number;
  rrifShe: number;
  tfsaWithdraw: number;
  nonRegWithdraw: number;
  taxableRrspExtraHe: number;
  taxableRrspExtraShe: number;
  shortfall: number;
}

export function withdrawForSpend(params: {
  buckets: AccountBuckets;
  netSpendNeed: number; // after pension net — still approximate; tax solved outside
  rrifMinHe: number;
  rrifMinShe: number;
  heConverted: boolean;
  sheConverted: boolean;
}): WithdrawResult {
  const b = cloneBuckets(params.buckets);
  let rrifHe = 0;
  let rrifShe = 0;
  let tfsaWithdraw = 0;
  let nonRegWithdraw = 0;
  let taxableRrspExtraHe = 0;
  let taxableRrspExtraShe = 0;

  if (params.heConverted) {
    rrifHe = Math.min(b.rrspHe, params.rrifMinHe);
    b.rrspHe -= rrifHe;
  }
  if (params.sheConverted) {
    rrifShe = Math.min(b.rrspShe, params.rrifMinShe);
    b.rrspShe -= rrifShe;
  }

  // Gross taxable forced mins — caller handles tax; here we only move balances.
  // Remaining net need after assuming mins are available pre-tax is handled by caller.
  // This function just ensures mins leave the RRSP and optional extra draws.

  let remainingGrossNeed = Math.max(0, params.netSpendNeed); // treated as gross target for extra draws (caller refines)

  // Prefer TFSA for non-forced need (tax-free)
  const tfsaAvail = b.tfsaHe + b.tfsaShe;
  const fromTfsa = Math.min(tfsaAvail, remainingGrossNeed);
  if (fromTfsa > 0) {
    let left = fromTfsa;
    const fromHe = Math.min(b.tfsaHe, left);
    b.tfsaHe -= fromHe;
    left -= fromHe;
    const fromShe = Math.min(b.tfsaShe, left);
    b.tfsaShe -= fromShe;
    tfsaWithdraw = fromTfsa;
    remainingGrossNeed -= fromTfsa;
  }

  // Extra RRSP/RRIF (taxable) — draw from larger balance first
  if (remainingGrossNeed > 0) {
    const order: Array<'he' | 'she'> = b.rrspHe >= b.rrspShe ? ['he', 'she'] : ['she', 'he'];
    for (const who of order) {
      if (remainingGrossNeed <= 0) break;
      if (who === 'he') {
        const take = Math.min(b.rrspHe, remainingGrossNeed);
        b.rrspHe -= take;
        taxableRrspExtraHe += take;
        remainingGrossNeed -= take;
      } else {
        const take = Math.min(b.rrspShe, remainingGrossNeed);
        b.rrspShe -= take;
        taxableRrspExtraShe += take;
        remainingGrossNeed -= take;
      }
    }
  }

  if (remainingGrossNeed > 0) {
    const take = Math.min(b.nonReg, remainingGrossNeed);
    b.nonReg -= take;
    nonRegWithdraw = take;
    remainingGrossNeed -= take;
  }

  return {
    buckets: b,
    rrifHe,
    rrifShe,
    tfsaWithdraw,
    nonRegWithdraw,
    taxableRrspExtraHe,
    taxableRrspExtraShe,
    shortfall: remainingGrossNeed,
  };
}
