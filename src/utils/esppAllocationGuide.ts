import { AllocationPolicy, ContributionType, type RetirementPlan } from '../types/calculator';
import { deployAnnualContributions, type RoomState } from './contributionPolicy';
import { resolveBuckets } from './accountBuckets';

export interface EsppSplit {
  toTfsa: number;
  toRrsp: number;
  toNonReg: number;
}

export interface EsppAllocationGuideResult {
  /** Employee + employer ESPP cash (sold) this year, CAD. */
  esppCashAnnual: number;
  /** He payroll RRSP (employee) — always RRSP, not ESPP choice. */
  payrollRrspHe: number;
  payrollRrspShe: number;
  employerMatchHe: number;
  employerMatchShe: number;
  rooms: RoomState;
  underTfsaFirst: EsppSplit;
  underRrspFirst: EsppSplit;
  activePolicy: AllocationPolicy;
  activeSplit: EsppSplit;
  /** Policy that minimizes non-reg overflow, then maximizes TFSA fill. */
  suggestedPolicy: AllocationPolicy;
  depositEsppToRrsp: boolean;
  summary: string;
}

function roomsFromPlan(plan: RetirementPlan): RoomState {
  return {
    tfsaHe: plan.heInput.carryForwardTfsaRoom ?? 0,
    tfsaShe: plan.sheInput.carryForwardTfsaRoom ?? 0,
    rrspHe: plan.heInput.carryForwardRrspRoom ?? 0,
    rrspShe: plan.sheInput.carryForwardRrspRoom ?? 0,
  };
}

function payrollRrspAnnual(
  salary: number,
  type: ContributionType,
  value: number
): number {
  return type === ContributionType.PERCENTAGE ? (salary * value) / 100 : value * 12;
}

function scoreSplit(s: EsppSplit): number {
  // Prefer less non-reg, then more TFSA (tax-free bridge), then RRSP
  return -s.toNonReg * 1e9 + s.toTfsa * 1e3 + s.toRrsp;
}

/**
 * This-year ESPP sale redeploy preview under TFSA-first vs RRSP-first.
 * ESPP is not an account — cash after sale follows allocation policy (after match + payroll RRSP).
 */
export function explainEsppAllocation(plan: RetirementPlan): EsppAllocationGuideResult {
  const he = plan.heInput;
  const she = plan.sheInput;
  const esppCashAnnual =
    (he.salary * (he.esppEmployeeRate || 0)) / 100 + (he.salary * (he.esppEmployerRate || 0)) / 100;
  const payrollRrspHe = payrollRrspAnnual(he.salary, he.rrspEmployeeType, he.rrspEmployeeValue);
  const payrollRrspShe = payrollRrspAnnual(she.salary, she.rrspEmployeeType, she.rrspEmployeeValue);
  const employerMatchHe = (he.salary * (he.rrspEmployerRate || 0)) / 100;
  const employerMatchShe = (she.salary * (she.rrspEmployerRate || 0)) / 100;
  const rooms = roomsFromPlan(plan);
  const buckets = resolveBuckets(plan);
  const depositEsppToRrsp = !!plan.depositEsppToRrsp;
  const personalInvestable = esppCashAnnual;

  // ESPP-only routing (payroll/match are fixed → RRSP; not part of the "where to put ESPP" choice)
  const run = (policy: AllocationPolicy): EsppSplit => {
    const r = deployAnnualContributions({
      personalInvestable,
      payrollRrspHe: 0,
      payrollRrspShe: 0,
      employerMatchHe: 0,
      employerMatchShe: 0,
      policy,
      rooms: { ...rooms },
      buckets,
    });
    return { toTfsa: r.toTfsa, toRrsp: r.toRrsp, toNonReg: r.toNonReg };
  };

  const underTfsaFirst = run(AllocationPolicy.TFSA_FIRST);
  const underRrspFirst = run(AllocationPolicy.RRSP_FIRST);
  const activePolicy = plan.allocationPolicy ?? AllocationPolicy.TFSA_FIRST;
  const activeSplit = activePolicy === AllocationPolicy.TFSA_FIRST ? underTfsaFirst : underRrspFirst;

  const suggestedPolicy =
    scoreSplit(underTfsaFirst) >= scoreSplit(underRrspFirst)
      ? AllocationPolicy.TFSA_FIRST
      : AllocationPolicy.RRSP_FIRST;

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);

  let summary: string;
  if (esppCashAnnual <= 0) {
    summary = 'No ESPP cash this year — nothing to redeploy.';
  } else if (depositEsppToRrsp) {
    const s = suggestedPolicy === AllocationPolicy.TFSA_FIRST ? underTfsaFirst : underRrspFirst;
    summary = `ESPP→RRSP tax toggle is ON (deduction path). Sale-and-redeploy under ${suggestedPolicy === AllocationPolicy.TFSA_FIRST ? 'TFSA-first' : 'RRSP-first'} would send ${fmt(s.toTfsa)} → TFSA, ${fmt(s.toRrsp)} → RRSP, ${fmt(s.toNonReg)} → non-reg.`;
  } else {
    const s = suggestedPolicy === AllocationPolicy.TFSA_FIRST ? underTfsaFirst : underRrspFirst;
    summary = `Suggest ${suggestedPolicy === AllocationPolicy.TFSA_FIRST ? 'TFSA-first' : 'RRSP-first'} for this year’s ${fmt(esppCashAnnual)} ESPP sale: ${fmt(s.toTfsa)} → TFSA, ${fmt(s.toRrsp)} → discretionary RRSP, ${fmt(s.toNonReg)} → non-reg.`;
  }

  return {
    esppCashAnnual,
    payrollRrspHe,
    payrollRrspShe,
    employerMatchHe,
    employerMatchShe,
    rooms,
    underTfsaFirst,
    underRrspFirst,
    activePolicy,
    activeSplit,
    suggestedPolicy,
    depositEsppToRrsp,
    summary,
  };
}
