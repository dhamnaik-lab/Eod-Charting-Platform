# CHART_WORKSPACE_UX_REFINEMENT_REPORT

Date: 2026-04-02

## Scope

This was a narrow follow-up pass after `CHART_WORKSPACE_UX_STABILITY_REPORT.md`.

The goals were:

- make the whole left sidebar slightly more readable without making it oversized
- make sidebar text slightly brighter / higher contrast
- refine the remaining zoom-out horizontal drift without undoing the prior cursor-anchored zoom work
- preserve the recent sheet-strip and sidebar auto-hide improvements

## What Remained Before This Pass

### Sidebar readability issues

- sidebar text was still a little too small in dense areas such as symbol rows, metadata rows, section labels, and compact buttons
- text contrast was still slightly too dim across the panel header, list headers, secondary row text, and compact controls
- search fields were usable, but the entered text and placeholder text still read too faintly for a dense desktop sidebar

### Zoom-out drift behavior

- the prior pass moved zoom anchoring from viewport-center logic to cursor/hover focus, which improved behavior materially
- zoom-out still showed residual horizontal movement because the remaining math was not preserving the exact rendered pixel anchor
- repeated zoom in/out could also accumulate small span drift because the in/out factors were only approximate opposites, not exact reciprocals

## Root Cause Found

Two low-level causes remained in the zoom path:

1. `src/engine/ScaleManager.ts` still used anchor math based on raw bar-span ratio only:
   - bar drawing is center-aligned inside each bar slot
   - the old zoom formula did not preserve that half-bar offset
   - result: zoom-out could visibly shift the chart horizontally even when the cursor stayed fixed

2. `src/engine/ChartEngine.ts` and the bottom zoom buttons in `src/components/ChartCanvas.tsx` used non-reciprocal zoom factors:
   - zoom-in and zoom-out were close opposites, but not exact inverses
   - result: repeated zoom cycles could accumulate a subtle viewport/span mismatch

## Sidebar Readability Refinements Applied

Updated `src/components/Sidebar.tsx` and `src/styles/global.css`:

- increased sidebar text sizing slightly across the whole sidebar while keeping the layout compact
- brightened text colors for:
  - rail buttons
  - collapse button
  - panel metadata
  - list headers
  - symbol rows
  - secondary row text
  - compact buttons
  - empty-state text
- increased compact input sizing slightly and brightened input text
- added a dedicated `.sidebar-compact-input::placeholder` rule so placeholder text is less faint
- slightly strengthened selected-row background/readability without changing sidebar behavior or structure

## Zoom Stability Refinement Applied

Updated `src/engine/ScaleManager.ts`, `src/engine/ChartEngine.ts`, and `src/components/ChartCanvas.tsx`:

- corrected the zoom anchor formula so it preserves the rendered cursor position using the bar-center offset instead of only a raw span ratio
- changed wheel zoom to use exact reciprocal in/out factors
- changed bottom zoom controls to use exact reciprocal in/out factors
- preserved the prior pass behavior where zoom stays tied to current cursor focus or current hover focus instead of falling back to viewport-center zoom

## AmiBroker Comparison

- AmiBroker was directly accessible in this Codex environment:
  - `C:\Program Files\AmiBroker\Broker.exe`
  - `C:\Program Files (x86)\AmiBroker\Broker.exe`
- this pass therefore used AmiBroker-style zoom stability as the explicit behavioral target
- no automated side-by-side UI harness was added in this repo; validation for this pass was done through code-path inspection, anchor-math verification, and the required build pipeline in this app

## Stability Result

- center-case repeated zoom behavior is now materially stricter because the pixel anchor is preserved exactly in unconstrained zoom math
- near the left and right history edges, stability is improved, but small movement can still occur when viewport clamping becomes unavoidable at the dataset bounds
- sheet-strip usability from the previous pass was preserved
- sidebar pin / auto-hide / click-reopen behavior from the previous pass was preserved

## Readability / Space Balance Decisions

- this pass did not widen the sidebar or oversize controls
- the sidebar remains dense, but text is one notch larger and brighter
- sheet tabs were intentionally left alone so the roomier workbook-strip behavior from the prior pass remains intact
- chart-area gains from sidebar auto-hide remain intact

## Files Modified

- `src/components/Sidebar.tsx`
- `src/components/ChartCanvas.tsx`
- `src/engine/ChartEngine.ts`
- `src/engine/ScaleManager.ts`
- `src/styles/global.css`
- `README.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`

## Files Preserved Intentionally

- `src/components/SheetTabs.tsx`
- `src/store/chartStore.ts`
- `src/RootApp.tsx`
- all legacy `src-tauri/*` files

## Backup Location

- `D:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260402_125345_chart_workspace_ux_refinement`

## Markdown Files Updated

- `README.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `CHART_WORKSPACE_UX_REFINEMENT_REPORT.md`

## Exact Build Commands Run

- `npm run typecheck:renderer`
- `npm run typecheck:electron`
- `npm run build`
- `npm run tauri:portable:win`

## Runnable Windows Output

- output path: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable`
- launcher path: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\Launch Portable EOD Chart.cmd`
- staged executable: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\EOD Chart.exe`

## Remaining Limitations

- this pass did not add a new interactive UI automation/smoke harness, so the strongest proof remains build validation plus targeted zoom-math verification
- clamp-driven movement at the extreme left/right data bounds is still possible when the visible range hits hard history limits
- the sidebar is clearer than before, but it still intentionally follows a dense desktop layout rather than a roomy modern web-app layout
