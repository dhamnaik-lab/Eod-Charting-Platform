# CA announcement classification and pending metadata refresh

## Result

The normal Load & Validate flow now reparses legacy pending import metadata before strict identity matching and readiness checks. Exact AGM-only notices are displayed as **Informational (no adjustment)** and do not inflate the Blocked count. AGM combined with Dividend remains in the financial workflow.

Pre-edit backup: `backups/pre_opencode_changes_20261023_123229_ca_classification_refresh`.

## Implementation

- `corporate_action_imports/classification_refresh.rs`: new database-bound command, limited to 100 unique exact import IDs per transaction. It uses the existing cached connection owner, reparses applicable Other/legacy Dividend metadata, preserves identity/source/date/dedupe fields, and records before/after metadata in `CLASSIFICATION_REFRESH` decisions. Approved/linked rows, manual decisions, unknown decision provenance and legacy manual-resolution messages remain untouched. Missing IDs fail the entire batch before mutation. Repeated refreshes are idempotent.
- `corporate_action_imports.rs`: the broad cash parser no longer interprets a `%` purpose's numeric value as cash. Such dividends require historical face-value or explicit cash-per-share evidence. Existing stored cash conflicts remain review-required rather than being overwritten. The `Intdividend` abbreviation is recognized; the strict cash grammar also accepts `Int Div`/`Int Dividend` forms while retaining compound/special/qualified exclusions.
- Demerger reclassification does not establish a price adjustment. It remains unsupported/review-required, with no inferred factor or price factor.
- The desktop bridge, command registry and TypeScript contract expose the metadata refresh. `connection_registry.rs` changes only the existing folder-bound helper's visibility to allow that owner to be reused.
- `corporateActionImportOperations.ts`: after complete queue enumeration, normal explicit-only Load refreshes classifications in bounded batches before matching. Cancellation/database-generation checks remain in place; an unavailable/incomplete/error response leaves preparation incomplete and approval unavailable. The legacy automatic-approval flow is unchanged.
- `corporateActionAnnouncementClassification.ts`, `corporateActionAllTypeReadinessSummary.ts`, `corporateActionBulkApproval.ts` and `DatabaseToolsDialogs.tsx`: an exact AGM-only allowlist with no financial fields is informational. Counts reconcile as **Not approved = Ready + Blocked + Informational**. The notices remain visible and retained. Existing summary scrolling and table spacing are preserved.

Original official evidence is never relabelled or manufactured. A reclassified dividend still needs the exact persisted official witness, machine-proven identity, local price evidence and explicit approval. Stored classification/status correction does not itself mean Ready or Approved. No financial approval, adjustment ledger, raw `.eod` write, migration or new index is introduced.

## Disposable real-data audit

The original temporary database `EOD DATABASE/Nse/market-data.sqlite3` was opened using SQLite `mode=ro` plus `query_only=ON` for an online backup. Only SQL copies were created; no EOD files were copied or modified.

Final evidence: `tmp/ca-classification-review-20261023-final/classification-results.json`.

- Examined **7,934** legacy candidates, including non-AGM Other notices.
- Refreshed **5,612** classifications/statuses in the final guarded implementation.
- Metadata reparse and audit checks took **7.69 seconds** inside the Rust test; complete test duration was 13.04 seconds, excluding compilation. This is not whole-app timing.
- Financial actions, SQLite prices, approval mappings and all original import evidence remained unchanged. SQL triggers additionally rejected financial writes and changes to approved imports/approval fields.
- The earlier exploratory SQL copy `tmp/ca-classification-review-20261023-1240` is retained but superseded by the final copy, which includes protection for legacy manual messages. Both copies are diagnostic artifacts, not active database selections.

No full readiness policy pass was run on these corrected rows, so there is no new Ready/Blocked total yet. In the original inspected dataset, 13,485 Other notices were labelled AGM or Annual General Meeting; these are the main informational cohort.

## Validation

- PASS: `cargo test --manifest-path src-tauri-shell/Cargo.toml classification_refresh --offline -- --test-threads=1` — 4 unit tests, 1 opt-in audit ignored by default.
- PASS: `cargo test --manifest-path src-tauri-shell/Cargo.toml simple_cash_dividend_evidence --offline -- --test-threads=1` — 39 tests.
- PASS: with `CA_CLASSIFICATION_AUDIT_ROOT` set to the final marked copy, `cargo test --manifest-path src-tauri-shell/Cargo.toml classification_refresh_disposable_data_audit --offline -- --ignored --nocapture --test-threads=1` — 1 real-data audit.
- PASS: focused Vitest with `--exclude 'tmp/**'` — 7 files, 88 tests: PendingPreparation, AllTypeReadinessSummary, OfficialImportsFix2, DividendPreparedScopeOrchestration, PendingCompactLayout, OfficialApprovalUx and NormalApprovalAdapter.
- PASS: `scripts/validate-change.ps1 -Profile renderer -Paths src/components/DatabaseToolsDialogs.tsx` — renderer typecheck and scoped whitespace, invoked through PowerShell with ExecutionPolicy Bypass.
- The initial new frontend failure was a pagination-mock fixture error; corrected and rerun. The cash-evidence suite initially exposed two existing positive fixtures whose preference-share/EGM wording was rejected by the pre-edit classifier. They now explicitly test rejection, preserving that eligibility boundary; no preference-share/EGM approval support was enabled.

## Next native check

Rebuild the portable app, run Load & Validate on the temporary database, and verify the Informational column and fresh readiness/rejection results. The original database has not been reprocessed by these tools; runtime metadata refresh occurs when the rebuilt app executes Load. Unsupported actions, missing/conflicting evidence and EOD gaps remain blocked. Explicit approval and automatic chart-refresh acceptance remain separate. No packaging, commits or pushes were performed here.
