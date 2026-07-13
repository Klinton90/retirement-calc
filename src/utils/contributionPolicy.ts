import { AllocationPolicy, type AccountBuckets } from '../types/calculator';
import { cloneBuckets } from './accountBuckets';

export interface RoomState {
  tfsaHe: number;
  tfsaShe: number;
  rrspHe: number;
  rrspShe: number;
}

export interface ContributionDeployInput {
  /** After-tax / redeployable personal cash (ESPP sale proceeds, extra savings). Excludes payroll RRSP. */
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
}

/**
 * Deploy annual savings: match → payroll RRSP → (TFSA vs discretionary RRSP by policy) → non-reg.
 */
export function deployAnnualContributions(input: ContributionDeployInput): {
  buckets: AccountBuckets;
  rooms: RoomState;
  toTfsa: number;
  toRrsp: number;
  toNonReg: number;
} {
  const b = cloneBuckets(input.buckets);
  const rooms = { ...input.rooms };
  let cash = Math.max(0, input.personalInvestable);
  let toTfsa = 0;
  let toRrsp = 0;
  let toNonReg = 0;

  // 1. Employer match → RRSP
  b.rrspHe += Math.max(0, input.employerMatchHe);
  b.rrspShe += Math.max(0, input.employerMatchShe);
  toRrsp += Math.max(0, input.employerMatchHe) + Math.max(0, input.employerMatchShe);

  // 2. Payroll employee RRSP always to RRSP (room-gated)
  const payHe = Math.min(Math.max(0, input.payrollRrspHe ?? 0), Math.max(0, rooms.rrspHe));
  b.rrspHe += payHe;
  rooms.rrspHe -= payHe;
  toRrsp += payHe;
  const payShe = Math.min(Math.max(0, input.payrollRrspShe ?? 0), Math.max(0, rooms.rrspShe));
  b.rrspShe += payShe;
  rooms.rrspShe -= payShe;
  toRrsp += payShe;
  // Overflow payroll without room → non-reg (taxable account; rare)
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
    const she = Math.min(cash, Math.max(0, rooms.tfsaShe));
    b.tfsaShe += she;
    rooms.tfsaShe -= she;
    cash -= she;
    toTfsa += she;
  };

  const fillRrsp = () => {
    const he = Math.min(cash, Math.max(0, rooms.rrspHe));
    b.rrspHe += he;
    rooms.rrspHe -= he;
    cash -= he;
    toRrsp += he;
    const she = Math.min(cash, Math.max(0, rooms.rrspShe));
    b.rrspShe += she;
    rooms.rrspShe -= she;
    cash -= she;
    toRrsp += she;
  };

  if (input.policy === AllocationPolicy.TFSA_FIRST) {
    fillTfsa();
    fillRrsp();
  } else {
    fillRrsp();
    fillTfsa();
  }

  if (cash > 0) {
    b.nonReg += cash;
    toNonReg += cash;
    cash = 0;
  }

  return { buckets: b, rooms, toTfsa, toRrsp, toNonReg };
}

/** Annual new TFSA room per person (not inflation-stepped in v1 unless caller inflates). */
export function addAnnualRoom(rooms: RoomState, tfsaLimit: number, newRrspHe: number, newRrspShe: number): RoomState {
  return {
    tfsaHe: rooms.tfsaHe + tfsaLimit,
    tfsaShe: rooms.tfsaShe + tfsaLimit,
    rrspHe: rooms.rrspHe + Math.max(0, newRrspHe),
    rrspShe: rooms.rrspShe + Math.max(0, newRrspShe),
  };
}

/**
 * Resolve this year's new TFSA contribution limit.
 * Default: flat nominal (historically CRA does not CPI-index TFSA room).
 * Optional: inflate with the plan inflation multiplier for sensitivity runs.
 */
export function resolveAnnualTfsaLimit(
  annualTfsaLimit: number | undefined,
  inflateWithCpi: boolean | undefined,
  inflationMultiplier: number = 1
): number {
  const base = annualTfsaLimit ?? 7000;
  return inflateWithCpi ? base * inflationMultiplier : base;
}
