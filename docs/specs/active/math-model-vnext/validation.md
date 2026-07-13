/**
 * Validation / closure notes
 *
 * 2026-07-12 evening (operator away → returned: chose just-fix over Plan mode)
 *
 * Suite: 66/66 green.
 *
 * Closed after validation hotfixes:
 * - TFSA bridge before extra RRSP; unfunded-year deplete; card yearsSecure/pension from target engine
 * - runProjection retirement uses age-based pensions, RRIF mins, RRIF-only split, bucket ledger
 * - Payroll RRSP always → RRSP under TFSA_FIRST; per-spouse accumulation horizon
 * - Deficit years draw down buckets; tests for contributionPolicy / redeposit / TFSA bridge
 *
 * Still soft / known:
 * - Non-reg tax is crude 50% inclusion
 * - Survivor stress still crude
 * - Working-year tax path still uses salary calculator (OK); retirement viewer aligned
 */
