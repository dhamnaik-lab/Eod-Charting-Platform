# NS-R7 — Native numeric history contract review

Recorded 23 November 2026 at 01:27 IST. Scope is the first-party Scanner route, the direct desktop start command, and completion reporting. Local `main` and HEAD were `f78b034e91e2dd506d33ca0dd076f87c5eda6b9f`, tree `645ad1216ffa264fb0f6068d147e47c7d50802c2`. The continuity tests and earlier working-tree fixes were preserved.

## What each caller receives

| Entry point and selection | Current behavior |
| --- | --- |
| Scanner, Core OHLCV or Daily Market with All History, including mixes with patterns | The native eligibility gate sends the entire selection to TypeScript. The TypeScript runner loads the requested raw history and evaluates each selected Core or Daily Market rule once against the latest endpoint of that series. Its chart-pattern worker receives the separate history flag and can emit grouped historical pattern matches. |
| Scanner, opt-in supported pattern-only All History | Native runs the paged pattern executor, subject to its ordinary database, rule and alert gates. Each page returned to the executor holds at most 5,000 bars, with overlap for detector context. This route continues before the first page. |
| Desktop IPC, schema-valid generic numeric AST with history | The start command parses the request and prepares an active, registered read-only database. Generic rule IDs can reach the numeric history executor. It receives a single bounded series of at most 5,000 bars, and each numeric rule evaluates at most the most recent 1,000 eligible endpoints after warm-up. A request containing numeric rules cannot take the pattern-only All History paging branch. |
| Desktop IPC, built-in Core or Daily Market rule with history | The executor's built-in rule validation disallows history and reports an evaluation failure. The desktop start acknowledgement is distinct from the executor's verdict. The Scanner avoids this case through its earlier fallback guard. |

Inspected [Scanner controls](../../src/components/ScannerWindow.tsx), [native eligibility and dispatch](../../src/plugins/scanner/nativeScannerRun.ts), [TypeScript runner](../../src/plugins/scanner/scannerRunner.ts), [desktop bridge](../../src/platform/nativeScannerBridge.ts), [IPC](../../src-tauri-shell/src/native_scanner/ipc.rs), [AST](../../src-tauri-shell/src/native_scanner/ast.rs), [built-in rule validation](../../src-tauri-shell/src/native_scanner/core_results.rs) and [executor](../../src-tauri-shell/src/native_scanner/scan.rs). The in-repository call-site search found ScannerWindow as the production caller of the native adapter. Direct IPC reachability follows from the validator and executor source. It was not exercised against a database in this review.

## Completion contract gap

The executor internally records `bars` and `evaluated_history_endpoints` per target. The V1 completion event sends target classifications, cancellation, duration, workers and diagnostics. A capped successful numeric rule does not add a diagnostic merely because it omitted older eligible endpoints. The event does not carry evaluated dates or whether the input was fully covered. A target counted as matched or no-match therefore answers what happened within the evaluated window. A consumer cannot use those counts to infer whole-history completeness. Capability discovery publishes a 5,000 maximum lookback and 32-rule limit without exposing the separate numeric endpoint cap. [Rust event shape](../../src-tauri-shell/src/native_scanner/job.rs) · [TypeScript event and capabilities](../../src/features/scanner/nativeScanContract.ts).

Prior fixture evidence proves the cap works as implemented. A single all-matching rule on 1,001 input bars emitted exactly the newest 1,000 matching dates. The 5,001-bar numeric case read 5,000 and still emitted the newest 1,000 dates. The separate 5,001-bar Common Gap case produced one two-match episode crossing a page seam. [Endpoint continuity record](2026-11-23_0117_IST_NSR7_HISTORICAL_ENDPOINT_CONTINUITY.md).

## Recommendation and approval boundary

Retain the current execution contract and Scanner routing. Raising the numeric cap would enlarge the direct bounded result set while leaving its range implicit. Enabling numeric historical output in the Scanner would change the accepted latest-endpoint behavior for Core and Daily Market rules and would require an explicit product decision.

If a caller needs bounded numeric history coverage, first approve a small completion-reporting change for the direct IPC path. A coverage report should distinguish the input window from the evaluated interval, be scoped per target and rule where limits differ, and indicate when older input is unknown. A full-size read alone cannot distinguish a symbol with exactly 5,000 bars from one with older data. An additive report or capability needs a compatibility check against existing readers before shipping. It must preserve the existing target counts, progress, cancellation, atomic publication, database identity checks, and fallback.

Full numeric paging is a separate contract decision. It needs an approved endpoint specification, bounds on memory and work, and a warm-up strategy that preserves indicator state across pages. The numeric evaluator currently computes against each endpoint's available prefix, and recursive indicators such as EMA and RSI depend on their seed history. Reusing only the pattern overlap could change values at seams. Fixtures should prove equality with a single-series oracle at 999, 1,000, 1,001, 5,000 and 5,001 endpoints, include a recursive indicator crossing a page boundary, and cover interruption and database reselection. Any new Scanner mode needs separate approved semantics for metadata, alerts, and TypeScript fallback.

## Validation and rollback

Documentation and SHA-256 evidence is under `tmp/NSR7_NUMERIC_CONTRACT_20261123_012652/`. This review made documentation changes only. It used the prior linked fixture results plus inspection of the current code. No scanner run, build, or live database access occurred.

Updated the two handoffs and the [living roadmap](../plans/2026-11-21_NATIVE_SCANNER_RETIREMENT_READINESS.md). The pre-edit backup is `backups/pre_opencode_changes_20261123_012653_nsr7-numeric-contract/`. With approval, reverse the documentation entries and remove this record while preserving earlier changes. The review is closed. Implementing coverage reporting, enabling numeric history for a Scanner selection, or changing its cap requires a separately scoped decision.
