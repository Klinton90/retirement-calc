/**
 * Cap personal (cash-consuming) contributions by free cash after lifestyle,
 * then report any remaining shortfall to raid from the portfolio.
 *
 * When budget-constrained, protect paycheck RRSP first, then ESPP, then Extra
 * (i.e. cut order: Extra → ESPP → RRSP employee).
 * Employer match / ESPP employer scale with what the employee actually contributes.
 */
export interface ContribElection {
  heEmp: number;
  sheEmp: number;
  heEsppEmployee: number;
  sheEsppEmployee: number;
  heEsppEmployer: number;
  sheEsppEmployer: number;
  heMatchFull: number;
  sheMatchFull: number;
  heExtra: number;
  sheExtra: number;
  solverExtra: number;
  heRefundRedeposit: number;
  sheRefundRedeposit: number;
}

export interface ConstrainedContrib {
  heEmp: number;
  sheEmp: number;
  heEsppEmployee: number;
  sheEsppEmployee: number;
  heEsppEmployer: number;
  sheEsppEmployer: number;
  heMatch: number;
  sheMatch: number;
  heExtra: number;
  sheExtra: number;
  solverExtra: number;
  heRefundRedeposit: number;
  sheRefundRedeposit: number;
  /** Portfolio draw needed after all voluntary savings are cut to zero. */
  raid: number;
  /** Household cash consumed by personal contributions (excludes employer money). */
  personalCashUsed: number;
  /** Employer money that still lands (match + ESPP employer on actual employee ESPP). */
  employerCashAdded: number;
}

function scaleGroup(amounts: number[], budget: number): { scaled: number[]; used: number } {
  const need = amounts.reduce((s, x) => s + Math.max(0, x), 0);
  if (need <= 0 || budget <= 0) {
    return { scaled: amounts.map(() => 0), used: 0 };
  }
  if (need <= budget) {
    return { scaled: amounts.map(x => Math.max(0, x)), used: need };
  }
  const s = budget / need;
  return { scaled: amounts.map(x => Math.max(0, x) * s), used: budget };
}

export function constrainContributionsByFreeCash(
  freeCash: number,
  elect: ContribElection
): ConstrainedContrib {
  if (freeCash < -0.5) {
    return {
      heEmp: 0,
      sheEmp: 0,
      heEsppEmployee: 0,
      sheEsppEmployee: 0,
      heEsppEmployer: 0,
      sheEsppEmployer: 0,
      heMatch: 0,
      sheMatch: 0,
      heExtra: 0,
      sheExtra: 0,
      solverExtra: 0,
      heRefundRedeposit: 0,
      sheRefundRedeposit: 0,
      raid: -freeCash,
      personalCashUsed: 0,
      employerCashAdded: 0,
    };
  }

  let budget = Math.max(0, freeCash);

  // 1) Fund RRSP employee first (most protected); match scales
  const rrsp = scaleGroup([elect.heEmp, elect.sheEmp], budget);
  const [heEmp, sheEmp] = rrsp.scaled;
  budget -= rrsp.used;
  const heMatch = elect.heEmp > 0 ? elect.heMatchFull * (heEmp / elect.heEmp) : 0;
  const sheMatch = elect.sheEmp > 0 ? elect.sheMatchFull * (sheEmp / elect.sheEmp) : 0;

  // 2) Fund ESPP employee; employer ESPP scales
  const espp = scaleGroup(
    [elect.heEsppEmployee, elect.sheEsppEmployee],
    budget
  );
  const [heEsppEmployee, sheEsppEmployee] = espp.scaled;
  budget -= espp.used;
  const heEsppEmployer =
    elect.heEsppEmployee > 0
      ? elect.heEsppEmployer *
        (heEsppEmployee / elect.heEsppEmployee)
      : 0;
  const sheEsppEmployer =
    elect.sheEsppEmployee > 0
      ? elect.sheEsppEmployer *
        (sheEsppEmployee / elect.sheEsppEmployee)
      : 0;

  // 3) Fund Extra / solver / refund last (cut first when short)
  const disc = scaleGroup(
    [
      elect.heExtra,
      elect.sheExtra,
      elect.solverExtra,
      elect.heRefundRedeposit,
      elect.sheRefundRedeposit,
    ],
    budget
  );
  const [
    heExtra,
    sheExtra,
    solverExtra,
    heRefundRedeposit,
    sheRefundRedeposit,
  ] = disc.scaled;

  const personalCashUsed =
    heExtra +
    sheExtra +
    solverExtra +
    heRefundRedeposit +
    sheRefundRedeposit +
    heEsppEmployee +
    sheEsppEmployee +
    heEmp +
    sheEmp;
  const employerCashAdded =
    heMatch + sheMatch + heEsppEmployer + sheEsppEmployer;

  return {
    heEmp,
    sheEmp,
    heEsppEmployee,
    sheEsppEmployee,
    heEsppEmployer,
    sheEsppEmployer,
    heMatch,
    sheMatch,
    heExtra,
    sheExtra,
    solverExtra,
    heRefundRedeposit,
    sheRefundRedeposit,
    raid: 0,
    personalCashUsed,
    employerCashAdded,
  };
}
