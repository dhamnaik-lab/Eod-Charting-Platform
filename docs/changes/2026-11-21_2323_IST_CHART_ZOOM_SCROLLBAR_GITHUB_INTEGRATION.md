# Chart wheel zoom / horizontal scrollbar — GitHub integration

- **IST timestamp:** 2026-11-21 23:23 IST (UTC+05:30)
- **Workstream:** `E:\TA Projects\EOD Charting Platform`
- **GitHub base:** `main` at `143f17e26af55714ac284a7da407390f4fa00dc8`
- **Branch:** `fix/chart-wheel-right-anchor-scrollbar-sync-20261121`
- **Bounded objective:** Integrate the two verified local chart corrections without bringing unrelated dirty-worktree files, affecting the native scanner, or modifying the database.
- **Local source authority:** `Eod Charting Platform Source Code 2026-11-21_231811_IST.zip` (user-supplied, source hashes independently checked against 2026-11-21 read-only PowerShell preview).

## Previous limitation
- Mouse-wheel zoom passed a cursor X index and the `'cursor'` anchor to `zoomViewport`, causing the rightmost visible bar to shift rather than retaining the previously accepted right-edge anchor.
- The horizontal scrollbar rounded fractional chart span/start calculations and did not consistently target the intended chart tab for drag/button interactions, with thumb-sync friction and incomplete right-edge scrolling.

## Files changed
- `src/engine/ChartEngine.ts`
- `src/components/ChartCanvas.tsx`
- This new change record.

The existing local `docs/changes/2026-11-21_1915_IST_CHART_WHEEL_ZOOM_AND_SCROLLBAR_SYNC.md` remains untracked in the user's local worktree and was deliberately **not added** to this GitHub branch, avoiding a conflicting path during local reconciliation. Existing local edits to `HANDOFF.md` and `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md` were not overwritten or published.

## Final implementation
1. Restore right-edge-anchored mouse-wheel zoom in `ChartEngine.onWheel`, preserving Shift+wheel pan, price/indicator wheel scaling, and `ScaleManager.zoomViewport`'s optional cursor-anchor behavior.
2. Use exact fractional viewport span/future margin/start calculations for scrollbar mapping; round only the virtual scrollbar content width to integer pixels. Preserve the existing pixels-per-bar minimum and integer navigation step sizing.
3. Activate the intended tab on bottom-bar mouse-down, wrap the bottom navigation controls with `runForChart`, and pass `tabId ?? undefined` plus the unrounded start to `scrollToViewportStart`.

## Evidence
- Source ZIP `ChartEngine.ts` SHA-256: `A866C3580FBC3A0CAD2F9D45C4DBBF3582D38B232797BB647BEF2B145C77AE07`.
- Source ZIP `ChartCanvas.tsx` SHA-256: `02A994898CCCFE29D24BEF6A332EA2A77A618706924B2FEBD835A8A3C6F3145C`.
- Expected normalized Git blob SHA-1 after integrating the exact local source:
  - `ChartEngine.ts`: `a06cdf0ca8cfc484e8a5a26ef44a310e735122af`
  - `ChartCanvas.tsx`: `b698e6651b4e9b83d0908837175eb45e70dcc862`
- Read-only comparison of the GitHub baseline and the ZIP confirmed the exact two-file candidate; `src/engine/ScaleManager.ts` already matches the GitHub baseline after normalizing CRLF to LF.

## Validation performed and limitations
- **2026-11-21 local validation as recorded in the user's original change note** (not rerun in this integration): `npx.cmd vitest run src/engine/__tests__/ScaleManager.test.ts src/components/__tests__/ScannerChartRouting.test.ts` — recorded PASS (22/22); `npm.cmd run typecheck:renderer` — recorded PASS; `scripts/check-doc-references.ps1` — recorded PASS.
- **This integration:** SHA-256 match of both ZIP files to preview-reported local sources; pinned GitHub base verified; exact candidate blob SHA-1 compared to uploaded local source, and GitHub update responses confirmed the same final blob SHAs.
- **Not performed in this integration:** new Vitest run, typecheck, renderer/Tauri build, portable packaging, or Windows manual acceptance. These remain pending and should not be represented as passed.
- No application run, database access, local Git writes, backup restore, reset, stash, clean, checkout, or main-branch update occurred in this GitHub integration.

## Preservation / risks
- Native Rust and TypeScript scanner code, database storage, chart indicators, chart settings, existing tested `ScaleManager` cursor-anchor API, and unrelated workstreams remain untouched.
- Existing 12 dirty-worktree entries and three accepted portable artifacts were not changed by these remote-only GitHub operations; their current local state was not independently rechecked after the initial read-only preview.
- **Important:** The two source files remain modified in the local worktree. Do **not** merge/pull the draft PR into that worktree without a deliberate, hash-verified reconciliation of the existing local changes and untracked chart change note.

## Rollback
- Do not merge the PR if validation or acceptance fails. The base `main` source remains unchanged. If merged later, revert only the relevant chart-source commit(s) after verifying the actual repository state, preserving all unrelated changes. The user's recorded pre-edit backups provide an additional local reference but are not to be restored automatically.
