/**
 * Breaks import cycle: targetEngine (MV deploy) ↔ marginalValueGuide (scoring via accumulate).
 * marginalValueGuide registers rankMvForStream at module load.
 */
import type { FamilyMember, RetirementPlan } from '../types/calculator';
import type { MvDestination } from '../types/calculator';

export interface MvRankLite {
  ranking: { destination: MvDestination }[];
}

type RankFn = (
  plan: RetirementPlan,
  stream: FamilyMember,
  opts?: { currentYear?: number; probeAnnual?: number }
) => MvRankLite;

let rankFn: RankFn | null = null;

export function registerMvRankForStream(fn: RankFn): void {
  rankFn = fn;
}

export function getMvRankForStream(): RankFn {
  if (!rankFn) {
    throw new Error(
      'MV rank not registered — import marginalValueGuide before accumulateToRetirement(useMvDeploy)'
    );
  }
  return rankFn;
}
