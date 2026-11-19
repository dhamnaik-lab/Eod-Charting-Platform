# RSC-05 — Rustfmt Correction and Pre-publication Gate

**IST timestamp:** 2026-11-19 19:35 IST (UTC+05:30)  
**Workstream:** EOD Charting Platform — `E:\TA Projects\EOD Charting Platform`  
**Feature branch:** `feature/native-rust-scanner-20261119`; parent `49565b5cc1360539e1367620d37f5501f2a55872`  
**Status:** Corrected Windows Rustfmt **PASS**, focused RSC-05 Windows validation **PASS** at `e158f086` (19 November 2026, 19:48 IST). Draft PR #122 unmerged.

## Objective and previous limitation

The operator's RSC-05 Windows command confirmed the exact feature checkout and SHA-256 backup of all seven protected local files, then failed `rustfmt --edition 2021 --check`. This repeats RSC-03/RSC-04 formatter-only failures caused by publishing manually formatted Rust without executing the canonical formatter in the editing environment, where `rustfmt` is unavailable. The existing GitHub Renderer CI passed but does not run Rustfmt.

## Files inspected and changes

Verified branch head, draft PR state, exact Git blobs for the source and records, and the user's two emitted `rustfmt --check` diff hunks.
- `src-tauri-shell/src/scanner_runaway_gap.rs`: join `CHART_PATTERN_SCANNER_SOURCE` into the prior import line and put three `trend_move_pct` conditions onto one line, as demanded by operator Rustfmt. **Formatting only.**
- `AGENTS.md`: add **mandatory Rustfmt pre-publication gate** for all future Rust-source commits, including explicit blocking of formatter-pass claims if no Rustfmt toolchain is available. When unavailable, obtain real formatting verification before publishing rather than asking for after-publish rework.
- `docs/changes/2026-11-19_1825_IST_RSC05_RUNAWAY_GAP_PARITY_DETECTOR.md`: update Windows evidence, candidate limitations and correct earlier CI status.
- `HANDOFF.md` and `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`: record current source status and the preventative rule.
- This change record.

## Final implementation and preserved behavior

No detector logic, math, historical grouping, fixture JSON, TS scanner/Worker, native routing, IPC, database, `.eod` files, dependencies or packaging changed. Existing RSC-01–RSC-04 and CA-01 HOLD remain untouched. No local Windows source files were changed by this GitHub-only correction. The user's seven-file backup is preserved.

## Validation commands and actual results

- Windows guarded source checkout at parent `49565b5`: **PASS**.
- Windows protected-file backup and post-checkout SHA-256: **PASS, 7/7**.
- Original `rustfmt --edition 2021 --check src-tauri-shell/src/scanner_runaway_gap.rs src-tauri-shell/src/scanner_breakaway_gap.rs`: **FAIL** with exactly two formatting differences.
- GitHub Renderer CI on parent `49565b5`: **SUCCESS**, does not certify Rust compilation or formatting.
- New formatting patch: exact one-occurrence substitutions matching the Windows formatter's proposed changes; GitHub staged changed-file scope and blob hashes verified before publication.
- At correction publication, Rustfmt and focused tests were **NOT RUN** in the GitHub editing environment; this historical limitation remains important to the pre-publication prevention rule.
- Subsequent operator Windows command-output at `e158f086`: corrected `rustfmt --check` **PASS**; shared Cargo `test scanner_` **14/14 PASS** (11 scanner-module tests plus three corporate-action tests, 1328 filtered); shared Cargo `check` **PASS**; Vitest **56/56 PASS across eight files**; TypeScript typecheck **PASS**; renderer build **PASS** (846 modules, 5.75 s); documentation references **PASS**; protected local files **7/7 SHA-256 PASS**.
- GitHub Renderer CI at `e158f086`: **SUCCESS**, independently checked. Real `.eod` corpus and portable-native execution are **NOT TESTED**.

## Risks, rollback and next steps

Corrected Rustfmt and focused Rust/TS parity are now verified on Windows. Full Rust-suite and real `.eod` parity remain untested. The new `AGENTS.md` rule is process guidance, **not an implemented automated GitHub Rustfmt gate**; adding CI enforcement is a separate bounded improvement. Revert only this isolated correction commit if needed; never reset or clean preserved local work. Keep PR #122 draft and do not merge or migrate another detector without explicit approval.
