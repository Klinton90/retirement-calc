/**
 * RRIF (Registered Retirement Income Fund) minimum withdrawal calculations.
 *
 * The minimum withdrawal is a prescribed fraction of the account balance as of
 * January 1 of the year. Below age 71 the CRA formula 1 / (90 - age) applies;
 * from age 71 onward a prescribed factor table is used.
 *
 * Not financial advice — see docs/explanation/math-model.md.
 */

/**
 * CRA prescribed RRIF minimum factors for ages 71 through 95.
 * Values reflect the post-2015 (current) CRA schedule.
 */
const RRIF_FACTOR_TABLE: Readonly<Record<number, number>> = {
  71: 0.0528,
  72: 0.0540,
  73: 0.0553,
  74: 0.0567,
  75: 0.0582,
  76: 0.0598,
  77: 0.0617,
  78: 0.0636,
  79: 0.0658,
  80: 0.0682,
  81: 0.0708,
  82: 0.0738,
  83: 0.0771,
  84: 0.0808,
  85: 0.0851,
  86: 0.0899,
  87: 0.0955,
  88: 0.1021,
  89: 0.1099,
  90: 0.1192,
  91: 0.1306,
  92: 0.1449,
  93: 0.1634,
  94: 0.1879,
  95: 0.2000,
};

const MIN_TABLE_AGE = 71;
const MAX_TABLE_AGE = 95;

/**
 * Returns the RRIF minimum withdrawal rate (fraction of the Jan 1 balance) for a
 * given age.
 *
 * - age < 71: `1 / (90 - age)`, with age clamped to a sensible lower bound of 55.
 * - age >= 71: CRA prescribed factor table (71..95). Ages above 95 use the 95+
 *   factor.
 */
export function rrifMinimumRate(age: number): number {
  if (age >= MIN_TABLE_AGE) {
    const clampedAge = Math.min(MAX_TABLE_AGE, Math.floor(age));
    return RRIF_FACTOR_TABLE[clampedAge];
  }

  // Below 71: 1 / (90 - age). Clamp age to a sensible lower bound so the
  // denominator stays reasonable (younger holders are rare but possible).
  const clampedAge = Math.max(55, age);
  return 1 / (90 - clampedAge);
}

/**
 * Returns the minimum dollar amount that must be withdrawn from a RRIF this year.
 *
 * @param balanceJan1 Account balance as of January 1.
 * @param age Age of the annuitant during the year.
 */
export function rrifMinimumWithdrawal(balanceJan1: number, age: number): number {
  if (balanceJan1 <= 0) {
    return 0;
  }
  return balanceJan1 * rrifMinimumRate(age);
}
