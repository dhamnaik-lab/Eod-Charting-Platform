# 2026-11-09 03:25 IST — Windows CRLF source-inspection tests

## Objective
Make two source-text inspection tests independent of the checkout's LF, CRLF, or CR line endings.

## Previous defect / limitation
On Windows, the clean audit-main worktree at `ebb43ab4c7d52babfb9694f2e7f7da77cbe28c6c` checked out `src/engine/Renderer.ts` and `src/RootApp.tsx` with CRLF line endings. Two Vitest source-inspection assertions used literal LF-containing strings without normalizing the text, so the Windows run failed despite the expected source structure being present.

## Files changed
- `src/engine/__tests__/DrawingD3C1Contracts.test.ts`
- `src/features/app/__tests__/sidebarRegionBoundaryB19.test.tsx`
- `docs/changes/2026-11-09_0325_IST_WINDOWS_CRLF_SOURCE_INSPECTION_TESTS.md` (this record)

## Final implementation
Each test file normalizes source text with `replace(/\r\n?/g, '\n')` before matching multiline source-structure fragments. Each includes a focused test proving identical normalization for LF, CRLF, and CR input. Existing rendering/Sidebar assertions remain in place.

## Behavior preserved
No production code, UI behavior, chart rendering, Sidebar fallback, Rust/Tauri behavior, database formats, runtime dependencies, or persistence behavior is changed. Only test source inspection is made line-ending agnostic.

## Validation commands / results
Windows audit-main baseline, 2026-11-09 (user-supplied output):
- `npm ci --offline`: **PASS**, 107 packages added.
- `npm test`: **FAIL**, 1,651 passed; 2 failed; 1 skipped. Failing tests were DrawingD3C1 contracts and Sidebar B19 boundary.
- Windows CRLF checks for both files: `CRLF=True`, `RawMatch=False`, `NormalizedMatch=True`.
- `npm run typecheck:renderer`: **PASS** (before this change).
- `npm run build:renderer`: **PASS**, 814 modules, 5.46 s (before this change).
- Windows original 117-file worktree and audit-main clean checkout: **PRESERVED**, per user validation.
- Initial code head `76e7317b48183cfafb3523f29359f33e9e8482b6`: GitHub Actions [Renderer CI #42527690214](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42527690214) **PASS**:
  - `npm ci`: **PASS**.
  - `npm test`: **PASS**, 1,655 tests passed, 1 skipped, 0 failed (247 test files passed, 1 skipped); includes the new LF/CRLF/CR normalization regressions.
  - `npm run typecheck:renderer`: **PASS**.
  - `npm run build:renderer`: **PASS**, 814 modules transformed, Vite built in 5.45 s.
- Final documented PR-head CI following this validation-record update: **PENDING**; check the final commit's own workflow run before merge approval.

## Risks / limitations
The tests remain source-layout assertions. Future intentional formatting of the relevant JSX or drawing-label calls can require separate assertion updates. Native Windows/Tauri, portable package and manual runtime acceptance are not covered by this test-only change.

## Rollback
Revert this bounded test-only commit, restoring the exact pre-change GitHub `main` versions of both test files. No production data migration is required.

## Evidence / source authority
- GitHub `main` commit: `ebb43ab4c7d52babfb9694f2e7f7da77cbe28c6c`.
- Git tree: `dedb89fe63191aa879cf04a1bff58b64fb682f1d`.
- Test source blobs before change: `62d54daf84d3177d9cedce6c10bbd13c42e6e93e`, `b0bf65d87b0ff4d411458cc4d4aee11dec679c14`.
- User Windows evidence: `EOD_AUDIT_MAIN_RENDERER_20261109_025702_IST`, CRLF check and renderer typecheck/build console outputs.
- Local WIP baseline and backup are separate; no local source edits were authorized.
