# WP-02 / NS-R7 — Stateful scanner indicator kernels

Recorded 23 November 2026 at 02:23 IST on local main at f78b034e91e2dd506d33ca0dd076f87c5eda6b9f. The user approved proceeding with full numeric paging and Scanner coverage as separate implementation scopes, deferring standalone RSI and ATR fixture work and sequencing the broader Rust indicator migration afterward.

## Implemented

The V1 numeric AST evaluator now uses incremental SMA, EMA, RSI and ATR kernels in [ast.rs](../../src-tauri-shell/src/native_scanner/ast.rs). SMA retains its input window and sums in the existing order. EMA retains its seed and current value. RSI retains previous input, seed observations and Wilder averages. ATR retains previous close and uses the same simple average of true range. The existing functions still return complete series. Evaluation and routing continue through the same V1 entry points. The kernel boundary prepares the forward evaluator and offers a reuse point for the later chart indicator migration.

Rustfmt passed with `rustfmt --edition 2021 --check src-tauri-shell/src/native_scanner/ast.rs`. Documentation references and scoped whitespace checks passed. Runtime tests and compilation are deferred. The earlier EMA fixture run predates this change. No live database access or release build ran. Backup: `backups/pre_opencode_changes_20261123_022124_nsr7-indicator-state/`.

## Remaining implementation

1. Connect these kernels to a bounded forward AST evaluator. Preserve lookback rings, crosses, null and warm-up semantics, and one evaluation per eligible target, rule and date. Run the existing parity suite and the combined state and seam matrix as part of executor validation.
2. Before wiring full history into desktop IPC, pin the consistency mechanism for the canonical cursor. Identify the SQLite and binary mutation paths that a read lease or writer generation would cover, including in-place history writes and alias changes, and choose the mechanism with demonstrable coverage. The current database-use permit and selection revision protect deletion and selection identity. They provide no proof that a long read saw one consistent price history. Then implement the separately advertised, quota-bounded result paging contract. [Paging contract and gates](2026-11-23_0152_IST_NSR7_NUMERIC_HISTORY_PAGING_DESIGN.md).
3. Publish Scanner coverage when the Scanner has an eligible numeric-history route. It currently routes built-in Core and Daily Market All History to TypeScript, and the supported native All History path evaluates patterns. The existing V1 numeric coverage is emitted only by qualifying native numeric history requests. A useful Scanner display needs the accepted numeric-history route to supply that completion. Show evaluated dates and endpoint counts with the loaded-window bound and older-input uncertainty where applicable. Preserve the existing latest-only rules, fallback and alert behavior.
4. Scope broader chart indicator migration after the paging and coverage work. Check chart callers' seed, null and timeframe contracts against the Rust kernels when doing that migration.

The 1,000-endpoint V1 cap, 32-rule limit, native OFF default, pattern history, TypeScript fallback and CA-01 HOLD remain in effect.
