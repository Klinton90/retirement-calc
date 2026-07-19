import { AllocationPolicy, FamilyMember, type AccountBuckets } from '../types/calculator';
import { cloneBuckets } from './accountBuckets';

export interface RoomState {
  tfsaHe: number;
  tfsaShe: number;
  rrspHe: number;
  rrspShe: number;
}

/** Who should receive discretionary RRSP after TFSA — relative soft capacity + who earns more. */
export type PreferredRrspOwner = FamilyMember | null;

export function softCapacityRank(level: 'GREEN' | 'AMBER' | 'RED' | string): number {
  if (level === 'GREEN') return 2;
  if (level === 'AMBER') return 1;
  return 0;
}

/**
 * Prefer the spouse with better RRIF soft capacity; on a tie, the higher earner
 * (deduction is worth more today). null → skip RRSP, go Non-reg.
 */
export function preferDiscretionaryRrspOwner(params: {
  softHe: 'GREEN' | 'AMBER' | 'RED' | string;
  softShe: 'GREEN' | 'AMBER' | 'RED' | string;
  heSalary: number;
  sheSalary: number;
}): PreferredRrspOwner {
  const heR = softCapacityRank(params.softHe);
  const sheR = softCapacityRank(params.softShe);
  if (heR === 0 && sheR === 0) return null;
  if (heR > sheR) return FamilyMember.HE;
  if (sheR > heR) return FamilyMember.SHE;
  // Same capacity tier (both green or both amber): higher earner gets the deduction
  return params.heSalary >= params.sheSalary ? FamilyMember.HE : FamilyMember.SHE;
}

export interface ContributionDeployInput {
  /** After-tax / redeployable personal cash (ESPP sale proceeds, Extra). Excludes payroll RRSP. */
  personalInvestable: number;
  /** Pre-tax payroll employee RRSP — always goes to RRSP (room permitting), never TFSA. */
  payrollRrspHe?: number;
  payrollRrspShe?: number;
  /** Employer RRSP match cash (goes straight to RRSP, does not consume personal cash). */
  employerMatchHe: number;
  employerMatchShe: number;
  policy: AllocationPolicy;
  rooms: RoomState;
  buckets: AccountBuckets;
  /**
   * After TFSA: who gets discretionary RRSP first.
   * Default HE then SHE. Pass SHE for higher-earner She / She-preferred soft capacity.
   */
  preferRrsp?: FamilyMember;
}

/**
 * Deploy annual savings: match → payroll RRSP → discretionary by policy → non-reg.
 *
 * Discretionary personal cash (ESPP / Extra-style):
 *   He TFSA → She TFSA → preferred spouse RRSP → other spouse RRSP → Non-reg.
 * Preference follows soft capacity + who earns more (caller supplies preferRrsp).
 */
export function deployAnnualContributions(input: ContributionDeployInput): {
  buckets: AccountBuckets;
  rooms: RoomState;
  toTfsa: number;
  toRrsp: number;
  toNonReg: number;
  toTfsaHe: number;
  toTfsaShe: number;
  toRrspHeDiscretionary: number;
  toRrspSheDiscretionary: number;
} {
  const b = cloneBuckets(input.buckets);
  const rooms = { ...input.rooms };
  let cash = Math.max(0, input.personalInvestable);
  let toTfsa = 0;
  let toRrsp = 0;
  let toNonReg = 0;
  let toTfsaHe = 0;
  let toTfsaShe = 0;
  let toRrspHeDiscretionary = 0;
  let toRrspSheDiscretionary = 0;

  b.rrspHe += Math.max(0, input.employerMatchHe);
  b.rrspShe += Math.max(0, input.employerMatchShe);
  toRrsp += Math.max(0, input.employerMatchHe) + Math.max(0, input.employerMatchShe);

  const payHe = Math.min(Math.max(0, input.payrollRrspHe ?? 0), Math.max(0, rooms.rrspHe));
  b.rrspHe += payHe;
  rooms.rrspHe -= payHe;
  toRrsp += payHe;
  const payShe = Math.min(Math.max(0, input.payrollRrspShe ?? 0), Math.max(0, rooms.rrspShe));
  b.rrspShe += payShe;
  rooms.rrspShe -= payShe;
  toRrsp += payShe;
  const payOverflow =
    Math.max(0, (input.payrollRrspHe ?? 0) - payHe) + Math.max(0, (input.payrollRrspShe ?? 0) - payShe);
  if (payOverflow > 0) {
    b.nonReg += payOverflow;
    toNonReg += payOverflow;
  }

  const fillTfsa = () => {
    const he = Math.min(cash, Math.max(0, rooms.tfsaHe));
    b.tfsaHe += he;
    rooms.tfsaHe -= he;
    cash -= he;
    toTfsa += he;
    toTfsaHe += he;
    const she = Math.min(cash, Math.max(0, rooms.tfsaShe));
    b.tfsaShe += she;
    rooms.tfsaShe -= she;
    cash -= she;
    toTfsa += she;
    toTfsaShe += she;
  };

  const fillRrspOne = (who: FamilyMember) => {
    if (who === FamilyMember.HE) {
      const he = Math.min(cash, Math.max(0, rooms.rrspHe));
      b.rrspHe += he;
      rooms.rrspHe -= he;
      cash -= he;
      toRrsp += he;
      toRrspHeDiscretionary += he;
    } else {
      const she = Math.min(cash, Math.max(0, rooms.rrspShe));
      b.rrspShe += she;
      rooms.rrspShe -= she;
      cash -= she;
      toRrsp += she;
      toRrspSheDiscretionary += she;
    }
  };

  const fillRrspPreferred = () => {
    const first = input.preferRrsp ?? FamilyMember.HE;
    const second = first === FamilyMember.HE ? FamilyMember.SHE : FamilyMember.HE;
    fillRrspOne(first);
    fillRrspOne(second);
  };

  if (input.policy === AllocationPolicy.TFSA_FIRST) {
    fillTfsa();
    fillRrspPreferred();
  } else {
    fillRrspPreferred();
    fillTfsa();
  }

  if (cash > 0) {
    b.nonReg += cash;
    toNonReg += cash;
    cash = 0;
  }

  return {
    buckets: b,
    rooms,
    toTfsa,
    toRrsp,
    toNonReg,
    toTfsaHe,
    toTfsaShe,
    toRrspHeDiscretionary,
    toRrspSheDiscretionary,
  };
}

export function addAnnualRoom(rooms: RoomState, tfsaLimit: number, newRrspHe: number, newRrspShe: number): RoomState {
  return {
    tfsaHe: rooms.tfsaHe + tfsaLimit,
    tfsaShe: rooms.tfsaShe + tfsaLimit,
    rrspHe: rooms.rrspHe + Math.max(0, newRrspHe),
    rrspShe: rooms.rrspShe + Math.max(0, newRrspShe),
  };
}

export function resolveAnnualTfsaLimit(
  annualTfsaLimit: number | undefined,
  inflateWithCpi: boolean | undefined,
  inflationMultiplier: number = 1
): number {
  const base = annualTfsaLimit ?? 7000;
  return inflateWithCpi ? base * inflationMultiplier : base;
}
