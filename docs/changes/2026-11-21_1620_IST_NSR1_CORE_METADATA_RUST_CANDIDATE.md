# NS-R1 Rust core metadata candidate — formatted and focused-validated

- **IST:** 20261121_162048_IST (UTC+05:30)
- **Workstream:** E:\TA Projects\EOD Charting Platform
- **Previous limitation:** The native V1 numeric engine returned only rule ID/date/value; accepted core OHLCV scanner metadata was missing, so candidate rules remained TypeScript-routed.
- **Source authority:** main 48da280cb37eeeef0e564e1c70b9db20f76bf567; existing PR #128 parent d403bcea5da4206248002f917e6cefd5d95c1a80.
- **Source package:** 301C6077EAED4839BFDB454F7A636847A6B86F25E86AC07B3BBFE01B8AC389E3 (LF-normalized candidate ZIP).
- **Files changed:** src-tauri-shell/src/native_scanner/core_results.rs, src-tauri-shell/src/native_scanner/scan.rs, src-tauri-shell/src/native_scanner/mod.rs, src-tauri-shell/src/scanner_contract.rs; this record, HANDOFF.md and NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md.
- **Implementation:** Exact predicate identity gate and complete match metadata (scanner/category/direction/reason/source, numeric fields), explicit null scalar for optional ratios, latest-only core behavior until history parity, and new Rust fixture tests for ten core IDs.
- **Preserved:** Original four native gap routes; TypeScript default/fallback; scanner results UI; alerts; plugin execution; read-only scanner; CA-01 adjusted-native HOLD; no live database or raw EOD writes.
- **Validation:** Windows rustfmt --edition 2021 --check on four LF candidate files PASS; isolated npm run build:renderer PASS (for Tauri compile-time frontendDist); Cargo check --offline --locked --tests PASS; cargo test native_scanner::core_results PASS; cargo test native_scanner PASS; executed against isolated PR source archive with shared project-root target. Entire CI, cross-language metadata-value parity and Windows portable acceptance PENDING.
- **Risk:** Numeric metadata values and human-readable reasons require independent TypeScript/Rust semantic parity; exact user-visible native routing still disabled. Changing ScannerScalarValueV1 to admit null may have other uses; focused regression passes do not establish universal parity.
- **Rollback:** Revert the one scoped PR commit; never reset or clean the user's active Windows worktree. Source package and temp fixture retained.
- **Next:** Verify GitHub PR head CI; run broad Rust regressions if required, then independent TS-Rust value/reason parity before enabling ten core selections. No merge or native activation authorized.