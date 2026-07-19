import { describe, expect, it } from 'vitest';
import {
  AllocationPolicy,
  FamilyMember,
  MvDestination,
  SurvivorWho,
} from '../types/calculator';
import { DEFAULT_ACCOUNT_BUCKETS, totalInvestable } from '../utils/accountBuckets';
import {
  resolveEarnerRoles,
  resolveSurvivorDeceased,
} from '../utils/earnerRoles';
import { deployDiscretionaryByMvOrder } from '../utils/mvDeployPolicy';
import { accumulateToRetirement } from '../utils/targetEngine';
import { calculateHouseholdTax } from '../utils/taxCalc';
import { basePlan } from './fixtures/excessMvFixtures';

describe('symmetric earner roles', () => {
  it('selects the higher base earner and uses He only as exact-tie breaker', () => {
    const base = basePlan();
    expect(resolveEarnerRoles(base).primary).toBe(FamilyMember.HE);
    expect(
      resolveEarnerRoles({
        heInput: { ...base.heInput, salary: 80_000 },
        sheInput: { ...base.sheInput, salary: 160_000 },
      }).primary
    ).toBe(FamilyMember.SHE);
    expect(
      resolveEarnerRoles({
        heInput: { ...base.heInput, salary: 100_000 },
        sheInput: { ...base.sheInput, salary: 100_000 },
      }).primary
    ).toBe(FamilyMember.HE);
  });

  it('defaults survivor stress to primary but permits an explicit override', () => {
    const shePrimary = basePlan({
      heInput: { ...basePlan().heInput, salary: 80_000 },
      sheInput: { ...basePlan().sheInput, salary: 160_000 },
    });
    expect(resolveSurvivorDeceased(shePrimary)).toBe(FamilyMember.SHE);
    expect(
      resolveSurvivorDeceased({
        ...shePrimary,
        survivorWho: SurvivorWho.HE,
      })
    ).toBe(FamilyMember.HE);
  });
});

describe('symmetric ESPP and spousal deployment', () => {
  it('routes each spouse ESPP sale through that spouse own order', () => {
    const result = deployDiscretionaryByMvOrder({
      heExtraAnnual: 0,
      sheExtraAnnual: 0,
      heEsppSaleAnnual: 2_000,
      sheEsppSaleAnnual: 3_000,
      heRefundRedepositAnnual: 0,
      sheRefundRedepositAnnual: 0,
      rooms: { tfsaHe: 0, tfsaShe: 0, rrspHe: 10_000, rrspShe: 10_000 },
      buckets: { ...DEFAULT_ACCOUNT_BUCKETS },
      heOrder: [MvDestination.RRSP_HE, MvDestination.NON_REG],
      sheOrder: [MvDestination.RRSP_SHE, MvDestination.NON_REG],
      spousalContributor: FamilyMember.HE,
    });

    expect(result.buckets.rrspHe).toBe(
      DEFAULT_ACCOUNT_BUCKETS.rrspHe + 2_000
    );
    expect(result.buckets.rrspShe).toBe(
      DEFAULT_ACCOUNT_BUCKETS.rrspShe + 3_000
    );
  });

  it('She-only ESPP increases the backsolve accumulation path', () => {
    const base = basePlan({
      heInput: {
        ...basePlan().heInput,
        esppEmployeeRate: 0,
        esppEmployerRate: 0,
      },
      sheInput: {
        ...basePlan().sheInput,
        esppEmployeeRate: 0,
        esppEmployerRate: 0,
      },
    });
    const withSheEspp = {
      ...base,
      sheInput: {
        ...base.sheInput,
        esppEmployeeRate: 10,
        esppEmployerRate: 2,
      },
    };

    const none = accumulateToRetirement(
      base,
      0,
      2026,
      AllocationPolicy.TFSA_FIRST,
      { useMvDeploy: false }
    );
    const withEspp = accumulateToRetirement(
      withSheEspp,
      0,
      2026,
      AllocationPolicy.TFSA_FIRST,
      { useMvDeploy: false }
    );
    expect(totalInvestable(withEspp)).toBeGreaterThan(totalInvestable(none));
  });

  it('uses contributor room and credits the secondary annuitant bucket', () => {
    const result = deployDiscretionaryByMvOrder({
      heExtraAnnual: 0,
      sheExtraAnnual: 5_000,
      heEsppSaleAnnual: 0,
      sheEsppSaleAnnual: 0,
      heRefundRedepositAnnual: 0,
      sheRefundRedepositAnnual: 0,
      rooms: { tfsaHe: 0, tfsaShe: 0, rrspHe: 5_000, rrspShe: 0 },
      buckets: { ...DEFAULT_ACCOUNT_BUCKETS },
      heOrder: [MvDestination.NON_REG],
      sheOrder: [MvDestination.SPOUSAL, MvDestination.NON_REG],
      spousalContributor: FamilyMember.HE,
    });

    expect(result.rooms.rrspHe).toBe(0);
    expect(result.buckets.rrspShe).toBe(
      DEFAULT_ACCOUNT_BUCKETS.rrspShe + 5_000
    );
    expect(result.sheSplit.toSpousal).toBe(5_000);
  });

  it('gives the spousal deduction to She when She is primary', () => {
    const plan = basePlan({
      heInput: { ...basePlan().heInput, salary: 80_000 },
      sheInput: { ...basePlan().sheInput, salary: 160_000 },
    });
    const result = calculateHouseholdTax(
      plan.heInput,
      plan.sheInput,
      [],
      plan.savingsBase,
      plan.savingsTargetRate,
      plan.taxConfig,
      plan.ccbConfig,
      false,
      500,
      plan.heInput.carryForwardRrspRoom,
      plan.sheInput.carryForwardRrspRoom,
      FamilyMember.SHE
    );

    expect(result.spousalContributionMonthly).toBe(500);
    expect(result.she.totalRrspDeduction).toBeGreaterThan(
      plan.sheInput.otherSavingsRrspMonthly * 12
    );
  });

  it('mirrors account outputs when He and She streams are swapped', () => {
    const zero = {
      tfsaHe: 0,
      tfsaShe: 0,
      rrspHe: 0,
      rrspShe: 0,
      nonReg: 0,
      cashExcluded: 0,
    };
    const hePrimary = deployDiscretionaryByMvOrder({
      heExtraAnnual: 8_000,
      sheExtraAnnual: 3_000,
      heEsppSaleAnnual: 2_000,
      sheEsppSaleAnnual: 1_000,
      heRefundRedepositAnnual: 500,
      sheRefundRedepositAnnual: 250,
      rooms: { tfsaHe: 4_000, tfsaShe: 5_000, rrspHe: 6_000, rrspShe: 2_000 },
      buckets: zero,
      heOrder: [
        MvDestination.TFSA_HE,
        MvDestination.TFSA_SHE,
        MvDestination.RRSP_HE,
        MvDestination.NON_REG,
      ],
      sheOrder: [
        MvDestination.TFSA_SHE,
        MvDestination.TFSA_HE,
        MvDestination.RRSP_SHE,
        MvDestination.SPOUSAL,
        MvDestination.NON_REG,
      ],
      spousalContributor: FamilyMember.HE,
    });
    const shePrimary = deployDiscretionaryByMvOrder({
      heExtraAnnual: 3_000,
      sheExtraAnnual: 8_000,
      heEsppSaleAnnual: 1_000,
      sheEsppSaleAnnual: 2_000,
      heRefundRedepositAnnual: 250,
      sheRefundRedepositAnnual: 500,
      rooms: { tfsaHe: 5_000, tfsaShe: 4_000, rrspHe: 2_000, rrspShe: 6_000 },
      buckets: zero,
      heOrder: [
        MvDestination.TFSA_HE,
        MvDestination.TFSA_SHE,
        MvDestination.RRSP_HE,
        MvDestination.SPOUSAL,
        MvDestination.NON_REG,
      ],
      sheOrder: [
        MvDestination.TFSA_SHE,
        MvDestination.TFSA_HE,
        MvDestination.RRSP_SHE,
        MvDestination.NON_REG,
      ],
      spousalContributor: FamilyMember.SHE,
    });

    expect(shePrimary.buckets.tfsaShe).toBe(hePrimary.buckets.tfsaHe);
    expect(shePrimary.buckets.tfsaHe).toBe(hePrimary.buckets.tfsaShe);
    expect(shePrimary.buckets.rrspShe).toBe(hePrimary.buckets.rrspHe);
    expect(shePrimary.buckets.rrspHe).toBe(hePrimary.buckets.rrspShe);
    expect(shePrimary.buckets.nonReg).toBe(hePrimary.buckets.nonReg);
  });
});
