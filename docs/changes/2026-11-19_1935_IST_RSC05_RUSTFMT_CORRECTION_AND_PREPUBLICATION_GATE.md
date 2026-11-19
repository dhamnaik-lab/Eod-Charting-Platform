# RSC-05 — Rustfmt Correction and Pre-publication Gate

**IST timestamp:** 2026-11-19 19:35 IST (UTC+05:30)  
**Workstream:** EOD Charting Platform — `E:\TA Projects\EOD Charting Platform`  
**Feature branch:** `feature/native-rust-scanner-20261119`; parent `49565b5cc1360539e1367620d37f5501f2a55872`  
**Status:** GitHub candidate; corrected Windows Rustfmt and full focused tests pending. Draft PR #122 unmerged.

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
- Corrected `rustfmt --check`: **NOT RUN** in editing environment; operator Windows validation required.
- Focused Rust `scanner_` tests, shared Cargo check, RSC-01–05 TypeScript parity Vitest, typecheck, renderer build, documentation check and native real `.eod` parity: **NOT RUN** after correction.

## Risks, rollback and next steps

Residual risk: a further Rustfmt difference or Rust/parity compile defect may surface on Windows. The new `AGENTS.md` rule is process guidance, **not an implemented CI Rustfmt gate**; an automatic CI pre-publication check remains a separately scoped improvement requiring approval. Revert only this isolated correction commit on the feature branch if necessary; never reset or clean the user's preserved local files or backup. Obtain actual Windows Rustfmt PASS first, then run the previously issued serial Rust/Cargo/Vitest/build checks; keep PR #122 draft and do not migrate another detector before RSC-05 acceptance.
