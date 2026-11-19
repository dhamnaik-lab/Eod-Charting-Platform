# RSC-03 — Final Rustfmt Line-Wrap Correction

**Timestamp:** 2026-11-19 16:22 IST (UTC+05:30)  
**Workstream:** EOD Charting Platform — `E:\TA Projects\EOD Charting Platform`  
**Branch:** `feature/native-rust-scanner-20261119` (draft PR #122)  
**Source authority:** `e8163635ed9f4f608f46b0bc65793606537f79e3` — `scanner_contract.rs` blob `0f43fccdf1063a909e4c977239d55ace6f95e153`.

## Objective and previous defect

Correct the one remaining Rustfmt wrapping difference reported by the operator after the first RSC-03 formatting follow-up. The user's Windows fast-forward and 7/7 preserved-file SHA-256 verification both passed; `rustfmt --check` failed, preventing all subsequent serial tests.

## Changed files and final implementation

- `src-tauri-shell/src/scanner_contract.rs`: place the format argument `scenario.id` on a separate line after the format string, matching the exact `rustfmt --check` output. No semantic code change.
- This change record.

## Preserved behavior and limits

All RSC-01/RSC-02 fixtures, scanner logic, production TypeScript scanner/worker, native inactive routing, IPC, database, `.eod` data, Corporate Actions CA-01 HOLD, dependencies, and existing Windows preservation backup remain untouched. No local checkout files changed from this GitHub commit.

## Actual validation and evidence

- User's Windows fast-forward to `e816363`: **PASS**.
- User's preservation SHA-256 verification: **PASS (7/7)**.
- User's `rustfmt --edition 2021 --check` on `e816363`: **FAIL**, one line-wrap difference in `scanner_contract.rs`.
- New source correction: exact one-occurrence string replacement from the operator's formatter diff; source blob pinned before edit and staged changed-file inventory checked.
- New commit's `rustfmt`, Rust `scanner_` tests, Cargo check, Windows Vitest, and portable acceptance: **NOT RUN** pending the operator's Windows validation. Do not claim a pass before actual command output.

## Risks and rollback

Risk remains that focused Rust tests may expose a separate defect. Revert only the formatting follow-up commit if necessary; accepted `main` base `bfb644bf` remains unchanged. Re-run `rustfmt --check` first, followed by serial scanner Rust tests, Cargo check, Vitest, and documentation validation. Do not merge PR #122 or begin RSC-04 before acceptance.
