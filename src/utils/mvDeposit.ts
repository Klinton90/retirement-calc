/**
 * Forced destination deposit for Excess MV probes and MV-ordered deploy.
 */
import { FamilyMember, MvDestination, type AccountBuckets } from '../types/calculator';
import { cloneBuckets } from './accountBuckets';
import type { RoomState } from './contributionPolicy';

/** Deposit up to room; does **not** spill remainder to Non-reg. */
export function depositIntoDestination(
  buckets: AccountBuckets,
  rooms: RoomState,
  destination: MvDestination,
  amount: number,
  spousalContributor: FamilyMember = FamilyMember.HE
): { buckets: AccountBuckets; rooms: RoomState; taken: number } {
  let left = Math.max(0, amount);
  const b = cloneBuckets(buckets);
  const r = { ...rooms };
  let taken = 0;

  const take = (cap: number): number => {
    const n = Math.min(left, Math.max(0, cap));
    left -= n;
    taken += n;
    return n;
  };

  switch (destination) {
    case MvDestination.TFSA_HE: {
      const n = take(r.tfsaHe);
      b.tfsaHe += n;
      r.tfsaHe -= n;
      break;
    }
    case MvDestination.TFSA_SHE: {
      const n = take(r.tfsaShe);
      b.tfsaShe += n;
      r.tfsaShe -= n;
      break;
    }
    case MvDestination.RRSP_HE: {
      const n = take(r.rrspHe);
      b.rrspHe += n;
      r.rrspHe -= n;
      break;
    }
    case MvDestination.RRSP_SHE: {
      const n = take(r.rrspShe);
      b.rrspShe += n;
      r.rrspShe -= n;
      break;
    }
    case MvDestination.SPOUSAL: {
      const contributorRoom =
        spousalContributor === FamilyMember.HE ? r.rrspHe : r.rrspShe;
      const n = take(contributorRoom);
      if (spousalContributor === FamilyMember.HE) {
        b.rrspShe += n;
        r.rrspHe -= n;
      } else {
        b.rrspHe += n;
        r.rrspShe -= n;
      }
      break;
    }
    case MvDestination.NON_REG: {
      const n = take(left);
      b.nonReg += n;
      break;
    }
  }

  return { buckets: b, rooms: r, taken };
}

/** Deposit with leftover spilled to Non-reg (MV probe path). */
export function depositForcedDestination(
  buckets: AccountBuckets,
  rooms: RoomState,
  destination: MvDestination,
  amount: number,
  spousalContributor: FamilyMember = FamilyMember.HE
): { buckets: AccountBuckets; rooms: RoomState; deposited: number; spilledToNonReg: number } {
  const first = depositIntoDestination(
    buckets,
    rooms,
    destination,
    amount,
    spousalContributor
  );
  const want = Math.max(0, amount);
  const leftover = want - first.taken;
  if (leftover <= 0 || destination === MvDestination.NON_REG) {
    return {
      buckets: first.buckets,
      rooms: first.rooms,
      deposited: first.taken,
      spilledToNonReg: destination === MvDestination.NON_REG ? first.taken : 0,
    };
  }
  const spill = depositIntoDestination(first.buckets, first.rooms, MvDestination.NON_REG, leftover);
  return {
    buckets: spill.buckets,
    rooms: spill.rooms,
    deposited: first.taken + spill.taken,
    spilledToNonReg: spill.taken,
  };
}
