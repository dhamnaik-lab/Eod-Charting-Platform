# NS-04 — Opt-in native scan database-selection guard

- **IST timestamp:** 2026-11-20 15:06 IST.
- **Active project:** EOD Charting Platform, `E:\TA Projects\EOD Charting Platform`.
- **Authority:** PR #124, `arena/1a89772f-eod-charting-platform`; parent `5d4a104fa4f96e795ce3a2d7034125010bcb52cb`, accepted main `717eb6f00af96d8f717929eab2fc2d57cd7e5b6f`.
- **Objective:** Prevent native scanner results being published into a different active database's UI.
- **Previous defect:** The adapter accepted event identities unconditionally, even if database selection changed. A late success or TypeScript fallback could display results against a different database.

## Scope and implementation
- `src/plugins/scanner/nativeScannerRun.ts`: optional pinned original database path and live selection callback; compare start acknowledgement path, run ID and every event identity, including events arriving before the acknowledgement. On selection or identity mismatch, cancel and discard provisional native results without rerunning TypeScript on the newly selected database.
- `src/components/ScannerWindow.tsx`: bind the opt-in native scan to the database selected before asynchronous preparation; cancel when the selection changes/window closes; guard stale UI publication.
- `src/plugins/scanner/__tests__/nativeScannerRunNS04.test.ts`: regression tests for wrong start identity, midrun DB change, and early mismatched events.
- `HANDOFF.md`, `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`: mark the correct resume point and remaining backend HOLD.

## Behavior preserved
Native OFF by default; TypeScript scanner remains the default. Valid native runs and same-database fallback retain their current behavior. No Rust source, corporate-action projection, SQLite registry, file data, API dependencies or generated outputs changed.

## Validation / limitations
Source head and PR state verified before changes. No executable local project dependencies were accessible in the GitHub-editing environment; actual Vitest/typecheck/build results must be collected from the new PR-head Renderer CI, not inferred. No Windows runtime tests were run.

**Backend HOLD remains:** `ReadOnlyDatabaseSource::open` derives its identity from folder path + mtime, not a canonical DB revision. The native backend does not itself cancel jobs on registry selection changes, and a renderer-only path comparison cannot prove physical junction/symlink identity or capture every rapid A→B→A transition. This is a GUI safety barrier, **not** acceptance of canonical native database authority. Implement backend invalidation in a separate bounded Rust change after verifying a real Rustfmt pre-publication check (required by `AGENTS.md`).

**Other open gates:** Windows shared Cargo, portable UI, disposable DB acceptance and the Linux-excluded identity-import test.

## Rollback
Revert only this scoped commit with approval, keep native execution OFF and preserve all local protected files. No user data changes or restoration are necessary.

## Next step
Check new-commit Renderer CI, then obtain a Rust toolchain and close the authoritative backend identity/cancellation issue before merging PR #124.

## Hosted CI on implementation commit `cc29bae0d7592b0ad2e73fa4241eccf0478c16f3`

The code-bearing commit passed all three independently inspected GitHub Actions workflows:

| Workflow | Actual result | Run ID |
|---|---|---|
| Renderer CI | PASS — 285 files passed / 1 skipped; 2,012 tests passed / 1 skipped; renderer typecheck PASS; Vite production build PASS (849 modules) | `44712912386` |
| Rust Scanner Rustfmt CI | PASS — all 16 scanner/native Rust modules enumerated | `44712912330` |
| Rust Compile and Test CI | PASS — Cargo check; native scanner 101 passed; RSC 18 passed; full crate 1,390 passed, 26 ignored, 1 filtered, 0 failed | `44712912402` |

The filtered Linux test is `database::nse_identity_imports::tests::resolves_standard_archive_paths`, retained for Windows acceptance. These results validate **the implementation commit**; this documentation-only follow-up does not alter source. They do not establish a canonical backend DB revision token, native registry-switch cancellation, Windows runtime or portable acceptance.
