# B14 — Indicator numeric settings validation and invalid-value recovery

- **IST timestamp:** 2026-11-08 20:54 IST (UTC+05:30)
- **Workstream:** EOD Charting Platform, authorized Windows path `E:\TA Projects\EOD Charting Platform`; GitHub-only implementation
- **Verified GitHub `main` baseline:** `d0ad1d00619f6822366948751d7602b2fe6737ec`
- **Tracking:** [B14 issue #43](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/43), [master #28](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/28), [draft PR #89](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/89)

## Objective / previous defect

The numeric input setter used `Number(value)`, which converted a cleared field `''` to zero and silently clamped some numeric entries without feedback. Invalid persisted numeric values could re-enter the settings dialog without a clear correction step. The scope is editing-time validation, error feedback, and Save prevention for schema-declared number fields; no indicator engine or workspace serialization changes.

## Files inspected and changed

Inspected `src/components/IndicatorSettingsDialog.tsx`, `src/engine/types.ts`, `src/indicators/registry.ts`, RSI/ALMA/LSMA builders, existing indicator settings and workspace regression tests.

1. **Created** `src/indicators/indicatorNumericInputValidation.ts`: pure numeric validator and error map, supporting finite numbers, integer period/length fields, explicit descriptor min/max, LSMA regression period minimum 2, optional signed LSMA offset, ALMA fractional offset in the 0–1 range and strictly positive ALMA sigma. Does **not** blanket-clamp valid negative/zero values.
2. **Modified** `src/components/IndicatorSettingsDialog.tsx`: retain invalid in-progress text without coercing it to zero, show inline field errors and footer alert, disable Save while any numeric schema input is invalid; clear overrides on switching indicator. Valid edits commit their exact numerical value without clamping. Saved invalid fields are shown as recoverable empty/error inputs rather than silently rewritten. Existing Save/Cancel/Remove, source/style/levels and chart calculation code remain unchanged.
3. **Created** `src/indicators/__tests__/indicatorNumericValidationB14.test.tsx`: eight SSR/pure-function/workspace/calculation regressions for empty/NaN/Infinity, RSI periods, ALMA sigma/offset, LSMA signed offsets, stored invalid input, Save guard and unchanged rendered outputs.
4. **Created** `docs/changes/2026-11-08_2054_IST_B14_NUMERIC_INPUT_VALIDATION.md`: this IST change record.

## Preservation and scope limitations

- No indicator calculation formula, parameter default, chart price transformation, stored workspace content, chart scaling or database write path changed.
- Existing numeric values are not silently normalized on opening the dialog. Users must correct a stored invalid numeric field before saving edited settings.
- Legitimate signed LSMA offsets, ALMA fractional offset values, ordinary zero/negative numeric values where no period/min rule applies are retained.
- This validates *schema-defined Inputs*. Plot widths, plot opacity, level settings, custom/non-schema numeric objects and any invalid settings not opened in this dialog are outside this bounded task.
- Real DOM input composition, native Windows UI and manual Save/Reopen require separate acceptance.

## Actual validation evidence

- **Initial implementation/test head `58198e1fbc9325780ba3242d5b2b84f6d4b14d78`**, [CI #42494312664](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42494312664): **1,607 Vitest passed / 1 skipped**, B14 8/8, renderer build PASS. TypeScript **FAIL** TS2677/TS2345: a type predicate for a union of literal schema field variants was not sufficiently narrow.
- **Focused type correction `e7903d910ca589b78755c67c1b8eef294bbd0f91`** maps numeric schema fields to definite-key descriptors without changing runtime rules.
- **Corrected code/tests [CI #42494491143](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42494491143): SUCCESS**. `npm ci` PASS, **239 test files passed / 1 skipped; 1,607 Vitest tests passed / 1 skipped / 0 failed**; B14 8/8 PASS; `npm run typecheck:renderer` PASS; `npm run build:renderer` PASS (Vite 4.26 s).
- **Final-head CI pending** following this documentation commit; the earlier run is not evidence for a future head.

## Risks, untested checks and rollback

Input validation introduces intentional Save blocking for invalid numeric configurations. No other saved configuration is automatically rewritten. The period/length integer rules are derived from current UI schema/verified builders; unusual legacy configurations may require manual repair rather than silent coercion.

No real Windows keyboard/pointer interaction, focus behavior, native Tauri/Rust check, portable build, end-to-end saved settings migration or database work executed. The baseline one skipped Vitest test remains skipped.

Before merge: close PR #89 without integrating. After separately approved merge: revert the B14 commit after checking subsequent changes; no migration rollback required.

**Next gate:** verify complete renderer CI on final documented B14 head, update issue #43 and master #28, leave draft PR unmerged. Then begin B21 independently; no worker migration without separate explicit approval.
