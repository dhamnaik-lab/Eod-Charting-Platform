# BSE automatic official fetch — 24 October 2026

## Result

The previously test-only native WebView2 collector is integrated into normal BSE Fetch Official. Direct HTTP is tried first; a failed direct response switches the current session to browser collection. It does not repeatedly retry HTTP 403 or depend on manual CSV acquisition. This supersedes the production-pending status in the earlier WebView proof report.

Missing BSE coverage is fetched in windows of at most seven calendar days. Successful windows are persisted individually; normal Fetch resumes uncovered dates. Force Re-fetch intentionally downloads covered dates again. Both official-fetch UIs expose Cancel Fetch and stop before starting the next exchange. Rows already stored remain available, but a cancelled/failed window does not receive successful coverage.

Fetch still only collects review candidates. Load & Validate and deliberate Approve Ready remain separate. No financial approval, canonical adjustment, raw EOD, or live database changes were performed by this implementation/test run.

## Implementation scope

- Backend: `corporate_action_imports.rs`, new `bse_fetch.rs`, former proof collector promoted to `bse_browser.rs`, cancellation export/command registration in `database.rs` and `main.rs`, Windows native dependencies promoted from dev-only in Cargo.toml.
- Platform bridge: desktop types, platform types and Tauri adapter.
- UI: legacy official-fetch dialog and normal workflow workspace/adapter; adapter cancellation tests.
- Documentation: this report and a short HANDOFF checkpoint. Existing unrelated dirty-worktree changes were preserved; no commit or package build.

The collector uses an isolated incognito WebView and dedicated app-cache profile (`bse-official-source`), not the user's browser or main app profile. The profile directory remains app-owned because the WebView environment can outlive an individual collection window.

The remote window has no result/command IPC bridge. Permissions, popups and downloads are denied; resource URLs and the requested BSE API/date parameters are constrained. Captured HTTP 200 JSON is validated for shape, row dates and identifiers; a valid empty array is accepted, while HTML/refusal/malformed/out-of-window data is rejected. Body limit: 8 MiB. Native setup/cancellation is acknowledged before teardown to avoid a creation/cleanup race discovered during live testing.

Raw response bytes and SHA-256 manifests are created without overwrite and synced before row import/coverage. Production captures live under the app-data directory's `official-source-captures/bse`. The existing official source URL, BSE_API provenance and identity mapping are preserved.

## Validation

All checks were serial. PASS:

- `cargo test --manifest-path src-tauri-shell/Cargo.toml corporate_action_imports::bse_ --offline -- --nocapture`: 10 passed, 2 opt-in live tests ignored.
- `cargo test --manifest-path src-tauri-shell/Cargo.toml bse_action_transport --offline -- --nocapture`: 3 passed, 1 live test ignored.
- `cargo test --manifest-path src-tauri-shell/Cargo.toml bse_fetch_production_live --offline -- --ignored --nocapture --test-threads=1`: 1 passed, using the production fetch/store/coverage path with isolated in-memory SQLite and native WebView2.
- `cargo check --manifest-path src-tauri-shell/Cargo.toml --offline -q`: passed; existing unused/dead-code warnings remain outside the new BSE modules.
- Scoped `scripts/validate-change.ps1 -Profile renderer -Paths ...`: renderer typecheck and whitespace passed.
- Focused Vitest: normal workflow adapter, legacy official fetch improvements and independent-windows fetch: 27 passed across 3 files.
- `rustfmt --check --edition 2021` on the two new BSE modules: passed.

Live receipt: `outputs/bse-production-fetch-pDxRuo/manifest.json`; immutable response captures/manifests are in its `captures/` directory.

| Live case | Measured result |
| --- | --- |
| 2026-10-15 to 2026-10-24 | 33 rows across two windows |
| Repeat same ten days | Ten cached days; no additional captures |
| 2016-03-01 to 2016-03-07 | 3 rows |
| 1990-01-01 to 1990-01-07 | Valid empty response, 0 rows |
| 2026-10-25 | Valid empty response, 0 rows |
| Cancellation during another native window | No coverage for cancelled window; browser closed |
| Financial state | 0 approved source rows; 0 canonical actions |

Earlier attempts are retained, not presented as passes: `GRgcMR` was incomplete because the test host implicitly exited between windows; `w5nO3d` and `zyq6Jg` exposed cancellation cleanup failure. The final run passed after fixing fixture exit handling and native initialization/teardown ordering; its temporary profile cleanup also passed. Earlier temporary profiles may remain; no broad cleanup was attempted.

## Remaining limits / operator next step

Rebuild the app, then exercise BSE-only normal Fetch for a recent short period before a full-history request. Normal desktop button/progress/cancel interaction has not been manually accepted in the rebuilt application. The full 1990–2026 dataset was not downloaded or proven complete; thousands of windows can take substantial time, and BSE can still refuse browser requests. Cancellation of an in-flight blocking direct request waits for its safe request boundary. Advanced scrip-specific backfill remains on its existing direct route. No full test suite, release/portable build or live-database migration was run.
