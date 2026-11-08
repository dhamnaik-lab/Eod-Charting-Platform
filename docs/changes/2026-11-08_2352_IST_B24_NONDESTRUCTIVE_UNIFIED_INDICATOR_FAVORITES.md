# B24 — Unify Sidebar and Indicator Picker favourites without rewriting legacy data

- **IST timestamp:** 2026-11-08 23:52 IST (UTC+05:30)
- **Active workstream:** EOD Charting Platform, authorized local root `E:\TA Projects\EOD Charting Platform` (GitHub-only changes; no local checkout/database)
- **Verified baseline authority:** GitHub `main` `24ea11198528b47894e0eb90b2a5a4c5cca1f5f7`
- **Tracking:** B24 / [#53](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/53), [draft PR #96](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/96), master #28

## Defect and approved objective

Sidebar and Indicator Picker each maintained different favourite lists in separate localStorage v1 keys, used different fresh-user defaults, and did not synchronize toggles. The Sidebar's default `bollinger_bands` was not a current catalogue ID (`boll` is). The approved bounded task is one visible list without losing pre-existing custom selections, while preserving catalogue navigation and explicitly chosen empty favourites.

## Migration and precedence policy (established before implementation)

1. Use a new canonical `eod-chart.indicator-favorites.v2` only when it contains a valid array, including intentionally empty `[]`.
2. Otherwise, read both legacy keys: `eod-chart.indicator-favorites.v1` (Picker) and `eod-chart.sidebar.favoriteIndicators.v1` (Sidebar). Preserve their **stable Picker-first union**, adding any Sidebar-only IDs, without duplicates.
3. If only one valid legacy list exists, preserve it exactly (except duplicate/non-string/blank normalization). Corrupt/missing lists never erase valid selections. Unknown historical string IDs remain stored to avoid destructive migration even if the current catalogue cannot display them.
4. If no valid stored list exists, use the Picker's eight valid default catalogue IDs (`sma`, `ema`, `rsi`, `macd`, `boll`, `supertrend`, `patterns`, `vwap`). This harmonizes fresh installs and does not reintroduce invalid `bollinger_bands` as a default.
5. **Reading causes no writes.** The first user toggle creates/updates only v2. Both legacy keys remain byte-for-byte untouched for rollback.
6. Both surfaces subscribe to same-document custom and cross-tab storage events, updating their views from one shared list.

## Files changed

- `src/indicators/indicatorFavoritesService.ts` — pure validated read/union/toggle/write with non-destructive precedence and event subscription
- `src/components/Sidebar.tsx` — replace independent favourite storage with shared service and live subscription
- `src/components/IndicatorPickerDialog.tsx` — same shared service and live subscription
- `src/indicators/__tests__/indicatorFavoritesB24.test.ts` — nine migration and source-wiring regressions
- This IST change record

## Behavior preserved

Existing explicit v1 preferences and raw values; valid empty user selections; search/filter/category/picker selection; add-indicator functionality; Sidebar sections; other localStorage keys; app data and indicator calculations. No new dependencies, no database read/write and no source-directory build outputs. New-user Sidebar favourites now intentionally match the Picker's valid eight-item default, rather than the stale Sidebar-only preset.

## Validation evidence

- First GitHub Actions [CI #42509547051](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42509547051) SUCCESS: `npm ci`; `npm test` **245 test files passed / 1 skipped, 1,638 tests passed / 1 skipped / 0 failed**, including B24 **9/9**; `npm run typecheck:renderer` PASS; `npm run build:renderer` PASS.
- Documented PR-head final CI is required after this record is committed; no claim of that run yet.

## Risks, manual checkpoints, rollback

- Actual simultaneous Sidebar/Picker interaction, cross-window and cross-tab storage events, corrupt browser storage, all themes, Tauri/Rust and Windows portable acceptance are untested. Storage-disabled sessions may only have session-local state. Unknown old IDs are retained but not shown unless supported by catalogue.
- To roll back while unmerged, close draft PR #96. If later merged, revert its squash commit; historical v1 keys were deliberately not changed. The v2 key can remain harmlessly until a separately authorized cleanup. Avoid bulk clearing user localStorage.
- Source snapshots/backups external to GitHub were not created or read; branch and exact baseline SHA preserve the reviewed source authority.
