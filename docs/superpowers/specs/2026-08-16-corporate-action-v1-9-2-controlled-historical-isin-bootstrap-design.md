# Corporate Action V1.9.2 Controlled Historical ISIN Bootstrap + Identity Recheck — Design Specification

**Date:** 2026-08-16 13:18 IST  
**Status:** Approved design, written-spec review pending  
**Project:** EOD Charting Platform  
**Scope:** Controlled write-capable bootstrap for the V1.9.1.1 `BOOTSTRAP_SAFE` population only

## 1. Purpose

V1.9.1.1 proved that 283 Corporate Action imports have strict, structured official evidence sufficient to bootstrap the exact event-date historical ISIN evidence currently missing from `instrument_isin_history`.

Those 283 imports represent 281 unique historical-identity tuples because the same-date Split/Bonus pairs for GLOBE and GPIL share one historical identity transition each.

V1.9.2 will perform the first write-capable operation in this audit sequence. Its purpose is limited to:

1. revalidating the audited V1.9.1.1 candidates against current database state;
2. writing only the 281 unique exact-date historical ISIN evidence rows that still satisfy every strict gate;
3. quick-resolving only the 283 audited Corporate Action imports by reusing the existing Quick Resolve logic unchanged;
4. recording deterministic provenance and decision audit records;
5. stopping before any Corporate Action approval.

V1.9.2 does not approve Split/Bonus actions and does not change price-adjustment behavior.

## 2. Approved Audit Basis

The approved V1.9.1.1 audit produced:

```text
V1.9 baseline targets:             295
BOOTSTRAP_SAFE:                    283
COMPANY_IDENTITY_MISMATCH:           9
CONFLICTING_ISIN_HISTORY:            3
```

The 283 safe rows contain:

```text
Split:                             185
Bonus:                              98
STRONG MATCH price validation:     258
MATCH price validation:             25
Unique historical identity tuples: 281
```

The two intentional duplicate tuple groups are:

```text
GLOBE  2021-08-03  INE581X01013 -> INE581X01021
  import 1274 BONUS
  import 1275 SPLIT

GPIL   2021-10-26  INE177H01013 -> INE177H01039
  import 2541 SPLIT
  import 2548 BONUS
```

The approved V1.9.1.1 candidate artifact is:

```text
bootstrap-safe-candidates.csv
SHA-256: ea196dbbfeb344eccab4e9077b101d0eb56827dd508c3092f937d6a0a2a603a7
```

The full audit artifacts used for review were:

```text
historical-isin-bootstrap-audit.csv
SHA-256: 609d48b31ec710977db350ee25cc7c25545c4d5877c5fa47b0f0d3daa99ed500

historical-isin-bootstrap-audit-summary.txt
SHA-256: b5f825cf1062d6c0b36c2196c2db7b0c9b1e9effb66ce472527eaafb80daad95
```

These hashes bind the design to the exact reviewed V1.9.1.1 audit output.

## 3. Scope Boundary

### 3.1 Included

Only rows contained in the approved `bootstrap-safe-candidates.csv` and still passing live revalidation may be considered.

Expected audited input population:

```text
283 Corporate Action import IDs
281 unique historical ISIN tuples
```

The counts are expected results, not permission to weaken validation. A candidate that no longer matches its V1.9.1.1 fingerprint must not be written.

### 3.2 Explicitly excluded

V1.9.2 must not touch:

```text
9  COMPANY_IDENTITY_MISMATCH rows
3  CONFLICTING_ISIN_HISTORY rows
49 earlier V1.9 NO_CANDIDATE rows
all non-BOOTSTRAP_SAFE V1.9.1.1 rows
all price-review/parser-review rows outside the approved candidate artifact
```

The nine company-name anomalies remain a separate future review. The three conflicting existing ISIN-history rows remain blocked and must not be overwritten.

## 4. Core Safety Principle

V1.9.2 does not weaken Quick Resolve.

The existing Quick Resolve contract remains:

```text
unresolved Corporate Action import
        +
exactly one active current destination
        +
exact event-date historical ISIN evidence
        ↓
existing Quick Resolve logic
        ↓
PENDING / reviewable identity state
```

V1.9.2 supplies the missing historical evidence only after strict revalidation. It then invokes the same existing Quick Resolve logic for the audited imports.

## 5. Implementation Architecture

V1.9.2 uses a guarded PowerShell operator wrapper plus a narrow Rust maintenance path inside the existing Tauri binary.

No Node writer will mutate the database and no duplicate implementation of Quick Resolve is allowed.

### 5.1 Rust integration points

The implementation should remain narrowly scoped to the existing backend:

```text
src-tauri-shell/src/database/corporate_action_imports.rs
  - candidate CSV parsing/validation
  - V1.9.1.1 fingerprint recomputation
  - tuple deduplication
  - preview plan generation
  - apply orchestration
  - existing Quick Resolve invocation
  - result/report construction

src-tauri-shell/src/database/instrument_mutations.rs
  - new strict historical-ISIN evidence insert helper
  - no automatic import-status promotion side effect

src-tauri-shell/src/database.rs
  - maintenance entrypoint re-export as needed

src-tauri-shell/src/main.rs
  - explicit maintenance CLI branch before Tauri startup
  - normal application startup unchanged when maintenance flag absent
```

No React/TypeScript UI change is required for V1.9.2.

### 5.2 Operator wrapper

A standalone PowerShell wrapper will expose two modes:

```text
Default                  Preview / Dry Run
-Apply                   Explicit write mode
```

Apply additionally requires the preview manifest generated by the immediately preceding successful preview.

## 6. Why the Existing ISIN-History Upsert Cannot Be Used Directly

The existing `upsert_instrument_isin_history_evidence(...)` helper has an intentional normal-application side effect: after inserting/updating evidence it calls logic that can promote matching `PENDING_ISIN_MISMATCH` Corporate Action imports to `PENDING`.

That behavior is correct for its existing callers, but it is too broad for V1.9.2 because V1.9.2 is authorized to change only the 283 audited imports.

Therefore V1.9.2 must add a separate strict helper with semantics equivalent to:

```text
insert_historical_isin_evidence_strict_no_promotion(...)
```

The helper must:

- normalize exchange/symbol/ISIN/date using existing platform normalization;
- insert a new exact tuple only when no relevant exact row exists;
- reject a conflicting row;
- not update an existing conflicting row;
- not promote or otherwise update any Corporate Action import;
- not call `promote_matching_pending_isin_mismatch_imports`;
- return the inserted/history row identifier or a typed strict outcome.

The existing helper remains unchanged for normal application behavior.

## 7. Historical Identity Tuple Definition

The V1.9.2 write-deduplication key is:

```text
exchange
+ historical/event symbol
+ historical official ISIN
+ Corporate Action ex-date
+ current active destination ISIN
```

For actual `instrument_isin_history` insertion, the stored evidence identity is:

```text
exchange
symbol
historical ISIN
effective_date = Corporate Action ex-date
```

The current active destination ISIN participates in safety/fingerprint validation even though it is not a stored column in the historical row.

The 283 audited imports must collapse to 281 unique tuple groups before any write.

## 8. Candidate Artifact Contract

The maintenance path must parse `bootstrap-safe-candidates.csv` with the existing Rust `csv` crate and reject malformed input.

Every row must satisfy at least:

```text
classification = BOOTSTRAP_SAFE
bootstrapFingerprintVersion = ca-isin-bootstrap-v1
bootstrapFingerprint = valid 64-char SHA-256 hex
importId = positive unique integer
exchange = NSE
historicalOfficialIsin = populated
officialSymbol = populated
exDate = valid date
currentIsin = populated and != historicalOfficialIsin
sourceEvidenceCount >= 1
```

The approved candidate artifact SHA-256 must be recorded in the preview manifest. The implementation may optionally enforce the exact approved hash by default and provide no override in V1.9.2.

No row may be added by auto-discovery during apply.

## 9. V1.9.1.1 Fingerprint Parity

V1.9.2 must recompute `ca-isin-bootstrap-v1` fingerprints from live database state.

The Rust implementation must reproduce the V1.9.1.1 canonical payload and ordering rules exactly.

The implementation must include golden-vector parity tests using real reviewed candidate rows from the approved artifact.

A candidate can proceed only when:

```text
recomputed live fingerprint == audited candidate fingerprint
```

Any mismatch becomes `STALE_FINGERPRINT` and blocks apply.

Fingerprint parity is required both during Preview and again inside the Apply transaction.

## 10. Preview / Dry Run Mode

Preview is the default mode and performs zero writes.

### 10.1 Live database isolation

Preview must use the V1.9.1.1 private-snapshot pattern:

```text
assert EOD Chart process is closed
        ↓
hash live DB + WAL + SHM
        ↓
copy main DB + WAL to private timestamped snapshot
        ↓
do not copy live SHM
        ↓
verify live hashes unchanged
        ↓
Rust maintenance path opens snapshot read-only
        ↓
revalidate all 283 candidates
        ↓
verify live hashes unchanged again
```

Preview must never open the live SQLite database.

### 10.2 Preview validation

Preview must verify:

- approved candidate CSV contract;
- all 283 expected candidate import IDs reconcile exactly once;
- import is still unapproved and `UNRESOLVED`;
- exchange/action/parse state remains eligible;
- latest Split/Bonus validation remains current and `MATCHED`;
- V1.7 compound scan fingerprint remains current where applicable;
- structured source evidence is still identical to the audited state;
- exactly one active current destination still exists;
- destination ISIN/company identity remains unchanged;
- no conflicting/new historical ISIN row now exists;
- `ca-isin-bootstrap-v1` fingerprint matches;
- tuple deduplication produces the expected deterministic groups.

### 10.3 Preview apply-plan fingerprint

A successful preview generates a second deterministic fingerprint:

```text
ca-isin-bootstrap-apply-plan-v1
```

Its canonical payload includes:

```text
candidateCsvSha256
candidateCount
ordered candidate import IDs
ordered V1.9.1.1 candidate fingerprints
uniqueTupleCount
ordered unique tuple payloads
source evidence IDs/provenance
destination identities
current relevant identity-history state
live DB main/WAL/SHM pre-preview hashes
```

Equivalent state must always produce the same plan fingerprint.

## 11. Preview Manifest

Preview must write a machine-readable manifest, for example:

```text
historical-isin-bootstrap-preview-manifest.json
```

It must contain:

```text
formatVersion
mode = PREVIEW
candidateCsvPath
candidateCsvSha256
candidateCount
uniqueTupleCount
importIds
candidateFingerprints
uniqueTuples
liveDatabaseFamilyHashes
planFingerprintVersion = ca-isin-bootstrap-apply-plan-v1
planFingerprint
createdAt
previewStatus
blockingRows
```

Apply must require this manifest explicitly.

The manifest is not an authorization to skip live revalidation.

## 12. Explicit Apply Mode

Apply must require both:

```text
-Apply
-PreviewManifest <path-to-successful-preview-manifest.json>
```

There is no implicit or interactive auto-apply from Preview.

### 12.1 Pre-apply gates

Before opening the live database for writes, the PowerShell wrapper must:

1. confirm the EOD Chart process is closed;
2. resolve the exact active database folder/file;
3. hash the candidate CSV and verify it matches the preview manifest;
4. hash live DB/WAL/SHM;
5. require the live database family hashes to match the successful preview manifest;
6. create a timestamped byte backup of the live DB family;
7. verify the live files did not change during backup;
8. verify the backup copies match their source hashes;
9. print the backup path before mutation begins.

If any gate fails, no live SQLite write connection may be opened.

## 13. Backup Contract

Apply must create a backup directory such as:

```text
tmp\corporate-action-v1-9-2-preapply-backup_<timestamp>\
```

It must preserve, when present:

```text
market-data.sqlite3
market-data.sqlite3-wal
market-data.sqlite3-shm
```

It should also copy `database.json` when present for operator clarity.

The backup is a safety artifact, not an automatic restore mechanism.

If Apply fails, normal SQLite transaction rollback is the first protection. The backup is retained for explicit recovery if required.

V1.9.2 must never automatically overwrite the live database with the backup.

## 14. Apply Transaction and TOCTOU Protection

The Rust maintenance path must open the live database and begin a single write transaction before any candidate mutation.

Within that transaction it must:

1. re-read all 283 candidate imports;
2. re-read all structured source evidence;
3. re-read latest price scans/compound state;
4. re-read active destinations;
5. re-read all relevant historical ISIN state;
6. recompute all `ca-isin-bootstrap-v1` fingerprints;
7. rebuild all 281 expected unique tuples;
8. recompute `ca-isin-bootstrap-apply-plan-v1` from transactional state;
9. require exact match with the preview manifest;
10. only then begin inserts/resolution.

Any mismatch rolls back the entire transaction.

## 15. Logical Batching

The operator still performs one Apply action.

Internally, candidate processing must be partitioned into deterministic logical batches containing no more than 100 import IDs.

The batches are for progress, diagnostics, and consistency with existing Corporate Action bulk-operation constraints.

They do **not** create partial commits.

All logical batches remain inside one outer transaction. Any unexpected failure in any batch rolls back all V1.9.2 mutations.

Tuple groups must never be split in a way that causes duplicate history insertion. A tuple shared by two Corporate Action imports is processed once, then both imports are quick-resolved against that one history row.

## 16. Strict Historical ISIN Insert

For each unique tuple group, V1.9.2 must query the exact relevant history state immediately before insertion.

Normal new case:

```text
no exact historical row exists
        ↓
strict insert one row
```

Matching row already exists before V1.9.2 mutation:

- if it is proven to have been inserted by an earlier successful V1.9.2 apply with matching plan/candidate provenance, classify as `ALREADY_APPLIED` under idempotent rerun handling;
- otherwise treat it as changed state and abort before mutation.

Conflicting row:

```text
abort / rollback
```

V1.9.2 must not overwrite or repurpose conflicting historical identity evidence.

## 17. History-Row Provenance

Each new `instrument_isin_history` row must use official source provenance derived from the audited structured evidence.

Expected source:

```text
NSE_API
```

`source_ref` should retain the official source locator when available.

The note must deterministically record V1.9.2 provenance, including:

```text
V1.9.2 controlled historical-ISIN bootstrap
associated Corporate Action import ID(s)
structured evidence ID(s)
ca-isin-bootstrap-v1 candidate fingerprint(s)
ca-isin-bootstrap-apply-plan-v1 fingerprint
```

Duplicate tuple groups such as GLOBE and GPIL list both import IDs/evidence IDs in deterministic order.

## 18. Targeted Quick Resolve

After a unique history row is successfully inserted, V1.9.2 invokes the existing:

```text
quick_resolve_corporate_action_import_internal(...)
```

for each Corporate Action import mapped to that tuple.

V1.9.2 must not reimplement Quick Resolve conditions.

Expected successful result for each audited candidate:

```text
UNRESOLVED -> PENDING
```

with the existing Quick Resolve decision:

```text
VERIFIED_QUICK_RESOLUTION
```

If Quick Resolve returns an error or unexpected status for any audited candidate, the entire outer transaction rolls back.

## 19. Bootstrap Decision Audit

In addition to the existing `VERIFIED_QUICK_RESOLUTION` decision record, V1.9.2 must record one explicit decision per affected import:

```text
HISTORICAL_ISIN_BOOTSTRAP_V1_9_2
```

The reason text must include, at minimum:

```text
candidate ca-isin-bootstrap-v1 fingerprint
apply-plan fingerprint
historical tuple identity
structured evidence ID(s)
```

The bootstrap decision and Quick Resolve decision are written in the same outer transaction as the history evidence.

No schema change is required if the existing `corporate_action_import_decisions` table can hold the decision type/reason.

## 20. Allowed Mutations

V1.9.2 Apply may mutate only:

```text
instrument_isin_history
  - insert the controlled historical identity evidence rows

corporate_action_imports
  - only through existing Quick Resolve for the 283 target imports
  - expected review_status/message transition to PENDING/reviewable

corporate_action_import_decisions
  - V1.9.2 bootstrap decision
  - existing VERIFIED_QUICK_RESOLUTION decision
```

No other table may be intentionally mutated.

## 21. Forbidden Mutations

V1.9.2 must not:

```text
approve any Corporate Action
insert/update corporate_actions
change Split/Bonus factor/ratio fields
change price-validation results
create price exceptions
create ISIN mismatch approval exceptions
modify corporate_action_import_evidence
modify instruments
modify instrument_identity_history
modify raw eod_prices
modify binary EOD data
change chart-adjustment logic
process the 9 company mismatch rows
process the 3 conflicting-history rows
process the 49 NO_CANDIDATE rows
```

## 22. Idempotency

A successful V1.9.2 operation must be safely recognizable on rerun.

A rerun with the same approved candidate artifact may report `ALREADY_APPLIED` only when all of the following agree:

- exact history row exists;
- history-row provenance identifies V1.9.2;
- matching `HISTORICAL_ISIN_BOOTSTRAP_V1_9_2` decision exists for the import;
- recorded candidate fingerprint matches;
- recorded plan fingerprint matches the successfully applied plan;
- import is already in the expected post-Quick-Resolve state or later normal workflow state.

Partial/mixed evidence is not treated as success. It becomes `PARTIAL_PRIOR_APPLY` and requires investigation.

Because the primary apply uses one outer transaction, a partial state should only arise from external/manual changes or a defect.

## 23. Result Classifications

Preview and Apply reporting should use explicit result classes.

At minimum:

```text
READY
STALE_FINGERPRINT
STATE_CHANGED
HISTORY_CONFLICT
DESTINATION_CHANGED
PRICE_VALIDATION_CHANGED
SOURCE_EVIDENCE_CHANGED
MALFORMED_CANDIDATE
ALREADY_APPLIED
PARTIAL_PRIOR_APPLY
INSERTED
QUICK_RESOLVED
FAILED
```

Apply must distinguish import-level outcomes from unique-tuple write outcomes.

## 24. Apply Success Invariants

A normal first successful Apply should satisfy conceptually:

```text
candidate imports requested:       283
unique tuples planned:             281
history rows inserted:             281
imports quick-resolved:            283
stale candidates:                    0
conflicts:                           0
failed imports:                      0
transaction committed:             yes
Corporate Actions approved:          0
```

These are expected values from the approved audit, not hard-coded substitutes for live verification.

## 25. Output Artifacts

### 25.1 Preview outputs

```text
historical-isin-bootstrap-preview-summary.txt
historical-isin-bootstrap-preview.csv
historical-isin-bootstrap-preview.json
historical-isin-bootstrap-preview-manifest.json
```

### 25.2 Apply outputs

```text
historical-isin-bootstrap-apply-summary.txt
historical-isin-bootstrap-apply-imports.csv
historical-isin-bootstrap-apply-tuples.csv
historical-isin-bootstrap-apply.json
```

Reports must identify:

- candidate artifact SHA-256;
- preview/apply plan fingerprint;
- database-family hashes;
- backup path;
- import counts;
- unique tuple counts;
- inserted/history row IDs;
- Quick Resolve results;
- decision record identifiers where practical;
- skipped/already-applied/stale/conflict/error details;
- explicit statement that Corporate Actions were not approved.

## 26. PowerShell Operator Contract

Conceptual command shape:

```powershell
# PREVIEW - default, zero writes
& ".\...\Run-EOD-Corporate-Action-Historical-ISIN-Bootstrap-V1-9-2.ps1" `
    -ProjectRoot "E:\TA Projects\EOD Charting Platform" `
    -CandidatesCsv "...\bootstrap-safe-candidates.csv"

# APPLY - explicit write mode
& ".\...\Run-EOD-Corporate-Action-Historical-ISIN-Bootstrap-V1-9-2.ps1" `
    -ProjectRoot "E:\TA Projects\EOD Charting Platform" `
    -CandidatesCsv "...\bootstrap-safe-candidates.csv" `
    -PreviewManifest "...\historical-isin-bootstrap-preview-manifest.json" `
    -Apply
```

No `-Apply` means no writes.

The wrapper must print the mode prominently before any database operation.

## 27. Rust Maintenance CLI Contract

The existing Tauri binary may expose a maintenance-only command-line branch, for example:

```text
--maintenance-corporate-action-isin-bootstrap
--mode preview|apply
--database-file <path>
--candidates <path>
--preview-manifest <path>
--output <path>
```

The branch must execute and return before normal Tauri application startup.

Without the explicit maintenance flag, the normal application behaves exactly as before.

Apply mode must not be callable without both the candidate artifact and preview manifest.

## 28. Error Handling

Fail closed for any safety uncertainty.

Examples:

- malformed candidate CSV → abort Preview/Apply;
- candidate count/reconciliation mismatch → abort;
- fingerprint mismatch → Preview reports stale; Apply aborts;
- live DB hashes differ from Preview → require new Preview;
- app process running → abort before DB access;
- backup mismatch → abort before write connection;
- history conflict → rollback all;
- destination ambiguity → rollback all;
- Quick Resolve error → rollback all;
- decision audit insert error → rollback all;
- report-write failure after successful DB commit must be surfaced distinctly as `COMMITTED_REPORT_FAILURE`, never reported as rollback.

## 29. Crash/Commit Semantics

Database state is authoritative.

The apply tool must track whether the SQLite transaction committed before writing final files.

If a process/reporting failure happens after commit, it must not claim the database operation was rolled back.

On restart/rerun, V1.9.2 idempotency checks use history provenance and decision records to determine whether the apply already completed.

## 30. Test Strategy

Implementation must be TDD-first.

### 30.1 Candidate parsing/fingerprint tests

1. approved safe row parses successfully;
2. non-`BOOTSTRAP_SAFE` row rejected;
3. duplicate import ID rejected;
4. malformed SHA-256 rejected;
5. historical/current ISIN equality rejected;
6. Rust `ca-isin-bootstrap-v1` matches golden V1.9.1.1 fingerprints;
7. fingerprint changes on evidence/date/destination/history state change;
8. deterministic ordering produces stable fingerprint.

### 30.2 Tuple-deduplication tests

9. 283-row reviewed fixture collapses to 281 tuple groups;
10. GLOBE Split+Bonus share one tuple;
11. GPIL Split+Bonus share one tuple;
12. unrelated events never collapse;
13. tuple ordering is deterministic.

### 30.3 Strict insert-helper tests

14. missing exact tuple inserts one history row;
15. identical pre-existing external row is not silently overwritten;
16. conflicting exact row fails;
17. helper performs no `corporate_action_imports` promotion;
18. unrelated `PENDING_ISIN_MISMATCH` row remains unchanged;
19. existing normal upsert behavior remains unchanged in its own tests.

### 30.4 Quick Resolve reuse tests

20. inserted exact-date evidence makes existing Quick Resolve succeed;
21. successful target becomes `PENDING`;
22. existing `VERIFIED_QUICK_RESOLUTION` decision is recorded;
23. Quick Resolve failure causes outer transaction rollback.

### 30.5 Transaction/atomicity tests

24. one failing candidate rolls back all inserted history rows;
25. one failing candidate rolls back all import status changes;
26. one failing decision insert rolls back all mutations;
27. logical batches never partially commit;
28. successful 283/281 synthetic run commits expected counts.

### 30.6 Scope tests

29. 9 company mismatch IDs are not accepted from full audit input;
30. 3 conflicting-history IDs are not accepted;
31. candidate auto-discovery cannot expand the approved file;
32. no `corporate_actions` row is created;
33. no factor/price/raw-EOD mutation occurs;
34. no non-target import status changes.

### 30.7 Preview/apply binding tests

35. Preview performs zero writes;
36. Apply without `-Apply` impossible;
37. Apply without preview manifest rejected;
38. candidate CSV hash mismatch rejected;
39. DB-family hash mismatch requires new Preview;
40. plan fingerprint mismatch rejected inside transaction;
41. backup created and verified before write connection.

### 30.8 Idempotency/recovery tests

42. second run after successful apply reports `ALREADY_APPLIED` deterministically;
43. partial provenance is `PARTIAL_PRIOR_APPLY` and blocked;
44. committed DB + report failure is detected as committed on rerun;
45. backup remains untouched after success/failure.

### 30.9 Regression validation

At minimum run:

- focused Corporate Action Rust tests;
- instrument mutation/history tests;
- EOD adjustment tests;
- Corporate Action frontend tests even though no frontend source changes are expected;
- renderer typecheck;
- renderer build;
- `cargo check` / `tauri:check`.

No portable build is required until source validation is green and the user chooses to rebuild the application.

## 31. Acceptance Criteria

V1.9.2 implementation is accepted only if:

1. Preview is zero-write and uses only a private DB+WAL snapshot.
2. Apply requires an explicit `-Apply` switch and successful Preview manifest.
3. The exact reviewed candidate artifact is hash-bound.
4. Rust reproduces all V1.9.1.1 candidate fingerprints.
5. All candidates are revalidated inside the write transaction.
6. 283 audited imports deduplicate to 281 expected tuple groups under unchanged state.
7. The strict history insert has no automatic unrelated-import promotion side effect.
8. Only exact historical ISIN evidence is inserted.
9. Existing Quick Resolve logic is invoked unchanged for each target import.
10. Any unexpected candidate failure rolls back the entire apply transaction.
11. All bootstrap/Quick Resolve decisions are auditable.
12. No Corporate Action is approved.
13. No Corporate Action factor is changed.
14. No price exception is created.
15. No raw EOD/binary EOD data is changed.
16. The 9 company mismatches remain untouched.
17. The 3 conflicting-history rows remain untouched.
18. The 49 earlier no-candidate rows remain untouched.
19. Apply is idempotently recognizable on rerun.
20. A verified pre-apply DB-family backup is retained.

## 32. Post-V1.9.2 Operator State

After a successful Apply, the expected 283 imports should be identity-resolved/reviewable through normal platform state, while Corporate Action approval remains pending.

The next phase is therefore not automatic approval. The operator returns to the Corporate Actions workbench, refreshes/revalidates state as required, reviews the READY population, and only then uses the existing explicit approval workflow.

The 12 excluded identity cases remain a separate audit stream.

## 33. Non-Goals

V1.9.2 does not:

- solve ticker-as-company-name source anomalies;
- repair the three existing conflicting history rows;
- solve the 49 NO_CANDIDATE identities;
- change identity fuzzy matching;
- change Corporate Action parser semantics;
- change compound Split/Bonus math;
- change price-validation thresholds;
- approve Corporate Actions;
- change chart adjustment behavior;
- modify raw prices;
- add a general migration framework;
- add new UI workflow beyond existing Corporate Actions state after completion.

## 34. Completion Definition

V1.9.2 is complete when:

1. a Preview against the current database produces a fully reconciled, zero-write plan;
2. the user reviews and explicitly authorizes Apply;
3. Apply creates and verifies the pre-write DB-family backup;
4. Apply revalidates the same plan inside one live SQLite transaction;
5. strict historical identity evidence is inserted once per unique tuple;
6. existing Quick Resolve resolves only the audited target imports;
7. all expected audit decision records are written;
8. the transaction commits with no Corporate Action approval or raw-price mutation;
9. final reports reconcile import-level and tuple-level counts;
10. a rerun can prove the operation already completed without duplicating writes.
