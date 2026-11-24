# DOCSYNC-02 — Native scanner and SCAN-PERF-01 acceptance reconciliation

Recorded 23 November 2026 at 00:46 IST (UTC+05:30). WP-00 is the documentation closeout for the native scanner workstream. The current handoffs and roadmap described NS-R2/NS-R3 as local candidates and predated the Windows evidence below.

## Source authority and protection

Local `main` and HEAD at `E:\TA Projects\EOD Charting Platform` match the supplied published checkpoint `f78b034e91e2dd506d33ca0dd076f87c5eda6b9f`, tree `645ad1216ffa264fb0f6068d147e47c7d50802c2`. Local merge ancestry records NS-R2 in PR #136 at `bdb9059f064d5757b861e7e0aaeb83062fb73b2c` and NS-R3 in PR #137 at `f78b034e91e2dd506d33ca0dd076f87c5eda6b9f`. The local remote-tracking reference was older. The local SCAN-PERF-01 renderer changes and regression test were verified directly and included in preservation checks.

## Acceptance evidence

| Evidence | Status | Basis |
| --- | --- | --- |
| NS-R2/NS-R3 source and fixture checks | **Merged** | #136 ships five latest-only Daily Market scanners and deterministic `en-IN` volume reasons (C-1). #137 completes 54 chart-pattern detectors, eligible for latest and paged pattern-only history. The dated records preserve the focused test and parity fixture history. |
| Windows NS-R2/NS-R3 automated validation and portable staging | **PASS** | The 22 November runner transcript records Rustfmt over 18 files, both shared-Cargo test filters, Cargo check, the Windows FullRenderer gate and Tauri release build. The recorded `native_scanner` result is 123 passed. The user supplied 18 passed for `scanner_` and 2,158 Vitest passed with one skipped. The transcript confirms those gates passed and omits their exact counts. |
| SCAN-PERF-01 automated renderer validation | **PASS** | Local logs confirm 28 focused tests and 2,169 full Vitest tests passed with one skipped. Renderer typecheck and build passed. The synthetic 55,497-result replay went from 55,497 mounted rows to 100, 40.8 s to 190 ms from payload to table, and seven to zero Scanner renders across six viewport updates. |
| SCAN-PERF-01 Windows chart responsiveness | **PASS, operator-confirmed** | The user confirmed 55,497 results remained responsive with Scanner Results open in the 14-symbol Nifty Bank, 74-rule, All History run. The exact SCAN-PERF-01 executable hash and raw screenshots were not available for this closeout. |
| Eligible native Rust versus TypeScript end-to-end parity | **PENDING, WP-01** | The 74-rule All History run took the TypeScript path. It exceeds the 32-rule native limit and includes history modes that fall back to TypeScript. Fixture results, CI, Windows build success and Scanner UI acceptance establish separate evidence. |

The Windows automated result `tmp/validation-workspace/NSR23_20261122_232158_IST/automated-result.json` identifies the pinned commit and tree. Its companion `validation-transcript.txt` has SHA-256 `B74D5EA80D6FA35783F13B1F5E8CCA3D03A8ECEB731495C1F5CE15A47E1103FA`. The staged `release/tauri-portable-win/EOD Chart Portable NSR23 20261122_232158_IST/EOD Chart.exe` independently matched the transcript and JSON SHA-256 `50A2255F84E885B816796F3BE21108D85A483D2068D32973E41BCB850124F6D2`. That hash identifies the earlier NS-R2/NS-R3 candidate. SCAN-PERF-01 benchmark and renderer logs remain under `tmp/SCAN_PERF_01_20261122_182621/`. [NS-R2 change record](2026-11-22_0156_IST_NSR2_DAILY_MARKET_NATIVE_PARITY.md) · [NS-R3 change record](2026-11-22_NSR3_REMAINING_CHART_PATTERNS_NATIVE_MIGRATION.md) · [SCAN-PERF-01 change record](2026-11-23_0003_IST_SCAN_PERF_01_SCANNER_RESULTS_RESPONSIVENESS.md).

## Remaining work and invariants

- Native remains OFF by default. Eligible opt-in batches accept at most 32 supported rules. Core OHLCV and Daily Market remain native latest-only. The generic numeric Rust history executor evaluates at most 1,000 contiguous trailing endpoints per target. The paged pattern-only history path is separate.
- C-2 (52-week descriptive text versus executable High/Low window semantics) and C-3 (`volume_surge` direction for 0% price change) remain unresolved specification decisions. CA-01 adjusted-native execution stays HOLD.
- NS-R4 signals/formulas, NS-R5 alert equivalence, NS-R6 external plugin compatibility and NS-R7 historical/operational completeness are open. NS-R8 native default and NS-R9 TypeScript retirement remain on HOLD pending evidence and separate approval. Any above-32 batching design has its own approval gate. [Living roadmap](../plans/2026-11-21_NATIVE_SCANNER_RETIREMENT_READINESS.md).

## Changes, validation and rollback

Updated the handoff, next-phase notes, living scanner roadmap, architecture and feature status. Appended the Windows UI acceptance to the existing SCAN-PERF-01 record. Behaviour, configuration and existing portable artifacts are outside this documentation change. The pre-edit backup is `backups/pre_opencode_changes_20261123_004441_docsync02/`. Evidence is under `tmp/DOCSYNC02_20261123_004440_IST/`.

- `scripts/validate-change.ps1 -Profile docs -Paths <seven changed Markdown files>` ran the reference checker and scoped Git whitespace check. The first run exited 2 on two Markdown trailing-space line breaks. After converting those breaks to paragraph spacing, the final run passed with exit 0.
- SHA-256 matched for 978 of 978 protected files, including the eight previously unrelated worktree files, both SCAN-PERF-01 source/test files, generated theme CSS and build metadata. HEAD and tree matched the baseline, the unrelated Git inventory was identical, and the index remained empty.
- The original two handoff bodies and the whole original SCAN-PERF-01 record body matched the scoped backup byte-for-byte. The added record passed a trailing-whitespace check.
- WP-00 ran documentation and preservation checks. Application validation above comes from the cited prior runs.

To roll back WP-00 with approval, reverse these six documentation edits and remove this newly added record. Keep the prior SCAN-PERF-01 implementation, test, evidence and historical documentation. Consult the scoped backup and preserve any later edits.

WP-01 requires explicit approval for the eligible native-versus-TypeScript comparison and the exact read-only data scope. Start with 1–5 supported rules, verify native completion status, and compare complete records across both engines.
