import {
  FamilyMember,
  SurvivorWho,
  type RetirementPlan,
} from '../types/calculator';

export interface EarnerRoles {
  primary: FamilyMember;
  secondary: FamilyMember;
}

/** Resolve stable household roles from base gross salary. Exact ties use He. */
export function resolveEarnerRoles(
  plan: Pick<RetirementPlan, 'heInput' | 'sheInput'>
): EarnerRoles {
  const primary =
    plan.sheInput.salary > plan.heInput.salary
      ? FamilyMember.SHE
      : FamilyMember.HE;
  return {
    primary,
    secondary:
      primary === FamilyMember.HE ? FamilyMember.SHE : FamilyMember.HE,
  };
}

export function resolveSurvivorDeceased(
  plan: Pick<RetirementPlan, 'heInput' | 'sheInput' | 'survivorWho'>
): FamilyMember {
  if (plan.survivorWho === SurvivorWho.HE) return FamilyMember.HE;
  if (plan.survivorWho === SurvivorWho.SHE) return FamilyMember.SHE;
  return resolveEarnerRoles(plan).primary;
}

export function otherMember(member: FamilyMember): FamilyMember {
  return member === FamilyMember.HE ? FamilyMember.SHE : FamilyMember.HE;
}
