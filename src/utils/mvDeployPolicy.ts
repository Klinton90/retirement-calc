/**
 * Phase 3B — discretionary Extra/ESPP deploy by precomputed MV destination order.
 * Each stream fills its own TFSA, then the spouse's TFSA, before MV residuals.
 */
import { FamilyMember, MvDestination, type AccountBuckets } from '../types/calculator';
import { cloneBuckets } from './accountBuckets';
import type { RoomState } from './contributionPolicy';
import type { DestinationSplit } from './excessMoneyGuide';
import { depositIntoDestination } from './mvDeposit';

function emptySplit(): DestinationSplit {
  return { toTfsa: 0, toTfsaHe: 0, toTfsaShe: 0, toSpousal: 0, toRrspOwn: 0, toNonReg: 0 };
}

function credit(split: DestinationSplit, d: MvDestination, amt: number) {
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

/** Walk MV order; room-limited destinations skip leftover to later slots; final residual → Non-reg. */
export function deployAmountByMvOrder(
  amount: number,
  order: MvDestination[],
  buckets: AccountBuckets,
  rooms: RoomState,
  into: DestinationSplit,
  spousalContributor: FamilyMember = FamilyMember.HE
): { buckets: AccountBuckets; rooms: RoomState } {
  let left = Math.max(0, amount);
  let b = buckets;
  let r = rooms;
  for (const d of order) {
    if (left <= 0) break;
    if (d === MvDestination.NON_REG) {
      const res = depositIntoDestination(b, r, d, left, spousalContributor);
      b = res.buckets;
      r = res.rooms;
      credit(into, d, res.taken);
      left -= res.taken;
      break;
    }
    const res = depositIntoDestination(b, r, d, left, spousalContributor);
    b = res.buckets;
    r = res.rooms;
    credit(into, d, res.taken);
    left -= res.taken;
  }
  if (left > 0) {
    const res = depositIntoDestination(b, r, MvDestination.NON_REG, left);
    b = res.buckets;
    r = res.rooms;
    credit(into, MvDestination.NON_REG, res.taken);
  }
  return { buckets: b, rooms: r };
}

export function deployDiscretionaryByMvOrder(params: {
  heExtraAnnual: number;
  sheExtraAnnual: number;
  heEsppSaleAnnual: number;
  sheEsppSaleAnnual: number;
  heRefundRedepositAnnual: number;
  sheRefundRedepositAnnual: number;
  rooms: RoomState;
  buckets: AccountBuckets;
  heOrder: MvDestination[];
  sheOrder: MvDestination[];
  spousalContributor: FamilyMember;
}): {
  buckets: AccountBuckets;
  rooms: RoomState;
  heSplit: DestinationSplit;
  sheSplit: DestinationSplit;
  toTfsa: number;
  toRrsp: number;
  toNonReg: number;
  toSpousal: number;
} {
  let buckets = cloneBuckets(params.buckets);
  let rooms = { ...params.rooms };
  const heSplit = emptySplit();
  const sheSplit = emptySplit();

  // Stable role-based room race: secondary stream, then primary stream.
  // Swapping household roles therefore mirrors destinations.
  const shePool =
    Math.max(0, params.sheExtraAnnual) +
    Math.max(0, params.sheEsppSaleAnnual) +
    Math.max(0, params.sheRefundRedepositAnnual);
  const hePool =
    Math.max(0, params.heExtraAnnual) +
    Math.max(0, params.heEsppSaleAnnual) +
    Math.max(0, params.heRefundRedepositAnnual);
  const deployStream = (who: FamilyMember) => {
    const result = deployAmountByMvOrder(
      who === FamilyMember.HE ? hePool : shePool,
      who === FamilyMember.HE ? params.heOrder : params.sheOrder,
      buckets,
      rooms,
      who === FamilyMember.HE ? heSplit : sheSplit,
      params.spousalContributor
    );
    buckets = result.buckets;
    rooms = result.rooms;
  };
  const secondary =
    params.spousalContributor === FamilyMember.HE
      ? FamilyMember.SHE
      : FamilyMember.HE;
  deployStream(secondary);
  deployStream(params.spousalContributor);

  const toTfsa = heSplit.toTfsa + sheSplit.toTfsa;
  const toRrsp = heSplit.toRrspOwn + sheSplit.toRrspOwn + sheSplit.toSpousal + heSplit.toSpousal;
  const toNonReg = heSplit.toNonReg + sheSplit.toNonReg;
  const toSpousal = sheSplit.toSpousal + heSplit.toSpousal;

  return { buckets, rooms, heSplit, sheSplit, toTfsa, toRrsp, toNonReg, toSpousal };
}

/** Fallback order when ranking is empty — ownership TFSA then Non-reg (skip RRSP). */
export function fallbackMvOrder(
  stream: FamilyMember,
  allowSpousal: boolean
): MvDestination[] {
  if (stream === FamilyMember.SHE) {
    return [
      MvDestination.TFSA_SHE,
      MvDestination.TFSA_HE,
      MvDestination.RRSP_SHE,
      ...(allowSpousal ? [MvDestination.SPOUSAL] : []),
      MvDestination.NON_REG,
    ];
  }
  return [
    MvDestination.TFSA_HE,
    MvDestination.TFSA_SHE,
    MvDestination.RRSP_HE,
    ...(allowSpousal ? [MvDestination.SPOUSAL] : []),
    MvDestination.NON_REG,
  ];
}

/**
 * Ownership: TFSA fills first (locked), then MV rank for residual destinations.
 * Prevents MV from skipping open TFSA room.
 */
export function withOwnershipTfsaFirst(
  stream: FamilyMember,
  mvOrder: MvDestination[]
): MvDestination[] {
  const rest = mvOrder.filter(
    (d) =>
      d !== MvDestination.TFSA_HE &&
      d !== MvDestination.TFSA_SHE
  );
  if (stream === FamilyMember.SHE) {
    return [MvDestination.TFSA_SHE, MvDestination.TFSA_HE, ...rest];
  }
  return [MvDestination.TFSA_HE, MvDestination.TFSA_SHE, ...rest];
}
