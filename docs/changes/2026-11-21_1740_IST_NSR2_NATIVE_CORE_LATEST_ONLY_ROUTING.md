# NS-R2 — guarded opt-in core OHLCV native latest-only integration

- **IST date:** 2026-11-21, 17:40 IST (UTC+05:30)
- **Active workstream:** E:\TA Projects\EOD Charting Platform
- **Parent/source authority:** PR #128 `af12f7cd075989a68e4cc6a671ce4c0752ef9224`, with Rustfmt, Rust Compile/Test and Renderer CI passing before branching.
- **New branch:** `feature/nsr2-core-ohlcv-native-routing-20261121`, based on the exact PR #128 head. **No merge or default activation**.
- **Objective:** Connect ten previously implemented Rust core OHLCV numeric rules to the opt-in native scan UI when evaluation is bounded/latest-only, while retaining all accepted TypeScript behaviors.
- **Previous limitation:** All core OHLCV IDs were treated as TypeScript-only despite a compiled Rust exact-AST matcher and complete result metadata, so the native checkbox could route only four gap patterns.

## Files changed
- `src/plugins/scanner/nativeScannerRun.ts`
- `src/components/ScannerWindow.tsx`
- `src/features/scanner/nativeCoreRuleExpressions.ts`
- `src/features/scanner/nativeCoreResultMetadataGate.ts` (documentation only)
- `src/plugins/scanner/__tests__/nativeCoreLatestRoutingNSR2.test.ts` (new)
- `HANDOFF.md`, `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`, this change record

## Final implementation
- Explicit native opt-in compiles exact built-in core numeric predicates and four approved gap pattern expressions, with no unsupported-rule dropping.
- Core rules require bounded/latest evaluation; full-history core runs retain complete TypeScript execution. Four gap pattern full-history mode remains supported and unchanged.
- Native output is buffered until accepted completion. A mismatched rule ID or incomplete core match metadata rejects the entire native result; the TypeScript fallback re-runs without provisional result publication.
- Existing alert-rule fallback, backend database identity/revision safeguards, cancellation, error handling, and CA-01 raw-only adjusted-native HOLD remain unchanged.
- New tests cover all ten rule compilation identities, core-vs-pattern historical eligibility, complete published result fields, and fail-closed malformed metadata.

## Preserved
- TypeScript scanner remains the default; no TypeScript scanner removal.
- The four gap patterns and existing UI result, selection, cancellation and alert semantics.
- Raw `.eod` records, live SQLite database, corporate-action approval controls, existing installed dependencies, local checkout, portable build and active Windows working-tree changes.

## Validation and limitations
- **Pre-change evidence:** PR #128 Rustfmt CI, Rust Compile and Test CI, Renderer CI PASS (GitHub verified).
- **New branch:** TypeScript source and tests committed directly; GitHub CI must run on the new commit. Local Vitest, TS typecheck and Windows native UI acceptance were **not executed** in this GitHub-only session; do not claim them passed.
- **Parity limit:** The TypeScript integration test uses legacy-handler-produced synthetic match metadata to verify transport completeness. It does **not** execute Rust against the same fixture. Exact Rust-versus-TypeScript numeric values, string formatting, warmup/null cases and real-symbol histories still require independent parity acceptance before merging or retiring TypeScript.
- **Known risks:** Core numeric edge cases, decimal display formatting and skipped/incomplete target semantics may differ; stay in draft, preserve fallback, and do not remove the legacy backend.

## Rollback
- Leave the parent PR #128 untouched; abandon or revert this branch's bounded commit if runtime parity fails. Do not reset or clean the Windows checkout. 
- **Next step:** Verify GitHub Renderer CI and focused synthetic parity. Then independently compare Rust and TypeScript core values/reasons on the same raw EOD bars, including historical/as-of settings, before approving merge or scanner retirement.
