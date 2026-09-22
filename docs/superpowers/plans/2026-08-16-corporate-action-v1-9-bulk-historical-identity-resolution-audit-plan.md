# Corporate Action V1.9 Bulk Historical Identity Resolution Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone, read-only Node.js/SQLite diagnostic that re-audits the 344 V1.8 `IDENTITY_MATCH_REQUIRED__PRICE_MATCHED` Split/Bonus rows, classifies their historical identity evidence, and exports deterministic STRICT SAFE fingerprints without resolving or approving anything.

**Architecture:** Keep V1.9 outside production application code. A PowerShell runner discovers the active database and the latest V1.8 baseline CSV, then launches a Node.js CLI. The CLI opens SQLite with `readOnly: true` plus `PRAGMA query_only=1`, loads immutable audit inputs through a small database adapter, performs all identity-graph/classification/fingerprint logic in pure JavaScript, and writes TXT/CSV/JSON outputs only to a timestamped `tmp` directory.

**Tech Stack:** PowerShell 7.x; Node.js 22+ built-ins (`node:sqlite`, `node:test`, `node:crypto`, `node:fs`, `node:path`); SQLite; no npm dependency additions; SHA-256.

## Global Constraints

- V1.9 may only `READ`, `CLASSIFY`, `EXPLAIN`, `FINGERPRINT`, and `EXPORT`.
- V1.9 must not resolve identity, update imports, approve actions, write exceptions, change symbols/ISINs, change Corporate Action factors, change raw EOD, or modify the adjustment engine.
- No production file under `src/` or `src-tauri-shell/` is modified.
- Target baseline is the V1.8 rows whose `auditBucket` is exactly `IDENTITY_MATCH_REQUIRED__PRICE_MATCHED`; the known baseline count is 344, but the implementation must re-check live state and report drift rather than assume 344 remains active.
- STRICT SAFE mirrors the current backend Quick Resolve safety posture: unresolved/unapproved Split or Bonus, current passing official price scan, exactly one active NSE candidate, exact event-date historical ISIN evidence for that candidate, deterministic/non-conflicting lineage, and a deterministic evidence fingerprint.
- Company-name similarity or symbol similarity alone must never produce STRICT SAFE.
- Multi-hop NSE identity history is allowed only when deterministic and conflict-free.
- Any uncertainty fails closed to `LIKELY_MISSING_EVIDENCE`, `AMBIGUOUS`, `NO_CANDIDATE`, `DATA_STATE_ANOMALY`, or `STATE_CHANGED`.
- Live SQLite must be opened with `{ readOnly: true }`, `PRAGMA query_only=1` must be verified, and required schema must be checked before analysis.
- The runner must tell the operator to close the EOD Chart app for the live audit, then hash the database sidecar set (`market-data.sqlite3`, existing `-wal`, existing `-shm`) before and after the run and fail if any file changes.
- Output may be written only beneath `E:\TA Projects\EOD Charting Platform\tmp\corporate-action-identity-audit_<timestamp>` unless the operator explicitly supplies another output directory.
- No new npm packages.
- Tests use synthetic temporary SQLite databases only; tests must never point at the live database.
- Current backend behavior to mirror is reference-only in `src-tauri-shell/src/database/corporate_action_imports.rs`: `quick_resolve_corporate_action_import_internal`, `load_identity_chain_instrument_candidates`, `has_instrument_isin_history_evidence`, and `list_resolution_suggestions_for_import_row`. These Rust functions are not modified.

---

## File Structure

The implementation package should be generated as a standalone folder named:

`EOD_Chart_Corporate_Action_Phase1_Bulk_Historical_Identity_Resolution_Audit_V1_9_<YYYY-MM-DD_HHMM_IST>`

Files inside that package:

- `Run-EOD-Corporate-Action-Bulk-Historical-Identity-Resolution-Audit-V1-9.ps1` — resolves active DB + latest V1.8 baseline, proves file immutability, runs tests, invokes the audit CLI.
- `README.md` — operator instructions, expected outputs, execution-policy note, and explicit no-mutation statement.
- `tools/identity-resolution-audit-cli.cjs` — argument validation, orchestration, exit codes, output paths.
- `tools/identity-resolution-audit-db.cjs` — read-only SQLite open/schema guards and all SQL reads.
- `tools/identity-resolution-audit-core.cjs` — CSV parser, state/scan validation, graph traversal, classification, canonical serialization, SHA-256 fingerprint inputs, reconciliation.
- `tools/identity-resolution-audit-export.cjs` — deterministic TXT/CSV/JSON/STRICT SAFE output generation.
- `tests/identity-resolution-audit-core.test.cjs` — pure-logic tests.
- `tests/identity-resolution-audit-integration.test.cjs` — synthetic SQLite fixtures covering DB behavior, strict safeguards, read-only enforcement, and output reconciliation.
- `docs/changes/2026-08-16_<HHMM>_IST_CORPORATE_ACTION_PHASE1_V1_9_BULK_HISTORICAL_IDENTITY_RESOLUTION_AUDIT.md` — package change/acceptance report; copied into the package for operator review, not written into the live project by the audit runner.

Project documentation already exists separately:

- `docs/superpowers/specs/2026-08-16-corporate-action-v1-9-bulk-historical-identity-resolution-audit-design.md`
- `docs/superpowers/plans/2026-08-16-corporate-action-v1-9-bulk-historical-identity-resolution-audit-plan.md`

---

### Task 1: Baseline Loader, Read-Only Database Guard, and Schema Contract

**Files:**
- Create: `tools/identity-resolution-audit-core.cjs`
- Create: `tools/identity-resolution-audit-db.cjs`
- Create: `tests/identity-resolution-audit-core.test.cjs`
- Create: `tests/identity-resolution-audit-integration.test.cjs`

**Interfaces:**
- `parseCsv(text: string): Array<Record<string,string>>`
- `loadV18Baseline(csvText: string): { expectedRows: BaselineRow[], expectedCount: number }`
- `openAuditDatabase(dbPath: string): DatabaseSync`
- `assertAuditSchema(db: DatabaseSync): void`
- `assertQueryOnly(db: DatabaseSync): void`
- `loadCurrentImportState(db: DatabaseSync, importId: number): CurrentImportRow | null`

`BaselineRow` contains at minimum:

```js
{
  importId: Number,
  exchange: String,
  symbol: String,
  isin: String,
  companyName: String,
  exDate: String,
  actionType: String,
  baselineValidationLabel: String,
  baselineScanStatus: String
}
```

- [ ] **Step 1: Write baseline CSV parser tests using the real V1.8 column names**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCsv, loadV18Baseline } = require('../tools/identity-resolution-audit-core.cjs');

test('loads only V1.8 identity-match-required price-matched rows', () => {
  const csv = [
    'auditBucket,recommendation,importId,exchange,symbol,isin,companyName,exDate,actionType,validationLabel,scanStatus',
    'IDENTITY_MATCH_REQUIRED__PRICE_MATCHED,"Resolve identity, not price",101,NSE,OLD,INE000A01001,"Example, Limited",2020-01-10,SPLIT,STRONG MATCH,MATCHED',
    'PRICE_REVIEW,"Review price",102,NSE,OTHER,INE000A01002,Other Limited,2020-01-10,SPLIT,NEEDS REVIEW,REVIEW'
  ].join('\r\n');
  const result = loadV18Baseline(csv);
  assert.equal(result.expectedCount, 1);
  assert.equal(result.expectedRows[0].importId, 101);
  assert.equal(result.expectedRows[0].companyName, 'Example, Limited');
});
```

- [ ] **Step 2: Run the core test and verify it fails before implementation**

Run:

```powershell
node --test tests\identity-resolution-audit-core.test.cjs
```

Expected: FAIL because `identity-resolution-audit-core.cjs` or exported functions do not yet exist.

- [ ] **Step 3: Implement a dependency-free RFC-4180-compatible CSV parser and strict V1.8 baseline filter**

Implementation requirements:

```js
function loadV18Baseline(csvText) {
  const rows = parseCsv(csvText);
  const required = [
    'auditBucket','importId','exchange','symbol','isin','companyName',
    'exDate','actionType','validationLabel','scanStatus'
  ];
  assertColumns(rows, required);
  const expectedRows = rows
    .filter((row) => row.auditBucket === 'IDENTITY_MATCH_REQUIRED__PRICE_MATCHED')
    .map(normalizeBaselineRow);
  const ids = new Set(expectedRows.map((row) => row.importId));
  if (ids.size !== expectedRows.length) throw new Error('V1.8 baseline contains duplicate importId values.');
  return { expectedRows, expectedCount: expectedRows.length };
}
```

Reject malformed CSV, non-integer import IDs, non-NSE rows in the strict target, and action types outside `SPLIT`/`BONUS` as baseline anomalies rather than silently coercing them.

- [ ] **Step 4: Write synthetic SQLite schema/read-only tests**

Create a temp DB containing the exact minimum columns used from:

```text
corporate_action_imports
corporate_action_import_evidence
corporate_action_scan_results
scan_runs
instrument_identity_history
instrument_isin_history
instruments
```

Then assert:

```js
const db = openAuditDatabase(dbPath);
assert.doesNotThrow(() => assertAuditSchema(db));
assert.doesNotThrow(() => assertQueryOnly(db));
assert.throws(() => db.exec('UPDATE corporate_action_imports SET review_status = review_status'), /readonly|read-only|query_only/i);
```

- [ ] **Step 5: Implement the DB open and schema guard**

Use exactly:

```js
const db = new DatabaseSync(dbPath, { readOnly: true });
db.exec('PRAGMA query_only = ON;');
```

Then verify `PRAGMA query_only` returns `1`. `assertAuditSchema()` must use `sqlite_master` plus `PRAGMA table_info(<table>)` and fail with an explicit missing-table/missing-column list.

- [ ] **Step 6: Run Task 1 tests**

Run:

```powershell
node --test tests\identity-resolution-audit-core.test.cjs tests\identity-resolution-audit-integration.test.cjs
```

Expected: PASS.

- [ ] **Step 7: Commit if the execution workspace is Git-backed**

```powershell
if (git rev-parse --is-inside-work-tree 2>$null) {
  git add tools/identity-resolution-audit-core.cjs tools/identity-resolution-audit-db.cjs tests/identity-resolution-audit-core.test.cjs tests/identity-resolution-audit-integration.test.cjs
  git commit -m "test: establish v1.9 identity audit contracts"
}
```

---

### Task 2: Live-State Drift and Current Price-Scan Revalidation

**Files:**
- Modify: `tools/identity-resolution-audit-db.cjs`
- Modify: `tools/identity-resolution-audit-core.cjs`
- Modify: `tests/identity-resolution-audit-core.test.cjs`
- Modify: `tests/identity-resolution-audit-integration.test.cjs`

**Interfaces:**
- `loadLatestOfficialScan(db, importId): ScanRow | null`
- `loadSameDateCompoundContext(db): Map<string, CompoundContext>`
- `evaluateTargetState(baselineRow, currentImport, scan, compoundContext): TargetStateResult`

`TargetStateResult.status` is exactly one of:

```text
ELIGIBLE
STATE_CHANGED
DATA_STATE_ANOMALY
```

- [ ] **Step 1: Add failing tests for resolved/approved/missing/stale/current states**

Required cases:

```js
assert.equal(evaluateTargetState(base, unresolved, currentMatchedScan, ctx).status, 'ELIGIBLE');
assert.equal(evaluateTargetState(base, approved, currentMatchedScan, ctx).status, 'STATE_CHANGED');
assert.equal(evaluateTargetState(base, pending, currentMatchedScan, ctx).status, 'STATE_CHANGED');
assert.equal(evaluateTargetState(base, unresolved, staleSymbolScan, ctx).status, 'DATA_STATE_ANOMALY');
assert.equal(evaluateTargetState(base, unresolved, reviewScan, ctx).status, 'DATA_STATE_ANOMALY');
assert.equal(evaluateTargetState(base, null, null, ctx).status, 'STATE_CHANGED');
```

- [ ] **Step 2: Run the targeted tests and verify failure**

Run:

```powershell
node --test --test-name-pattern="target state|scan currentness|compound fingerprint" tests\identity-resolution-audit-core.test.cjs tests\identity-resolution-audit-integration.test.cjs
```

Expected: FAIL because the state/scan evaluator is not implemented.

- [ ] **Step 3: Implement latest completed `official_imports` scan loading**

Mirror the current V1.8/V1.7 semantics:

```sql
SELECT s.*
FROM corporate_action_scan_results s
JOIN scan_runs r ON r.id = s.scan_run_id
WHERE s.corporate_action_import_id = ?
  AND r.scope = 'official_imports'
  AND r.status = 'COMPLETED'
ORDER BY s.scanned_at DESC, s.id DESC
LIMIT 1
```

A passing price scan requires `scan_status='MATCHED'`; confidence determines `MATCH` versus `STRONG MATCH` only for reporting, not eligibility.

- [ ] **Step 4: Implement V1.7 compound currentness verification**

Parse metadata only from:

```text
[CA_COMPOUND_V1 factor=<number> count=<integer> fingerprint=<value>]
```

Recompute the same-date Split/Bonus component fingerprint from still-live, parsed, non-rejected rows grouped by exact `exchange + symbol + ex_date`. If scan metadata contains a compound fingerprint and the current group/fingerprint differs, classify `DATA_STATE_ANOMALY` with reason `COMPOUND_COMPONENT_SET_OR_FACTOR_CHANGED`.

- [ ] **Step 5: Implement target-state drift logic**

The baseline import is eligible only when live state remains:

```text
review_status = UNRESOLVED
approved_corporate_action_id IS NULL
action_type in SPLIT/BONUS
parse_status = PARSED
exchange = NSE
latest official scan = MATCHED and current
```

If the import exists but has been resolved/approved or is no longer unresolved, report `STATE_CHANGED`; do not classify its identity graph.

- [ ] **Step 6: Run Task 2 tests**

Run the full Node test suite. Expected: PASS.

- [ ] **Step 7: Commit if Git-backed**

```powershell
if (git rev-parse --is-inside-work-tree 2>$null) {
  git add tools tests
  git commit -m "feat: revalidate v1.9 target state and price evidence"
}
```

---

### Task 3: Identity Graph, Exact Event-Date Evidence, and Fail-Closed Classification

**Files:**
- Modify: `tools/identity-resolution-audit-db.cjs`
- Modify: `tools/identity-resolution-audit-core.cjs`
- Modify: `tests/identity-resolution-audit-core.test.cjs`
- Modify: `tests/identity-resolution-audit-integration.test.cjs`

**Interfaces:**
- `loadIdentityHistory(db, exchange): IdentityHistoryRow[]`
- `loadIsinHistory(db, exchange): IsinHistoryRow[]`
- `loadInstruments(db, exchange): InstrumentRow[]`
- `buildIdentityGraph(historyRows): IdentityGraph`
- `analyzeIdentity(row, graph, isinHistory, instruments): IdentityAnalysis`
- `classifyIdentity(analysis): ClassificationResult`

`ClassificationResult.classification` is exactly one of:

```text
STRICT_SAFE
LIKELY_MISSING_EVIDENCE
AMBIGUOUS
NO_CANDIDATE
DATA_STATE_ANOMALY
```

- [ ] **Step 1: Add failing pure-logic tests for all identity classifications**

Cover at least:

```text
1. Direct exact event-date evidence + one active destination -> STRICT_SAFE
2. Deterministic OLD_A -> OLD_B -> CURRENT multi-hop -> STRICT_SAFE
3. One active candidate but no exact event-date evidence -> LIKELY_MISSING_EVIDENCE
4. Two active candidates -> AMBIGUOUS
5. Conflicting historical ISIN paths -> AMBIGUOUS
6. No connected current instrument -> NO_CANDIDATE
7. Cross-exchange evidence -> DATA_STATE_ANOMALY
8. Directed symbol-change cycle -> AMBIGUOUS
9. Similar company name only -> never STRICT_SAFE
10. Similar symbol only -> never STRICT_SAFE
```

- [ ] **Step 2: Run classification tests and verify they fail**

Run:

```powershell
node --test --test-name-pattern="STRICT SAFE|multi-hop|ambiguous|no candidate|similarity|cycle|cross-exchange" tests\identity-resolution-audit-core.test.cjs
```

Expected: FAIL.

- [ ] **Step 3: Load identity tables read-only and normalize once per audit**

Use these exact source tables:

```sql
SELECT id, exchange, isin, current_symbol, current_name, old_symbol, old_name,
       new_symbol, new_name, effective_date, change_type, source, source_ref
FROM instrument_identity_history
WHERE UPPER(exchange) = 'NSE'
ORDER BY effective_date, id;

SELECT id, exchange, symbol, isin, effective_date, source, source_ref, note
FROM instrument_isin_history
WHERE UPPER(exchange) = 'NSE'
ORDER BY symbol, effective_date, id;

SELECT symbol, exchange, isin, name, series, COALESCE(is_active,1) AS is_active,
       lifecycle_status
FROM instruments
WHERE UPPER(exchange) = 'NSE'
ORDER BY symbol;
```

Normalize exchange/symbol/ISIN using uppercase trimmed values; preserve original values separately for output.

- [ ] **Step 4: Implement candidate discovery to mirror backend Quick Resolve semantics**

Seed the connected component with official `symbol` and official `ISIN`. Treat each `instrument_identity_history` row as connecting its non-empty `old_symbol`, `new_symbol`, `current_symbol`, and `isin` within the same exchange. Candidate instruments are NSE instruments whose symbols are in that connected component.

For each candidate, exact event-date evidence is true only when an `instrument_isin_history` row matches all four normalized values exactly:

```text
exchange = NSE
symbol = candidate.symbol
isin = official import ISIN
effective_date = import.ex_date
```

This deliberately mirrors `has_instrument_isin_history_evidence()`.

- [ ] **Step 5: Add deterministic path construction and conflict detection**

For transparency, retain identity-history row IDs as edges. Compute a shortest deterministic path from the event symbol/ISIN seed to each candidate, sorting ties by:

```text
effective_date ASC, history row id ASC, destination symbol ASC
```

Detect directed symbol-change cycles using only meaningful historical transitions (`old_symbol -> new_symbol` or `old_symbol -> current_symbol` when different). Do not treat the reverse traversal used for connected-component discovery as a cycle by itself.

Flag `DATA_STATE_ANOMALY` for any safety-relevant row whose normalized exchange differs from NSE. Flag `AMBIGUOUS` when valid evidence supports branching active destinations or a directed cycle makes lineage non-deterministic.

- [ ] **Step 6: Implement the strict classification order**

Use this fail-closed order:

```js
if (analysis.dataAnomalies.length) return DATA_STATE_ANOMALY;
if (analysis.directedCycle || analysis.conflictingEvidence) return AMBIGUOUS;
if (analysis.activeCandidates.length > 1) return AMBIGUOUS;
if (analysis.activeCandidates.length === 0) return NO_CANDIDATE;
const only = analysis.activeCandidates[0];
if (!only.hasExactEventDateIsinEvidence) return LIKELY_MISSING_EVIDENCE;
if (!only.deterministicPath) return AMBIGUOUS;
return STRICT_SAFE;
```

Do not use company-name or symbol similarity as a positive gate.

- [ ] **Step 7: Record rejected candidates/reasons**

Each candidate record must expose reasons such as:

```text
INACTIVE_HISTORICAL_ONLY
MISSING_EXACT_EVENT_DATE_ISIN_EVIDENCE
COMPETING_ACTIVE_CANDIDATE
CONFLICTING_LINEAGE
CROSS_EXCHANGE
UNSUPPORTED_OR_NONDETERMINISTIC_HOP
```

- [ ] **Step 8: Run Task 3 tests**

Run all Node tests. Expected: PASS.

- [ ] **Step 9: Commit if Git-backed**

```powershell
if (git rev-parse --is-inside-work-tree 2>$null) {
  git add tools tests
  git commit -m "feat: classify historical identity evidence fail closed"
}
```

---

### Task 4: Canonical Evidence Fingerprints and STRICT SAFE Snapshot Contract

**Files:**
- Modify: `tools/identity-resolution-audit-core.cjs`
- Modify: `tests/identity-resolution-audit-core.test.cjs`

**Interfaces:**
- `buildFingerprintPayload(target, identityAnalysis): FingerprintPayload`
- `canonicalStringify(value): string`
- `computeEvidenceFingerprint(payload): string`

- [ ] **Step 1: Add failing fingerprint stability and drift tests**

Required assertions:

```js
assert.equal(computeEvidenceFingerprint(payloadA), computeEvidenceFingerprint(deepClone(payloadA)));
assert.notEqual(computeEvidenceFingerprint(payloadA), computeEvidenceFingerprint({...payloadA, exDate: '2020-01-11'}));
assert.notEqual(computeEvidenceFingerprint(payloadA), computeEvidenceFingerprint(payloadWithDifferentEvidenceRow));
assert.notEqual(computeEvidenceFingerprint(payloadA), computeEvidenceFingerprint(payloadWithCompetingCandidate));
assert.notEqual(computeEvidenceFingerprint(payloadA), computeEvidenceFingerprint(payloadWithDifferentFinalIsin));
```

- [ ] **Step 2: Run fingerprint tests and verify failure**

Run:

```powershell
node --test --test-name-pattern="fingerprint|canonical" tests\identity-resolution-audit-core.test.cjs
```

Expected: FAIL.

- [ ] **Step 3: Implement recursive canonical serialization**

Rules:

- Object keys sorted lexicographically.
- Arrays preserve semantic order only where order is meaningful (`identityPath`); set-like arrays (`eventEvidence`, `candidateSet`) must be sorted before serialization.
- Strings are normalized UTF-8 JSON strings.
- Numbers must be finite; reject NaN/Infinity.
- `undefined` is not permitted in fingerprint payloads.

- [ ] **Step 4: Implement the versioned fingerprint payload**

The payload must include:

```js
{
  schema: 'CA_IDENTITY_AUDIT_V1',
  import: { id, exchange, officialSymbol, officialIsin, exDate, actionType },
  priceScan: { scanId, scanRunId, scanStatus, scanSymbol, scanExchange, expectedFactor, scannedAt, compoundFingerprint },
  eventEvidence: [{ id, exchange, symbol, isin, effectiveDate, source, sourceRef }],
  identityPath: [{ historyId, effectiveDate, changeType, oldSymbol, newSymbol, currentSymbol, isin, source, sourceRef }],
  candidateSet: [{ symbol, exchange, isin, isActive, hasExactEventDateIsinEvidence }],
  selectedDestination: { symbol, exchange, isin }
}
```

Compute:

```js
crypto.createHash('sha256').update(canonicalStringify(payload), 'utf8').digest('hex')
```

Only STRICT SAFE rows receive a non-empty fingerprint.

- [ ] **Step 5: Run Task 4 tests**

Expected: PASS, including competitor-introduction fingerprint change.

- [ ] **Step 6: Commit if Git-backed**

```powershell
if (git rev-parse --is-inside-work-tree 2>$null) {
  git add tools/identity-resolution-audit-core.cjs tests/identity-resolution-audit-core.test.cjs
  git commit -m "feat: fingerprint v1.9 identity evidence snapshots"
}
```

---

### Task 5: Deterministic Audit Exports and Count Reconciliation

**Files:**
- Create: `tools/identity-resolution-audit-export.cjs`
- Modify: `tests/identity-resolution-audit-core.test.cjs`
- Modify: `tests/identity-resolution-audit-integration.test.cjs`

**Interfaces:**
- `buildAuditSummary(result): string`
- `writeAuditOutputs(outputDir, result): { summaryPath, csvPath, jsonPath, strictSafePath }`

- [ ] **Step 1: Add failing export/reconciliation tests**

Tests must assert:

```text
expected baseline = eligible + state changed + data/state anomalies discovered before identity analysis
eligible = STRICT_SAFE + LIKELY_MISSING_EVIDENCE + AMBIGUOUS + NO_CANDIDATE + identity-stage DATA_STATE_ANOMALY
strict-safe-candidates.csv row count = STRICT_SAFE count
no non-STRICT_SAFE row has a fingerprint
```

Also verify stable ordering by:

```text
classification priority, exDate DESC, importId ASC
```

- [ ] **Step 2: Run export tests and verify failure**

Run the full Node suite. Expected: FAIL because exporter is not implemented.

- [ ] **Step 3: Implement `identity-resolution-audit-summary.txt`**

The summary must show at minimum:

```text
Expected V1.8 target population: <n>
Still eligible for V1.9 identity analysis: <n>
State changed since V1.8: <n>
Data/state anomalies: <n>

STRICT SAFE: <n>
LIKELY - MISSING EVIDENCE: <n>
AMBIGUOUS: <n>
NO CANDIDATE: <n>
DATA/STATE ANOMALY: <n>
```

For each STRICT SAFE row include import ID, event symbol/ISIN/date, destination symbol/ISIN, chain depth, exact event-date evidence IDs, and SHA-256 fingerprint.

- [ ] **Step 4: Implement the full CSV and JSON outputs**

`identity-resolution-audit.csv` columns must include the fields approved in the spec, plus `targetState` and `targetStateReason` so drift is explicit.

`identity-resolution-audit.json` must contain:

```js
{
  schema: 'CA_IDENTITY_AUDIT_OUTPUT_V1',
  generatedAt,
  databasePath,
  baselinePath,
  reconciliation,
  counts,
  rows: [/* full evidence */]
}
```

- [ ] **Step 5: Implement `strict-safe-candidates.csv` as a strict subset**

Columns:

```text
importId,exchange,officialSymbol,officialIsin,exDate,actionType,priceConfidencePct,
selectedSymbol,selectedIsin,identityChainDepth,eventEvidenceIds,evidenceFingerprint
```

Assert in code before writing that every row has `classification === 'STRICT_SAFE'`, exactly one active destination, exact event-date evidence, and a 64-character lowercase hex SHA-256 fingerprint.

- [ ] **Step 6: Run Task 5 tests**

Expected: PASS and exact count reconciliation.

- [ ] **Step 7: Commit if Git-backed**

```powershell
if (git rev-parse --is-inside-work-tree 2>$null) {
  git add tools/identity-resolution-audit-export.cjs tests
  git commit -m "feat: export reconciled v1.9 identity audit reports"
}
```

---

### Task 6: CLI, PowerShell Runner, Immutability Proof, and Operator Documentation

**Files:**
- Create: `tools/identity-resolution-audit-cli.cjs`
- Create: `Run-EOD-Corporate-Action-Bulk-Historical-Identity-Resolution-Audit-V1-9.ps1`
- Create: `README.md`
- Create: `docs/changes/2026-08-16_<HHMM>_IST_CORPORATE_ACTION_PHASE1_V1_9_BULK_HISTORICAL_IDENTITY_RESOLUTION_AUDIT.md`
- Modify: `tests/identity-resolution-audit-integration.test.cjs`

**Interfaces:**

CLI:

```text
node tools/identity-resolution-audit-cli.cjs --db <market-data.sqlite3> --baseline <v1.8.csv> --output <dir>
```

PowerShell:

```powershell
& ".\EOD_Chart_Corporate_Action_Phase1_Bulk_Historical_Identity_Resolution_Audit_V1_9_<timestamp>\Run-EOD-Corporate-Action-Bulk-Historical-Identity-Resolution-Audit-V1-9.ps1" `
    -ProjectRoot "E:\TA Projects\EOD Charting Platform"
```

Optional parameters:

```text
-DatabaseFolder <path>
-BaselineCsv <path>
-OutputRoot <path>
-SkipTests
```

- [ ] **Step 1: Add failing CLI end-to-end test with a synthetic DB + V1.8 CSV**

Spawn the CLI against temp paths and assert exit code 0 plus all four output files. Assert the synthetic DB bytes hash is unchanged before/after.

- [ ] **Step 2: Run the end-to-end test and verify failure**

Run:

```powershell
node --test tests\identity-resolution-audit-integration.test.cjs
```

Expected: FAIL because CLI is not implemented.

- [ ] **Step 3: Implement CLI orchestration and explicit exit codes**

Use these exit-code classes:

```text
0  success
2  bad arguments/baseline
3  database or schema guard failure
4  audit/classification invariant failure
5  output write failure
6  immutability/reconciliation failure
```

CLI sequence:

```text
parse args -> load V1.8 baseline -> open read-only DB -> verify query_only/schema ->
load identity datasets -> evaluate each baseline ID -> reconcile -> write outputs -> close DB -> exit 0
```

No CLI path may invoke a write SQL statement.

- [ ] **Step 4: Implement PowerShell active-database and baseline discovery**

Reuse V1.8 operational conventions:

1. Resolve Documents `EOD Chart Profile\app-profile-location.json` when present.
2. Read `database-registry.json` and use `lastActivePath` unless `-DatabaseFolder` is provided.
3. Read `database.json` for `dbFile`, defaulting to `market-data.sqlite3`.
4. If `-BaselineCsv` is omitted, locate the newest `tmp\corporate-action-review-audit_*\corporate-action-review-audit.csv` whose parsed target count is nonzero; print the chosen path.
5. Require Node 22+ and verify `require('node:sqlite')` before running.

- [ ] **Step 5: Add before/after live file immutability proof**

Before invoking Node, tell the operator:

```text
Close the EOD Chart application before continuing. V1.9 hashes the live SQLite database files before and after the read-only audit.
```

Hash every existing file in this set:

```text
market-data.sqlite3
market-data.sqlite3-wal
market-data.sqlite3-shm
```

Use PowerShell `Get-FileHash -Algorithm SHA256`. After the CLI exits, hash the same set again. If a file appeared/disappeared or any SHA-256 changed, fail with exit code 6 semantics and do not print `Audit PASS`.

- [ ] **Step 6: Make the runner execute synthetic tests before live audit**

Unless `-SkipTests` is explicitly provided, run:

```powershell
node --test "$PackageRoot\tests\identity-resolution-audit-core.test.cjs" "$PackageRoot\tests\identity-resolution-audit-integration.test.cjs"
```

Abort on any test failure.

- [ ] **Step 7: Document the PowerShell execution-policy issue observed in V1.8**

README must state that if Windows blocks the unsigned `.ps1`, use only a process-scoped temporary bypass:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
```

Do not recommend `CurrentUser` or `LocalMachine` changes.

- [ ] **Step 8: Run the entire synthetic suite and CLI acceptance test**

Expected: all tests PASS, output counts reconcile, and DB hash remains identical.

- [ ] **Step 9: Commit if Git-backed**

```powershell
if (git rev-parse --is-inside-work-tree 2>$null) {
  git add tools tests README.md Run-EOD-Corporate-Action-Bulk-Historical-Identity-Resolution-Audit-V1-9.ps1 docs/changes
  git commit -m "feat: add read-only v1.9 historical identity audit"
}
```

---

### Task 7: Package Guardrails and Windows Live Acceptance Gate

**Files:**
- Verify only; no production source files may be changed.
- Package all files listed in the File Structure section.

**Interfaces:**
- Package SHA-256 published with the ZIP.
- Live output files:
  - `identity-resolution-audit-summary.txt`
  - `identity-resolution-audit.csv`
  - `identity-resolution-audit.json`
  - `strict-safe-candidates.csv`

- [ ] **Step 1: Run a static write-surface scan over V1.9 Node files**

The scan must reject executable SQL containing any of these tokens outside test fixtures/comments:

```text
INSERT
UPDATE
DELETE
REPLACE
CREATE
DROP
ALTER
VACUUM
REINDEX
ATTACH
DETACH
```

The DB adapter is allowed `SELECT`, `WITH`, and read-only `PRAGMA` only.

- [ ] **Step 2: Verify no production source payload exists**

Package verification must assert there is no payload under:

```text
src/
src-tauri-shell/
```

Reference source hashes may be recorded in the change report, but those files must not be patched.

- [ ] **Step 3: Run all synthetic tests one final time**

Run:

```powershell
node --test tests\identity-resolution-audit-core.test.cjs tests\identity-resolution-audit-integration.test.cjs
```

Expected: PASS.

- [ ] **Step 4: Build ZIP and compute SHA-256**

Publish the exact package hash. Verify ZIP integrity before handoff.

- [ ] **Step 5: Windows live run — read-only only**

Operator closes the EOD Chart app, runs the V1.9 PowerShell wrapper, and sends back the summary TXT + CSV. Do not perform V1.10 or any identity mutation in this task.

Expected console milestones:

```text
[PASS] V1.8 baseline loaded: 344 target row(s).   # exact count may differ only if a different valid baseline is deliberately supplied
[PASS] SQLite read-only/query_only verified.
[PASS] Synthetic test suite passed.
[PASS] Audit classifications reconciled.
[PASS] Live database file hashes unchanged.
Audit PASS. No identity or Corporate Action rows were modified.
```

- [ ] **Step 6: Review live classifications before any future mutation design**

Acceptance review must answer:

```text
How many baseline rows are still active?
How many are STATE_CHANGED?
How many are STRICT SAFE?
How many are LIKELY_MISSING_EVIDENCE?
How many are AMBIGUOUS?
How many are NO_CANDIDATE?
How many are DATA_STATE_ANOMALY?
Do counts reconcile exactly?
Does every STRICT SAFE row have exactly one active NSE destination, exact event-date ISIN evidence, deterministic lineage, and a SHA-256 fingerprint?
```

No V1.10 implementation begins until the user reviews these live V1.9 results and separately approves a V1.10 design.

---

## Plan Self-Review

### Spec coverage

- V1.8 344-row baseline and drift protection: Tasks 1-2 and 6.
- Current passing price evidence and V1.7 compound freshness: Task 2.
- Exact event-date historical ISIN evidence: Task 3.
- Deterministic multi-hop NSE lineage: Task 3.
- Ambiguous/conflicting/no-candidate/cross-exchange/cycle handling: Task 3.
- Company/symbol similarity cannot confer safety: Task 3 tests.
- SHA-256 deterministic evidence fingerprint including candidate set: Task 4.
- Four required output artifacts and exact reconciliation: Task 5.
- Read-only SQLite/query-only enforcement: Tasks 1 and 6.
- Before/after live database immutability proof: Task 6.
- Full synthetic test matrix: Tasks 1-6.
- No production source modification and V1.9/V1.10 boundary: Global Constraints and Task 7.

### Placeholder scan

Placeholder scan completed with no unresolved implementation markers or unspecified test/error-handling steps. The timestamp in the eventual package/change-report filename is an execution-time naming value, not an unresolved functional requirement.

### Type/interface consistency

The plan uses one flow throughout:

```text
V1.8 BaselineRow
  -> CurrentImportRow + ScanRow
  -> TargetStateResult
  -> IdentityAnalysis
  -> ClassificationResult
  -> FingerprintPayload (STRICT SAFE only)
  -> reconciled audit result
  -> TXT/CSV/JSON/STRICT SAFE exports
```

No production mutation interface is defined anywhere in V1.9.
