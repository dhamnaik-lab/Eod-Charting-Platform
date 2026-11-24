# BHAV-RECOVERY-01A — Journal integrity and rollback preflight

Timestamp: 2026-11-25T00:22:28.380188+05:30 (IST).

## Objective and source authority

- Parent `b12bea2a7ef806efbcbafe39b1269d1acf9b0f11`; candidate branch `fix/bhav-recovery-01-journal-integrity-20261125`.
- Prevent future journal/physical tail mismatches without changing the database format or the accepted Bhavcopy acquisition, admission and durability policies.
- Evidence ZIP SHA-256 `C97F497B08289DD367CE7F1381ADBD89FE92C0BF9DE5BB0D302023EDE4799BA3`; 9,558 append files at baseline length, 138 normalized matches, 276 previous-close differences. 55 conservative baselines and SQLite binding remain unverified.

## Implementation candidate

- `src-tauri-shell/src/bhavcopy/ingestion.rs`: finalize journal binary previous-close fields with the existing stable sort/fill routine, retaining original row order and SQL-facing source values. Reuse final admission masks for journal and writer. Log counts reference the journal-admitted rows.
- `src-tauri-shell/src/bhavcopy_recovery.rs`: verify every append rollback target read-only before truncation; recheck at write boundary. Preserve strict encoded-record matching and durable sync.
- `src-tauri-shell/src/bhavcopy/tests.rs` and recovery module tests: multi-day missing and supplied previous close, exact checkpoint, repeat checkpoint, later mismatch with no earlier truncation, repeat rollback.
- Existing first-record/single-day previous-close behavior, worker caps, immediate vs deferred sync, storage schema, security admission, and index additive guards remain intended unchanged. No new dependencies. No legacy production recovery or calendar changes.

## Validation and limitations

- Source blob identity and isolated patch application verified during package creation. Rustfmt and compilation not available in the packaging environment. Windows canonical Rustfmt and focused/regression Rust tests pending; do not publish before passing.
- Windows runner stages only the three source files for formatting, backs up the active source and HANDOFF, records actual formatted hashes and logs, runs shared Cargo offline/locked serially. No release build, application launch, live download or production database access. Test fixtures only.
- Preflight prevents deterministic append mismatches from causing earlier truncation; it does not make multi-file I/O atomic against hardware faults or external writers. Conservative baselines are not truncated by this operation. Existing RECOVERY_ERROR sessions remain blocked and require 01B. Additional per-row grouping and one extra read-only rollback pass may have small overhead; performance not measured.

## Rollback

Retain the parent commit and exact backup created before edits. Do not restore automatically or switch executables against the actual affected database. If validation fails, retain the candidate and evidence for review; do not publish, merge or repair the database.

## Windows validation — 25 November 2026, 00:48 IST

- Candidate validation completed with source parent `b12bea2a7ef806efbcbafe39b1269d1acf9b0f11`; exact source backup `backups/pre_opencode_changes_20261125_003724_bhav-recovery01a-20261125-003721-279`.
- `rustfmt --edition 2021 --check` on the three changed Rust files: PASS (rustfmt 1.10.0-stable); Git whitespace gate PASS.
- Shared Cargo wrapper (`--offline --locked`, root target), serial filters: `bhav_recovery01a_` 3 PASS; `bhavcopy_recovery::` 19 PASS; `bhavcopy::` 182 PASS / 4 ignored; `database::binary_eod::` 29 PASS. 230 distinct passing tests, zero failures; focused tests overlap module suites. Existing unused `create_holiday_skip_result` warning unchanged.
- Windows evidence ZIP `BHAV-Recovery01A-Evidence-20261125-003721-279.zip` SHA-256 `0DC31E1DF380CA90DBFB67996717F1B3E92285DD8947DE9404E780C9F000B692`; transcript SHA-256 `E5A18C0B05DB400AF25D27D19EFF9DD8FEB3FB4F4BB6C14C34C7DEC78C721162`. Formatted source SHA-256 values:
  - `src-tauri-shell/src/bhavcopy/ingestion.rs`: `4BB378166D01AC81CA9CD19676249BAD35522941CFF88CB481FB3B48A5BCA644`
  - `src-tauri-shell/src/bhavcopy/tests.rs`: `F20D134B2EC8B16D18C003F9A72231C38AC81BD47088C9664FAB43B5F230E3E6`
  - `src-tauri-shell/src/bhavcopy_recovery.rs`: `984698D33490D783E98FBD9F5A6F14125261EBCFF26C811C126B315F20CCB685`
- Original manifest and formatted source hashes independently reconciled against uploaded evidence. No actual database access, release build, live download or native acceptance. Prior pending-validation wording above describes preparation, superseded by these results.
- Publication authorized only to the candidate branch, subject to exact staged-tree and remote checks; publication receipt required to establish actual remote commit. No merge. 01B remains separate and blocked until authorized.
