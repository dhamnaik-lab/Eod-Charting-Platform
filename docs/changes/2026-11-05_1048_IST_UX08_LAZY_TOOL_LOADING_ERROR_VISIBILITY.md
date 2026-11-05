# UX-08 — Visible loading and errors for lazy-loaded tools

**IST:** 2026-11-05 10:48 IST (+05:30)
**Workstream:** EOD Charting Platform, `E:\TA Projects\EOD Charting Platform`
**Verified source authority:** GitHub `dhamnaik-lab/Eod-Charting-Platform`, `main` @ `787fe7c44fa08fa11176976aaf2b9975105695af`
**Isolated branch:** `fix/ux08-visible-lazy-tool-states-20261105`

## Objective and previous defect
Fourteen lazy UI tools in `RootApp.tsx` used `<Suspense fallback={null}>`, creating blank UI while a code chunk loaded. Six of those and the Command Palette were covered by `ErrorBoundary fallback={null}` and could silently disappear on rendering/import failure. Some lazy dialogs were not protected by an error boundary at all.

## Files changed
- Modified `src/RootApp.tsx`.
- Added `src/components/LazyToolBoundary.tsx`.
- Added `src/features/app/__tests__/lazyToolBoundary.test.tsx`.
- Added this change record.

## Final implementation
- A reusable `LazyToolBoundary` wraps the existing `ErrorBoundary` and React `Suspense`.
- While an existing lazy window is loading, show an accessible, named `Opening [tool]...` status.
- On lazy import or render failure, show a named, accessible `[tool] unavailable` message with an explicit **Reload application** button. This avoids claiming an ErrorBoundary-only retry can recover from React.lazy's cached rejected module import.
- All fourteen lazy windows, including the previously unguarded database/delete/recent/layout/watchlist/FAQ/keyboard/about dialogs, now use the reusable boundary.
- The existing non-lazy Command Palette keeps its ErrorBoundary but uses the existing visible default fallback instead of `null`.

## Behavior preserved
- Every existing window-open conditional and the tool's component and props.
- Startup initialization and error/retry overlay, normal tool function, window system, database operations, charting, data processing, and the accepted tools' close controls.
- No new dependencies, API changes, Rust/Tauri code changes, schema changes, production database access, or changes to Bhavcopy operations.
- The user's dirty local checkout is untouched; only the isolated GitHub branch was modified.

## Validation and results
- GitHub main source SHA and existing `AGENTS.md`, `RootApp.tsx`, `ErrorBoundary.tsx` inspected before edits — **PASS (source evidence)**.
- All fourteen lazy wrappers, absence of blank fallbacks, Command Palette error visibility, and root app structural landmarks checked on authored source — **PASS (static structural checks)**.
- Five targeted Vitest test cases added for loading status, error content/actions, loaded child behavior, fourteen tool call sites, and reload path — **CREATED, NOT EXECUTED**.
- Focused Vitest, wider renderer regressions, renderer TypeScript, Vite build — **NOT EXECUTED** on the user's Windows checkout.
- Native Tauri portable build and manual Windows visual checks — **NOT EXECUTED**.
- No tests/builds are reported as passing without actual tool output.

## Risk/limitations
- The fallback is a fixed centered panel which needs visual verification with multiple windows, small screen sizes, and all themes.
- Reloading to recover a rejected lazy import reloads the entire app; any unsaved UI state may be lost. The user must explicitly press the button.
- The default Command Palette boundary Retry is unchanged for non-lazy render errors.
- A static render test does not replace a runtime chunk-load rejection simulation or keyboard/screen-reader test.

## Validation commands before approval
Run serially in the actual EOD checkout, after verifying source reconciliation:
1. `npm run test -- src/features/app/__tests__/lazyToolBoundary.test.tsx`
2. Relevant existing UI regressions.
3. `npm run typecheck:renderer`
4. `npm run build:renderer`

The user then performs `npm run tauri:portable:win` and Windows UI smoke checks at the consolidation checkpoint. Do not blind-pull into a dirty worktree.

## Rollback
Before merge: close the isolated draft PR/branch; `main` is unchanged. After merge: create a reviewed revert PR limited to the files above. No local backups were created because no live local project files were edited.
