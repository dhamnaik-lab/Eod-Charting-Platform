# Corporate Actions — Rights readiness regression contract alignment

- **IST timestamp:** 2026-11-16 02:20:02 (+05:30)
- **Workstream and authorized local root:** EOD Charting Platform, `E:\\TA Projects\\EOD Charting Platform`
- **Repository/source authority:** `dhamnaik-lab/Eod-Charting-Platform`, `main@42ae31bae7937dde944c87a997b94da933ad1a0b`
- **Branch:** `test/ca-rights-readiness-20261116`
- **Bounded issue:** one stale readiness test expectation. Not a change to production financial policy.

## Objective

Make the `Corporate Action normal Fetch + Load adapter` fixture reflect the existing verified Rights-terms admission policy, without altering implementation, financial approval safety, or import/scan APIs.

## Previous defect / limitation

Baseline GitHub Renderer CI [43759843377](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/43759843377) ran identical application and test files to `main@42ae31ba` and reported exactly two failing tests (1,826 passed, 2 failed, 1 skipped). One failing test asserted that an incomplete Rights announcement (missing ratio and cash issue-price terms) is Ready after a local EOD scan. Current `hasRightsFinancialTerms()` and `getCorporateActionApprovalState()` instead hold incomplete Rights as `NOT APPROVABLE`; this is the intended safety rule, not a defect to remove.

## Files inspected

- `src/features/corporateActions/__tests__/corporateActionNormalWorkflowAdapter.test.ts`
- `src/features/corporateActions/corporateActionValidation.ts`
- `src/features/corporateActions/workflow/corporateActionNormalWorkflowAdapter.ts`
- `src/components/DatabaseToolsDialogs.tsx` (separate unrelated identity rollback failure context only)
- `package.json`
- GitHub baseline [PR #105](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/105) and Renderer CI [43759843377](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/43759843377).

## Files modified

1. `src/features/corporateActions/__tests__/corporateActionNormalWorkflowAdapter.test.ts` — update the one outdated fixture and assertion.
2. This mandatory change record.

No production code, Rust, database migration, lockfile, build configuration or plugin code was changed.

## Implementation

The existing test now models four imports: a Dividend without an imported factor (Ready when EOD data exists); a Rights announcement with missing financial terms (not Ready despite EOD); an upcoming Dividend (not Ready); and Rights with complete positive ratio and issue price (Ready when EOD exists, even without an imported adjustment factor). The scan is requested for all four; assertions enforce `loaded:4, ready:2, needsReview:2, conflicts:0`.

## Behaviour preserved

- Rights approvals remain blocked unless finite positive ratio numerator, denominator and cash amount are present.
- Local EOD availability alone does not fabricate missing Rights terms.
- Dividend with an EOD window may be Ready without an imported factor.
- Upcoming announcements remain non-Ready.
- Approval remains an explicit operator action with backend revalidation.
- No automatic approval, database access or financial action.
- All unrelated UI and test failures (including identity recovery) remain out of scope.

## Validation commands / results

| Gate | Command or evidence | Actual result |
| --- | --- | --- |
| Clean-main baseline | GitHub Renderer CI run 43759843377 | **CONFIRMED:** 1,826 passed; 2 failed; 1 skipped; TypeScript and Vite build passed |
| Corporate Actions adapter regression | Included in GitHub full `npm test` (no separate focused invocation) | **PASS:** 17/17 tests in adapter suite |
| Full renderer suite | `npm test` | **FAIL overall:** 1,827 passed, 1 failed, 1 skipped; 264 files passed, 1 failed, 1 skipped. Only failing suite is out-of-scope identity rollback |
| Typecheck | `npm run typecheck:renderer` | **PASS** in [CI 43760368433](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/43760368433) |
| Renderer build | `npm run build:renderer` | **PASS**, Vite built in 5.59s in CI 43760368433 |
| Changed-file scope | GitHub comparison with `main@42ae31ba` | **PASS:** 2 files (1 test, 1 change record), 0 behind baseline |
| Windows portable | `npm run tauri:portable:win` | **Not performed**, user-held |
| Native/financial manual acceptance | No action is authorized | **Not performed** |

## Risk / limitations

- This test intentionally strengthens the regression fixture without adding production behaviour.
- Main may still fail one unrelated identity-recovery source-inspection test. Do not loosen rollback confirmation or merge solely to make CI green.
- The test's classifications reflect existing policy and current data fixture. Approval authority is Rust/backend at execution, not the test's readout.
- The branch should remain draft until source/test checks are reviewed and explicit merge approval is given.

## Rollback guidance

Discard the separate test branch, or revert only the single test-fixture change to exact `main@42ae31bae7937dde944c87a997b94da933ad1a0b`. Do not change production CA policy.

## Evidence

- Baseline source SHA: `42ae31bae7937dde944c87a997b94da933ad1a0b`
- Initial test-only change commit: `38ffb89ae4e29337a5b0774a860b0c7abeb99212`
- Verified application/test CI commit: `c2c3019ce7b1b345c115a71278168632d8833613`; [Renderer CI 43760368433](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/43760368433) confirms CA adapter 17/17 PASS, full Vitest one unrelated identity failure, typecheck PASS, build PASS.
- Subsequent change-record-only update does not modify application/test code.
