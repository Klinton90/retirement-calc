/**
 * Resolve TFSA-first + MV residual destination orders once per plan/year.
 * Cached so calculatePlanTargets binary-search does not re-rank every trial.
 */
import { FamilyMember, type MvDestination, type PersonInput, type RetirementPlan } from '../types/calculator';
import { getMvRankForStream } from './mvRankBridge';
import { fallbackMvOrder, withOwnershipTfsaFirst } from './mvDeployPolicy';
import { DEFAULT_LIFE_EXPECTANCY_DELTA } from './retirementHorizon';
import { resolveEarnerRoles } from './earnerRoles';

export interface MvDeployOrders {
  heOrder: MvDestination[];
  sheOrder: MvDestination[];
}

type CacheEntry = { key: string; orders: MvDeployOrders };

let cache: CacheEntry | null = null;

function extraMonthly(p: PersonInput): number {
  if (p.extraContributionMonthly !== undefined && p.extraContributionMonthly !== null) {
    return Math.max(0, p.extraContributionMonthly);
  }
  return Math.max(0, (p.otherSavingsTfsaMonthly || 0) + (p.otherSavingsRrspMonthly || 0));
}

/** Fingerprint fields that change MV ranking / Extra routing. */
export function mvPlanCacheKey(plan: RetirementPlan, currentYear: number): string {
  const he = plan.heInput;
  const she = plan.sheInput;
  const b = plan.accountBuckets;
  return [
    currentYear,
    plan.investmentReturnRate,
    plan.inflationRate,
    plan.salaryGrowthRate ?? 0.01,
    plan.desiredRetirementSpendMonthly,
    plan.mandatoryRetirementSpendMonthly,
    plan.lifeExpectancyDelta ?? DEFAULT_LIFE_EXPECTANCY_DELTA,
    plan.optimizeSpousalRrsp ? 1 : 0,
    plan.depositEsppToRrsp ? 1 : 0,
    he.age,
    he.retirementAge,
    he.salary,
    extraMonthly(he),
    he.carryForwardTfsaRoom ?? 0,
    he.carryForwardRrspRoom ?? 0,
    he.esppEmployeeRate ?? 0,
    he.esppEmployerRate ?? 0,
    he.rrspEmployeeType,
    he.rrspEmployerRate ?? 0,
    he.rrspEmployeeValue ?? 0,
    she.age,
    she.retirementAge,
    she.salary,
    extraMonthly(she),
    she.carryForwardTfsaRoom ?? 0,
    she.carryForwardRrspRoom ?? 0,
    she.esppEmployeeRate ?? 0,
    she.esppEmployerRate ?? 0,
    she.rrspEmployeeType,
    she.rrspEmployerRate ?? 0,
    she.rrspEmployeeValue ?? 0,
    plan.survivorToggle ? 1 : 0,
    plan.survivorWho ?? 'PRIMARY',
    plan.survivorYearIndex ?? '',
    plan.survivorSpendFactor ?? 0.7,
    b?.tfsaHe ?? 0,
    b?.tfsaShe ?? 0,
    b?.rrspHe ?? 0,
    b?.rrspShe ?? 0,
    b?.nonReg ?? 0,
  ].join('|');
}

export function resolveMvDeployOrders(
  plan: RetirementPlan,
  currentYear: number
): MvDeployOrders {
  const key = mvPlanCacheKey(plan, currentYear);
  if (cache && cache.key === key) return cache.orders;

  const rank = getMvRankForStream();
  const roles = resolveEarnerRoles(plan);
  const heNeedsRank =
    extraMonthly(plan.heInput) > 0 ||
    (!plan.depositEsppToRrsp &&
      (plan.heInput.esppEmployeeRate || 0) + (plan.heInput.esppEmployerRate || 0) > 0);
  const sheNeedsRank =
    extraMonthly(plan.sheInput) > 0 ||
    (!plan.depositEsppToRrsp &&
      (plan.sheInput.esppEmployeeRate || 0) +
        (plan.sheInput.esppEmployerRate || 0) >
        0);

  const heRank = heNeedsRank
    ? rank(plan, FamilyMember.HE, { currentYear })
    : { ranking: [] as { destination: MvDestination }[] };
  const sheRank = sheNeedsRank
    ? rank(plan, FamilyMember.SHE, { currentYear })
    : { ranking: [] as { destination: MvDestination }[] };

  const orders: MvDeployOrders = {
    heOrder:
      heRank.ranking.length > 0
        ? withOwnershipTfsaFirst(
            FamilyMember.HE,
            heRank.ranking.map((s) => s.destination)
          )
        : fallbackMvOrder(
            FamilyMember.HE,
            !!plan.optimizeSpousalRrsp &&
              roles.secondary === FamilyMember.HE
          ),
    sheOrder:
      sheRank.ranking.length > 0
        ? withOwnershipTfsaFirst(
            FamilyMember.SHE,
            sheRank.ranking.map((s) => s.destination)
          )
        : fallbackMvOrder(
            FamilyMember.SHE,
            !!plan.optimizeSpousalRrsp &&
              roles.secondary === FamilyMember.SHE
          ),
  };
  cache = { key, orders };
  return orders;
}

export function clearMvDeployOrdersCache(): void {
  cache = null;
}
