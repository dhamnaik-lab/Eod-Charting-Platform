# Identity ER4 — Source Candidate Review, Version History, Promotion & Rollback Design R1

**Date:** 2026-09-15 IST  
**Workstream:** `E:\TA Projects\EOD Charting Platform`  
**Current self-contained source authority:** `Eod Charting Platform Source Code 2026-09-15_020218_IST.zip`  
**Authority SHA-256:** `8C3C9092DC2F6190FEB3703A174721570493DC52510F862FBBBB904C6D7B6BB6`  
**Protected source authority:** `543 files exact`  
**Status:** DESIGN R1 WRITTEN SPEC APPROVED / IMPLEMENTATION PLAN AUTHORIZED / SOURCE IMPLEMENTATION NOT AUTHORIZED

## 1. Objective

ER4 adds the operator-governed configuration layer after ER3 candidate discovery and validation.

ER3 is already closed and establishes:

```text
ER1    configured-source health / drift evidence
ER3-A  official-domain candidate discovery
ER3-B  bounded candidate acquisition + source-contract validation
```

ER3 deliberately stops at non-promoting technical evidence:

```text
DISCOVERED_NOT_PROMOTED
VALIDATED_CANDIDATE_NOT_PROMOTED
INDETERMINATE_CANDIDATE
REJECTED_CANDIDATE
```

ER4 is responsible for the missing governance and durable configuration layer:

```text
operator candidate review
→ keep current / reject / approve
→ durable decision record
→ versioned source configuration
→ stale-fenced explicit promotion
→ post-promotion ER1 health evidence
→ reviewed rollback as a new version
```

ER4 must not collapse source configuration into I3/I4 Identity-data Apply authority. URL configuration and Identity-data mutation remain separate reviewed authorities.

## 2. Why ER4 is required

The current application already supports manual official-source recovery, but it has no durable source-version authority.

Current manual behavior is:

```text
Check Source Health
→ inspect evidence
→ optionally export recovery briefs
→ open Official Source URLs
→ overwrite officialSourceUrls.v1
→ clear previous health result
→ run Check Source Health again
```

The current backend stores the complete nine-field official-source configuration as one mutable JSON setting:

```text
officialSourceUrls.v1
```

`settings.rs` writes that value through a generic UPSERT. `official_source_urls.rs` reads it, overlays non-empty values on hardcoded defaults, and intentionally does not rewrite a saved override. There is currently no source version ID, revision fence, review fingerprint, decision history, promotion record, rollback lineage, or atomic history owner.

ER4 is required if the completed ER3-A/B capabilities are to be used safely inside the application instead of remaining private technical kernels.

## 3. Current authority preserved

ER4 Design R1 must preserve exactly:

```text
I3     CLOSED / ACTIVE reviewed Preview → Apply authority
I4     CLOSED / ACTIVE reviewed Preview → atomic Apply authority
ER0    RESOLVED / CLOSED
ER1    CLOSED / CURRENT
ER2    CLOSED / CURRENT
ER3-A  CLOSED / GREEN
ER3-B  CLOSED / GREEN
ER3-C  OMITTED / NOT IMPLEMENTED / NOT REQUIRED
ER3    CLOSED / CURRENT
ER4    DESIGN R1 APPROVED IN CHAT / IMPLEMENTATION NOT AUTHORIZED
ER5+   NOT AUTHORIZED
```

ER4 must not alter without separate approval:

- I3 Preview/Apply review authority;
- I4 Preview/atomic Apply, rollback and stale-SHA protections;
- ER1 11-source health report contract, UI and freshness semantics;
- ER2 resolver/shadow semantics;
- ER3-A discovery ordering, limits and `DISCOVERED_NOT_PROMOTED` authority;
- ER3-B NSE-only GET transport, body budgets, parser/population validation and non-promoting classifications;
- existing download commands and managed Identity archive behavior;
- existing manual source-recovery UI behavior;
- BSE candidate recovery;
- deferred NSE symbol-change temp-staging concurrency issue;
- ER5+.

## 4. Existing implementation facts that constrain ER4

### 4.1 Current settings owner

`src-tauri-shell\src\database\settings.rs` exposes generic:

```text
get_setting
set_setting
```

`set_setting` directly UPSERTs a row in `settings(key, value, updated_at)`.

### 4.2 Current official-source key

`src-tauri-shell\src\database\official_source_urls.rs` defines:

```text
OFFICIAL_SOURCE_URLS_SETTING_KEY = "officialSourceUrls.v1"
```

The effective configuration contains nine fields:

```text
nseSecuritiesAvailablePageUrl
nseEquityMasterUrl
nseSmeMasterUrl
nseSymbolChangeUrl
nseCompanyNameChangeUrl
nseDelistedPageUrl
nseDelistedWorkbookUrl
bseListScripsUrlPrefix
bseListScripsReferer
```

When the setting is absent, malformed, or omits a field, existing defaults remain effective.

### 4.3 Current manual UI

`src\components\DatabaseToolsDialogs.tsx` owns the existing Official Source URLs editor. The current Apply action writes the complete nine-field JSON through `api.setSetting(...)`, then clears the previous source-health result so the operator can run `Check Source Health` again.

ER4 must preserve this visible workflow.

### 4.4 Existing database bootstrap

`src-tauri-shell\src\database\bootstrap.rs` owns connection preparation:

```text
apply pragmas
→ run migrations
→ seed defaults
```

The database already uses WAL, foreign keys, a 15-second busy timeout and centralized `CREATE TABLE IF NOT EXISTS` migrations. ER4 schema creation and baseline migration must use this existing ownership path rather than creating a parallel database bootstrap mechanism.

## 5. Architectural decision

Use one database-owned, per-source version ledger with one mutation owner.

Expected new backend modules:

```text
src-tauri-shell\src\database\official_source_version_history.rs
src-tauri-shell\src\database\official_source_candidate_review.rs
```

Expected related owners to change in later implementation stages:

```text
src-tauri-shell\src\database\bootstrap.rs
src-tauri-shell\src\database\settings.rs
src-tauri-shell\src\database\official_source_urls.rs
src-tauri-shell\src\database\official_source_candidate_validation.rs
src-tauri-shell\src\database\official_source_health.rs
src-tauri-shell\src\database.rs
src-tauri-shell\src\main.rs
src\types\desktop.ts
src\platform\types.ts
src\platform\tauriDesktop.ts
src\components\DatabaseToolsDialogs.tsx
```

These are expected surfaces, not implementation authorization.

No second URL settings store, host allowlist, parser, ER1 health engine or ER3 transport stack should be created.

## 6. ER4 responsibility boundary

### ER4 owns

- durable per-source version history;
- one current-version pointer per source field;
- monotonically increasing source revision;
- baseline migration from the existing effective configuration;
- versioned manual overrides;
- ER3-B candidate → deterministic ER4 review plan conversion;
- review fingerprint;
- operator decisions;
- stale-review rejection;
- explicit candidate promotion;
- rollback as a new version;
- compatibility mirror maintenance for `officialSourceUrls.v1`;
- post-promotion/post-rollback ER1 health-result linkage;
- operator-visible history and review workflow.

### ER4 does not own

- ER3 discovery algorithms;
- ER3 candidate transport/parser logic;
- ER1 health semantics;
- I3/I4 Identity-data Apply;
- Corporate Action Apply;
- BSE candidate discovery/validation/promotion;
- automatic URL promotion;
- automatic rollback;
- raw CSV/XLSX body persistence;
- arbitrary web search;
- deferred NSE temp-staging concurrency repair;
- ER5+.

## 7. Source identity registry for ER4

ER4 must freeze one internal registry for all nine configured fields.

Each registry entry must define:

```text
sourceKey
exchange
sourceId (optional for configuration-only fields)
sourceRole (optional for configuration-only fields)
configField
candidatePromotionEligible
```

Required R1 registry:

| Source key | Exchange | Frozen source ID | Frozen role/purpose | Config field | Candidate promotion in ER4 R1 |
|---|---|---|---|---|---|
| `NSE_SECURITIES_AVAILABLE_PAGE` | NSE | — | configuration-only landing page | `nseSecuritiesAvailablePageUrl` | No — manual/versioned only |
| `NSE_CURRENT_EQUITY_MASTER` | NSE | `NSE_CURRENT_EQUITY_MASTER` | `CURRENT_IDENTITY_MASTER` | `nseEquityMasterUrl` | Yes |
| `NSE_CURRENT_SME_MASTER` | NSE | `NSE_CURRENT_SME_MASTER` | `CURRENT_IDENTITY_MASTER_SME` | `nseSmeMasterUrl` | Yes |
| `NSE_SYMBOL_CHANGE_HISTORY` | NSE | `NSE_SYMBOL_CHANGE_HISTORY` | `HISTORICAL_SYMBOL_CONTINUITY` | `nseSymbolChangeUrl` | Yes |
| `NSE_COMPANY_NAME_CHANGE_HISTORY` | NSE | `NSE_COMPANY_NAME_CHANGE_HISTORY` | `HISTORICAL_NAME_CONTINUITY` | `nseCompanyNameChangeUrl` | Yes |
| `NSE_DELISTED_PAGE` | NSE | — | configuration-only landing page | `nseDelistedPageUrl` | No — manual/versioned only |
| `NSE_DELISTED_COMPANIES_WORKBOOK` | NSE | `NSE_DELISTED_COMPANIES_WORKBOOK` | `DELISTED_LIFECYCLE_EVIDENCE` | `nseDelistedWorkbookUrl` | Yes |
| `BSE_LIST_SCRIPS_URL_PREFIX` | BSE | — | configuration-only BSE endpoint prefix | `bseListScripsUrlPrefix` | No — manual/versioned only |
| `BSE_LIST_SCRIPS_REFERER` | BSE | — | configuration-only BSE referer | `bseListScripsReferer` | No — manual/versioned only |

Automated candidate review/promotion is therefore limited to the five frozen NSE ER3-B source contracts.

Configuration-only labels above are ER4 registry descriptors, not new ER0/ER3 source contracts.

This registry must be the single ER4 source-key mapping authority; substring inference is prohibited.

## 8. Persistence architecture

ER4 R1 uses three SQLite tables in the active database.

### 8.1 `official_source_url_versions`

Append-only immutable source versions.

Proposed schema:

```sql
CREATE TABLE IF NOT EXISTS official_source_url_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  source_key TEXT NOT NULL,
  exchange TEXT NOT NULL,
  source_id TEXT,
  source_role TEXT,
  source_revision INTEGER NOT NULL CHECK (source_revision >= 1),
  url TEXT NOT NULL,
  parent_version_id INTEGER REFERENCES official_source_url_versions(id),
  batch_id TEXT NOT NULL,
  change_kind TEXT NOT NULL CHECK (
    change_kind IN ('BASELINE_IMPORT','MANUAL_OVERRIDE','CANDIDATE_PROMOTION','ROLLBACK')
  ),
  candidate_content_sha256 TEXT,
  validation_report_sha256 TEXT,
  operator_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (source_key, source_revision)
);
```

Required indexes:

```text
(source_key, source_revision DESC)
batch_id
parent_version_id
```

Rows are never updated or deleted by normal ER4 operations. For configuration-only fields, `source_id` and `source_role` are NULL; for the five frozen ER3-B contracts they contain the exact frozen source ID and role/purpose from the ER4 registry.

### 8.2 `official_source_url_current`

Current active pointer and revision per source field.

Proposed schema:

```sql
CREATE TABLE IF NOT EXISTS official_source_url_current (
  source_key TEXT PRIMARY KEY,
  current_version_id INTEGER NOT NULL REFERENCES official_source_url_versions(id),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

The revision increments exactly once for every successful source-key change.

A no-op manual save must not increment revision.

### 8.3 `official_source_review_events`

Durable operator review/decision evidence.

Proposed schema:

```sql
CREATE TABLE IF NOT EXISTS official_source_review_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  source_key TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_role TEXT NOT NULL,
  base_version_id INTEGER NOT NULL REFERENCES official_source_url_versions(id),
  base_revision INTEGER NOT NULL,
  current_url TEXT NOT NULL,
  candidate_url TEXT,
  candidate_final_url TEXT,
  candidate_content_sha256 TEXT,
  validation_report_json TEXT,
  validation_report_sha256 TEXT,
  review_fingerprint TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (
    decision IN ('KEEP_CURRENT','REJECT_CANDIDATE','APPROVE_PROMOTION','ROLLBACK_APPROVED')
  ),
  result_version_id INTEGER REFERENCES official_source_url_versions(id),
  result_status TEXT NOT NULL CHECK (
    result_status IN (
      'RECORDED',
      'PROMOTED',
      'PROMOTED_HEALTHY',
      'PROMOTED_HEALTH_CHECK_FAILED',
      'ROLLBACK_COMPLETED',
      'ROLLBACK_HEALTHY',
      'ROLLBACK_HEALTH_CHECK_FAILED'
    )
  ),
  operator_note TEXT,
  post_health_configuration_fingerprint TEXT,
  post_health_report_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);
```

Raw downloaded source bodies are forbidden from this table.

## 9. Authority model between ledger and compatibility JSON

### 9.1 After ER4 baseline migration

The authoritative current source configuration becomes:

```text
official_source_url_current
→ official_source_url_versions
```

`officialSourceUrls.v1` remains as a compatibility mirror only.

### 9.2 Compatibility mirror rule

Every successful ER4 source mutation must update, in the same SQLite transaction:

```text
new immutable version row(s)
current pointer(s) + revision(s)
review event, when applicable
full nine-field officialSourceUrls.v1 JSON mirror
```

A committed state in which current pointers and `officialSourceUrls.v1` disagree is invalid.

### 9.3 Read rule

After successful ER4 baseline migration, backend effective-source loading should prefer the ER4 current ledger.

`officialSourceUrls.v1` remains required for compatibility and existing UI behavior but is no longer the authoritative current-pointer owner.

### 9.4 Direct generic-setting bypass

After ER4-B is active, a generic `set_setting` request targeting `officialSourceUrls.v1` must fail closed with an explicit error such as:

```text
OFFICIAL_SOURCE_URLS_REQUIRES_REVIEWED_SAVE
```

It performs zero write.

The existing Official Source URLs UI must be migrated to the dedicated reviewed manual-save command, which carries the expected configuration fingerprint and source revisions. This preserves the visible manual workflow without leaving a stale-unfenced generic bypass.

`get_setting(officialSourceUrls.v1)` may continue returning the compatibility mirror for legacy/read compatibility. All other generic settings preserve current behavior.

## 10. Baseline migration

Baseline migration occurs once per active database.

### 10.1 Preconditions

Run from the existing database migration/bootstrap owner after ER4 tables exist.

### 10.2 Effective baseline source

Determine the current effective nine-field configuration exactly as the application does today:

1. start with frozen defaults;
2. read `officialSourceUrls.v1` if present;
3. apply valid non-empty override fields;
4. if JSON is absent or malformed, preserve current fallback-to-default behavior.

Malformed or partial legacy JSON must preserve its **effective current behavior** during migration: unsupported/missing fields continue to fall back to frozen defaults. The baseline transaction may normalize the raw compatibility JSON into a complete nine-field mirror, but it must not change any effective source URL.

### 10.3 Atomic baseline transaction

If `official_source_url_current` has no rows:

1. generate one baseline `batch_id`;
2. insert nine `BASELINE_IMPORT` version rows with `source_revision = 1`;
3. insert nine current pointers with `revision = 1` and verify each pointer references the matching revision-1 row;
4. serialize the exact effective nine-field configuration into `officialSourceUrls.v1` as a full normalized compatibility mirror;
5. commit atomically.

If any baseline step fails, no ER4 table may be left partially initialized.

### 10.4 Idempotency and integrity

Subsequent database opens must create no additional baseline versions.

At database preparation time:

- `official_source_url_current` row count `0` means baseline migration is required;
- row count `9` requires the exact frozen nine source keys, valid referenced version rows, and `current.revision == versions.source_revision`;
- any partial row count, unknown key, missing version target, duplicate revision, or pointer/revision mismatch fails closed as ER4 ledger corruption.

ER4 R1 must not silently reconstruct or delete a partially inconsistent ledger during normal application startup.

## 11. Manual editor preservation and versioning

The existing Official Source URLs dialog remains visible and functionally available.

### 11.1 Visible behavior preserved

Keep:

- the same nine fields;
- Reset Defaults;
- Apply;
- existing input normalization;
- existing success/error surface;
- clearing stale source-health evidence after a successful save.

### 11.2 Internal save contract

Replace direct generic-setting ownership with an ER4 command that receives:

```text
expectedConfigurationFingerprint
expectedSourceRevisions
nine normalized source fields
optional operator note
```

The backend compares the proposed values to the current ledger.

For every changed field:

```text
change_kind = MANUAL_OVERRIDE
```

All changed fields from one Apply click share one `batch_id` and commit atomically.

An unchanged save creates no version, no revision increment and no history event.

### 11.3 Manual edit validation policy

ER4 R1 must not introduce a new hard provenance/network validation requirement before a manual save.

This preserves the accepted emergency/manual recovery behavior.

A manual save may later fail ER1 health/provenance, exactly as today; that failure is evidence, not grounds to remove the manual path.

### 11.4 Stale-editor protection

The editor must load and retain the current configuration fingerprint plus all nine source revisions.

Apply fails with zero write if any reviewed source revision changed before commit.

The UI must reload and ask the operator to review the newer configuration.

## 12. Configuration fingerprint

ER4 needs one deterministic aggregate configuration fingerprint for manual-editor stale detection.

Fingerprint inputs, in fixed source-key order:

```text
schema version
source key
current version ID
current revision
current URL
```

Canonical serialization must be explicit and versioned before hashing.

Timestamps do not participate.

The digest algorithm is SHA-256 uppercase hex.

Canonical configuration-fingerprint payload is compact UTF-8 JSON with this exact logical shape:

```text
[
  "ER4_CONFIG_V1",
  [
    [sourceKey, currentVersionId, revision, currentUrl],
    ... exactly nine rows in frozen ER4 registry order ...
  ]
]
```

No whitespace, timestamps or object-key ordering may influence the digest.

## 13. ER4 candidate review plan

ER4-A converts one eligible ER3-B candidate result into a deterministic read-only review plan.

### 13.1 Preconditions

Candidate review is eligible only when:

- source key is one of the five NSE candidate-promotion-eligible entries;
- current source version exists;
- current configured URL matches the ER3-B request base;
- candidate result belongs to the same source ID/role;
- candidate classification is one of the frozen ER3-B result states.

### 13.2 Review-plan fields

At minimum:

```text
schemaVersion
sourceKey
exchange
sourceId
sourceRole
baseVersionId
baseRevision
currentUrl
candidateUrl
candidateFinalUrl
candidateContentSha256
classification
discoveryReason
httpStatus
contentType
responseBytes
parserStatus
schemaStatus
populationStatus
populationCount
freshnessStatus
validationReason
validationReportSha256
reviewFingerprint
```

Raw candidate body is absent.

### 13.3 Validation-report hash

Create a canonical ER3-B evidence projection and hash it using SHA-256 uppercase hex.

Canonical validation-report payload is compact UTF-8 JSON with this exact logical shape:

```text
[
  "ER4_VALIDATION_V1",
  sourceKey,
  sourceId,
  sourceRole,
  currentUrl,
  candidateUrl,
  candidateFinalUrl,
  candidateContentSha256,
  classification,
  discoveryReason,
  httpStatus,
  contentType,
  responseBytes,
  parserStatus,
  schemaStatus,
  populationStatus,
  populationCount,
  freshnessStatus,
  validationReason
]
```

JSON null is used for absent optional values. No timestamp or object-key ordering may influence the digest.

## 14. Review fingerprint

The review fingerprint fences operator decisions against stale source state or changed remote content.

Canonical inputs:

```text
ER4 review schema version
source key
source ID
source role
base version ID
base revision
current URL
candidate URL
candidate final URL
candidate content SHA-256
ER3-B classification
validation report SHA-256
```

Timestamps and operator notes do not participate.

The fingerprint is SHA-256 uppercase hex.

Canonical review-fingerprint payload is compact UTF-8 JSON with this exact logical shape:

```text
[
  "ER4_REVIEW_V1",
  sourceKey,
  sourceId,
  sourceRole,
  baseVersionId,
  baseRevision,
  currentUrl,
  candidateUrl,
  candidateFinalUrl,
  candidateContentSha256,
  classification,
  validationReportSha256
]
```

## 15. Operator-visible candidate workflow

### 15.1 Entry point

Continue using the existing Source Health area.

For an ER1 result that is both:

- eligible under the existing frozen ER3-B failure-trigger mapping; and
- one of the five ER4 promotion-eligible NSE source contracts;

show:

```text
Find Official Replacement Candidates
```

Do not show the action for:

- healthy sources;
- BSE sources;
- `NSE_SECURITIES_AVAILABLE_PAGE`;
- `NSE_DELISTED_PAGE`;
- unsupported source roles.

### 15.2 Candidate presentation

Display current source and candidate evidence side by side.

Current source:

```text
source ID / role
current URL
current version ID
current revision
latest ER1 health evidence when available
```

Candidate:

```text
candidate URL
final URL
discovery reason
HTTP status
content type
byte count
content SHA-256
parser/schema/population states
population count
freshness state
validation reason
classification
```

### 15.3 Mandatory classification labels

Display the exact ER3 classifications:

```text
DISCOVERED_NOT_PROMOTED
VALIDATED_CANDIDATE_NOT_PROMOTED
INDETERMINATE_CANDIDATE
REJECTED_CANDIDATE
```

No UI copy may imply that “validated” means “approved.”

## 16. Operator decisions

### 16.1 Keep Current

Available for a reviewed candidate.

Behavior:

- stale-fence the review;
- persist `KEEP_CURRENT` review event;
- current version remains unchanged;
- no compatibility JSON change;
- optional note allowed.

### 16.2 Reject Candidate

Available for a reviewed candidate.

Behavior:

- stale-fence the review;
- require non-empty rejection note;
- persist `REJECT_CANDIDATE`;
- current version remains unchanged.

### 16.3 Approve Replacement

Available only when:

```text
classification == VALIDATED_CANDIDATE_NOT_PROMOTED
```

It must remain unavailable for:

```text
DISCOVERED_NOT_PROMOTED
INDETERMINATE_CANDIDATE
REJECTED_CANDIDATE
```

Confirmation text must state explicitly:

```text
This changes only the configured official source URL.
It does not import data or execute I3/I4 Apply.
```

No decision is automatic.

## 17. Decision stale fencing

Before any decision event is persisted, reload:

- current version ID;
- current revision;
- current URL.

Require exact equality with the reviewed base.

If stale, return transient command result:

```text
STALE_REJECTED
```

The stale attempt performs **zero database write**: no review event, no source version, no current-pointer change and no compatibility-mirror change.

A stale candidate requires a new review plan.

For `KEEP_CURRENT` and `REJECT_CANDIDATE`, acquire one `BEGIN IMMEDIATE` transaction, perform the stale check inside that transaction, insert the committed review event only after the check passes, and then commit. These decisions never create a source-version row.

For promotion/rollback, remote revalidation occurs before the mutation transaction; the base version/revision is checked again inside `BEGIN IMMEDIATE` immediately before any write.

## 18. Candidate promotion revalidation

Promotion requires fresh candidate revalidation immediately before the mutation transaction.

### 18.1 ER3-B reuse

ER4 must call a minimal internal ER3-B direct-candidate revalidation API.

It must not duplicate:

- host allowlist;
- redirect policy;
- timeout/body budgets;
- content-type logic;
- source parsers;
- population checks.

### 18.2 Promotion revalidation requirements

Require:

```text
same source ID / role
same candidate URL
final URL remains officially valid
classification == VALIDATED_CANDIDATE_NOT_PROMOTED
candidate content SHA-256 == reviewed candidate SHA-256
validation report SHA-256 == reviewed evidence hash
```

If remote bytes changed, reject the reviewed plan before write and require a new review.

## 19. Atomic candidate promotion

After successful revalidation, open one `BEGIN IMMEDIATE` transaction.

Inside that transaction:

1. re-read base version/revision and fail stale before write;
2. persist the `APPROVE_PROMOTION` review event in a non-final state owned by the transaction;
3. insert one `CANDIDATE_PROMOTION` version row with `parent_version_id = current_version_id` and `source_revision = base_revision + 1`;
4. update that source key’s current pointer to the new version and set current revision to the same new source revision;
5. rebuild the complete effective nine-field configuration from current pointers;
6. update the `officialSourceUrls.v1` compatibility mirror;
7. link the review event to the resulting version;
8. set transaction result to `PROMOTED`;
9. commit.

Any failure before commit rolls back every ER4 mutation.

Promotion never runs I3/I4 or source-data import.

## 20. Post-promotion ER1 health

After the promotion transaction commits, assess the **exact committed configuration snapshot** returned by that transaction.

ER4 must reuse the existing ER1 internal health engine by exposing/refactoring an internal `pub(crate)` explicit-configuration helper as needed. It must not call a path that silently reloads a newer configuration after the promotion transaction.

Persist:

```text
post_health_configuration_fingerprint
post_health_report_json
```

The fingerprint is the ER4 configuration fingerprint of the exact nine-source snapshot that ER1 assessed. The full ER1 report may be stored because it contains aggregate evidence only, not source bodies.

The promotion result is evaluated against the affected source's existing ER1 result mapping; unrelated source failures do not relabel the promoted source itself. The full report remains available for audit.

### 20.1 Success

When the affected ER1 source result satisfies the existing ER1 compatible/healthy semantics, update the review event to:

```text
PROMOTED_HEALTHY
```

### 20.2 Failure / unavailable health check

When the affected ER1 source result fails/is unavailable, or the health run itself cannot complete, update to:

```text
PROMOTED_HEALTH_CHECK_FAILED
```

Do not automatically roll back.

The UI must show an explicit reviewed Rollback action.

Reason: ER3-B already revalidated the candidate immediately before promotion; a subsequent health failure may be transient. Automatic rollback would create a second unreviewed mutation.

## 21. Version history UI

ER4 must expose per-source history without changing the existing manual editor’s primary function.

At minimum show:

```text
version ID
revision
active marker
URL
change kind
parent version ID
created time
candidate SHA when applicable
review decision/result when applicable
operator note
post-health status when applicable
```

History is newest-first and read-only.

Version rows are immutable.

## 22. Rollback design

Rollback creates a new version; it never rewinds a current pointer directly to an old row and never deletes history.

### 22.1 Rollback selection

Operator chooses a prior version belonging to the same source key.

Show:

```text
current active URL/version/revision
selected historical URL/version
lineage/change-kind evidence
latest relevant health evidence
```

### 22.2 Rollback target revalidation

Before operator confirmation, validate:

- selected version exists;
- same source key/ID/role;
- official provenance remains valid;
- selected URL still satisfies the relevant frozen source contract through ER3-B direct-candidate revalidation for eligible NSE contracts.

For source keys not supported by ER3-B candidate validation, ER4 R1 does not offer automated rollback. The existing manual editor remains the fallback.

### 22.3 Rollback fingerprint

Freeze:

```text
schema version
source key
current version ID
current revision
current URL
target historical version ID
target URL
target validation SHA-256
```

### 22.4 Atomic rollback transaction

After explicit operator confirmation:

1. stale-fence current version/revision;
2. insert `ROLLBACK_APPROVED` review event;
3. insert a new immutable `ROLLBACK` source version whose URL equals the selected historical URL, whose parent is the current version, and whose `source_revision = current_revision + 1`;
4. update current pointer to that new version and set current revision to the same source revision;
6. update compatibility JSON;
7. link review event to new rollback version;
8. commit.

History example:

```text
v7  URL-A
v8  URL-B  CANDIDATE_PROMOTION
v9  URL-A  ROLLBACK
```

v8 remains permanently auditable.

### 22.5 Post-rollback health

Run ER1 after commit against the exact committed rollback configuration snapshot using the same explicit-configuration health helper and persist its configuration fingerprint/report.

For the affected source, result becomes:

```text
ROLLBACK_HEALTHY
```

or:

```text
ROLLBACK_HEALTH_CHECK_FAILED
```

Unrelated source failures remain evidence in the full report but do not relabel the rollback target's result.

No automatic second rollback is allowed.

## 23. Review-event durability and crash semantics

### 23.1 Pre-commit failure

If promotion/rollback transaction fails before commit:

- no version row;
- no current-pointer change;
- no compatibility JSON change;
- no durable approval event from that failed transaction.

The command returns `FAILED_NO_WRITE` as a transient result to the caller; normal ER4 history contains only committed events.

### 23.2 Post-commit / pre-health interruption

A committed promotion/rollback may exist with result:

```text
PROMOTED
ROLLBACK_COMPLETED
```

On next ER4/history load, these states are recognized as `POST_HEALTH_PENDING` operationally and the operator can explicitly run/retry the health check.

ER4 must never infer that an unrecorded post-health check passed.

## 24. Concurrency model

ER4 uses:

- existing SQLite WAL mode;
- existing 15-second busy timeout;
- `BEGIN IMMEDIATE` for every source-version mutation;
- per-source monotonic revision;
- aggregate configuration fingerprint for manual multi-field edits.

Required race behavior:

- two concurrent promotions: first commit wins; second stale-rejects;
- manual save racing with promotion: stale side rejects before mutation;
- rollback racing with manual save: stale side rejects;
- multiple app instances: database lock + revision checks prevent silent last-write-wins on source authority.

The deferred NSE temp-staging concurrency issue is unrelated and remains untouched.

## 25. Public backend contract

ER4 may add dedicated Tauri commands; generic ER3-A/B internals remain private.

Expected command categories:

```text
getOfficialSourceConfigurationAuthority
saveOfficialSourceUrlsReviewed
findOfficialSourceReplacementCandidates
createOfficialSourceCandidateReview
recordOfficialSourceCandidateDecision
promoteOfficialSourceCandidateReviewed
listOfficialSourceHistory
createOfficialSourceRollbackReview
applyOfficialSourceRollbackReviewed
retryOfficialSourcePostHealth
```

Exact command names may be adjusted during the implementation plan only if semantics remain identical and the final plan freezes the names before source changes.

No command may expose raw downloaded source bodies.

## 26. Frontend contract

ER4 should extend the existing database-tooling surface rather than create a separate top-level application.

Expected frontend additions:

- source-configuration authority metadata: version/revision/fingerprint;
- replacement-candidate state on eligible ER1 rows;
- candidate-review panel/modal;
- source-version history panel;
- explicit decision confirmation;
- explicit rollback confirmation;
- post-health status and retry affordance.

The existing Official Source URLs dialog remains present.

## 27. Security and provenance rules

ER4 must preserve all existing official-source security boundaries.

### Candidate promotion

Only ER3-B validated NSE candidates are eligible.

### Manual editor

Manual edits remain accepted under current visible behavior. ER4 records them as `MANUAL_OVERRIDE`; it does not falsely label them ER3-validated.

### BSE

BSE fields may be versioned when manually changed, because they are part of the existing configuration.

ER4 R1 must not add:

- BSE discovery;
- BSE candidate validation;
- automated BSE promotion;
- BSE automated rollback through ER3-B.

### Raw content

Raw CSV/XLSX bodies are not persisted in ER4 history or review events.

## 28. Failure handling

Fail closed at each authority boundary.

### Read-only failures

Examples:

- unsupported source key;
- no current version;
- malformed candidate report;
- candidate/source-role mismatch;
- non-promotable classification.

These produce no write.

### Stale failures

Examples:

- current version changed;
- current revision changed;
- current URL changed;
- reviewed candidate hash changed;
- review fingerprint mismatch.

These return transient `STALE_REJECTED` with zero database write: no review event, version row, current-pointer change or compatibility-mirror change.

### Transaction failures

Any error during version/pointer/mirror/review mutation rolls back the transaction.

### Post-health failures

Do not roll back automatically. Persist the failed post-health status and require explicit operator action.

## 29. ER4 staged implementation authority

The approved architecture is staged to preserve bounded-problem discipline.

### ER4-A — deterministic review authority

Read-only only:

- source registry;
- configuration authority read model;
- ER3-B result → ER4 review plan;
- deterministic validation-report hash;
- deterministic review fingerprint;
- promotability rules;
- stale-plan contract tests;
- no DB schema or write;
- no UI mutation action.

### ER4-B — version ledger + manual compatibility

- schema/migration;
- nine-source baseline import;
- current pointers/revisions;
- compatibility mirror;
- manual editor routed through version owner;
- no candidate promotion;
- restart/concurrency/failure-injection tests.

### ER4-C — operator candidate review

- ER1 eligible-source action;
- ER3 discovery/validation invocation through dedicated command;
- review UI;
- durable `KEEP_CURRENT` and `REJECT_CANDIDATE` decisions;
- history viewer;
- no promotion.

### ER4-D — explicit candidate promotion

- fresh ER3-B candidate revalidation;
- SHA/report/fingerprint stale fencing;
- atomic promotion;
- compatibility mirror;
- post-promotion ER1 health;
- no automatic rollback.

### ER4-E — reviewed rollback + final acceptance

- prior-version review;
- target revalidation;
- atomic rollback-as-new-version;
- post-rollback ER1 health;
- full frontend/backend regressions;
- manual operator checkpoint;
- portable Windows validation as applicable;
- authority closeout and fresh source snapshot.

No later stage begins automatically when an earlier stage turns GREEN. Each stage requires explicit approval or an approved fast-track authority that names the included stages.

## 30. Required tests

### 30.1 ER4-A

At minimum:

1. registry contains exactly nine unique source keys;
2. exactly five sources are candidate-promotion eligible;
3. BSE sources are not candidate-promotion eligible;
4. landing-page sources are not candidate-promotion eligible;
5. review-plan hash deterministic;
6. review fingerprint deterministic;
7. source/candidate mismatch rejects;
8. stale base-version contract rejects;
9. only `VALIDATED_CANDIDATE_NOT_PROMOTED` is promotable;
10. review plan contains no raw response body;
11. ER3-A/B behavior unchanged.

### 30.2 ER4-B

At minimum:

1. clean DB creates all three ER4 tables;
2. defaults produce exactly nine baseline versions/pointers;
3. valid legacy JSON baseline preserves exact effective values;
4. malformed legacy JSON preserves current default fallback behavior;
5. baseline is idempotent across reopen;
6. one-field manual edit creates exactly one version;
7. multi-field manual edit is one atomic batch;
8. manual no-op creates no version/revision;
9. every version row’s `source_revision` is monotonic and unique per source key;
10. `officialSourceUrls.v1` mirror equals current ledger after commit;
11. direct generic `set_setting(officialSourceUrls.v1)` is rejected with zero write;
12. stale editor revisions reject with zero write;
13. injected transaction failure leaves no partial ledger/mirror state;
14. partial/corrupt current-ledger state fails closed instead of auto-repairing;
15. state survives restart.

### 30.3 ER4-C

At minimum:

1. eligible failed NSE ER1 row exposes candidate action;
2. healthy source does not;
3. BSE source does not;
4. landing-page source does not;
5. candidate classifications are visibly distinct;
6. Keep Current persists no URL version;
7. Reject requires note and persists no URL version;
8. history viewer reflects committed decisions;
9. existing manual editor remains available.

### 30.4 ER4-D

At minimum:

1. non-promotable classifications reject;
2. revalidation is mandatory;
3. changed candidate SHA rejects before write;
4. changed current revision rejects before write;
5. promotion inserts one new version and increments revision once;
6. compatibility mirror updated atomically;
7. failure injection leaves no partial state;
8. promotion does not invoke I3/I4;
9. post-health PASS records `PROMOTED_HEALTHY`;
10. post-health failure records `PROMOTED_HEALTH_CHECK_FAILED` without auto-rollback.

### 30.5 ER4-E

At minimum:

1. rollback target must belong to same source;
2. unsupported target source contract cannot use automated rollback;
3. target revalidation required;
4. stale current revision rejects;
5. rollback creates a new version, never rewinds/deletes;
6. failed promotion remains in history;
7. post-health PASS/FAIL statuses recorded;
8. restart preserves entire lineage;
9. manual recovery still works after rollback implementation.

## 31. Preservation validation

As applicable after each source-changing stage, run:

```text
official_source_runtime_provenance_
er1_
er2a_
er2b_
er2c1_
er2c2_
er3a_
er3b_
i3_reviewed_
i4_historical_
NSE delisted discovery/fallback
```

Plus scope-appropriate:

```text
focused ER4 Rust tests
focused Vitest
TypeScript typecheck
frontend build
cargo check --locked --offline
migration tests
failure-injection tests
restart-persistence tests
manual UI checkpoint
portable Windows validation when UI stage is complete
```

A narrow focused test does not replace broader validation when the changed owner can affect wider behavior.

## 32. Evidence and artifact policy

Routine ER4 task evidence:

```text
E:\TA Projects\EOD Charting Platform\tmp
```

Source snapshot evidence only:

```text
E:\TA Projects\EOD Charting Platform Source Audit
```

Every meaningful source/build/configuration change requires:

```text
docs\changes\YYYY-MM-DD_HHMM_IST_<DESCRIPTIVE_TOPIC>.md
```

with actual commands/results, preservation, risks, rollback and hashes.

## 33. Rollback principle for implementation stages

Each ER4 stage must define a bounded rollback.

ER4-A should be source-only/read-only and removable without database migration.

Once ER4-B creates durable schema/history, rollback must preserve existing ledger evidence even if the feature is disabled. Destructive dropping of ER4 history is not an ordinary rollback mechanism.

Later rollback of an ER4 implementation means restoring application behavior while retaining or explicitly migrating durable audit history safely.

## 34. Non-goals

ER4 Design R1 does not authorize:

- BSE candidate recovery;
- automated landing-page promotion;
- automatic promotion;
- automatic rollback;
- I3/I4 Apply after source change;
- raw candidate body persistence;
- arbitrary web search;
- remote/multi-user approval identity;
- role-based access control;
- cloud synchronization;
- ER5+;
- deferred NSE temp-staging concurrency repair;
- unrelated database or UI refactoring.

## 35. Acceptance criteria for full ER4 closure

ER4 may close only when:

- source history is durable, immutable and per source;
- every active source has a current version/revision;
- legacy/manual source configuration remains visibly usable;
- generic settings cannot bypass history;
- manual edits are versioned as `MANUAL_OVERRIDE`;
- only explicit local operator confirmation can promote;
- only `VALIDATED_CANDIDATE_NOT_PROMOTED` can be promoted;
- reviewed candidate content is revalidated and SHA-fenced at promotion;
- stale configuration/review state rejects before write;
- promotion is atomic across version/current/mirror/review state;
- rollback creates a new version and preserves failed versions;
- no automatic rollback occurs;
- post-promotion/post-rollback ER1 health evidence is recorded truthfully;
- raw remote source bodies are not persisted by ER4;
- I3/I4 remain separate reviewed data-mutation paths;
- BSE candidate recovery remains excluded;
- all required backend/frontend/build/manual validations pass;
- ER4 current-authority closeout is written;
- a fresh self-contained source snapshot is independently accepted.

## 36. Implementation gate

This document defines ER4 Design R1 only.

Source implementation is not authorized until:

1. this written specification is reviewed and explicitly approved;
2. a separate staged ER4 implementation plan is written from this approved specification;
3. that implementation plan is reviewed/approved before ER4-A source changes begin.

ER5+, BSE candidate recovery, landing-page promotion, automatic promotion/rollback, I3/I4 Apply coupling and the deferred concurrency issue remain separately gated.
