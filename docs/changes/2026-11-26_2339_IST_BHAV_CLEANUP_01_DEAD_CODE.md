# BHAV-CLEANUP-01 — Dead-code cleanup

- IST: 2026-11-26T23:52:34.974355+05:30
- Source authority: `cef2a4a72a52ba50846231183b4a4a5e90889c6b` plus accepted local PERF-02 documentation closeout `0360BDF7F8210839E271760C18FB9A08931F49A9C924665C4969DEBB646DDC29`.
- Objective: eliminate eleven observed Rust dead-code warnings without changing runtime behaviour.
- Previous limitation: 11 release warnings, 3 test warnings.
- Implementation: Removed unused DownloadTask.mode and its 12 literal assignments; removed now-unused internal fallback/history-generator mode arguments. Deleted unreferenced create_holiday_skip_result and load_imported_trade_dates. Restricted seven test-only helpers and MAX_BHAVCOPY_PREFILTER_WORKERS to cfg(test); all tests retained. Active download mode in BatchDownloadConfig, calendar decisions, source admission, coverage receipt checks, binary data writes, recovery, checkpoint policy and worker limits unchanged.
- Files changed:
  - `src-tauri-shell/src/bhavcopy/bse_browser_fallback.rs`
  - `src-tauri-shell/src/bhavcopy/calendar.rs`
  - `src-tauri-shell/src/bhavcopy/index_fallback.rs`
  - `src-tauri-shell/src/bhavcopy/index_fallback/tests.rs`
  - `src-tauri-shell/src/bhavcopy/ingestion.rs`
  - `src-tauri-shell/src/bhavcopy/mod.rs`
  - `src-tauri-shell/src/bhavcopy/sources/nse.rs`
  - `src-tauri-shell/src/bhavcopy/tests.rs`
  - `src-tauri-shell/src/bhavcopy/types.rs`
  - `HANDOFF.md`
  - `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
  - `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`
  - `docs/changes/2026-11-26_2339_IST_BHAV_CLEANUP_01_DEAD_CODE.md`
- Validation: canonical explicit-file Rustfmt PASS; `bhavperf02_` 3 passed / 1 ignored; `bhavcopy::` 207 passed / 5 ignored; `bhavcopy_recovery::` 19 passed; `database::binary_eod::` 29 passed. 255 distinct regression passes; all zero failures. `cargo check --release --offline --locked` through shared wrapper PASS, no warning lines. Operator benchmark (ignored) not repeated.
- Protected accepted portable SHA-256: `36187516702E2E1E03EE4A1AEB749AFEC6591A77B68B294FA73B04929C8C9662`. No DB access, Git mutations or new release artifact.
- Risk: a real optimized executable build and manual smoke test remain pending; no new performance or full exchange-source parity claim.
- Rollback: with owner approval and app closed, restore only exact affected files from `E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20261126_233920_BHAV-CLEANUP-01-20261126-233919-529422`; remove only this newly created change record if rolling back. Do not restore database or clean targets.
- Evidence: local validation log and source inventory in `E:\TA Projects\EOD Charting Platform\tmp\BHAV-CLEANUP-01-20261126-233919-529422`; publication and CI remain pending.

## Final acceptance — 27 November 2026, 02:03 IST

**Status: PASS for the bounded dead-code cleanup.** Owner approved documentation closeout. Earlier validation-stage statements above are historical and superseded by the following results.

- PR #146 merged at `f2398acac9b3d8394d8df0000f8518aac93320e3`; tree `f4391b3b5b66f11489bb98bf79c77cb893a872ba`. Candidate `bb7eed10f8fa6468259b1a18bfd16b5f3aa39c01`. Renderer CI #231 and Rust Compile and Test CI #47 passed. Local synchronization verified 14 candidate files with no worktree replacements; protected local Cargo.toml/build metadata preserved at synchronization.
- Validation: 255 distinct regression passes (207 Bhavcopy, 19 recovery, 29 binary EOD; 3 focused tests overlap). Five Bhavcopy tests intentionally ignored. Rustfmt, release-profile check, documentation references and CI passed. Actual optimized Rust build 3m42s, Vite renderer 6.84s, standard portable packaging passed. Zero compiler warnings, no warning suppression.
- Accepted build `20261127.014028` / `2026-11-27T01:40:28+05:30`; executable SHA-256 `67BDAAC606A0DA0FD3D44A28661586B8EE7F7A78D11D303449CE859EDA29DC17` matches the compiled binary. Previous PERF-02 portable retained at `E:\TA Projects\EOD Charting Platform\tmp\BHAV-CLEANUP-01-Build-20261127-014027-691940\Prior-PERF-02-Portable`; previous SHA-256 `36187516702E2E1E03EE4A1AEB749AFEC6591A77B68B294FA73B04929C8C9662`.

### Native smoke (operator-provided application log)

Date Range 2026-11-26 through 2026-11-26, all four exchanges, two workers. Test instructions specified New Database and Force download OFF; the pasted log does not independently establish the selected database path, force setting or executable identity. The bounded no-op workflow is accepted, not a separate chart/UI acceptance or full physical database comparison.

| Exchange | Files scanned | Reconciliation |
|---|---:|---:|
| NSE | 3,598 | 1,299 ms |
| BSE | 5,126 | 1,971 ms |
| NSE Index | 137 | 64 ms |
| BSE Index | 79 | 25 ms |
| Total | 8,940 | 3,359 ms |

All four already-imported dates recognized; zero eligible download dates, zero jobs, zero imported rows, zero failed jobs, no new quotation writes and no new checkpoint, as reported. Log timestamps 02:03:48–02:03:51 (approximately 3 seconds); summed reconciliation timings are not an independent wall-clock benchmark. No fresh-source or write-path exercise in this smoke. Existing regression and PERF-02 native evidence remain the basis for broader preservation; prior external source failures, 17 held source rows and unmet monthly planning target remain open, not newly verified by this smoke.

### Evidence and closeout scope

- Validation ZIP SHA-256 `D13750FDAA5940B6ADD794133006089E972E88DC45AA8C3EF31C8F67E15EAA0F`.
- Publication receipt SHA-256 `F9C2BC8268F85DD3FA07F5D50A4975C2614081C80CF4A10E827F6CBC7D9082A7`.
- Main synchronization receipt SHA-256 `348F416F54540DAA94EF2B307B310F896BD9CE588137BB4649B1E9EBD156F01D`.
- Build evidence ZIP SHA-256 `DFCCD1F55D6C983DD4B91A1F89A369476601926E6811DD49C68A815E0088B6EE`; BUILD.log `4D7420ACDEC7522A7C24F84577CA1F801101CDAB2D16E21C50290A4B5D5F1FAD`; PACKAGE.log `8009CBA6813F989D96D8D1DF917B0F9A6312533BE57423BE13534524FD02D199`.
- Smoke transcript reproduced from the owner's chat message, UTF-8/LF with final newline, SHA-256 `12832BA96A75B7D98FE091433F00DB3DDF7CB33CCB25213860D0861C6389EFC4`. Included in closeout evidence, not a separately authenticated on-disk application log.
- Documentation application timestamp IST: 2026-11-27T02:18:38.558383+05:30. Four documents only (this record and the three trackers). No source changes, database access, Git mutations, dependencies or rebuild. Production EOD Database and RECOVERY-01B remain HOLD. Publication of this final documentation delta is separate; no next implementation started.
- Rollback of this documentation-only closeout: restore the four original document bytes from `E:\TA Projects\EOD Charting Platform\backups\BHAV-CLEANUP-01-Closeout-20261127-021838-558383` after owner approval. Runtime rollback, if needed, requires separate approval and use of the retained prior portable after hash verification; never restore a database as part of this documentation rollback.
