# NS-04 — Native Gap Scanner Complete Historical Coverage

**Timestamp:** 21 November 2026, 03:35 IST (UTC+05:30)  
**Workstream:** EOD Charting Platform — `E:\TA Projects\EOD Charting Platform`  
**GitHub base:** PR #124, pinned `d6e63d59d049e2c21be4821e9b21065905f477b4`  
**Branch:** `fix/ns04-full-history-gap-parity-20261121`

## Objective and previous limitation

In All History mode, Rust read no more than 5,000 bars per target, while the existing TypeScript gap-pattern scanner evaluates every available completed historical endpoint. Manual Nifty Bank/Exhaustion Gap comparison: Rust-enabled output 38 episodes versus TypeScript output 128; this discrepancy is not itself a verified per-result parity diagnosis.

## Files changed

- `src-tauri-shell/src/native_scanner/scan.rs` — bounded paged historical pattern traversal, reverse chronological episode grouping, source overlap validation, focused synthetic regression tests.
- This change record.

## Final implementation

Native gap-only All History scans read trailing 5,000-bar pages through the existing read-only database source and use the detector's 260-bar context as overlapping pages. Newest-to-oldest page processing evaluates each completed endpoint exactly once; the grouping accumulator merges consecutive episodes even across page boundaries and retains earliest-episode representative metadata. The full source history is traversed without materializing all price bars at once. Each page validates strict date order and exact overlapping price bars. Missing pages, source failures, unsupported patterns, and changed overlap report errors instead of a clean non-match. Cancellation discards partial target results.

## Preserved behavior

Latest-only and Specified bars, numeric AST capped evaluation, native OFF by default, TypeScript scanner and alert fallback, scanner UI, original database and profile resolution, raw `.eod` immutability, Rust read-only connections, job permits, CA-01 adjusted-native HOLD, and existing database switching safeguards. No new dependencies or schema changes.

## Validation

- Source inspection: GitHub PR #124 at `d6e63d59d049e2c21be4821e9b21065905f477b4`.
- New regression source: >5,000-bar old/recent gap matches; cross-page grouping metadata; 5,000/5,001-bar and as-of endpoint coverage; cancellation and second-page failure.
- Rustfmt, Cargo check/test, renderer checks, GitHub CI, Windows portable, manual parity: **PENDING actual execution** at initial publication. Update this record with genuine command output when available; do not claim PASS before execution.

## Risks and limitations

- Native numeric AST All History retains the existing separate 1,000-endpoint cap; this correction applies to gap-only history.
- This code relies on the read-only source returning deterministic date-bounded trailing rows and validates overlap; concurrent mutation outside the guarded database use may fail closed.
- The full-history read/evaluation workload can be larger than before; memory remains bounded per target but historical result arrays may grow.
- The original 38-versus-128 user dataset comparison remains unverified until Windows portable acceptance.
- Load Bars incremental editing and cancellation-count reporting remain separate issues.

## Rollback

Revert only this scoped correction commit from its isolated GitHub branch or close the follow-up pull request; PR #124 and original Windows production files are unchanged. Do not manipulate the live database.
