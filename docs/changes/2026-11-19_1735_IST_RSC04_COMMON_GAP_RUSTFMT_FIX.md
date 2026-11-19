# RSC-04 — Common Gap Rustfmt Follow-up

**IST timestamp:** 2026-11-19 17:35 IST (UTC+05:30)  
**Workstream/root:** EOD Charting Platform — `E:\TA Projects\EOD Charting Platform`  
**Feature branch:** `feature/native-rust-scanner-20261119`  
**Previous commit:** `15217e9491f1765c3ece939e767ccb3323370a7d`  
**Status:** GitHub-only formatting candidate, pending Windows verification; draft PR #122 unmerged.

## Objective and previous defect

After a safe Windows fast-forward to RSC-04, the operator verified all seven preserved local files against their SHA-256 backups. `rustfmt --edition 2021 --check` failed on two formatting differences in `src-tauri-shell/src/scanner_common_gap.rs`. The serial test runner stopped before Rust compilation, Cargo check, Vitest, renderer typecheck/build and document checks.

## Files inspected and changed

Verified the branch commit, PR state and exact original Git blobs. Inspected `src-tauri-shell/src/scanner_common_gap.rs` (blob `3163effb7cbce5fb00ad1147b13a6ace95df797e`), its RSC-04 change record (blob `f0352d269bdd05558187a8f931ab144a784340d0`), and the two formatting hunks in the user's Windows output.

- `src-tauri-shell/src/scanner_common_gap.rs`: break the four-part finite-value condition over separate lines; break the latest-results length assertion over multiple lines, both following the exact `rustfmt --check` output.
- `docs/changes/2026-11-19_1724_IST_RSC04_COMMON_GAP_PARITY_DETECTOR.md`: record actual GitHub and Windows preflight/formatting evidence and pending checks.
- This new change record.

## Final implementation and preservation

Only whitespace/line wrapping changed in the Common Gap source, without changing numeric rules or control flow. The accepted RSC-01/RSC-02/RSC-03 contracts, Common Gap fixture, TypeScript scanner/Worker/UI, Tauri IPC, database and `.eod` files remain unchanged. No dependencies or local Windows files were modified by this GitHub correction. CA-01 stays on HOLD. The existing operator backup must be retained.

## Validation commands and results

- User Windows branch checkout to `15217e9`: **PASS**; preserved files: **7/7 SHA-256 PASS**.
- User Windows `rustfmt --edition 2021 --check src-tauri-shell/src/scanner_common_gap.rs src-tauri-shell/src/scanner_breakaway_gap.rs` at `15217e9`: **FAIL** with exactly two formatting diff hunks; remaining tests did not execute.
- GitHub Renderer CI for `15217e9`: **SUCCESS**. This does not validate Rust compilation.
- Corrected Rust file: matching two exact, single-occurrence text replacements applied from the user's rustfmt diff; branch source pinned and staged changed-file inventory to be verified before publishing.
- New commit's Rustfmt, focused Rust `scanner_` tests, shared Cargo `check`, Windows parity Vitest, renderer typecheck/build, and docs check: **NOT RUN**, pending operator validation.

## Risks, rollback, next steps

Remaining risk is undiscovered Rust compilation/parity defects. Revert only this formatting follow-up commit if needed; do not reset/clean the user's checkout or touch its preserved files. Re-run Rustfmt after a guarded local fast-forward to the correction commit; if PASS, continue the already prepared serial validation. Keep PR #122 in draft and do not start another detector migration or merge before RSC-04 acceptance.
