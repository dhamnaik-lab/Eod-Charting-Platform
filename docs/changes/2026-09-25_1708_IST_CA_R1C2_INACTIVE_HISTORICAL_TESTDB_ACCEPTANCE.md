# CA R1-C2 — Inactive-Historical Existing-Event TEST-DB Acceptance

IST timestamp: 2026-09-25T17:08:12.323397+05:30

## Objective
Apply only the accepted R1-B2 inactive-historical existing-event reconciliation to the three authorized TEST-database candidates and prove exact linkage/idempotency without creating duplicate canonical actions or changing unrelated rows.

## Previous limitation
R1-B2 source/TDD was accepted and installed but intentionally performed zero TEST-database writes. Imports 17846, 18044 and 20973 therefore remained unresolved despite their existing canonical actions 399, 393 and 360.

## Authority / bounded scope
- Current source authority: 569 files / 563 protected, including accepted R1-B2.
- Controlled targets only: 17846 -> 399, 18044 -> 393, 20973 -> 360.
- This is R1-C2 only. Full R1-C/Reconciliation-to-Zero remains open.

## Database backup
Raw writer-excluded pre-change TEST DB/WAL(+SHM) backup: `E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260925_162636_CA_R1C2_EXISTING_EVENT_TESTDB`.
No operational D: database was accessed.

## Final execution
The exact installed production `reconcile_existing_corporate_action_import_internal()` owner was invoked from an isolated ignored Rust harness. All three rows were linked inside one `BEGIN IMMEDIATE` transaction. No new canonical Corporate Action was created.

Expected and actual SQLite logical row changes through the controlled connection: **6 total** = 3 `corporate_action_imports` link/status updates + 3 `VERIFIED_EXISTING_EVENT_RECONCILIATION` decision inserts. Idempotent replay wrote 0 additional rows.

## Behavior preserved
- raw imported symbol/ISIN/event terms unchanged;
- corporate_actions row count unchanged;
- no duplicate/new canonical adjustment;
- no Safe V1/0.95/PENDING_ISIN_MISMATCH/Quick Resolve/AUTO-ID1/R1-B1 policy change;
- no schema or migration;
- no raw-price writer invoked;
- source files unchanged by R1-C2;
- Git/network/app launch not used.

## Validation performed / actual results
- accepted R1-B2 GREEN evidence and current 569-file source manifest verified;
- accepted R1-C1 parent execution evidence verified;
- pre-change writer-excluded DB+WAL(+SHM) capture stable and hash-manifested;
- rehearsal precheck: 112/112 exact pre-state with 3 ALREADY_LINKED_REVIEW / 7 REPAIR_CANDIDATE / 43 CLASSIFICATION_REVIEW / 59 EVIDENCE_BLOCKED;
- rehearsal controlled apply: PASS; 6 exact logical row changes; 0 new canonical actions; replay delta 0;
- current-source R1-B2 regression: 5/5 PASS;
- current-source R1-B1 regression: 10/10 PASS;
- rehearsal postcheck: 6 ALREADY_LINKED_REVIEW / 4 REPAIR_CANDIDATE / 43 CLASSIFICATION_REVIEW / 59 EVIDENCE_BLOCKED;
- live DB/source raw state rechecked unchanged immediately before live apply;
- live controlled apply: PASS; exact 6 logical row changes; 0 new canonical actions; replay delta 0;
- live read-only R1-A postcheck: same 112-row expected post-state; approvalWrites=0; executedRepairs=0;
- post-change writer-excluded database-set hashes captured;
- Cargo remained `--locked --offline`; target cache used for speed only: `E:\TA Projects\EOD Charting Platform\tmp\CA_LEGACY_RAW_PATH_CLEANUP_BUILD_CACHE`.

Post-apply 112-row summary: `{"accountedFor": 112, "applicabilityUnknownRows": 8, "coverageCertification": "NOT_ASSESSED", "databaseComplete": false, "deferredRows": 0, "inScopeBlockedRows": 98, "outcomeCounts": {"ALREADY_LINKED_REVIEW": 6, "CLASSIFICATION_REVIEW": 43, "DEFERRED_SCOPE": 0, "EVIDENCE_BLOCKED": 59, "MISSING_IMPORT": 0, "PREPARATION_ERROR": 0, "READY_FOR_EXISTING_APPROVAL_RECHECK": 0, "REPAIR_CANDIDATE": 4}}`

## Risks / limitations
This closes only the R1-B2 execution slice. Four R1-A repair candidates remain and classification/evidence-blocked rows remain for later bounded work. No zero-queue, portable, UI or full database-completeness claim is made here.

## Rollback guidance
If this exact three-link slice must be reverted, stop EOD Chart/database tools and restore the complete pre-change DB/WAL(+SHM) set from `E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260925_162636_CA_R1C2_EXISTING_EVENT_TESTDB` as one database state under a separately reviewed rollback step. Do not manually unlink individual rows without a reviewed rollback procedure.

## Hash evidence
Pre-change database set: `{"market-data.sqlite3": {"bytes": 83812352, "sha256": "172D1B3D62821134915C1CB31379D89C81D4FC3437608B8E27142C2822D511A9"}, "market-data.sqlite3-shm": {"bytes": 32768, "sha256": "FD4C9FDA9CD3F9AE7C962B0DDF37232294D55580E1AA165AA06129B8549389EB"}, "market-data.sqlite3-wal": {"bytes": 0, "sha256": "E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855"}}`
Post-change database set: `{"market-data.sqlite3": {"bytes": 83812352, "sha256": "3140EE0B5BEED16D9B95FB5E8D7FE4BF01D84830DE258ACC1DB8143C412A2DF6"}, "market-data.sqlite3-shm": {"bytes": 32768, "sha256": "FD4C9FDA9CD3F9AE7C962B0DDF37232294D55580E1AA165AA06129B8549389EB"}, "market-data.sqlite3-wal": {"bytes": 0, "sha256": "E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855"}}`
R1-B2 GREEN evidence: `798107854A6CB4243D4E483CFCFDE4BAC0C75CB7A453CF7CB3F4A1889182C8F8`
R1-C1 parent evidence: `4FB973344A3D4E4DB16AEA8AC3B7E9C414B71EDBD05266F19B60A3D67EDDD9EA`
