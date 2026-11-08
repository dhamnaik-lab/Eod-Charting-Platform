# B25 — Keep individual PATTERN indicator saves chart-local

- **IST timestamp:** 2026-11-09 00:00 IST (UTC+05:30)
- **Workstream:** EOD Charting Platform; authorized root `E:\TA Projects\EOD Charting Platform`, GitHub-only, local checkout/database not accessed
- **Verified source authority:** GitHub `main` `24ea11198528b47894e0eb90b2a5a4c5cca1f5f7`
- **Tracking:** [B25 issue #54](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/54), [draft PR #97](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/97), [master #28](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/28)

## Evidence of existing semantics (confirmed before change)

- `IndicatorSettingsDialog.handleSave` previously wrote every edited PATTERN's selections/three colours to global `eod-chart.candlestick-settings.v1` via `saveCandlestickSettings` **and** called `onSave(draft)`.
- `src/features/charts/chartTabStateMutationService.ts` updates the current tab's indicator by ID through `updateTabIndicator`; chart/workspace persistence stores that indicator's own colour/pattern fields.
- New PATTERN indicator instances are created from `src/indicators/catalog.ts`'s independent default template (`createIndicatorFromCatalogId('patterns')`). A repository-wide read of `loadSavedCandlestickSettings` found only the service and its focused tests, with no current production consumer.
- Thus the global write in the per-chart edit dialog was an unintended side effect, not the source of new-chart defaults. No global defaults migration is justified.

## Bounded correction and changed files

- `src/components/IndicatorSettingsDialog.tsx`: remove only the global `saveCandlestickSettings` import and PATTERN-specific write block in `handleSave`; keep numeric validation and `onSave(draft)`.
- `src/features/candlestick/__tests__/patternLocalSaveB25.test.tsx`: seven regressions for this write boundary, preserved legacy service, defaults and workspace restoration.
- This change record.

## Preserved behavior and data

PATTERN rendering, pattern selections and colours on the current chart, Save/Cancel/Remove, workspace persistence, creation from catalogue defaults, all other indicator calculations, and existing values stored in `eod-chart.candlestick-settings.v1`. The legacy global `loadSavedCandlestickSettings`/`saveCandlestickSettings` API and its tests remain unchanged; other callers may continue to use it explicitly. No other settings system, new dependency, database change, local build product, or source refactor.

## Actual validation

- First renderer [GitHub Actions #42510197670](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42510197670) **SUCCESS**: `npm ci`, `npm test` **245 passed test files / 1 skipped, 1,636 tests passed / 1 skipped / 0 failed**; focused B25 **7/7**; `npm run typecheck:renderer` PASS; `npm run build:renderer` PASS.
- Final documented PR head requires a fresh CI run after committing this record. This run is not yet claimed.
- B18 separately modifies the same settings component and has a source-level regression expecting the old global call; **that test assertion must be reconciled in combined integration CI** to reflect B25's separately approved removal. The B18 focus and dirty-discard behavior remains preserved.

## Risks and manual acceptance

No real Windows PATTERN Save→reopen, newly added chart, global storage upgrade/rollback or cross-sheet UI acceptance; no Tauri/Rust/portable build. The global service remains available but is not intentionally invoked by the per-chart PATTERN Save. User localStorage is never cleared.

## Rollback

Close unmerged PR #97 to discard this change. After a separately authorized merge, revert only the exact B25 squash commit; the legacy stored global key and service were not modified. On integration, ensure B18 focus tests and B25 storage contract both pass together before merging.

## Evidence identifiers

Original base `24ea11198528b47894e0eb90b2a5a4c5cca1f5f7`; pre-document code/test commit `fe5b9925ded3806e5a8eb851b5fd456406a96177`; initial successful CI `#42510197670`.
