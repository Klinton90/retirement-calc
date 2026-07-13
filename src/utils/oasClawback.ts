/**
 * OAS (Old Age Security) recovery tax — commonly called the "OAS clawback".
 *
 * When an individual's net income exceeds a threshold, OAS is recovered at a
 * flat rate on the excess, up to the full OAS amount received.
 *
 * Not financial advice — see docs/explanation/math-model.md.
 */

/** Default OAS recovery threshold (individual net income). Configurable. */
export const DEFAULT_OAS_CLAWBACK_THRESHOLD = 90970;

/** Default OAS recovery rate on income above the threshold. */
export const DEFAULT_OAS_CLAWBACK_RATE = 0.15;

export interface OasClawbackResult {
  /** Dollar amount of OAS recovered (clamped to the OAS received). */
  clawback: number;
  /** OAS remaining after the recovery tax. */
  oasAfter: number;
}

/**
 * Computes the OAS clawback for an individual.
 *
 * @param oasAnnual Annual OAS benefit received (gross).
 * @param individualNetIncomeApprox Approximate individual net income used for the
 *   recovery test.
 * @param threshold Income threshold above which OAS is recovered.
 * @param rate Recovery rate applied to income above the threshold.
 */
export function oasClawback(
  oasAnnual: number,
  individualNetIncomeApprox: number,
  threshold: number = DEFAULT_OAS_CLAWBACK_THRESHOLD,
  rate: number = DEFAULT_OAS_CLAWBACK_RATE
): OasClawbackResult {
  const oas = Math.max(0, oasAnnual);
  const excess = Math.max(0, individualNetIncomeApprox - threshold);
  const clawback = Math.min(oas, excess * rate);

  return {
    clawback,
    oasAfter: oas - clawback,
  };
}
