# Dividend dependency-aware incremental validation — bounded slice

Date: 26 October 2026 IST.

The initial implementation below subsequently failed native performance acceptance
(cancelled at 24/91 after 25m09s). Its repeated compatibility work is superseded
by the [focused performance correction](2026-10-26_CA_DIVIDEND_COMPATIBILITY_PERFORMANCE_FIX.md).
Correctness checks below remain historical evidence, not performance acceptance.

## Result and boundary

Load & Validate now checks backend-owned dependency fingerprints before invoking
the full Dividend policy. Compatible saved eligible/blocked results reconstruct
the current review response; only changed/uncached IDs receive policy evaluation.
The renderer displays reused versus policy-evaluated counts and carries reuse
into immutable activity reports. This is the first bounded incremental slice,
not completion of every P1/P3 lifecycle or P2 exports.

Two additive tables separate immutable backend checkpoints from transactional
current pointers. Renderer P1 history cannot populate those pointers. One fresh
validation after rebuild is necessary to establish backend checkpoints; existing
9,023 saved P1 report items cannot safely be promoted into them.

See [dependency/transaction contract](../../outputs/2026-10-26_CA_DIVIDEND_INCREMENTAL_DEPENDENCY_CONTRACT.md)
for exact inputs, fail-closed behavior, interruption, counts and cost boundaries.
Identity/source changes conservatively invalidate all Dividend checkpoints;
import/evidence/price/canonical changes schedule their conservative date/identity
dependency group. No path/mtime/size/age or saved Ready label proves compatibility.

## Existing native P1 acceptance

User-supplied native evidence: first run completed 91/91 batches in 13m48s,
saving 9,023/9,023 results (4,274 eligible, 4,749 ineligible, zero failed).
After restart, Loaded remained 0 and Reports reopened the completed snapshot,
paging 400/9,023 rows without another scan. P1 history persistence/reopen is PASS.
That observation predates this patch and does not accept incremental Load & Validate.

## Validation

- PASS: `cargo test dividend_incremental --manifest-path src-tauri-shell/Cargo.toml -- --nocapture` — 11 focused tests on disposable file-backed/in-memory SQLite and temporary `.eod` files. Includes restart/no-change zero-policy reuse, unchanged blockers, changed/new group isolation, source/proof and price arrival/content/order changes, lineage/policy/payload invalidation, due-date buckets, failed-result retry and forced transactional rollback.
- PASS: focused Rust `dividend_prepared_scope` (13), `dividend_policy_r1` (22), and `corporate_action_history::tests` (4); all serial. The policy function is byte-identical after CRLF normalization to the required pre-edit backup (SHA-256 `F141D252E18D314A26693DE1E3080128701597933DFEE5FB31518B49E7BFB418`).
- PASS: seven focused renderer suites, 75 tests, covering orchestration/reuse counts, bridge, history, targeted refresh, explicit approval, reports and search; `tmp/**` excluded.
- Initial renderer run: FAIL, 74 passed/1 failed because a historical whole-module byte pin predated accepted dirty-worktree changes. Replaced with the verified pre-edit policy-function preservation assertion; rerun 75/75 PASS.
- PASS: scoped renderer validation (`validate-change.ps1 -Profile renderer -Paths ...`), including typecheck and whitespace.
- PASS: focused Rust formatting checks for the new owner/tests.
- NOT RUN: native incremental acceptance/representative timing, desktop build, packaging, broad validation, live migration/scan, financial approval, commit or push.

No live database, live full scan, financial approval, desktop build, packaging,
commit or push is authorized or used. The user rebuilds.

## Files changed in this slice

- `src-tauri-shell/src/database/corporate_action_imports/dividend_validation_cache.rs`: new diagnostic compatibility/checkpoint owner; `auto_approval/dividend_incremental_tests.rs`: new disposable tests.
- `bootstrap.rs`: additive cache schema; `corporate_action_imports.rs`: checkpoint bridge/counter mapping; `auto_approval.rs`: serialization, reuse counter, fingerprint visibility and test inclusion only; the policy/write-stage logic is preserved.
- `database.rs`, `corporate_action_history.rs` and `dividend_prepared_scope_bridge_tests.rs`: DTO, count validation and bridge fixture.
- Renderer `src/types/desktop.ts`, Dividend prepared-scope orchestration, validation-history mapping and `DatabaseToolsDialogs.tsx`: reuse counts and presentation. Three focused renderer test files updated.
- `HANDOFF.md`, the P1 change record, this record and the dependency contract under `outputs/`: scope, native evidence, measured checks and remaining limits.

## Protections and remaining acceptance

The underlying read-only policy and financial writer are unchanged. Explicit
Approve Ready and backend transaction rechecks remain required; cached outcomes
cannot call a writer. Targeted post-approval refresh, search/ranking/Details,
identity/provenance/manual contracts, the separate 500-ID diagnostic export and
raw price files are preserved. HEGAM/ICICIGI/HDBFS approvals were not replayed.

Native incremental acceptance still requires the user's rebuild, one seeding
validation, restart, and no-change Load & Validate showing all compatible results
reused with zero full-policy evaluations. Representative timing, due-event and
changed-evidence native observations remain unmeasured. Compatibility checking
still performs content reads, queue preparation and 100-ID transport calls.

Valid pre-edit backups: `backups/pre_opencode_changes_20261026_104117_ca_dividend_incremental`,
`backups/pre_opencode_changes_20261026_104202_ca_dividend_incremental_types`,
`backups/pre_opencode_changes_20261026_104448_ca_dividend_incremental_tests`,
`backups/pre_opencode_changes_20261026_104653_ca_dividend_incremental_display`.
