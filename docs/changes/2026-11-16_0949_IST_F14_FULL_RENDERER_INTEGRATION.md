# F-14 full renderer integration — verification-only branch

- **IST timestamp:** 2026-11-16 09:49 (+05:30)
- **Project/workstream:** EOD Charting Platform
- **Authorized local root:** `E:\\TA Projects\\EOD Charting Platform` (**not accessed**)
- **Repository source authority:** `main@42ae31bae7937dde944c87a997b94da933ad1a0b`
- **Candidate F-14 draft:** `fix/f14-chart-settings-draft-20261116`, commit `c8e2112b597ae9c8bad35583116d24b7564ceabc` (PR #109)
- **This validation branch:** `test/f14-with-verified-baseline-20261116`
- **Objective:** Confirm that F-14 plus the separately tested baseline-test corrections passes the **complete** renderer CI, without merging or changing PR #109.

## Prior limitation

At PR #109 head, GitHub Renderer CI #43803099301 confirmed:
- F-14 tests **7/7 passed**.
- TypeScript typecheck **PASS**.
- Vite renderer build **PASS**.
- Full Vitest **1,833 passed, 2 failed, 1 skipped**, with exactly the two pre-existing failures independently reproduced on `main`: stale Rights terms test and obsolete identity rollback native-confirmation test.

The two existing test fixes are independently reviewed in draft PRs #106 and #107 and passed **together** in draft PR #108 ([CI #43762466626](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/43762466626), 1,828 passed, 1 skipped, zero failures).

## Files inspected

- `src/components/ChartCanvas.tsx` and `src/components/ChartSettingsDialog.tsx` at F-14 head
- `src/features/charts/chartSettingsDraftService.ts`
- `src/features/charts/__tests__/chartSettingsDraftF14.test.ts`
- `src/features/corporateActions/__tests__/corporateActionNormalWorkflowAdapter.test.ts` on F-14 and PR #106 branches
- `src/features/identityRecovery/__tests__/identityEr4HistoryVisibility.test.ts` on F-14 and PR #107 branches
- GitHub source diff, PR #109 CI, PR #108 combined CI and validated blob hashes

## Exact changes over the F-14 source commit

1. Copy **only** corrected CA adapter test, source/test blob `98c06b88b8ca5c653ee3ba70e27f86874b356c6b` from PR #106. GitHub destination blob SHA matched exactly.
2. Copy **only** corrected identity rollback test, source/test blob `1bf1670865342891f750470b09a0f666afa1bc9a` from PR #107. GitHub destination blob SHA matched exactly.
3. Add this verification-only record.

**No F-14 production source, dependency/lockfile, Rust, database, build configuration, acceptance workflow, or main branch changed.**

## Behaviour preserved

All properties of the F-14 PR #109 and the two test fixes remain as independently validated. Rights terms/approval gates and reviewed identity rollback confirmation retain existing production safeguards. No actual database or financial operation was performed.

## Validation gates and evidence

| Gate | Result |
| --- | --- |
| F-14-only renderer tests | **PASS** 7/7 in CI #43803099301 |
| F-14-only typecheck and Vite | **PASS** in CI #43803099301 |
| F-14-only full Vitest | **FAIL** on two confirmed main baseline tests; 1,833 passed, 2 failed, 1 skipped |
| Verification-only test blob SHA comparison | **PASS** exact matches from PRs #106/#107 |
| Combined full `npm test` | **PASS:** 1,835 passed, 1 skipped, **0 failed**; 266 test files passed, 1 skipped. F-14 7/7, CA 17/17, identity 6/6. [GitHub Renderer CI #43803487748](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/43803487748) |
| Combined `npm run typecheck:renderer` | **PASS** in Renderer CI #43803487748 |
| Combined `npm run build:renderer` | **PASS**, Vite built in 5.77 seconds, Renderer CI #43803487748 |
| Windows native/portable | **Not run**; operator explicitly deferred Windows acceptance |
| Merge | **Not authorized**; draft branches only |

## Risks and regression notes

- A green combined renderer suite validates only the React/TypeScript test/build boundaries, not Windows Tauri/WebView2 UI or adjusted-mode asynchronous rehydration.
- Auto-fit and Alert-rule changes remain immediate by explicit operator decision; the F-14 staged draft does not roll these back on Cancel.
- F-14 chart settings no longer preview live, as explicitly approved.
- The combined branch must never be merged as a substitute for reviewing/merging the original draft PRs.

## Rollback and next step

Discard this validation-only branch/PR without modifying `main`. Continue to keep PRs #103–#109 on hold until explicit operator merge approval. GitHub verified command results recorded above. Original tested source commit: `898146db9da29dcb6b322430ce432c0ec8cfee1e`. This documentation-only update does not change production/test blobs; any subsequent CI on the document head must be distinguished from the already passing source run. Preserve accepted behaviour.
