# Corporate Action V1.7.3 Compound Residual Percentage Fix — Design

## Problem

V1.7.2 correctly derives the combined theoretical price for same-date Split/Bonus groups, but its new presentation helper returns residuals as decimal ratios while the existing Corporate Action UI formatter expects percentage points. This produces values 100× too small: BHARATRAS `+0.03%` instead of about `+2.99%`, FCL `+0.03%` instead of about `+2.78%`, and NAZARA `+0.04%` instead of about `+4.30%`.

## Design

Keep the existing UI formatter unchanged. Correct `getPresentationResidualPct()` in `corporateActionCompoundValidation.ts` to return percentage points, matching the established `getResidualGapPct()` contract in `corporateActionValidation.ts`:

`(actual / theoretical - 1) * 100`

Update the focused compound-presentation tests so BHARATRAS, FCL, and an ordinary single-action case assert percentage-point values.

## Scope

Modified:
- `src/features/corporateActions/corporateActionCompoundValidation.ts`
- `src/features/corporateActions/__tests__/corporateActionCompoundValidation.test.ts`

Unchanged:
- `src/components/DatabaseToolsDialogs.tsx`
- Rust Corporate Action scanner and approval logic
- compound factor/fingerprint logic
- theoretical price calculation
- confidence/MATCH/REVIEW decisions
- identity workflows
- raw EOD data and adjustment mathematics

## Acceptance

After validation and portable rebuild:
- BHARATRAS compound ×4 displays residual about `+2.99%`.
- FCL compound ×10 displays residual about `+2.78%`.
- NAZARA compound ×4 displays residual about `+4.30%`.
- Price Check and Price Review show the same residual scale.
- Existing ordinary single-action residual formatting remains unchanged.
