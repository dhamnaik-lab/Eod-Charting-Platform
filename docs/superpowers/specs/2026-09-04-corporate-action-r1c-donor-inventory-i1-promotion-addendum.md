# Corporate Action R1C Donor Inventory — I1 Promotion Addendum

Status: CURRENT CLASSIFICATION ADDENDUM  
Date: 2026-09-04

## Relationship to the earlier donor inventory

The earlier R1C donor inventory remains useful for the reconstruction history and for features that have not been promoted.

This addendum changes the classification of the five I1 items after implementation, automated validation, and manual runtime acceptance.

## Classification changes

| R1C item | Earlier classification | Current classification |
| --- | --- | --- |
| `NSE + BSE / NSE / BSE` direct-fetch scope | donor-safe candidate | **ACTIVE** |
| per-exchange fetch lifecycle log | donor-safe candidate | **ACTIVE** |
| per-active-database last successful fetch | donor-safe candidate | **ACTIVE** |
| improved real backend error surfacing | donor-safe candidate | **ACTIVE** |
| From/To validation and date bounds | donor-safe candidate | **ACTIVE** |

## Important implementation boundary

The I1 promotion reused selected R1C ideas inside the existing workflow. It did not promote the reconstructed product architecture.

The active code remains centered on `CorporateActionDialog`.

The direct-fetch selector is separate from the CSV fallback selector.

This is a required safety boundary:

- direct fetch: `BOTH | NSE | BSE`
- CSV fallback: `NSE | BSE`

`BOTH` must never be passed as a CSV exchange.

## Force Re-fetch classification

Force Re-fetch remains **existing active behavior preserved from the restored workflow**.

It was not replaced by the R1C Normal workspace helper.

Force Re-fetch works with each active direct-fetch scope, including `NSE + BSE`.

## Failure behavior now accepted

For a combined scope:

- NSE can succeed
- BSE can fail
- the combined run is still failed
- the overall-complete lifecycle line is omitted
- the previous last-success record remains unchanged
- the real exchange failure is displayed

This behavior was exercised manually with a real BSE request failure and is now part of the accepted contract.

## Items that remain donor/reference only

The classification of these items does not change:

- reconstructed Review cards and presentation
- evidence drawer concepts
- Review filtering ideas
- Approve summary presentation
- Maintenance information-architecture ideas
- managed-window presentation ideas

These may be considered during the UI/UX phase, but presentation reuse must preserve the active legacy workflow behavior.

## Items that remain superseded as a whole

Do not reactivate without explicit authorization:

- four-stage Fetch -> Load -> Review -> Approve product flow
- separate Corporate Action Maintenance product
- independent Normal/Maintenance product windows
- automatic Load & Process requirement

## Items that remain diagnostic/caution

Do not promote without a separate diagnosis:

- economic-event grouping
- compound same-action `shareFactor` assumptions
- approval recheck implementation coupled to the reconstructed Load path

## Next reuse rule

R1C is still a donor library, not the current product authority.

Any further R1C promotion must follow the same procedure used for I1:

1. compare against the active existing workflow
2. identify one bounded improvement
3. preserve existing capabilities
4. write/verify a failing test
5. implement the smallest change
6. run focused and full regression
7. build the portable application
8. perform a private/test-database runtime checkpoint
9. document acceptance before the next promotion
