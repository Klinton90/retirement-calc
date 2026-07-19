/**
 * This-year ESPP sale redeploy on rooms after Extra — locked ownership cascade display.
 * Nest-egg Extra/ESPP path uses MV (ADR 0003); this guide is informational for ESPP vs Extra crowding.
 */
import { AllocationPolicy, ContributionType, FamilyMember, type RetirementPlan } from '../types/calculator';
import {
  deployAnnualContributions,
  preferDiscretionaryRrspOwner,
  type RoomState,
} from './contributionPolicy';
import { resolveBuckets } from './accountBuckets';
import {
  computeSoftCapacity,
  consumeTfsaForExtra,
  resolveExtraContributionMonthly,
} from './excessMoneyGuide';
import { resolveEarnerRoles } from './earnerRoles';

export interface EsppSplit {
  toTfsa: number;
  toRrsp: number;
  toNonReg: number;
  toTfsaHe: number;
  toTfsaShe: number;
  toRrspHe: number;
  toRrspShe: number;
}

export interface EsppAllocationGuideResult {
  esppCashAnnual: number;
  payrollRrspHe: number;
  payrollRrspShe: number;
  employerMatchHe: number;
  employerMatchShe: number;
  /** Opening carry-forward rooms (before Extra eats TFSA). */
  rooms: RoomState;
  /** Rooms left after Extra He → Extra She fill TFSA (what ESPP actually sees). */
  roomsAfterExtra: RoomState;
  /** TFSA consumed this year by Extra before ESPP. */
  extraAteTfsa: number;
  heExtraAnnual: number;
  sheExtraAnnual: number;
  /** He TFSA → She TFSA → preferred RRSP — on rooms *after* Extra. */
  lockedCascade: EsppSplit;
  preferredRrsp: FamilyMember;
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

/**
 * This-year ESPP sale redeploy on rooms **after Extra** has taken TFSA:
 * He TFSA → She TFSA → preferred spouse RRSP → other → Non-reg.
 */
export function explainEsppAllocation(plan: RetirementPlan): EsppAllocationGuideResult {
  const he = plan.heInput;
  const she = plan.sheInput;
  const heEsppCashAnnual =
    (he.salary * (he.esppEmployeeRate || 0)) / 100 +
    (he.salary * (he.esppEmployerRate || 0)) / 100;
  const sheEsppCashAnnual =
    (she.salary * (she.esppEmployeeRate || 0)) / 100 +
    (she.salary * (she.esppEmployerRate || 0)) / 100;
  const esppCashAnnual = heEsppCashAnnual + sheEsppCashAnnual;
  const payrollRrspHe = payrollRrspAnnual(he.salary, he.rrspEmployeeType, he.rrspEmployeeValue);
  const payrollRrspShe = payrollRrspAnnual(she.salary, she.rrspEmployeeType, she.rrspEmployeeValue);
  const employerMatchHe = (he.salary * (he.rrspEmployerRate || 0)) / 100;
  const employerMatchShe = (she.salary * (she.rrspEmployerRate || 0)) / 100;
  const rooms = roomsFromPlan(plan);
  const buckets = resolveBuckets(plan);
  const depositEsppToRrsp = !!plan.depositEsppToRrsp;
  const personalInvestable = depositEsppToRrsp ? 0 : esppCashAnnual;

  const heExtraAnnual = resolveExtraContributionMonthly(he) * 12;
  const sheExtraAnnual = resolveExtraContributionMonthly(she) * 12;
  const roles = resolveEarnerRoles(plan);
  const { rooms: roomsAfterExtra, ateTfsa: extraAteTfsa } = consumeTfsaForExtra(
    rooms,
    heExtraAnnual,
    sheExtraAnnual,
    roles.primary
  );

  const currentYear = new Date().getFullYear();
  const softHe = computeSoftCapacity(FamilyMember.HE, he, buckets.rrspHe, plan, currentYear);
  const softShe = computeSoftCapacity(FamilyMember.SHE, she, buckets.rrspShe, plan, currentYear);
  const preferredRrsp =
    preferDiscretionaryRrspOwner({
      softHe: softHe.level,
      softShe: softShe.level,
      heSalary: he.salary,
      sheSalary: she.salary,
    }) ?? FamilyMember.HE;

  const r = deployAnnualContributions({
    personalInvestable,
    payrollRrspHe: 0,
    payrollRrspShe: 0,
    employerMatchHe: 0,
    employerMatchShe: 0,
    policy: AllocationPolicy.TFSA_FIRST,
    rooms: { ...roomsAfterExtra },
    buckets,
    preferRrsp: preferredRrsp,
  });
  const lockedCascade: EsppSplit = {
    toTfsa: r.toTfsa,
    toRrsp: r.toRrspHeDiscretionary + r.toRrspSheDiscretionary,
    toNonReg: r.toNonReg,
    toTfsaHe: r.toTfsaHe,
    toTfsaShe: r.toTfsaShe,
    toRrspHe: r.toRrspHeDiscretionary,
    toRrspShe: r.toRrspSheDiscretionary,
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);
  const prefName = preferredRrsp === FamilyMember.SHE ? 'She' : 'He';
  const remainingTfsa = roomsAfterExtra.tfsaHe + roomsAfterExtra.tfsaShe;

  let summary: string;
  if (esppCashAnnual <= 0) {
    summary = 'No ESPP cash this year — nothing to redeploy.';
  } else if (depositEsppToRrsp) {
    summary = `ESPP→RRSP tax toggle is ON (deduction path). After Extra ate ${fmt(extraAteTfsa)} TFSA, sale-and-redeploy would see ${fmt(remainingTfsa)} TFSA left.`;
  } else {
    const extraNote =
      extraAteTfsa > 0
        ? `Extra already filled ${fmt(extraAteTfsa)} TFSA (${fmt(remainingTfsa)} left for ESPP). `
        : '';
    summary = `${extraNote}Combined ESPP ${fmt(esppCashAnnual)} (${fmt(heEsppCashAnnual)} He / ${fmt(sheEsppCashAnnual)} She): ${fmt(lockedCascade.toTfsaHe)} → He TFSA, ${fmt(lockedCascade.toTfsaShe)} → She TFSA, prefer ${prefName} RRSP (${fmt(lockedCascade.toRrspHe)} He / ${fmt(lockedCascade.toRrspShe)} She), ${fmt(lockedCascade.toNonReg)} → non-reg. Live projection routes each person's ESPP through that person's MV path.`;
  }

  return {
    esppCashAnnual,
    payrollRrspHe,
    payrollRrspShe,
    employerMatchHe,
    employerMatchShe,
    rooms,
    roomsAfterExtra,
    extraAteTfsa,
    heExtraAnnual,
    sheExtraAnnual,
    lockedCascade,
    preferredRrsp,
    depositEsppToRrsp,
    summary,
  };
}
