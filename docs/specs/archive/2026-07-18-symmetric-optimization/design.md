# Design: earner roles + symmetric flows

## Role model

`resolveEarnerRoles` derives stable roles from base gross salary:

- primary = higher salary
- secondary = the other spouse
- exact tie = He (deterministic)

Roles are fixed at plan level, while per-year RRSP preference still uses soft capacity and
current salary.

## ESPP

- Compute employee and employer ESPP per person in both engines.
- Preserve each person's ESPP identity through free-cash constraints.
- Payroll RRSP, sale cash, and refund redeposit remain on that person's stream.
- Deploy each stream through its own MV order.

## Ownership

- Each stream fills own TFSA, then spouse TFSA.
- Each stream may use only its own personal RRSP.
- Cross-spouse RRSP is allowed only through `SPOUSAL`.
- Non-reg receives final residual.

## Room race

Deploy secondary stream first, then primary stream. Swapping all spouse inputs, rooms, and
orders therefore mirrors account outputs.

## Spousal RRSP

- Contributor = primary (uses primary RRSP room and receives deduction).
- Annuitant = secondary (balance is credited to secondary RRSP bucket).
- Offered only to the secondary stream when optimization is enabled.

## Survivor

- Default deceased = primary.
- `survivorWho` can select primary, He, or She.
- Both engines use the same CPP survivor benefit, OAS stop, split disablement, and spend factor.

## Decumulation

TFSA bridge draws use the larger remaining TFSA with a secondary-role tie-break, replacing
the prior He-first order.

## Cleanup and validation

- Deleted dead `allocateDiscretionaryYear` and stale asymmetric helpers.
- Added per-person ESPP, She-primary deduction, survivor-direction, and mirror-output tests.
