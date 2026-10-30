# NSE current-universe lifecycle coverage — Phase 1

Implemented the first remediation phase from the read-only identity audit.
Native rebuilt-desktop acceptance is separate and remains open.

## Changed behavior

- An absent active instrument outside EQ/BE/BZ/SM/ST/SZ receives
  `OUTSIDE_COVERAGE` in preview and stays ACTIVE. A missing/unknown series is held too.
- An absent covered instrument without applicable lifecycle evidence receives
  `REVIEW_REQUIRED` and stays ACTIVE. Same-ISIN matches and name-only/current-symbol
  history hints do not authorize deactivation.
- `OLD_SYMBOL` requires a unique typed SYMBOL_CHANGE/BOTH path to a different symbol
  present in the current master. Dates must parse, be effective by the local date,
  and strictly increase along the path. Cycles, conflicting outgoing edges,
  same-day successive transitions, missing targets and self-edges fail closed.
- Explicit delisting can deactivate a covered instrument using the existing
  official actual-delisted workbook. Uncovered instruments remain untouched even
  if a hint/list entry exists; their lifecycle requires an applicable source flow.
- Held rows remain visible with ACTIVE as their proposal. Preview summary badges
  distinguish Held for review and Outside coverage. Apply can execute the remaining
  reviewed changes without changing held rows' flags or metadata.
- The writer rejects a deactivation list lacking an explicit OLD_SYMBOL/DELISTED
  classification before performing any writes. Backend plan reconstruction,
  expected SHA comparison, transactions and deliberate Apply confirmation remain.
- Plan hash policy is now `NSE_CURRENT_UNIVERSE_SYNC_PLAN_V2_COVERAGE`, invalidating
  pre-fix reviewed previews even where other fields happen to be unchanged.

Existing inactive instruments are not automatically repaired or reactivated.
The patch preserves broad current NSE equity/SME ingestion and does not create a
new ingestion whitelist. This coverage check governs destructive lifecycle changes.
Raw price files, financial adjustment records and financial approval logic are not
part of this change.

## Scope, backup and evidence fixture

Runtime files: `src-tauri-shell/src/database/nse_identity_imports.rs` and the Identity
Import summary badges in `src/components/DatabaseToolsDialogs.tsx`. Updated the
reviewed-authority contract's expected hash policy and affected Rust fixtures.

Pre-edit backup:
`backups/pre_opencode_changes_20261029_025752_nse_lifecycle_coverage_phase1`.

Prepared a consistent SQLite snapshot through a source connection using `mode=ro`,
`PRAGMA query_only=ON` and a read transaction. Source `total_changes` was zero.
Retained evidence at `tmp/ca-nse-lifecycle-coverage-20261029/` includes a 161914880-byte
`proof.sqlite3`, receipt and READ_ONLY_PLAN_ONLY marker. This is an owned evidence
fixture, not disposable scratch; it is not automatically deleted. The guarded Rust
replay opens this copy read-only, only constructs the current-universe plan, and
does not invoke historical preview or Apply. No `.eod` files were copied or written.

## Validation

- PASS: 32 core `database::nse_identity_imports::tests::` Rust tests. This includes
  reviewed-plan staleness, rollback, source parsing and current/historical plan
  integration. Final compile/link 36.79s; tests 0.28s.
- PASS: seven `lifecycle_coverage_tests` with `--include-ignored`, including the
  pinned read-only snapshot replay. Final compile/link 1.40s; tests 0.27s. The
  initial six-unit run compiled in 1m13s and passed, with replay intentionally
  ignored until the snapshot was prepared. Total final unique Rust tests: 39.
- All Cargo invocations used shared-wrapper Preview followed by Run, serially.
  Three warnings in untouched `bhavcopy/holiday_sync.rs` were left unchanged.
- PASS: the 14 focused Identity Import UI/contract files, 78 tests.
- PASS: renderer profile, TypeScript and scoped whitespace.
- Documentation references and final scoped whitespace checked at handoff.
- NOT TESTED: rebuilt portable graphical/interactive acceptance.

### Guarded-copy plan result

| Measure | New plan |
| --- | ---: |
| Current symbols | 3200 |
| Activations including inserts | 29 |
| Metadata updates | 259 |
| Deactivations | **0** |
| OUTSIDE_COVERAGE, held ACTIVE | **990** |
| REVIEW_REQUIRED, held ACTIVE | **62** |

The snapshot replay asserts that every held proposal is ACTIVE and connection
`total_changes` is zero. The fixture's database SHA-256 is unchanged after replay.
No live preview/Apply or snapshot Apply occurred. The apply preservation and
positive delisting/rename tests use synthetic in-memory databases only.

The first six new safeguard tests passed. An initial broader core run passed 28 of
32 tests. Two older assertions expected deactivation solely from absence; they were
updated to require the row remain active. The rollback-injection fixture now supplies
an actual-delisted workbook so its failure still occurs on an authorized deactivation.
Two legacy fixtures also relied on an empty name-change file despite the already
strict parser contract; their default now supplies valid empty CSV headers. No
parser acceptance rule was relaxed.

No source downloads, financial approvals, database repairs, release builds,
portable staging, commits or pushes occurred. The only live-data access was
read-only creation of the retained snapshot; user data was not modified.

## Remaining work

This phase does not resolve the ten historical identity errors. No-op disposition,
equivalent predecessor representations and same-day SGB chronology remain separate
reviewed phases. A current lifecycle snapshot is not event-date financial proof.

After the user's portable rebuild, obtain a fresh current-universe preview. Inspect
the held rows' ACTIVE proposals and counts before any deliberately reviewed Apply.
Source changes may alter counts; old screenshots and this receipt do not authorize
Apply. Do not apply to production merely to verify the UI.
