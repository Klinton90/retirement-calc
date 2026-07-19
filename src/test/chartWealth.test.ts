import { describe, it, expect } from 'vitest';
import { plot1PortfolioBalance } from '../utils/chartWealth';
import type { ProjectionYear } from '../types/calculator';

function row(partial: Partial<ProjectionYear> & Pick<ProjectionYear, 'isRetired' | 'portfolioStart' | 'portfolioEnd'>): ProjectionYear {
  return {
    year: 2055,
    ageHe: 65,
    ageShe: 63,
    grossIncome: 0,
    netIncome: 0,
    actualSavings: 0,
    ccbBenefit: 0,
    childCosts: 0,
    expenses: 0,
    pensionIncome: 0,
    pensionNet: 0,
    hePensionGross: 0,
    shePensionGross: 0,
    drawdownGross: 0,
    drawdownNet: 0,
    retirementTax: 0,
    tfsaDraw: 0,
    heRrspDraw: 0,
    sheRrspDraw: 0,
    heTfsaDraw: 0,
    sheTfsaDraw: 0,
    nonRegDraw: 0,
    portfolioDrawTotal: 0,
    investmentGain: 0,
    savingsDrift: 0,
    unallocatedCash: 0,
    heTakeHomePay: 0,
    sheTakeHomePay: 0,
    heExtraIncomeNet: 0,
    sheExtraIncomeNet: 0,
    taxSavingsPending: 0,
    savingsTargetAmount: 0,
    contribToTfsa: 0,
    contribToRrsp: 0,
    contribToNonReg: 0,
    heRrspRoomRemaining: 0,
    sheRrspRoomRemaining: 0,
    heTfsaRoomRemaining: 0,
    sheTfsaRoomRemaining: 0,
    ...partial,
  };
}

describe('plot1PortfolioBalance', () => {
  it('uses end-of-year balance while working', () => {
    expect(
      plot1PortfolioBalance(
        row({ isRetired: false, portfolioStart: 100_000, portfolioEnd: 120_000 })
      )
    ).toBe(120_000);
  });

  it('uses opening balance once retired (Nest Egg / Min Savings convention)', () => {
    expect(
      plot1PortfolioBalance(
        row({ isRetired: true, portfolioStart: 3_189_924, portfolioEnd: 3_060_066 })
      )
    ).toBe(3_189_924);
  });
});
