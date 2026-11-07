# B01 — Indicator Timeframe presentation correctness

**IST timestamp:** 2026-11-08 01:07 IST (UTC+05:30)
**Workstream:** EOD Charting Platform
**Authorized local root:** `E:\TA Projects\EOD Charting Platform` (not accessed)
**Repository:** `dhamnaik-lab/Eod-Charting-Platform`
**Source authority at task start:** GitHub `main` `61bb494b9f63e86d068b5f54d167a3959723d403` (tree `fea6c0f06dbcca3a4923cfafd7717866dbe14028`)
**Issue:** #30 (B01); **master register:** #28; **draft PR:** #69
**Branch:** `fix/b01-indicator-timeframe-truthfulness-20261108`

## Objective and previous defect

The Indicator Settings Inputs tab exposed an optional per-study `Timeframe` selector (D/W/M/Q/Y) which wrote `OverlayIndicator.timeframe`. In the actual indicator renderer `buildRenderableIndicators(bars, indicators)`, calculations always use the bars passed from the active chart, without per-indicator aggregation/alignment. The legend displayed `[W]`, `[M]`, `[Q]` or `[Y]` based solely on this metadata, falsely implying different-frequency computations. This is a user-facing information/correctness defect, not a mathematical calculation defect.

## Source inspection / authority checks

- Inspected `src/components/IndicatorSettingsDialog.tsx`, `src/indicators/catalog.ts`, `src/indicators/registry.ts`, `src/engine/types.ts`, existing `IndicatorsMTFOffset.test.ts`, indicator numerical batch tests, `useDraggableFloatingWindow.ts`, and `workspacePersistence.ts`/its existing tests.
- Compared latest `main` to the prior B00 merge `7fee47b6df0a9a5f7ff2ce051ca718ccbf83ff26`: intervening six commits belonged to the Corporate Actions workstream and did not modify the B01 target files. New verified B01 source authority is `61bb494b...`, not the older report SHA.
- Decision: suppress unsupported UI/legend claims now. True per-indicator HTF resampling is not authorized as part of B01.

## Files changed

- **Modified:** `src/components/IndicatorSettingsDialog.tsx` — removed the inert `TimeframeField` from Inputs and removed the unused field component (29 deleted lines). Existing schema-driven inputs, generic Offset, Style, Levels, Scale, Visibility and Save/Cancel behavior are untouched.
- **Modified:** `src/indicators/catalog.ts` — stopped appending legacy per-indicator `timeframe` to display-label tags, with a comment clarifying why. Existing offset-tag behavior is untouched (B02 separately tracked).
- **Created:** `src/indicators/__tests__/indicatorTimeframeTruthfulness.test.tsx` — five focused regression tests.
- **Created:** `docs/changes/2026-11-08_0107_IST_B01_INDICATOR_TIMEFRAME_TRUTHFULNESS.md` — this record.
- **Not modified:** chart-level timeframe UI, indicator calculation functions/registry, `src/engine/types.ts`, workspace serialization/restore implementation, Rust/Tauri, database, package and lock files, packaging outputs.

## Exact behavior changed

- Indicator Settings no longer exposes a per-indicator timeframe selector that does not affect computation.
- Indicator legend/compact labels no longer advertise unsupported per-indicator `[W]`/`[M]`/`[Q]`/`[Y]` tags from legacy metadata.
- No automatic conversion of historical metadata or migration is performed.

## Accepted behavior preserved

- `OverlayIndicator.timeframe?: ChartTimeframe` remains in the type, and persisted indicator records retain existing `timeframe` fields when restored/saved. Historic workspaces are not stripped or rewritten by this change.
- Actual indicator values still compute using the active chart bar series; chart-level D/W/M/Q/Y selection and existing aggregation helpers are unchanged. EMA numerical series produced from identical chart bars are identical with or without the legacy field.
- Existing indicator selection, schema fields, generic `Offset (bars)` control, ALMA/LSMA algorithm offsets, tooltip/layout geometry, charts and data behavior are unchanged.
- No new dependencies, database access, Rust/backend change, local source checkout modification, or extra application feature.

## Validation — actual GitHub Actions evidence

**First run:** https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42406801037 — commit `fc50457fa19e78b981d47060570b357892694e25`. `npm ci` **PASS**; full `npm test` **PASS** (1,466 passed, 1 skipped); `npm run build:renderer` **PASS**. `npm run typecheck:renderer` **FAIL** in newly added test line 59 due to TS2353 excess-property check when passing an inline object with `timeframe` to a `ChartIndicator` parameter. No production type error observed.

**Correction:** commit `814d96a45fb9659681ba9dbd2f5350b21ae08343` declared the pre-existing legacy-offset test fixture as `OverlayIndicator` before passing it to the label function. No runtime source changed in this repair.

**Second run:** https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42406970392 — commit `814d96a45fb9659681ba9dbd2f5350b21ae08343`.

| Command / check | Verified second-run result |
|---|---|
| Checkout, setup Node.js 24, `npm ci` | **PASS** |
| `npm test` (full Vitest suite) | **PASS:** 222 test files passed, 1 skipped; 1,466 tests passed, 1 skipped, 0 failed |
| New `indicatorTimeframeTruthfulness.test.tsx` | **PASS: 5/5** (11 ms) |
| Existing `IndicatorsMTFOffset.test.ts` | **PASS: 4/4** (4 ms) |
| Existing `workspacePersistence.test.ts` | **PASS: 5/5** (4 ms) |
| `npm run typecheck:renderer` | **PASS** |
| `npm run build:renderer` | **PASS**, Vite built in 4.26 seconds |
| Separate standalone focused Vitest command | **NOT RUN**; focused suites were executed in the full suite |
| Browser/Windows manual UI checkpoint, Rust/Tauri Windows portable, real market data or database validation | **NOT RUN** (outside this bounded GitHub UI/labels correction) |

**Important validation gate:** This document changes the branch head. Verify the GitHub Actions run on the final documentation commit independently before any merge approval; the second-run result above applies specifically to commit `814d96a...`.

## Risks and limitations

- Older saved indicator metadata such as `timeframe: 'W'` remains present but intentionally inert and hidden; a future genuine per-indicator MTF implementation must explicitly define aggregation, incomplete-bar lookahead protection, and value alignment in a separate reviewed issue.
- B02 `Offset (bars)` remains visible and may be misleading for non-ALMA/LSMA indicators. It is intentionally not changed in this task.
- React SSR verifies the dialog markup but is not an interactive browser/Windows screenshot test. A user manual checkpoint should confirm that existing indicators and chart timeframe controls appear unchanged, and legends no longer show unsupported W/M/Q/Y tags.
- This GitHub-only change has not been built as a portable Windows executable. Renderer CI alone is not native/release certification.
- Source SHA must be rechecked before merge; the Corporate Actions workstream has moved `main` since the old audit SHA.

## Rollback / completion gate

Before merge, close draft PR #69 without deleting accepted source. After any separately approved merge, revert the B01 commit through a reviewed PR; leave legacy saved fields unchanged. The issue remains OPEN until user accepts validation and merge. No branch protection, source-control cleanup, or additional B02 changes are authorized as part of B01.
