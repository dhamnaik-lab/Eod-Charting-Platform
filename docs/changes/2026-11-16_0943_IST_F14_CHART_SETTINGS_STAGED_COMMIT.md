# F-14 — Chart Settings staging, explicit OK, and Cancel semantics

- **IST timestamp:** 2026-11-16 09:43 (+05:30)
- **Workstream:** EOD Charting Platform
- **Authorized Windows source root:** `E:\\TA Projects\\EOD Charting Platform` (**not accessed**)
- **GitHub authority:** `dhamnaik-lab/Eod-Charting-Platform`, `main@42ae31bae7937dde944c87a997b94da933ad1a0b`
- **Working branch:** `fix/f14-chart-settings-draft-20261116`
- **Audit finding:** F-14, 2026-11-15 UX Review
- **User decision:** Stage chart-specific changes until OK; no live preview. Preserve Auto-fit and Alert rule edits as deliberate immediate operations.

## Objective / previous defect

The Chart Settings dialog previously used local drafts only for chart type and Renko configuration. Other controls (volume, appearance, value labels, scales, adjusted pricing and event markers) called live Zustand actions immediately. Cancel, Close/X, backdrop and Escape merely dismissed the dialog, leaving those changes applied. In the Alerts section, edits could persist immediately. An indiscriminate restore-on-Cancel would be unsafe for alert persistence and adjusted-price data reloads.

## Files inspected

- `src/components/ChartSettingsDialog.tsx`
- `src/components/ChartCanvas.tsx`
- `src/store/chartStore.ts`
- `src/store/chartStoreTypes.ts`
- `src/features/charts/chartTabSessionController.ts`
- `src/features/charts/chartTabStateMutationService.ts`
- `src/engine/valueLabelSettings.ts`
- `src/engine/types.ts`
- `package.json`
- Existing renderer test patterns for source contracts / SSR.

## Files changed

1. `src/components/ChartSettingsDialog.tsx` — hold a local settings snapshot, route chart-specific controls to local edits, pass a differential change set on OK; retain existing close paths and Renko validation.
2. `src/components/ChartCanvas.tsx` — apply only edited settings after successful chart/Renko validation in one target-tab `runForChart` transaction. Preserve adjusted-mode flags and avoid needless raw-to-adjusted rehydrations.
3. `src/features/charts/chartSettingsDraftService.ts` — pure immutable draft-clone and changed-field diff helper.
4. `src/features/charts/__tests__/chartSettingsDraftF14.test.ts` — regression tests for copied data, cancel/discard semantics, selective commit, changed-back values, all labels, event toggles, dismissal/Renko validation source contracts and deliberate exceptions.
5. This change record.

## Final implementation

Opening Chart Settings captures its chart-specific properties in a local draft, including nested appearance, status values and event-visibility maps. Editing a control mutates only the draft. OK validates chart type / Renko settings first using the **existing** `applyChartSettingsDialog` action, and applies only fields different from the opening snapshot; no unrelated setting is overwritten. Invalid Renko input keeps the dialog open and does not commit the other drafts. Closing without OK drops the draft.

Chart settings are no longer live-previewed. The dialog explicitly explains that Auto-fit and Alert edits apply immediately, because they remain commands/persistent alert operations, not staged chart visual preferences.

## Accepted behaviour preserved

- Chart type and Renko existing validation, field defaults, error display and OK closure.
- Existing chart-tab targeting through one `runForChart` activation.
- Existing volume pane, status values, price scale, future margin, visual theme and event marker store actions.
- Global adjusted-price mode, dividend/rights inclusion, and associated database preference/data rehydration actions are **not called while drafting**.
- Auto-fit price/all panes remains immediate.
- Alert-rule edits remain immediate persistent writes; Cancel cannot roll those operations back.
- Existing escape/focus-close handling and backdrop/X/Cancel handlers are retained.
- No Rust, DB schema, source-file authority, dependency, lockfile, persistence format, or unrelated feature changes.

## Validation and actual results

| Check | Command or evidence | Actual result |
| --- | --- | --- |
| Source authority | GitHub latest commit and pinned source file reads | **Verified** `main@42ae31ba`, unchanged at branch start |
| Scope | GitHub compare against `main@42ae31ba` | **PASS:** 5 changed files, 0 behind baseline, no unrelated changes |
| F-14 regression suite | Included in full GitHub `npm test`; no separate focused invocation | **PASS:** 7/7 tests in [Renderer CI #43803099301](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/43803099301) |
| Full renderer regression | `npm test` | **FAIL on pinned-main baseline only:** 1,833 passed, 2 failed, 1 skipped, with only previously established CA/identity baseline tests failing. Combined validation with exact corrected tests in [PR #110 CI #43803487748](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/43803487748) **PASS:** 1,835 passed, 1 skipped, 0 failed |
| TypeScript | `npm run typecheck:renderer` | **PASS** in PR #109 [CI #43803099301](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/43803099301) and combined [CI #43803487748](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/43803487748) |
| Renderer build | `npm run build:renderer` | **PASS**, 5.58s PR #109 and 5.77s combined PR #110 |
| Rust/Tauri/Windows portable | `npm run tauri:portable:win` | **Not run**, Windows acceptance intentionally deferred |
| Manual Windows acceptance | Cancel/X/Escape/backdrop, OK, invalid Renko, Auto-fit/Alerts, switch tiles | **Not run**, user-held |

**Important:** Full Vitest on unchanged main has two known unrelated test failures. Separate test corrections PRs #106/#107 passed in combined renderer CI PR #108 but remain unmerged; this F-14 branch is based only on `main`, so a green full-suite result is not assumed. Do not mix their corrections into this branch.

## Risks / limitations

- Settings no longer preview live. This is an explicitly approved behaviour change.
- Applying adjusted-mode changes can trigger normal data rehydration; this is deferred until OK.
- This branch uses existing independent store actions after chart/Renko validation rather than a new transactional store API. Individual store actions are synchronous, but not globally atomic with asynchronous rehydration; actual Windows acceptance is needed.
- A chart/tab changed externally while this dialog is open may affect its context; differential patches limit overwrites, and existing `runForChart` targets the chart. Verify chart-tab isolation in Windows.
- Auto-fit and alert edits remain immediate and cannot be undone via Cancel by design; the dialog discloses this.
- No claim of native validation or full test success before actual output.

## Rollback

Do not merge if CI or operator acceptance fails. Discard branch `fix/f14-chart-settings-draft-20261116`, or restore the two modified components to their original blobs at `main@42ae31ba` and remove the new draft helper and regression tests. Preserve unrelated source and documentation changes.

## Evidence

- Baseline commit `42ae31bae7937dde944c87a997b94da933ad1a0b`.
- Branch `fix/f14-chart-settings-draft-20261116`.
- F-14 source/test commit `c8e2112b597ae9c8bad35583116d24b7564ceabc`; [PR #109](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/109) initial CI #43803099301: 7/7 F-14 PASS; TypeScript/Vite PASS; full suite 2 known baseline failures.
- [PR #110](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/110) validation-only source commit `898146db9da29dcb6b322430ce432c0ec8cfee1e`, [Renderer CI #43803487748](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/43803487748): full Vitest **1,835 pass, 1 skip, 0 fail**, TypeScript PASS, Vite PASS. Includes only two exact previously validated test corrections over F-14 source; no F-14 code/test changed.
- Subsequent documentation-only updates do not change application/test source but may trigger new CI runs.
