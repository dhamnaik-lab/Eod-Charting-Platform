# BSE native WebView2 collection proof — 24 October 2026

## Result

PASS for a bounded native source-collection proof: the application's installed
WebView2 engine collected 13 BSE Corporate Actions rows for 23 October 2026.
The final explicit live test passed in 3.55 seconds including window/profile
cleanup. It opened no database and performed no import, approval or price write.

This demonstrates a working native browser collection path where direct HTTP
was refused. It does not establish the exchange's precise access-rule cause or
full historical completeness, and does not enable a production fallback yet.

## Evidence

- Final capture: `outputs/bse-webview-proof-XJYYql/response.json` (3,893 bytes).
- Manifest: `outputs/bse-webview-proof-XJYYql/manifest.json` (13 rows; exact URL,
  date scope, hash, no-database/production-disabled flags, successful cleanup).
- SHA-256: `1ddcbbc8dc1b9f7b4a0de35a95752dbf1a2ff913912ce0a2d047bff5ee570c70`.
- Exact API: DefaultData/w, Fdate/TDate=20261023, equity segment, ex-date scope,
  no scrip/industry/purpose filter, strSearch=S.
- Captures from two preceding runs also contained 13 valid rows, but those test
  runs failed profile-cleanup assertions. Their original manifests are retained
  in `outputs/bse-webview-proof-YiToxI` and `outputs/bse-webview-proof-013Djh`.

## Implementation and boundary

- New `src-tauri-shell/src/database/corporate_action_imports/bse_browser_proof.rs`.
- Parent module includes it only under `cfg(all(test, windows))`.
- Cargo.toml/Cargo.lock expose the already locked WebView2/windows crates as
  Windows-only development dependencies; no production dependency was added.
- Independent Tauri test runtime: no main window, app setup, plugins, custom
  command handler or database initialization. A temporary browser profile and
  distinct window label are used. Existing capability configuration is unchanged.
- Native WebView2 settings disable web messaging, host objects, script dialogs
  and devtools. Permissions are denied; pop-ups/downloads are denied. Request
  interception permits only the official page/assets and the exact dated API
  request. Unexpected top-level navigation fails the proof.
- On page completion, native evaluation sends an ordinary browser fetch to the
  requested API. Response bytes are captured by native response/GetContent events;
  no JavaScript-to-Tauri result channel or cookie extraction is used.
- Bounds: one to seven calendar days, 60-second collection timeout, 8 MiB accepted
  body limit. The response must be HTTP 200, a nonempty array, contain official
  six-digit security codes and purpose text, and have every ex-date in scope.
  Duplicate/missing/extra query parameters, wrong dates and origins cannot match.
- Completion accepts one terminal result. Window close/cancellation/timeout fail;
  callbacks are stopped/unregistered and the window is destroyed. Profile cleanup
  waits up to ten seconds for native file handles, against a verified owned temp
  directory only.

Backup: `backups/pre_opencode_changes_20261024_113441_bse_webview_proof`.
Existing dirty edits, including main.rs, were preserved.

## Checks

- PASS — `cargo test --manifest-path src-tauri-shell/Cargo.toml bse_browser_proof --offline -- --nocapture`:
  5/5 focused tests, live test ignored by default. Final compile/link: 26.18 seconds.
- PASS — `cargo test --manifest-path src-tauri-shell/Cargo.toml bse_browser_proof_live --offline -- --ignored --nocapture --test-threads=1`:
  1/1 actual WebView2 test; final manifest reports profileCleanup Ok.
- Initial compile found a completed-handler type mismatch; corrected against the
  installed WebView2 callback API. Initial live runs exposed asynchronous profile
  release and tempfile's wrapped OS errors; bounded cleanup retry now passes.
- PASS — scoped rustfmt check of the new proof module and git whitespace check
  of touched tracked source/manifest files. Final response SHA-256 matches its
  manifest; no proof-profile WebView2 process remained in the final process check.
- No renderer check was needed: this proof changes no renderer source. No full
  suite, app/portable build, packaging, commit or push was run.

## Remaining work

Promoting this test-only collector into Fetch still requires production lifecycle
integration and tests for history windows, empty periods, partial/truncated feeds,
user cancellation during native navigation, and safe source-provenance/coverage
recording. A successful single-day response is not approval to mark 1990–2026
complete. Explicit financial approval and raw EOD immutability remain unchanged.

Two temporary profiles from failed runs remain:
`C:\Users\dharm\AppData\Local\Temp\eod-bse-proof-profile-DrGZOq` and
`C:\Users\dharm\AppData\Local\Temp\eod-bse-proof-profile-jg7iX6`.
No associated browser processes remained when checked. A cleanup command targeting
the first profile was rejected by automatic approval review with "blocked by
policy" and no more specific reason. No alternate deletion was attempted. The
final passing run's own profile was removed by its normal verified cleanup.
