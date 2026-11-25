# BHAV-01 — Download outcome and import integrity (unpublished candidate)

Timestamp: 2026-11-24T18:34:33+05:30 (IST). Base: `eaaea26d86f66e6ae3f08cac89282bae2e7a569e`. Candidate branch: `fix/bhav-01-download-integrity-20261124`.

## Objective and previous defects

Resolve BC-02/06/07/08/09/11/12 from BHAV-AUDIT-01. Previously, failed downloads could become successful holiday skips; malformed/HTML/ZIP/date-mismatched candidates could hide failures or stop source fallback; single-date retries deleted successful history; refresh failure could hide committed imports; logs conflated coverage with attempts; diagnostic entries inflated planned-job counts.

## Candidate implementation

- Typed `DownloadOutcome` with diagnostic marker and optional follow-up warning. Transport absence is not a storage coverage certificate. Discovery/linked-file 404, HTML, bad JSON structure, wrong filename/date, invalid ZIP and unusable CSV are treated conservatively. A candidate-local rejection continues eligible alternatives, while storage errors do not restart candidate import. BSE browser fallback shares the existing filename/date/base allowlist. Existing source candidate order, retry limits and 128 MB ZIP-entry limit retained.
- Removed unconditional holiday failure reconciliation. Only explicit `ConfirmedAbsent` is eligible for informational saved-calendar annotation; existing calendar pre-skips and Update cutoff are not redesigned here (BHAV-02).
- Preserve successful coverage log on single-date retry using existing batch preservation helper; report replacement row writes. Add `bhavcopy_download_attempts` (latest terminal outcome, rows written, message, timestamp, exchange/date key) through additive bootstrap schema. Existing rows are not converted into invented historical attempts. Latest-attempt recording is separate from price/recovery writes; persistence failure returns a visible warning. Calendar skips, already-present checks, and diagnostics are not new source attempts. Automatic retry and authoritative coverage reconciliation are BHAV-03.
- Keep archive/history request diagnostics visible without counting them as completed planned jobs. Final terminal result per planned exchange/date, unresolved NSE Index outcome when no final import is returned; explicit cancellation for known staged jobs not completed. No full-exchange coverage certification from supported historical subset. Calendar skips separately counted. Returned results own renderer summary; runtime events deduplicate.
- Post-import invalidation, snapshot, notification and single-date renderer refresh errors surface separately from import outcome. Checkpoint scheduling remains ahead of post-import reporting. Warnings do not mark the import as failed. Recovery errors remain errors.

## Files changed

- `src-tauri-shell/src/bhavcopy/bse_browser_fallback.rs`
- `src-tauri-shell/src/bhavcopy/calendar.rs`
- `src-tauri-shell/src/bhavcopy/index_fallback.rs`
- `src-tauri-shell/src/bhavcopy/index_fallback/tests.rs`
- `src-tauri-shell/src/bhavcopy/ingestion.rs`
- `src-tauri-shell/src/bhavcopy/mod.rs`
- `src-tauri-shell/src/bhavcopy/parsers/json.rs`
- `src-tauri-shell/src/bhavcopy/tests.rs`
- `src-tauri-shell/src/bhavcopy/transport.rs`
- `src-tauri-shell/src/bhavcopy/types.rs`
- `src-tauri-shell/src/database/bootstrap.rs`
- `src/components/BhavcopyDownloadWindow.tsx`
- `src/components/__tests__/BhavcopyDownloadRerun.test.ts`
- `src/features/bhavcopy/__tests__/fallbackProgress.test.ts`
- `src/features/workspace/chartRuntimeController.ts`
- `src/store/bhavcopyStore.ts`
- `src/types/desktop.ts`
- `HANDOFF.md` (candidate resume note only; prior entries preserved)
- `docs/changes/2026-11-24_1834_IST_BHAV01_DOWNLOAD_OUTCOME_INTEGRITY.md` (this record)

## Preserved behavior / boundary

No new dependency, live downloads, actual EOD database access, release or portable build. No changes to binary layout, identity admission rules, supported index set, canonical leases, recovery state transitions, deferred APPEND_NEWEST policy, actual 2-worker write/2-worker checkpoint limits, or calendar refresh UI. Full History memory and worker policy are separate findings. The existing general import failure/recovery workflow remains authoritative; if a batch aborts before producing terminal results, no complete attempt ledger is guaranteed for all jobs. A future retry planner must not infer complete coverage from a terminal result or from missing attempt records. Existing manual calendar provenance limitations remain until BHAV-02. No synthetic holiday dates added.

## Actual validation

- Uploaded archive SHA-256 `EB4B5265989F75BCA01B66A506F3F09A5C8BB35AF4F338A867FC5F89093ED3E2` matched; archive comment pins exact base commit.
- Six initial patch files' LF-normalized Git blob SHAs matched GitHub. Original patch applies against normalized scratch files; raw CRLF archive causes context mismatch.
- Consolidated candidate diff applied to normalized scratch baseline, result compared byte-for-byte (LF) against candidate replacement inventory; whitespace check run (see package `VALIDATION.txt`).
- Six changed TS/TSX sources: actual TypeScript transpile diagnostics PASS (not semantic typecheck).
- Actual transpiled Zustand store executed with mocked dependency wiring: diagnostics, duplicate results, partial/failed/absent outcomes, cancellation, calendar skip and follow-up warning smoke PASS (not Vitest).
- Actual new SQL DDL and UPSERT extracted from Rust source executed on an in-memory synthetic SQLite fixture: idempotent creation, latest error and absent outcome retained, original successful coverage row unchanged — PASS (not Rust execution).
- New focused Rust/renderer regression definitions added; **not executed** here. No Rust toolchain or PowerShell executable in editing environment; Rustfmt, Cargo, Vitest, full TS typecheck, renderer build, native acceptance and package publication are pending.

## Risks / close gates

This is an unpublished **candidate**, not a verified implementation. Actual exchange response semantics, historical filename formats, migration on a Windows test fixture, cancellation/reporting under the desktop harness, real compiler behavior, formatter baseline, and full regression compatibility need validation. Keep `main` unchanged. Run actual Windows formatter check first; do not publish if any gate fails. Do not access/download into production EOD DB without separate permission. Native and portable acceptance belongs to owner. Global architecture/phase tracker updates at validation/closure; those files were not included in the supplied snapshot.

## Rollback

Before applying, use the provided exact-path backup guard and verify scope. Do not roll back a DB by deleting the additive table; existing coverage remains intact, and the unused new table is backward-compatible. Restore only the candidate paths from the verified backup on explicit authorization, remove the new change record only if exact hash matches; keep unrelated work and local main untouched. No automatic reset, clean, stash, commit, push, or merge.

## Formatter correction evidence — 2026-11-24 19:34 IST

- Initial Windows canonical Rustfmt check failed (exit 1); candidate and protected hashes and Git whitespace check passed. No tests ran.
- Isolated Windows Rustfmt `rustfmt 1.10.0-stable (b940084d7e 2026-09-28)` ran `rustfmt --edition 2021 <original changed Rust files>` (exit 0), followed by `rustfmt --edition 2021 --check <18 final changed Rust files>` (exit 0). Evidence ZIP SHA-256: `320DB249B4EDD97597BB4B898C73E14D3EF0945FF529AED1E47CECF3F68797BD`.
- Independent review matched the 19 original candidate hashes and 15 formatted hashes against the original manifest and baseline snapshot. Lexical comparison showed only formatting punctuation and import ordering differences; not a semantic compiler check.
- Seven inherited formatting-only paths, required by recursive canonical Rustfmt: `bhavcopy/batch_runtime.rs`, `bhavcopy/holiday_sync.rs`, `bhavcopy/parsers/csv.rs`, `bhavcopy/parsers/mod.rs`, `bhavcopy/settings.rs`, `bhavcopy/sources/bse.rs`, `bhavcopy/sources/nse.rs` (all beneath `src-tauri-shell/src/`). No intentional behavior changes. Original candidate scope expands from 19 to 26 files only for this formatter requirement.
- Active-checkout canonical formatter, Cargo tests, renderer checks, native acceptance and publication remain pending. Re-run serial validation on the exact final inventory. Preserve the two local build files. Retain exact pre-format backups; do not restore automatically.

## Windows automated validation — 2026-11-24 (IST)

**Supersedes the pending automated-validation entries above.** User-provided Windows console transcript SHA-256: `7367D51713924038F94CFB233BE7FCEBE52DABC0B60C527911CD59EB99B9E739`. Transcript retained with the publication evidence in `tmp`, not in docs. Candidate branch `fix/bhav-01-download-integrity-20261124`; base `eaaea26d86f66e6ae3f08cac89282bae2e7a569e`.

- Guarded formatter application: PASS, exact 26-file inventory; protected local files and local main unchanged. Pre-format backup: `backups/pre_opencode_changes_20261124_195250_572_bhav01-rustfmt`.
- `git diff --check`: PASS. `rustfmt --edition 2021 --check <18 changed Rust files>`: PASS.
- Shared Cargo wrapper Preview/Run, `cargo test --offline --locked ... bhav01_`: PASS (12 passed, 0 failed); `cargo test --offline --locked ... bhavcopy::`: PASS (180 passed, 0 failed, 4 ignored). The focused tests overlap the regression suite, not an additive count.
- `npm test -- src/features/bhavcopy/__tests__ src/components/__tests__/BhavcopyDownloadRerun.test.ts src/components/__tests__/BhavcopyMarketHolidayLayoutStatus.test.ts src/components/__tests__/BhavcopyMarketHolidayRefresh.test.ts src/components/__tests__/BhavcopyOfficialHolidaySync.test.ts`: PASS (7 files, 47 tests).
- `npm run typecheck:renderer`: PASS. `npm run build:renderer`: PASS (6.83 seconds). Final marker `PASS: BHAV01_VALIDATION_GATES`.
- Warning: unused `create_holiday_skip_result`; defer cleanup to BHAV-02. Four ignored native/maintenance tests remain unexecuted. No production DB access or live downloads. No full workspace test claimed.
- Approved publication scope: existing 26 paths only (24 source/test, 2 documentation); the publication runner adds these validation notes to the existing change record and HANDOFF, verifies exact staged blobs and normal Git hooks, and permits a non-force push to the dedicated candidate branch only. Publication, CI, portable Windows build and manual acceptance are not yet evidenced by this record. Merge not authorized. BHAV-02/BHAV-03 and phase-tracker/architecture closure updates remain pending.
