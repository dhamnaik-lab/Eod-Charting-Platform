# CA R1-C1 — Existing-Event TEST-DB Controlled Acceptance

IST timestamp: 2026-09-25T12:57:37.516719+05:30

## Objective
Apply only the accepted R1-B1 strict existing-event reconciliation to the three proven TEST-database candidates and prove exact linkage/idempotency without creating duplicate canonical actions or changing unrelated rows.

## Previous limitation
R1-B1 source/TDD was accepted but had intentionally performed zero user/TEST-database writes. Imports 819, 19896 and 22888 therefore remained UNRESOLVED despite their existing canonical actions 235, 379 and 337.

## Authority / bounded scope
- Current source authority: 569 files, including R1-B1 and the accepted legacy-path cleanup.
- Controlled targets only: 819 -> 235, 19896 -> 379, 22888 -> 337.
- This is **R1-C1**, the controlled acceptance slice for R1-B1. It does not close full R1-C/Reconciliation-to-Zero.

## Database backup
Raw writer-excluded pre-change TEST DB/WAL(+SHM) backup: `E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260925_121218_CA_R1C1_EXISTING_EVENT_TESTDB`.
No operational D: database was accessed.

## Final execution
The exact production `reconcile_existing_corporate_action_import_internal()` owner was invoked from an isolated ignored Rust test harness. All three rows were linked inside one `BEGIN IMMEDIATE` transaction. The owner reused the existing import-link and decision writers. No new canonical Corporate Action was created.

Expected and actual SQLite row changes through the controlled connection: **6 total** = 3 `corporate_action_imports` link/status updates + 3 `VERIFIED_EXISTING_EVENT_RECONCILIATION` decision inserts. Idempotent replay wrote 0 additional rows.

## Behavior preserved
- raw imported symbol/ISIN/event terms unchanged;
- corporate_actions row count unchanged;
- no duplicate/new canonical adjustment;
- no Safe V1/0.95/AUTO-ID1/20MICRONS/PENDING_ISIN_MISMATCH policy change;
- no schema or migration;
- no raw-price writer invoked; exact `total_changes()` accounting leaves no unaccounted SQLite row mutation through the controlled transaction;
- source files unchanged;
- Git/network/app launch not used.

## Validation performed / actual results
- inherited R1-B1 GREEN evidence verified by SHA and current source manifest;
- inherited post-cleanup full frontend/typecheck/build/Cargo evidence verified by SHA and current 569-file source manifest;
- pre-change writer-excluded DB+WAL(+SHM) capture stable and hash-manifested;
- rehearsal on raw TEST-DB copy: PASS;
- focused current-source R1-B1 regression: 10/10 PASS;
- rehearsal R1-A postcheck: three targets ALREADY_LINKED_REVIEW; 112/112 cohort accounted;
- live controlled apply: PASS; 6 exact SQLite row changes; 0 new canonical actions; replay delta 0;
- live read-only R1-A postcheck: three targets ALREADY_LINKED_REVIEW; 112/112 cohort accounted; approvalWrites=0; executedRepairs=0;
- post-change writer-excluded database-set hashes captured;
- build cache used for speed only: `E:\TA Projects\EOD Charting Platform\tmp\CA_LEGACY_RAW_PATH_CLEANUP_BUILD_CACHE`. Cargo remained `--locked --offline` and source authority determined correctness.

Post-apply 112-row summary: `{"accountedFor": 112, "applicabilityUnknownRows": 8, "coverageCertification": "NOT_ASSESSED", "databaseComplete": false, "deferredRows": 0, "inScopeBlockedRows": 101, "outcomeCounts": {"ALREADY_LINKED_REVIEW": 3, "CLASSIFICATION_REVIEW": 43, "DEFERRED_SCOPE": 0, "EVIDENCE_BLOCKED": 59, "MISSING_IMPORT": 0, "PREPARATION_ERROR": 0, "READY_FOR_EXISTING_APPROVAL_RECHECK": 0, "REPAIR_CANDIDATE": 7}}`

## Risks / limitations
This closes only the existing-event R1-B1 execution slice. Other R1-A repair/classification/evidence-blocked rows remain for later bounded R1-B/R1-C slices. No portable/UI zero-queue claim is made here.

## Rollback guidance
If this exact three-link slice must be reverted, stop EOD Chart/database tools and restore the complete pre-change DB/WAL(+SHM) set from `E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260925_121218_CA_R1C1_EXISTING_EVENT_TESTDB` as one atomic database state. Do not manually unlink individual rows without a separately reviewed rollback procedure.

## Hash evidence
Pre-change database set: `{"market-data.sqlite3": {"bytes": 83800064, "sha256": "E73DF0CE6653059036998EAEFDBA68687654BE0D499118BBA8118157951BA361"}, "market-data.sqlite3-shm": {"bytes": 32768, "sha256": "DF1C6170530B54207731D222DF720B5154877219F1A6F45616C96056F62D6A73"}, "market-data.sqlite3-wal": {"bytes": 4157112, "sha256": "10DA59D4EC53D9F40745B0348DCD4FC3F990784630753AFB503476CF7ED6A41E"}}`
Post-change database set: `{"market-data.sqlite3": {"bytes": 83812352, "sha256": "172D1B3D62821134915C1CB31379D89C81D4FC3437608B8E27142C2822D511A9"}, "market-data.sqlite3-shm": {"bytes": 32768, "sha256": "FD4C9FDA9CD3F9AE7C962B0DDF37232294D55580E1AA165AA06129B8549389EB"}, "market-data.sqlite3-wal": {"bytes": 0, "sha256": "E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855"}}`
R1-B1 evidence: `0874E0B3157179D0985D526F83A88CB94AC2BADFEC8D5C5084DA9611089F28AC`
Legacy cleanup evidence: `5DA39549344DE082C24BC3DBE0DB3134F0AFAEEAD5D4779AE8DE6916C2D8D18C`
Legacy cleanup closeout evidence: `66A644A25FB80D51BE243D4E534B3A994CE8865E8A4E7B6916EE565C475A4D5A`
