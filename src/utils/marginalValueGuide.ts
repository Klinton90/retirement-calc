/**
 * Excess marginal-value (MV) ranking — ADR 0003 / excess-mv-ranking.
 *
 * Scores where to send a probe Extra dollar by after-tax retirement payoff,
 * not soft-capacity cascade order. Soft capacity remains diagnostic in Excess UI.
 */

import {
  AllocationPolicy,
  FamilyMember,
  MvDestination,
  type RetirementPlan,
} from '../types/calculator';
import { totalInvestable } from './accountBuckets';
import type { RoomState } from './contributionPolicy';
import { resolveExtraContributionMonthly, type DestinationSplit } from './excessMoneyGuide';
import { depositForcedDestination } from './mvDeposit';
import { withOwnershipTfsaFirst } from './mvDeployPolicy';
import { resolveEarnerRoles } from './earnerRoles';
import {
  accumulateToRetirement,
  simulateDecumulation,
} from './targetEngine';
import { registerMvRankForStream } from './mvRankBridge';

export { MvDestination, depositForcedDestination };

const PROBE_FLOOR_ANNUAL = 1000;
const SCORE_EPS = 1e-6;

export function mvProbeAnnual(extraMonthly: number): number {
  return Math.max(PROBE_FLOOR_ANNUAL, Math.max(0, extraMonthly) * 12);
}

/**
 * The MV ranking exists to order the **RRSP tier** (own RRSP vs Spousal vs Non-reg).
 * Ownership TFSA is always filled first (see `withOwnershipTfsaFirst`), so only the pool
 * left *after* TFSA ever reaches that tier. Probing with the full pool oversaturates RRSP
 * well past green RRIF headroom, where the RRSP destinations flatten and a room-limited one
 * (e.g. Spousal, which consumes the primary's room) can wrongly lose to the stream's own
 * RRSP. Probe the post-TFSA residual so scores reflect the marginal dollar that actually
 * reaches each destination. See ADR 0003.
 */
export function rrspTierProbeAnnual(
  poolAnnual: number,
  tfsaRoomAvailable: number
): number {
  return Math.max(PROBE_FLOOR_ANNUAL, poolAnnual - Math.max(0, tfsaRoomAvailable));
}

export function withMvProbe(
  plan: RetirementPlan,
  stream: FamilyMember,
  destination: MvDestination,
  annualToday: number
): RetirementPlan {
  return {
    ...plan,
    mvProbe: { stream, destination, annualToday: Math.max(0, annualToday) },
  };
}

export function roomForDestination(
  rooms: RoomState,
  destination: MvDestination,
  spousalContributor: FamilyMember = FamilyMember.HE
): number {
  switch (destination) {
    case MvDestination.TFSA_HE:
      return Math.max(0, rooms.tfsaHe);
    case MvDestination.TFSA_SHE:
      return Math.max(0, rooms.tfsaShe);
    case MvDestination.RRSP_HE:
      return Math.max(0, rooms.rrspHe);
    case MvDestination.RRSP_SHE:
      return Math.max(0, rooms.rrspShe);
    case MvDestination.SPOUSAL:
      return Math.max(
        0,
        spousalContributor === FamilyMember.HE
          ? rooms.rrspHe
          : rooms.rrspShe
      );
    case MvDestination.NON_REG:
      return Number.POSITIVE_INFINITY;
  }
}

/** Symmetric legal destinations: both TFSAs, own RRSP, optional role-based spousal RRSP. */
export function feasibleDestinationsForStream(
  stream: FamilyMember,
  rooms: RoomState,
  allowSpousal: boolean,
  spousalContributor: FamilyMember = FamilyMember.HE
): MvDestination[] {
  const all =
    stream === FamilyMember.SHE
      ? [
          MvDestination.TFSA_SHE,
          MvDestination.TFSA_HE,
          MvDestination.RRSP_SHE,
          ...(allowSpousal ? [MvDestination.SPOUSAL] : []),
          MvDestination.NON_REG,
        ]
      : [
          MvDestination.TFSA_HE,
          MvDestination.TFSA_SHE,
          MvDestination.RRSP_HE,
          ...(allowSpousal ? [MvDestination.SPOUSAL] : []),
          MvDestination.NON_REG,
        ];
  return all.filter(
    (d) =>
      roomForDestination(rooms, d, spousalContributor) > 0 ||
      d === MvDestination.NON_REG
  );
}

export interface MvObjectiveSnapshot {
  isFunded: boolean;
  monthlyPersonalSavingsNeeded: number;
  shortfallFromCurrentPath: number;
  /**
   * Funded primary proxy: terminal wealth at target spend @71 convert (higher = more
   * spend headroom). Full surplus binary-search is too expensive for MV ranking.
   */
  surplusExtraMonthly: number;
  /** Tax + 2× OAS clawback on conversion@71 path (tie-break; lower better). */
  taxDrag: number;
  terminalWealth: number;
}

/**
 * Lightweight objective for MV probes — funding binary search @71 convert when short;
 * funded uses terminal wealth + tax drag (no nested surplus search).
 */
export function mvObjectiveSnapshot(
  plan: RetirementPlan,
  currentYear: number = new Date().getFullYear()
): MvObjectiveSnapshot {
  const policy = AllocationPolicy.TFSA_FIRST;

  const fundedAt = (monthly: number) => {
    // Cascade-only while scoring MV — avoids recurse into rank→accumulate(MV).
    const b = accumulateToRetirement(plan, monthly, currentYear, policy, { useMvDeploy: false });
    const dec = simulateDecumulation(plan, b, currentYear, 71, 71, false);
    return { buckets: b, dec, ok: dec.yearsFunded >= dec.horizonYears };
  };

  const base = fundedAt(0);
  let monthly = 0;
  let solvedBuckets = base.buckets;
  let solvedDec = base.dec;

  if (!base.ok) {
    let low = 0;
    let high = 50000;
    for (let i = 0; i < 28; i++) {
      const mid = (low + high) / 2;
      const trial = fundedAt(mid);
      if (trial.ok) {
        high = mid;
        solvedBuckets = trial.buckets;
        solvedDec = trial.dec;
      } else {
        low = mid;
      }
    }
    monthly = (low + high) / 2;
    const final = fundedAt(monthly);
    solvedBuckets = final.buckets;
    solvedDec = final.dec;
  }

  const shortfall = Math.max(0, totalInvestable(solvedBuckets) - totalInvestable(base.buckets));
  const taxDrag = solvedDec.totalTaxPaid + solvedDec.totalOasClawback * 2;

  // After-tax terminal wealth. RRSP face still owes deferred withdrawal tax, so haircut the
  // terminal RRSP by the scenario's effective retirement rate (tax + clawback per $ of RRIF
  // withdrawn). Paired with the contribution-refund credit in accumulateToRetirement, this
  // yields the classic rule "RRSP wins iff refund rate > withdrawal rate": green RRIF headroom
  // (low withdrawal rate) favors RRSP, red/overfunded (clawback) favors non-reg. Counting RRSP
  // at pre-tax face (the old proxy) let non-reg beat RRSP even with green headroom.
  const curve = solvedDec.curve;
  const totalRrif = curve.reduce((s, y) => s + y.rrifHe + y.rrifShe, 0);
  const last = curve.length ? curve[curve.length - 1] : undefined;
  const terminalRrsp = last ? last.rrspEnd : 0;
  const terminalNonRrsp = Math.max(0, solvedDec.terminalWealth - terminalRrsp);
  const rrspWithdrawalRate =
    totalRrif > 0
      ? Math.min(
          0.6,
          Math.max(0, (solvedDec.totalTaxPaid + solvedDec.totalOasClawback) / totalRrif)
        )
      : 0.3;
  const afterTaxTerminal = terminalNonRrsp + terminalRrsp * (1 - rrspWithdrawalRate);

  // Funded proxy for surplus capacity: after-tax terminal wealth at fixed target spend.
  const surplusExtraMonthly = base.ok ? afterTaxTerminal / 12 : 0;

  return {
    isFunded: base.ok,
    monthlyPersonalSavingsNeeded: monthly,
    shortfallFromCurrentPath: shortfall,
    surplusExtraMonthly,
    taxDrag,
    terminalWealth: afterTaxTerminal,
  };
}

export interface MvDestinationScore {
  destination: MvDestination;
  /** Higher is better (regime-normalized). */
  primaryDelta: number;
  tieBreakDelta: number;
  /** Lexicographic: primary then tie-break. */
  rankKey: number;
  snapshot: MvObjectiveSnapshot;
}

function compareScores(a: MvDestinationScore, b: MvDestinationScore): number {
  if (Math.abs(a.primaryDelta - b.primaryDelta) > SCORE_EPS) {
    return b.primaryDelta - a.primaryDelta;
  }
  if (Math.abs(a.tieBreakDelta - b.tieBreakDelta) > SCORE_EPS) {
    return b.tieBreakDelta - a.tieBreakDelta;
  }
  return a.destination.localeCompare(b.destination);
}

export interface MvRankingResult {
  stream: FamilyMember;
  probeAnnual: number;
  isFunded: boolean;
  baseline: MvObjectiveSnapshot;
  ranking: MvDestinationScore[];
  top: MvDestination;
  /** Suggested this-year fill: put probe into top then cascade leftovers by rank order through rooms. */
  suggestedSplit: DestinationSplit;
}

function emptySplit(): DestinationSplit {
  return { toTfsa: 0, toTfsaHe: 0, toTfsaShe: 0, toSpousal: 0, toRrspOwn: 0, toNonReg: 0 };
}

function creditSplit(split: DestinationSplit, d: MvDestination, amt: number) {
  if (amt <= 0) return;
  switch (d) {
    case MvDestination.TFSA_HE:
      split.toTfsaHe += amt;
      split.toTfsa += amt;
      break;
    case MvDestination.TFSA_SHE:
      split.toTfsaShe += amt;
      split.toTfsa += amt;
      break;
    case MvDestination.RRSP_HE:
      split.toRrspOwn += amt;
      break;
    case MvDestination.RRSP_SHE:
      split.toRrspOwn += amt;
      break;
    case MvDestination.SPOUSAL:
      split.toSpousal += amt;
      break;
    case MvDestination.NON_REG:
      split.toNonReg += amt;
      break;
  }
}

/**
 * Fill `amount` across destinations in MV rank order using this-year rooms.
 */
export function fillSplitByMvOrder(
  amount: number,
  order: MvDestination[],
  rooms: RoomState,
  spousalContributor: FamilyMember = FamilyMember.HE
): DestinationSplit {
  const split = emptySplit();
  const r = { ...rooms };
  let left = Math.max(0, amount);
  for (const d of order) {
    if (left <= 0) break;
    if (d === MvDestination.NON_REG) {
      creditSplit(split, d, left);
      left = 0;
      break;
    }
    const cap = roomForDestination(r, d, spousalContributor);
    const take = Math.min(left, cap);
    if (take <= 0) continue;
    creditSplit(split, d, take);
    left -= take;
    // consume room for subsequent destinations that share capacity
    if (d === MvDestination.TFSA_HE) r.tfsaHe -= take;
    else if (d === MvDestination.TFSA_SHE) r.tfsaShe -= take;
    else if (d === MvDestination.RRSP_HE) r.rrspHe -= take;
    else if (d === MvDestination.RRSP_SHE) r.rrspShe -= take;
    else if (d === MvDestination.SPOUSAL) {
      if (spousalContributor === FamilyMember.HE) r.rrspHe -= take;
      else r.rrspShe -= take;
    }
  }
  if (left > 0) creditSplit(split, MvDestination.NON_REG, left);
  return split;
}

export function roomsFromPlanOpening(plan: RetirementPlan): RoomState {
  const he = plan.heInput;
  const she = plan.sheInput;
  const MAX_RRSP = 33720;
  return {
    tfsaHe: he.carryForwardTfsaRoom ?? 0,
    tfsaShe: she.carryForwardTfsaRoom ?? 0,
    rrspHe: (he.carryForwardRrspRoom ?? 0) + Math.min(MAX_RRSP, he.salary * 0.18),
    rrspShe: (she.carryForwardRrspRoom ?? 0) + Math.min(MAX_RRSP, she.salary * 0.18),
  };
}

/**
 * Rank destinations for one Extra stream by MV of a recurring annual probe.
 */
export function rankMvForStream(
  plan: RetirementPlan,
  stream: FamilyMember,
  opts?: { currentYear?: number; probeAnnual?: number }
): MvRankingResult {
  const currentYear = opts?.currentYear ?? new Date().getFullYear();
  const extraMo =
    stream === FamilyMember.HE
      ? resolveExtraContributionMonthly(plan.heInput)
      : resolveExtraContributionMonthly(plan.sheInput);
  const rooms = roomsFromPlanOpening(plan);
  const roles = resolveEarnerRoles(plan);
  // Symmetric TFSA spill: a stream fills its own TFSA then the spouse's before any RRSP tier.
  const tfsaRoomAvailable =
    Math.max(0, rooms.tfsaHe) + Math.max(0, rooms.tfsaShe);
  const probeAnnual =
    opts?.probeAnnual ??
    rrspTierProbeAnnual(Math.max(0, extraMo) * 12, tfsaRoomAvailable);
  const allowSpousal =
    !!plan.optimizeSpousalRrsp && stream === roles.secondary;
  const destinations = feasibleDestinationsForStream(
    stream,
    rooms,
    allowSpousal,
    roles.primary
  );

  const baseline = mvObjectiveSnapshot(plan, currentYear);
  const funded = baseline.isFunded;

  const ranking: MvDestinationScore[] = [];
  for (const destination of destinations) {
    const probed = withMvProbe(plan, stream, destination, probeAnnual);
    const snapshot = mvObjectiveSnapshot(probed, currentYear);
    let primaryDelta: number;
    let tieBreakDelta: number;
    if (funded) {
      primaryDelta = snapshot.surplusExtraMonthly - baseline.surplusExtraMonthly;
      tieBreakDelta = baseline.taxDrag - snapshot.taxDrag; // lower tax drag → higher
    } else {
      primaryDelta =
        baseline.monthlyPersonalSavingsNeeded - snapshot.monthlyPersonalSavingsNeeded;
      tieBreakDelta =
        baseline.shortfallFromCurrentPath - snapshot.shortfallFromCurrentPath;
    }
    ranking.push({
      destination,
      primaryDelta,
      tieBreakDelta,
      rankKey: primaryDelta * 1e6 + tieBreakDelta,
      snapshot,
    });
  }

  ranking.sort(compareScores);
  const top = ranking[0]?.destination ?? MvDestination.NON_REG;
  // Suggest routing Extra annual; if Extra=0, still show probe-sized suggestion on ranked order.
  // Ownership TFSA fills first; MV order applies to residual destinations.
  const suggestAmount = extraMo > 0 ? extraMo * 12 : probeAnnual;
  const order = withOwnershipTfsaFirst(
    stream,
    ranking.map((s) => s.destination)
  );
  const suggestedSplit = fillSplitByMvOrder(
    suggestAmount,
    order,
    rooms,
    roles.primary
  );

  return {
    stream,
    probeAnnual,
    isFunded: funded,
    baseline,
    ranking,
    top,
    suggestedSplit,
  };
}

export function emptyMvRanking(stream: FamilyMember): MvRankingResult {
  const baseline: MvObjectiveSnapshot = {
    isFunded: true,
    monthlyPersonalSavingsNeeded: 0,
    shortfallFromCurrentPath: 0,
    surplusExtraMonthly: 0,
    taxDrag: 0,
    terminalWealth: 0,
  };
  return {
    stream,
    probeAnnual: 0,
    isFunded: true,
    baseline,
    ranking: [],
    top: MvDestination.NON_REG,
    suggestedSplit: {
      toTfsa: 0,
      toTfsaHe: 0,
      toTfsaShe: 0,
      toSpousal: 0,
      toRrspOwn: 0,
      toNonReg: 0,
    },
  };
}

export function topDestinationLabel(d: MvDestination): string {
  switch (d) {
    case MvDestination.TFSA_HE:
      return 'He TFSA';
    case MvDestination.TFSA_SHE:
      return 'She TFSA';
    case MvDestination.RRSP_HE:
      return 'He RRSP';
    case MvDestination.RRSP_SHE:
      return 'She RRSP';
    case MvDestination.SPOUSAL:
      return 'Spousal RRSP';
    case MvDestination.NON_REG:
      return 'Non-reg';
  }
}

/** Map cascade DestinationSplit dollars to a single top bucket (largest share). */
export function topDestinationFromSplit(
  split: DestinationSplit,
  stream: FamilyMember
): MvDestination | null {
  const candidates: { d: MvDestination; v: number }[] = [
    { d: MvDestination.TFSA_HE, v: split.toTfsaHe },
    { d: MvDestination.TFSA_SHE, v: split.toTfsaShe },
    {
      d: stream === FamilyMember.SHE ? MvDestination.RRSP_SHE : MvDestination.RRSP_HE,
      v: split.toRrspOwn,
    },
    { d: MvDestination.SPOUSAL, v: split.toSpousal },
    { d: MvDestination.NON_REG, v: split.toNonReg },
  ];
  let best: { d: MvDestination; v: number } | null = null;
  for (const c of candidates) {
    if (c.v <= 0) continue;
    if (!best || c.v > best.v) best = c;
  }
  return best?.d ?? null;
}

registerMvRankForStream(rankMvForStream);
