# NS-R1 — Native core result metadata integrity gate

**Timestamp:** 2026-11-21 15:20 IST (UTC+05:30)  
**Workstream:** EOD Charting Platform — `E:\TA Projects\EOD Charting Platform`  
**Source baseline:** verified GitHub `main@48da280cb37eeeef0e564e1c70b9db20f76bf567`  
**Branch/PR:** `feature/native-scanner-retirement-readiness-20261121`, draft PR #128

## Objective and previous defect

NS-04 native execution supports only four gap-pattern IDs. The ten core OHLCV candidate AST expressions already match TypeScript *decisions*, but Rust numeric matches currently contain only `ruleId`, date and an optional scalar `value`, not accepted `ScannerResult` direction, category, source, reasons, numerical columns and warnings. Simply routing new numeric rules natively would produce misleading incomplete gap-category rows. Additionally, the previous adapter converted any matching event's rule ID without verifying that it was requested for this run. Native result publication must fail closed before route expansion.

## Files created/modified

- **Created:** `src/features/scanner/nativeCoreResultMetadataGate.ts` — verifies a future core result carries exactly the accepted scanner identity/category/direction, one nonempty reason, source `EODScannerPlugin_v1`, expected numeric value columns and no fabricated score, pattern or grouped history. It does not approximate missing metadata.
- **Created:** `src/features/scanner/nativeCoreResultMetadataGate.test.ts` — constructs positive valid-bar TypeScript outputs for all ten core definitions; asserts complete metadata passes and tampered columns, invalid numerics, missing direction/source/reason and added history/score fail.
- **Modified:** `src/plugins/scanner/nativeScannerRun.ts` — buffered event match validator rejects unsolicited rule IDs and incomplete future core outputs before committing native results, falling back to the existing full TypeScript run. A structurally complete future core result would also retain `warnings: []`.
- **Modified:** `src/plugins/scanner/__tests__/nativeScannerRunNS04.test.ts` — tests unrequested native output with a valid gap match in the same batch and asserts zero partial result publication, exactly one TypeScript fallback.
- **Modified:** `HANDOFF.md`, `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`, `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`, `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`, `FILE_INVENTORY.md`, [native retirement plan](../plans/2026-11-21_NATIVE_SCANNER_RETIREMENT_READINESS.md).
- **Created:** this change record.

## Exact behavior changed and preserved

The adapter now rejects an event containing a rule ID not in the run's selected scanner IDs. If a future core numeric result lacks accepted structural metadata, it is rejected as well. All provisional native matches remain buffered and are never mixed with TypeScript results. On native completion with a valid DB identity, a rejected record causes whole-run fallback. This is a defensive fail-closed change, **not new core-native execution**.

Accepted behavior preserved: native OFF by default, four gap patterns, gap result metadata/geometry/history grouping, TypeScript fallback, alert evaluation, cancellation, DB identity/change detection, active profile, read-only scanner data source, CA-01 adjusted-native HOLD and all chart/market-data functions. No Rust, schema, package, dependency or raw `.eod` change. No direct Windows checkout/profile/database access.

## Validation performed — actual results

- Source authority: GitHub main at `48da280cb`; PR #128 head inspected before edit. Root `AGENTS.md` and direct source/test contracts read.
- First-party [Renderer CI #44891185355](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/44891185355): **SUCCESS**.
- Vitest: **287 test files passed, 1 skipped; 2,023 tests passed, 1 skipped**.
- TypeScript renderer typecheck: **PASS**.
- Vite renderer production build: **PASS**.
- Rustfmt/Cargo/Rust scanner regressions: **NOT RUN**; no Rust source changed; local container has no Rust toolchain.
- Windows portable/native parity: **NOT RUN**; user approval and actual Windows run required before any release claim.

## Risks/limitations

Structural completeness is not semantic parity: the Rust implementation must still produce the exact original reason formatting, values and price precision, and must match core latest-only semantics. New core rules remain intentionally TypeScript-routed. Native numeric All History remains capped; alert and plugin migrations remain pending. CA-01 issuer-event ownership HOLD continues to prohibit adjusted-native scanning.

## Rollback and next action

Close/revert only the draft PR #128 branch's metadata-guard commits if the checks regress; do not modify live database, workspace files or accepted portable. The GitHub base commit is the source rollback authority for remote-only modifications; no local Windows backup was taken.

**Next implementation boundary:** implement full core numeric `ScanMatchRecord` metadata generation in Rust, preserving the TypeScript result contract and validating actual Rustfmt *before publishing the Rust source*. Then add real Rust fixture parity and complete front-end handling/acceptance before enabling any core-native route or retiring TypeScript execution. No merge is authorized in this task.
