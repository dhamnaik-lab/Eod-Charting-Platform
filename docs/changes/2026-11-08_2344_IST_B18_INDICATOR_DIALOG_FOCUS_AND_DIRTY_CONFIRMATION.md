# B18 — Indicator Settings focus lifecycle and explicit dirty-draft confirmation

- **IST timestamp:** 2026-11-08 23:44 IST (UTC+05:30)
- **Workstream:** EOD Charting Platform, authorized root `E:\TA Projects\EOD Charting Platform`; GitHub-only source edit
- **Source authority:** GitHub `main` `24ea11198528b47894e0eb90b2a5a4c5cca1f5f7` (tree `104592ab1b2db9089960f182af58d721b17bc986`)
- **Tracking:** B18 / [#47](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/47); [draft PR #95](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/95); master #28

## Objective and previous defect

The floating Indicator Settings dialog lacked modal semantics, initial focus, Tab/Shift+Tab containment, Escape handling and opener focus restoration. Close, Cancel and backdrop could silently discard unsaved settings. The permitted behavior decision is explicit confirmation before losing dirty changes; ordinary clean close remains immediate.

## Files changed

- `src/components/IndicatorSettingsDialog.tsx` — modal semantics, focus lifecycle, keyboard trap, guarded close, accessible inline discard prompt
- `src/features/app/indicatorSettingsDraftGuard.ts` — pure structural dirty-draft check (including invalid numeric text)
- `src/features/app/__tests__/indicatorSettingsDialogFocusB18.test.tsx` — eight focused checks
- This IST change record

## Final implementation

- Labelled `role="dialog"` and `aria-modal="true"` on the existing floating panel, without new layout container.
- On opening, focus the Close control; while open, wrap Tab and Shift+Tab through the existing `getModalTabWrapTarget` helper; on actual unmount, restore focus to a connected original opener.
- Escape is handled on the dialog, preventing bubbling. Escape, Close, Cancel and backdrop call the same `requestClose` guard.
- A clean draft closes immediately. A modified draft or an invalid numeric text override shows an explicit `Keep editing` / `Discard changes` choice; Escape in the confirmation returns to editing.
- Original indicator baseline resets when switching to a different indicator ID.

## Behavior preserved

Indicator calculation, plots, numeric B14 Save protection, supported settings panels, native ChartCanvas keyboard guard, pointer drag, floating position persistence, `onSave` and `onRemove` actions, PATTERN storage behavior, and all other dialog types. No new dependency or source directory build artifact. No local checkout or database accessed.

## Validation commands and actual results

- CI `#42508649190` ran `npm ci`, `npm test`, `npm run typecheck:renderer`, `npm run build:renderer`: **1,637 tests passed / 1 skipped**, but the TypeScript step **failed** on a test-fixture discriminated-union spread (`TS2345`); no production code defect was reported.
- Fixed only the RSI fixture type. CI [`#42508816791`](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42508816791) then completed **SUCCESS**: `npm ci`; **245 test files passed / 1 skipped, 1,637 tests passed / 1 skipped, 0 failed**, including **B18 8/8**; `npm run typecheck:renderer` PASS; `npm run build:renderer` PASS.
- A separate final-head CI check including this documentation is required before merge review; not claimed yet.

## Risks and limitations

Manual Windows keyboard-only open/Tab/Shift+Tab/Escape, backdrop/drag/resize, dirty-save confirmation, focus restoration when the opener disappears, and modal screen-reader interaction remain untested. Tauri/Rust and portable Windows packaging not run. Invalid or unsaved forms are protected, but `Remove` remains the existing intentional direct remove action. Screen-reader and actual browser focus behavior are not proven by SSR/source-level tests alone.

## Rollback

PR #95 remains draft and unmerged; close it to discard the proposed changes. If later merged, revert only its verified squash commit and use the prior tested `main` tree; do not restore a different workstream or an old snapshot.

## Evidence

Original baseline commit `24ea11198528b47894e0eb90b2a5a4c5cca1f5f7`. Corrected source/test CI commit `87ef1eacb613be612473f58fbe1a811e5ce1dbf8`; successful renderer workflow `#42508816791`. Windows native and manual checkpoints remain open.
