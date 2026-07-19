import type { ProjectionYear } from '../types/calculator';

/**
 * Plot 1 wealth balance for a projection year.
 *
 * Working years use end-of-year (`portfolioEnd`) — after contributions & growth.
 * Retired years use opening balance (`portfolioStart`) — same convention as the
 * Nest Egg card and Min Savings `portfolioCurve` / →$0 path (start of year).
 */
export function plot1PortfolioBalance(row: ProjectionYear): number {
  return row.isRetired ? row.portfolioStart : row.portfolioEnd;
}
