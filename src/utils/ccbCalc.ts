import type { ChildInput, CcbConfig } from '../types/calculator';
import { DEFAULT_CCB_CONFIG } from './taxRates';

// Calculate Canada Child Benefit (CCB)
export function calculateCcb(
  children: ChildInput[],
  adjustedFamilyNetIncome: number,
  ccbConfig: CcbConfig = DEFAULT_CCB_CONFIG
): number {
  const activeChildren = children.filter(child => child.age >= 0);
  if (activeChildren.length === 0) {
    return 0;
  }

  // 1. Calculate Maximum Benefit
  let maxBenefit = 0;
  for (const child of activeChildren) {
    if (child.age < 6) {
      maxBenefit += ccbConfig.maxUnder6;
    } else if (child.age < 18) {
      maxBenefit += ccbConfig.max6To17;
    }
  }

  // 2. Calculate Clawback
  const numChildren = activeChildren.length;
  let reductionRateTier1 = 0;
  let reductionRateTier2 = 0;

  if (numChildren === 1) {
    reductionRateTier1 = ccbConfig.reduction1ChildTier1;
    reductionRateTier2 = ccbConfig.reduction1ChildTier2;
  } else if (numChildren === 2) {
    reductionRateTier1 = ccbConfig.reduction2ChildrenTier1;
    reductionRateTier2 = ccbConfig.reduction2ChildrenTier2;
  } else if (numChildren === 3) {
    reductionRateTier1 = ccbConfig.reduction3ChildrenTier1;
    reductionRateTier2 = ccbConfig.reduction3ChildrenTier2;
  } else {
    reductionRateTier1 = ccbConfig.reduction4PlusChildrenTier1;
    reductionRateTier2 = ccbConfig.reduction4PlusChildrenTier2;
  }

  let reduction = 0;
  const afni = adjustedFamilyNetIncome;

  if (afni > ccbConfig.threshold2) {
    const tier1Reduction = (ccbConfig.threshold2 - ccbConfig.threshold1) * reductionRateTier1;
    const tier2Reduction = (afni - ccbConfig.threshold2) * reductionRateTier2;
    reduction = tier1Reduction + tier2Reduction;
  } else if (afni > ccbConfig.threshold1) {
    reduction = (afni - ccbConfig.threshold1) * reductionRateTier1;
  }

  return Math.max(0, maxBenefit - reduction);
}
