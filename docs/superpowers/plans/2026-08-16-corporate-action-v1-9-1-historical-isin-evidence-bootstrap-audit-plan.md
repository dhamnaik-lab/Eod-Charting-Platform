# Corporate Action V1.9.1 Historical ISIN Evidence Bootstrap Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone, read-only Node/SQLite audit that re-evaluates every V1.9 `LIKELY_MISSING_EVIDENCE` Corporate Action row and determines whether its attached structured official evidence is safe to bootstrap into exact-date historical ISIN evidence in a later, separate phase.

**Architecture:** Reuse the successful V1.9 diagnostic pattern but create a separate V1.9.1 package with focused baseline loading, read-only SQLite loaders, deterministic evidence validation/classification, `ca-isin-bootstrap-v1` fingerprinting, reconciled exports, and a PowerShell wrapper that proves main/WAL/SHM immutability. V1.9.1 never calls production mutation APIs and never modifies React, Rust, Tauri, Corporate Action rows, identity history, approvals, or raw EOD data.

**Tech Stack:** Node.js 22+ (`node:sqlite`, `node:test`, `node:crypto`, `node:fs`), CommonJS `.cjs`, SQLite read-only mode + `PRAGMA query_only=1`, PowerShell 7+, CSV/JSON/TXT exports.

## Global Constraints

- Target only rows from the latest successful V1.9 audit whose classification is exactly `LIKELY_MISSING_EVIDENCE`; expected live baseline is currently 295, but the count is not authorization.
- Re-evaluate live state for every baseline row and classify drift as `STATE_CHANGED`, `ACTIVE_INSTRUMENT_MISMATCH`, or `DATA_STATE_ANOMALY`; never silently drop rows.
- Every baseline row must reconcile exactly once.
- `BOOTSTRAP_SAFE` requires every approved gate from the V1.9.1 design specification.
- Existing Quick Resolve semantics remain unchanged.
- V1.9.1 may only `READ`, `VERIFY`, `CLASSIFY`, `EXPLAIN`, `FINGERPRINT`, and `EXPORT`.
- V1.9.1 may never insert `instrument_isin_history`, update `corporate_action_imports`, resolve identity, invoke Quick Resolve, approve Corporate Actions, create exceptions, or alter raw EOD data.
- Open SQLite with `readOnly: true`, enable `PRAGMA query_only = ON`, and verify `PRAGMA query_only = 1` before auditing.
- PowerShell must hash the main SQLite file and existing `-wal`/`-shm` sidecars before and after the audit and require byte-for-byte equality.
- `BOOTSTRAP_SAFE` source provenance is restricted to the existing official NSE Corporate Action ingestion source `NSE_API`; unknown/manual/ad-hoc sources cannot qualify.
- Structured evidence contradictions fail closed. Missing values and contradictory values are distinct classifications.
- Company matching is deterministic only; no fuzzy similarity thresholds. For the standalone audit, canonicalize legal suffix `LIMITED` to `LTD` after uppercasing/tokenization so the approved `LIMITED` ↔ `LTD` example is deterministic without fuzzy matching.
- Any populated evidence factor must match the parsed parent factor within `1e-9 * max(1, abs(parentFactor))`; a missing `factor_seen` alone does not make evidence incomplete.
- `bootstrapFingerprintVersion` is exactly `ca-isin-bootstrap-v1`.
- `bootstrap-safe-candidates.csv` contains only `BOOTSTRAP_SAFE` rows.
- Do not touch `src/` or `src-tauri-shell/` in this phase.
- The supplied project snapshot has no Git metadata. In that environment, use isolated package workspaces and verification checkpoints instead of commits. If implementation is executed in a real Git checkout, commit after each green task using the commit messages shown below.

---

## File Structure

Create one timestamped standalone package under the project root when execution begins:

```text
EOD_Chart_Corporate_Action_Phase1_Historical_ISIN_Evidence_Bootstrap_Audit_V1_9_1_<TIMESTAMP>_IST/
├── tools/
│   ├── historical-isin-bootstrap-audit-core.cjs
│   ├── historical-isin-bootstrap-audit-db.cjs
│   ├── historical-isin-bootstrap-audit-export.cjs
│   └── historical-isin-bootstrap-audit-cli.cjs
├── tests/
│   ├── historical-isin-bootstrap-audit-core.test.cjs
│   └── historical-isin-bootstrap-audit-integration.test.cjs
├── docs/
│   └── changes/
│       └── 2026-08-16_<TIME>_IST_CORPORATE_ACTION_PHASE1_V1_9_1_HISTORICAL_ISIN_EVIDENCE_BOOTSTRAP_AUDIT.md
├── Run-EOD-Corporate-Action-Historical-ISIN-Evidence-Bootstrap-Audit-V1-9-1.ps1
└── README.md
```

Responsibilities:

- `historical-isin-bootstrap-audit-core.cjs`: baseline CSV parsing, normalization, live-state validation helpers, evidence gate evaluation, classification precedence, canonical fingerprint payload, SHA-256.
- `historical-isin-bootstrap-audit-db.cjs`: read-only SQLite connection/schema guards and all SQL loaders. No write SQL belongs in this file.
- `historical-isin-bootstrap-audit-export.cjs`: deterministic sorting, reconciliation, TXT/CSV/JSON rendering, and safe-candidate subset.
- `historical-isin-bootstrap-audit-cli.cjs`: argument parsing, orchestration, error/exit codes, live row-by-row audit.
- `historical-isin-bootstrap-audit-core.test.cjs`: unit/TDD coverage for baseline loading, state rules, evidence/classification rules, normalization, fingerprinting.
- `historical-isin-bootstrap-audit-integration.test.cjs`: synthetic SQLite schema/loaders, query-only protection, CLI/output/no-mutation checks, wrapper static safety contract.
- PowerShell wrapper: active DB discovery, latest V1.9 baseline discovery, Node/test gates, pre/post byte hashes, output path, operator handoff.

---

### Task 1: V1.9 Baseline Contract and Package Skeleton

**Files:**
- Create: `tools/historical-isin-bootstrap-audit-core.cjs`
- Create: `tests/historical-isin-bootstrap-audit-core.test.cjs`

**Interfaces:**
- Consumes: V1.9 `identity-resolution-audit.csv`.
- Produces:

```js
parseCsv(text: string): Array<Record<string,string>>
loadV19BootstrapBaseline(csvText: string): {
  expectedCount: number,
  expectedRows: Array<{
    importId: number,
    exchange: 'NSE',
    officialSymbol: string,
    officialIsin: string,
    companyName: string,
    exDate: string,
    actionType: 'SPLIT'|'BONUS',
    priceValidationLabel: 'STRONG MATCH'|'MATCH',
    priceConfidencePct: number|null,
    baselineDestination: { symbol: string, exchange: 'NSE', isin: string, companyName: string|null }
  }>
}
normalizeText(value: unknown): string
normalizeUpper(value: unknown): string
```

- [ ] **Step 1: Copy only the RFC-4180 parser behavior into the new failing tests**

Use a fixture with commas, escaped quotes, CRLF, and embedded newlines:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCsv, loadV19BootstrapBaseline } = require('../tools/historical-isin-bootstrap-audit-core.cjs');

test('parseCsv preserves RFC-4180 quoted fields', () => {
  const csv = 'classification,classificationReason,companyName\r\n' +
    'LIKELY_MISSING_EVIDENCE,"one candidate, no evidence","ABC ""INDIA"" LTD"\r\n';
  assert.deepEqual(parseCsv(csv), [{
    classification: 'LIKELY_MISSING_EVIDENCE',
    classificationReason: 'one candidate, no evidence',
    companyName: 'ABC "INDIA" LTD',
  }]);
});
```

- [ ] **Step 2: Add failing V1.9 target-filter tests**

The target loader must reject non-target rows and malformed/duplicate IDs rather than silently accepting them:

```js
test('loadV19BootstrapBaseline selects only LIKELY_MISSING_EVIDENCE rows', () => {
  const rows = [
    v19CsvRow({ importId: 10, classification: 'LIKELY_MISSING_EVIDENCE' }),
    v19CsvRow({ importId: 11, classification: 'NO_CANDIDATE' }),
  ];
  const result = loadV19BootstrapBaseline(toCsv(rows));
  assert.equal(result.expectedCount, 1);
  assert.deepEqual(result.expectedRows.map((row) => row.importId), [10]);
});

test('loadV19BootstrapBaseline rejects duplicate strict-target import ids', () => {
  const csv = toCsv([
    v19CsvRow({ importId: 10, classification: 'LIKELY_MISSING_EVIDENCE' }),
    v19CsvRow({ importId: 10, classification: 'LIKELY_MISSING_EVIDENCE' }),
  ]);
  assert.throws(() => loadV19BootstrapBaseline(csv), /duplicate import id 10/i);
});
```

Require these V1.9 columns exactly:

```js
const REQUIRED_V19_COLUMNS = [
  'importId','exchange','officialSymbol','officialIsin','companyName','exDate','actionType',
  'priceValidationLabel','priceConfidencePct','classification','classificationReason',
  'activeCandidateCount','activeCandidates'
];
```

If the actual V1.9 CSV encodes candidate fields under deterministic columns produced by V1.9 export, adapt the test fixture to those exact existing column names before implementation; do not infer destination from company-name similarity.

- [ ] **Step 3: Run the new tests and verify RED**

Run:

```powershell
node --no-warnings --test tests\historical-isin-bootstrap-audit-core.test.cjs
```

Expected: FAIL because `historical-isin-bootstrap-audit-core.cjs` does not yet export the new functions.

- [ ] **Step 4: Implement the minimal parser and baseline loader**

Implement normalization and strict filtering:

```js
function normalizeText(value) {
  return value == null ? '' : String(value).trim();
}
function normalizeUpper(value) {
  return normalizeText(value).toUpperCase();
}

function loadV19BootstrapBaseline(csvText) {
  const rows = parseCsv(csvText);
  requireColumns(rows, REQUIRED_V19_COLUMNS);
  const selected = rows.filter((row) => normalizeUpper(row.classification) === 'LIKELY_MISSING_EVIDENCE');
  const seen = new Set();
  const expectedRows = selected.map(normalizeV19BaselineRow);
  for (const row of expectedRows) {
    if (seen.has(row.importId)) throw new Error(`Duplicate import id ${row.importId} in V1.9 bootstrap baseline.`);
    seen.add(row.importId);
  }
  return { expectedCount: expectedRows.length, expectedRows };
}
```

`normalizeV19BaselineRow` must enforce:

```text
exchange == NSE
actionType in SPLIT/BONUS
officialSymbol non-empty
officialIsin non-empty
exDate non-empty
classification == LIKELY_MISSING_EVIDENCE
activeCandidateCount == 1
baseline destination symbol/ISIN non-empty
```

- [ ] **Step 5: Verify GREEN**

Run the same `node --test` command. Expected: all Task 1 tests PASS.

- [ ] **Step 6: Run the loader against the user's actual V1.9 CSV fixture**

Use the extracted live V1.9 result if available in the implementation workspace:

```powershell
node --no-warnings -e "const fs=require('fs'); const c=require('.\\tools\\historical-isin-bootstrap-audit-core.cjs'); const r=c.loadV19BootstrapBaseline(fs.readFileSync('<V1.9 identity-resolution-audit.csv>','utf8')); console.log(r.expectedCount)"
```

Expected for the currently supplied audit: `295`.

- [ ] **Step 7: Commit/checkpoint**

If Git is available:

```bash
git add tools/historical-isin-bootstrap-audit-core.cjs tests/historical-isin-bootstrap-audit-core.test.cjs
git commit -m "test: define V1.9.1 bootstrap baseline contract"
```

Otherwise record a package workspace checkpoint and continue.

---

### Task 2: Read-Only SQLite Schema, State, Evidence, Destination, and History Loaders

**Files:**
- Create: `tools/historical-isin-bootstrap-audit-db.cjs`
- Modify: `tests/historical-isin-bootstrap-audit-core.test.cjs`
- Create: `tests/historical-isin-bootstrap-audit-integration.test.cjs`

**Interfaces:**
- Consumes: active `market-data.sqlite3`, baseline import IDs.
- Produces:

```js
openAuditDatabase(dbPath): DatabaseSync
assertQueryOnly(db): void
assertAuditSchema(db): void
loadCurrentImportState(db, importId): ImportState|null
loadLatestOfficialScan(db, importId): ScanState|null
loadSameDateCompoundContext(db): Map<string,CompoundContext>
loadImportEvidence(db, importId): StructuredEvidence[]
loadIsinHistory(db, exchange='NSE'): IsinHistoryRow[]
loadIdentityHistory(db, exchange='NSE'): IdentityHistoryRow[]
loadInstruments(db, exchange='NSE'): InstrumentRow[]
```

Use these schema contracts, matching the currently audited application schema:

```js
const REQUIRED_SCHEMA = Object.freeze({
  corporate_action_imports: [
    'id','exchange','source','symbol','isin','company_name','purpose_raw','ex_date','record_date',
    'action_type','factor','parse_status','review_status','message','approved_corporate_action_id','imported_at'
  ],
  corporate_action_import_evidence: [
    'id','import_id','source_code','source_locator','captured_at','symbol_seen','isin_seen','company_name_seen',
    'action_type_seen','event_date_seen','factor_seen','raw_reference','note'
  ],
  scan_runs: ['id','scope','status'],
  corporate_action_scan_results: [
    'id','scan_run_id','corporate_action_import_id','symbol','exchange','scan_status','prev_trade_date','ex_trade_date',
    'expected_factor','confidence','message','scanned_at'
  ],
  instrument_identity_history: [
    'id','exchange','isin','current_symbol','current_name','old_symbol','old_name','new_symbol','new_name',
    'effective_date','change_type','source','source_ref'
  ],
  instrument_isin_history: ['id','exchange','symbol','isin','effective_date','source','source_ref','note'],
  instruments: ['symbol','exchange','isin','name','series','is_active','lifecycle_status'],
});
```

- [ ] **Step 1: Write failing integration tests for read-only/query-only/schema behavior**

```js
test('openAuditDatabase enforces read-only and query_only', () => {
  const fixture = createFixtureDb();
  const db = openAuditDatabase(fixture.path);
  assert.equal(Number(Object.values(db.prepare('PRAGMA query_only').get())[0]), 1);
  assert.throws(() => db.exec("UPDATE corporate_action_imports SET symbol='X' WHERE id=1"), /readonly|read-only|attempt to write/i);
  db.close();
});

test('assertAuditSchema names missing tables and columns', () => {
  const fixture = createIncompleteFixtureDb();
  const db = openAuditDatabase(fixture.path);
  assert.throws(() => assertAuditSchema(db), /instrument_isin_history|corporate_action_import_evidence/i);
  db.close();
});
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
node --no-warnings --test tests\historical-isin-bootstrap-audit-integration.test.cjs
```

Expected: FAIL because DB helpers do not exist.

- [ ] **Step 3: Implement connection and schema guards**

```js
function openAuditDatabase(dbPath) {
  if (!fs.existsSync(dbPath)) throw new Error(`Database file does not exist: ${dbPath}`);
  const db = new DatabaseSync(dbPath, { readOnly: true });
  db.exec('PRAGMA query_only = ON;');
  assertQueryOnly(db);
  return db;
}
```

`assertAuditSchema` must enumerate `sqlite_master` and `PRAGMA table_info(...)` and throw one explicit error listing all missing tables/columns.

- [ ] **Step 4: Write failing loader tests**

Synthetic fixture must include at least:

```text
corporate_action_imports row: NSE, SPLIT, UNRESOLVED, historical ISIN, ex-date
one COMPLETED official_imports MATCHED scan
one corporate_action_import_evidence row
one active current instrument with same audited destination symbol and different ISIN
zero exact-date instrument_isin_history rows
```

Assertions:

```js
assert.equal(loadCurrentImportState(db, 1).reviewStatus, 'UNRESOLVED');
assert.equal(loadLatestOfficialScan(db, 1).scanStatus, 'MATCHED');
assert.equal(loadImportEvidence(db, 1).length, 1);
assert.equal(loadInstruments(db, 'NSE').filter((row) => row.isActive).length, 1);
```

- [ ] **Step 5: Verify loader tests RED**

Expected: FAIL because loader exports are missing.

- [ ] **Step 6: Implement all SQL loaders**

`loadImportEvidence` SQL must be read-only and deterministic:

```sql
SELECT id, import_id, source_code, source_locator, captured_at, symbol_seen, isin_seen,
       company_name_seen, action_type_seen, event_date_seen, factor_seen, raw_reference, note
FROM corporate_action_import_evidence
WHERE import_id = ?
ORDER BY captured_at, id
```

`loadLatestOfficialScan` must join `scan_runs` and use only:

```sql
r.scope = 'official_imports' AND r.status = 'COMPLETED'
ORDER BY s.scanned_at DESC, s.id DESC
LIMIT 1
```

Reuse the V1.9 compound currentness model: same-date Split/Bonus groups are generated from parsed, non-rejected imports and stored in a read-only `Map` keyed by exchange/symbol/ex-date.

- [ ] **Step 7: Add a static SQL safety test**

Scan every file under `tools/` and fail if SQL execution/preparation contains mutating verbs:

```js
const forbiddenSql = /\b(INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER|VACUUM|REINDEX)\b/i;
for (const file of toolFiles) {
  const text = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(extractExecutableSql(text), forbiddenSql);
}
```

Allow `CREATE TABLE` only inside `tests/` fixture builders, never `tools/`.

- [ ] **Step 8: Verify GREEN**

Run both test files. Expected: all current tests PASS.

- [ ] **Step 9: Commit/checkpoint**

```bash
git add tools/historical-isin-bootstrap-audit-db.cjs tests/historical-isin-bootstrap-audit-*.test.cjs
git commit -m "feat: add read-only V1.9.1 audit loaders"
```

---

### Task 3: Live-State Revalidation and Deterministic Company/Factor Normalization

**Files:**
- Modify: `tools/historical-isin-bootstrap-audit-core.cjs`
- Modify: `tests/historical-isin-bootstrap-audit-core.test.cjs`

**Interfaces:**

```js
validateScanCurrentness(currentImport, scan, compoundContext): { current: boolean, reason: string }
evaluateBootstrapTargetState(baselineRow, currentImport, scan, compoundContext, liveDestination): {
  status: 'ELIGIBLE'|'STATE_CHANGED'|'ACTIVE_INSTRUMENT_MISMATCH'|'DATA_STATE_ANOMALY',
  reason: string
}
normalizeBootstrapCompanyName(value): string
factorsCompatible(parentFactor, evidenceFactor): boolean
```

- [ ] **Step 1: Write failing tests for target-state drift**

Required cases:

```js
test('eligible target remains unresolved parsed NSE Split/Bonus with current MATCHED scan', ...);
test('approved or resolved import becomes STATE_CHANGED', ...);
test('stale expected factor becomes STATE_CHANGED', ...);
test('changed unique destination becomes ACTIVE_INSTRUMENT_MISMATCH', ...);
test('current destination ISIN equal to historical ISIN becomes DATA_STATE_ANOMALY', ...);
```

For compound rows, use scan metadata format already produced by V1.7:

```text
[CA_COMPOUND_V1 factor=4.000000000000 count=2 fingerprint=...]
```

and require the stored fingerprint to equal the live same-date component fingerprint.

- [ ] **Step 2: Run tests and verify RED**

Expected failure: target-state functions not defined.

- [ ] **Step 3: Implement currentness/state evaluation**

Rules:

```text
missing import -> STATE_CHANGED: IMPORT_MISSING
not UNRESOLVED -> STATE_CHANGED: REVIEW_STATUS_CHANGED
approved_corporate_action_id present -> STATE_CHANGED: IMPORT_ALREADY_LINKED_OR_APPROVED
not PARSED -> STATE_CHANGED: PARSE_STATUS_CHANGED
not NSE -> DATA_STATE_ANOMALY: EXCHANGE_OUT_OF_SCOPE
not SPLIT/BONUS -> DATA_STATE_ANOMALY: ACTION_TYPE_OUT_OF_SCOPE
missing/latest scan not MATCHED -> STATE_CHANGED: PRICE_VALIDATION_NO_LONGER_MATCHED
symbol/exchange/factor/date window changed -> STATE_CHANGED
compound fingerprint changed -> STATE_CHANGED
unique destination differs from V1.9 destination -> ACTIVE_INSTRUMENT_MISMATCH
historical ISIN == current destination ISIN -> DATA_STATE_ANOMALY
```

- [ ] **Step 4: Write failing deterministic company normalization tests**

```js
test('company normalization treats LIMITED and LTD punctuation variants as equal', () => {
  assert.equal(normalizeBootstrapCompanyName('ABC Industries Limited'), 'ABC INDUSTRIES LTD');
  assert.equal(normalizeBootstrapCompanyName('ABC INDUSTRIES LTD.'), 'ABC INDUSTRIES LTD');
});

test('company normalization does not fuzzy-match different issuers', () => {
  assert.notEqual(
    normalizeBootstrapCompanyName('ABC INDUSTRIES LTD'),
    normalizeBootstrapCompanyName('ABC INFRASTRUCTURE LTD')
  );
});
```

- [ ] **Step 5: Implement deterministic normalization**

Use token-level canonicalization only:

```js
function normalizeBootstrapCompanyName(value) {
  const tokens = normalizeUpper(value)
    .replace(/&/g, ' AND ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token === 'LIMITED' ? 'LTD' : token);
  return tokens.join(' ');
}
```

Do not add edit-distance, substring, phonetic, token-overlap, or percentage similarity.

- [ ] **Step 6: Write failing factor-compatibility tests**

```js
test('missing factor_seen is allowed but populated factor must agree', () => {
  assert.equal(factorsCompatible(2, null), true);
  assert.equal(factorsCompatible(2, 2.0000000001), true);
  assert.equal(factorsCompatible(2, 5), false);
});
```

- [ ] **Step 7: Implement factor tolerance**

```js
function factorsCompatible(parentFactor, evidenceFactor) {
  if (evidenceFactor == null || evidenceFactor === '') return true;
  const a = Number(parentFactor), b = Number(evidenceFactor);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a));
}
```

- [ ] **Step 8: Verify GREEN**

Run core tests. Expected: all Task 3 tests PASS.

- [ ] **Step 9: Commit/checkpoint**

```bash
git add tools/historical-isin-bootstrap-audit-core.cjs tests/historical-isin-bootstrap-audit-core.test.cjs
git commit -m "feat: revalidate V1.9.1 live state deterministically"
```

---

### Task 4: Structured Official Evidence, Historical-ISIN Conflict Analysis, and Classification

**Files:**
- Modify: `tools/historical-isin-bootstrap-audit-core.cjs`
- Modify: `tests/historical-isin-bootstrap-audit-core.test.cjs`

**Interfaces:**

```js
analyzeBootstrapEvidence(input): BootstrapEvidenceAnalysis
classifyBootstrapEvidence(analysis): { classification: BootstrapClassification, reason: string }
```

Where:

```js
type BootstrapClassification =
  | 'BOOTSTRAP_SAFE'
  | 'SOURCE_EVIDENCE_MISMATCH'
  | 'SOURCE_EVIDENCE_INCOMPLETE'
  | 'COMPANY_IDENTITY_MISMATCH'
  | 'CONFLICTING_ISIN_HISTORY'
  | 'MULTIPLE_SOURCE_CONFLICT'
  | 'ACTIVE_INSTRUMENT_MISMATCH'
  | 'STATE_CHANGED'
  | 'DATA_STATE_ANOMALY';
```

`BootstrapEvidenceAnalysis` must include all gate results, evidence rows considered, relevant ISIN-history rows, live destination, and all failure reasons—not just the primary classification.

- [ ] **Step 1: Write the approved evidence-gate tests first**

At minimum implement tests 1–17 from the design matrix:

```text
1 exact evidence + unique destination -> BOOTSTRAP_SAFE
2 evidence symbol mismatch -> SOURCE_EVIDENCE_MISMATCH
3 evidence ISIN mismatch -> SOURCE_EVIDENCE_MISMATCH
4 evidence event-date mismatch -> SOURCE_EVIDENCE_MISMATCH
5 missing provenance -> SOURCE_EVIDENCE_INCOMPLETE
6 missing evidence ISIN -> SOURCE_EVIDENCE_INCOMPLETE
7 normalized company exact -> gate PASS
8 material company mismatch -> COMPANY_IDENTITY_MISMATCH
9 no exact-date ISIN history -> continue
10 identical exact-date history exists -> DATA_STATE_ANOMALY
11 conflicting exact-date history -> CONFLICTING_ISIN_HISTORY
12 two evidence rows agree -> may BOOTSTRAP_SAFE
13 two evidence rows conflict -> MULTIPLE_SOURCE_CONFLICT
14 active destination changed -> ACTIVE_INSTRUMENT_MISMATCH
15 price scan stale -> STATE_CHANGED
16 current ISIN == historical ISIN -> DATA_STATE_ANOMALY
17 unknown source code -> cannot BOOTSTRAP_SAFE
```

Use `sourceCode: 'NSE_API'` as the sole recognized source for this NSE audit.

- [ ] **Step 2: Verify RED**

Expected: classification APIs missing.

- [ ] **Step 3: Implement evidence normalization and per-row gates**

Normalize each structured evidence row to:

```js
{
  id, importId,
  sourceCode: normalizeUpper(source_code),
  sourceLocator: normalizeText(source_locator),
  capturedAt: normalizeText(captured_at),
  symbolSeen: normalizeUpper(symbol_seen),
  isinSeen: normalizeUpper(isin_seen),
  companyNameSeen: normalizeText(company_name_seen),
  actionTypeSeen: normalizeUpper(action_type_seen),
  eventDateSeen: normalizeText(event_date_seen),
  factorSeen: factor_seen == null ? null : Number(factor_seen),
  rawReference: normalizeText(raw_reference),
  note: normalizeText(note),
}
```

Provenance gate requires:

```js
const OFFICIAL_SOURCE_CODES = new Set(['NSE_API']);
const recognizedSource = OFFICIAL_SOURCE_CODES.has(e.sourceCode);
const traceableLocator = Boolean(e.sourceLocator || e.rawReference);
```

- [ ] **Step 4: Implement multiple-source conflict detection**

Material identity tuple:

```js
function materialEvidenceTuple(e) {
  return [e.symbolSeen, e.isinSeen, e.eventDateSeen, e.actionTypeSeen].join('\u0000');
}
```

If more than one non-empty materially distinct tuple exists, set `multipleSourceConflict=true`. Capture conflicting evidence IDs in the report.

Capture-timestamp, note, and locator differences alone are not material conflicts.

- [ ] **Step 5: Implement exact-date/history analysis**

Relevant exact-date rows are:

```js
historyRows.filter((row) =>
  normalizeUpper(row.exchange) === 'NSE' &&
  normalizeUpper(row.symbol) === target.officialSymbol &&
  normalizeText(row.effectiveDate) === target.exDate
)
```

Rules:

```text
0 rows -> normal bootstrap path
>=1 row with same official historical ISIN and no conflicting ISIN -> DATA_STATE_ANOMALY: MATCHING_HISTORY_ALREADY_EXISTS
any different ISIN at same symbol/date -> CONFLICTING_ISIN_HISTORY
mixed matching + conflicting rows -> CONFLICTING_ISIN_HISTORY
```

Also include broader connected/overlap rows in the fingerprint/report if the DB loader exposes them; a contradiction in broader history must fail closed as `CONFLICTING_ISIN_HISTORY` or `DATA_STATE_ANOMALY` with an explicit reason.

- [ ] **Step 6: Implement deterministic primary-classification precedence**

Use this exact precedence so every row has one stable primary class while retaining all failed gates:

```js
const CLASSIFICATION_PRECEDENCE = [
  'STATE_CHANGED',
  'ACTIVE_INSTRUMENT_MISMATCH',
  'DATA_STATE_ANOMALY',
  'MULTIPLE_SOURCE_CONFLICT',
  'CONFLICTING_ISIN_HISTORY',
  'SOURCE_EVIDENCE_INCOMPLETE',
  'SOURCE_EVIDENCE_MISMATCH',
  'COMPANY_IDENTITY_MISMATCH',
  'BOOTSTRAP_SAFE',
];
```

Important: evidence field mismatch beats company mismatch only after structural/history conflicts have been ruled out. Unknown source or absent locator/raw reference is `SOURCE_EVIDENCE_INCOMPLETE`, not a new unapproved class.

- [ ] **Step 7: Verify GREEN and fail-closed behavior**

Run core tests. Expected: all evidence/classification cases PASS.

- [ ] **Step 8: Add one property-style invariant test**

For every synthetic `BOOTSTRAP_SAFE` fixture:

```js
assert.equal(analysis.failedGates.length, 0);
assert.equal(analysis.recognizedOfficialSource, true);
assert.equal(analysis.exactEventEvidenceMatch, true);
assert.equal(analysis.companyMatch, true);
assert.equal(analysis.historyConflict, false);
assert.equal(analysis.destinationIsUniqueAndUnchanged, true);
```

- [ ] **Step 9: Commit/checkpoint**

```bash
git add tools/historical-isin-bootstrap-audit-core.cjs tests/historical-isin-bootstrap-audit-core.test.cjs
git commit -m "feat: classify historical ISIN bootstrap evidence"
```

---

### Task 5: `ca-isin-bootstrap-v1` Canonical Fingerprint

**Files:**
- Modify: `tools/historical-isin-bootstrap-audit-core.cjs`
- Modify: `tests/historical-isin-bootstrap-audit-core.test.cjs`

**Interfaces:**

```js
canonicalizeForJson(value, path='$'): unknown
canonicalStringify(value): string
buildBootstrapFingerprintPayload(target, evidenceAnalysis): object
computeBootstrapFingerprint(payload): string
```

- [ ] **Step 1: Write failing fingerprint stability/change tests**

Implement design cases 18–21:

```js
test('bootstrap fingerprint is stable for equivalent evidence regardless of insertion order', ...);
test('fingerprint changes when historical ISIN changes', ...);
test('fingerprint changes when destination ISIN changes', ...);
test('fingerprint changes when source code locator or evidence date changes', ...);
```

Also assert invalid values fail rather than serialize ambiguously:

```js
assert.throws(() => canonicalStringify({ factor: Number.NaN }), /non-finite/i);
assert.throws(() => canonicalStringify({ value: undefined }), /undefined/i);
```

- [ ] **Step 2: Verify RED**

Expected: fingerprint API missing.

- [ ] **Step 3: Implement canonical serializer**

Objects: sort keys lexicographically. Arrays: caller must supply safety arrays pre-sorted; canonicalizer preserves array order and rejects `undefined`/non-finite numbers.

```js
function computeBootstrapFingerprint(payload) {
  return crypto.createHash('sha256').update(canonicalStringify(payload), 'utf8').digest('hex');
}
```

- [ ] **Step 4: Implement exact payload contract**

Top level:

```js
{
  version: 'ca-isin-bootstrap-v1',
  importId,
  parentImport: {
    exchange, symbol, historicalIsin, companyName, exDate, actionType, factor,
  },
  structuredEvidence: sortedEvidence.map(e => ({
    id, sourceCode, sourceLocator, symbolSeen, isinSeen, companyNameSeen,
    actionTypeSeen, eventDateSeen, factorSeen, rawReference,
  })),
  destination: {
    instrumentId: destination.instrumentId ?? null,
    symbol: destination.symbol,
    isin: destination.isin,
    companyName: destination.companyName,
    isActive: destination.isActive,
  },
  identityHistoryState: sortedRelevantHistory.map(h => ({
    id, exchange, symbol, isin, effectiveDate, source, sourceRef, note,
  })),
}
```

Sort evidence by `(id, sourceCode, sourceLocator, eventDateSeen, isinSeen)`. Sort history by `(effectiveDate, id, symbol, isin)`.

- [ ] **Step 5: Ensure fingerprint exists only for safe rows**

```js
function maybeFingerprint(classification, target, analysis) {
  if (classification !== 'BOOTSTRAP_SAFE') return { version: '', fingerprint: '' };
  const payload = buildBootstrapFingerprintPayload(target, analysis);
  return { version: 'ca-isin-bootstrap-v1', fingerprint: computeBootstrapFingerprint(payload) };
}
```

Test that all non-safe rows export blank fingerprint fields.

- [ ] **Step 6: Verify GREEN**

Run core tests. Expected: all fingerprint tests PASS.

- [ ] **Step 7: Commit/checkpoint**

```bash
git add tools/historical-isin-bootstrap-audit-core.cjs tests/historical-isin-bootstrap-audit-core.test.cjs
git commit -m "feat: add V1.9.1 bootstrap evidence fingerprints"
```

---

### Task 6: Reconciliation, Four Exports, and CLI Orchestration

**Files:**
- Create: `tools/historical-isin-bootstrap-audit-export.cjs`
- Create: `tools/historical-isin-bootstrap-audit-cli.cjs`
- Modify: `tests/historical-isin-bootstrap-audit-integration.test.cjs`

**Interfaces:**

```js
reconcileBootstrapAuditResult(input): ReconciledAudit
writeBootstrapAuditOutputs(outputDir, result): {
  summary: string,
  csv: string,
  json: string,
  safeCsv: string
}
run(argv?: string[]): { reconciled: ReconciledAudit, outputs: OutputPaths }
```

- [ ] **Step 1: Write failing reconciliation tests**

Design case 22:

```js
test('every V1.9 baseline row reconciles exactly once', () => {
  const result = reconcileBootstrapAuditResult({ expectedBaselineCount: 3, rows: [safeRow(1), incompleteRow(2), stateChangedRow(3)] });
  assert.equal(result.rows.length, 3);
  assert.equal(Object.values(result.counts).reduce((a,b) => a+b, 0), 3);
});

test('reconciliation rejects count mismatch and duplicate import ids', ...);
```

- [ ] **Step 2: Write failing export tests**

Design case 23:

```js
test('bootstrap-safe-candidates.csv contains only BOOTSTRAP_SAFE rows', () => {
  const outputs = writeBootstrapAuditOutputs(outDir, reconciledFixture());
  const safeCsv = fs.readFileSync(outputs.safeCsv, 'utf8');
  assert.match(safeCsv, /BOOTSTRAP_SAFE/);
  assert.doesNotMatch(safeCsv, /SOURCE_EVIDENCE_INCOMPLETE/);
});
```

Required filenames exactly:

```text
historical-isin-bootstrap-audit-summary.txt
historical-isin-bootstrap-audit.csv
historical-isin-bootstrap-audit.json
bootstrap-safe-candidates.csv
```

- [ ] **Step 3: Verify RED**

Expected: export/reconciliation APIs missing.

- [ ] **Step 4: Implement classification counts and deterministic row order**

Sort output rows by classification priority, ex-date descending, import ID ascending. Count all nine approved classes, even when zero.

Summary must include:

```text
V1.9 baseline targets: <N>
Rows reconciled: <N>
BOOTSTRAP_SAFE: ...
SOURCE_EVIDENCE_MISMATCH: ...
SOURCE_EVIDENCE_INCOMPLETE: ...
COMPANY_IDENTITY_MISMATCH: ...
CONFLICTING_ISIN_HISTORY: ...
MULTIPLE_SOURCE_CONFLICT: ...
ACTIVE_INSTRUMENT_MISMATCH: ...
STATE_CHANGED: ...
DATA_STATE_ANOMALY: ...
Mode: READ ONLY
Fingerprint version: ca-isin-bootstrap-v1
```

- [ ] **Step 5: Define full CSV fields explicitly**

At minimum:

```js
const FULL_CSV_HEADERS = [
  'importId','exchange','officialSymbol','historicalOfficialIsin','currentIsin','companyName','destinationCompanyName',
  'normalizedOfficialCompany','normalizedDestinationCompany','companyMatch','exDate','actionType','factor',
  'priceValidationLabel','priceConfidencePct','sourceEvidenceCount','sourceCodes','sourceLocators','rawReferences',
  'evidenceSymbols','evidenceIsins','evidenceEventDates','evidenceCompanies','evidenceActionTypes','evidenceFactors',
  'exactDateIsinHistoryCount','exactDateIsinHistoryJson','destinationInstrumentId','destinationSymbol','destinationIsin',
  'classification','classificationReason','failedGates','gateResultsJson','bootstrapFingerprintVersion','bootstrapFingerprint'
];
```

Safe CSV may use the same header set to keep V1.9.2 ingestion simple.

- [ ] **Step 6: Write failing CLI end-to-end fixture test**

Synthetic DB + V1.9 CSV must produce one safe, one mismatch, one state-changed row, then assert:

```js
const { reconciled, outputs } = run(['--db', dbPath, '--baseline', baselinePath, '--output', outDir]);
assert.equal(reconciled.rows.length, 3);
assert.equal(reconciled.counts.BOOTSTRAP_SAFE, 1);
assert.ok(fs.existsSync(outputs.safeCsv));
```

- [ ] **Step 7: Implement CLI with explicit exit codes**

```js
const EXIT = Object.freeze({
  SUCCESS: 0,
  ARGUMENT_OR_BASELINE: 2,
  DATABASE_OR_SCHEMA: 3,
  AUDIT_INVARIANT: 4,
  OUTPUT: 5,
  RECONCILIATION: 6,
});
```

Arguments:

```text
--db <market-data.sqlite3>
--baseline <V1.9 identity-resolution-audit.csv>
--output <output directory>
```

Per row orchestration:

```text
load current import
load latest official scan
evaluate live state
if drift -> emit drift class
else load structured evidence + live destination/history
analyze gates
classify
fingerprint only if BOOTSTRAP_SAFE
append row
```

Unexpected per-row malformed identity/evidence data must fail closed into `DATA_STATE_ANOMALY` with `AUDIT_ANALYSIS_ERROR:<message>`, unless a structural/schema failure makes the entire audit unreliable—in that case abort the audit.

- [ ] **Step 8: Verify GREEN**

Run both test files. Expected: all tests PASS and exports reconcile.

- [ ] **Step 9: Commit/checkpoint**

```bash
git add tools/historical-isin-bootstrap-audit-{export,cli}.cjs tests/historical-isin-bootstrap-audit-integration.test.cjs
git commit -m "feat: export and run V1.9.1 bootstrap audit"
```

---

### Task 7: PowerShell Immutability Wrapper, Change Documentation, and Final Package Verification

**Files:**
- Create: `Run-EOD-Corporate-Action-Historical-ISIN-Evidence-Bootstrap-Audit-V1-9-1.ps1`
- Create: `README.md`
- Create: `docs/changes/2026-08-16_<TIME>_IST_CORPORATE_ACTION_PHASE1_V1_9_1_HISTORICAL_ISIN_EVIDENCE_BOOTSTRAP_AUDIT.md`
- Modify: `tests/historical-isin-bootstrap-audit-integration.test.cjs`

**Interfaces:**
- PowerShell parameters:

```powershell
param(
    [string]$ProjectRoot = 'E:\TA Projects\EOD Charting Platform',
    [string]$DatabaseFolder,
    [string]$BaselineCsv,
    [string]$OutputRoot,
    [switch]$SkipTests
)
```

- [ ] **Step 1: Write failing static wrapper contract tests**

Assert wrapper text contains:

```text
Node 22+ guard
node:sqlite guard
active database discovery via Documents\EOD Chart Profile\database-registry.json
latest V1.9 baseline discovery under tmp\corporate-action-identity-audit_*
identity-resolution-audit.csv
Get-FileHash SHA256
main + -wal + -shm tracking
Assert-DatabaseStateUnchanged
node --test of both V1.9.1 test files
historical-isin-bootstrap-audit-cli.cjs
```

Also assert it does **not** invoke:

```text
Quick Resolve
approve
cargo
npm run tauri
UPDATE
INSERT
```

except explanatory text that is not an executable command; implement the static test against command lines/tokens rather than prose comments.

- [ ] **Step 2: Verify RED**

Expected: wrapper missing.

- [ ] **Step 3: Implement baseline discovery for V1.9, not V1.8**

`Resolve-BaselineCsv` must search:

```powershell
$tmpRoot = Join-Path $Root 'tmp'
Get-ChildItem -LiteralPath $tmpRoot -Directory -Filter 'corporate-action-identity-audit_*'
```

and choose the newest directory containing:

```text
identity-resolution-audit.csv
```

The core loader then enforces that only `LIKELY_MISSING_EVIDENCE` rows become targets.

- [ ] **Step 4: Implement pre/post database+sidecar hashing**

Track exactly:

```powershell
@($DatabasePath, "${DatabasePath}-wal", "${DatabasePath}-shm")
```

For each existing file save `Exists`, `Length`, and lowercase SHA-256. After CLI returns, recalculate before checking CLI exit status so mutations are detected even when the CLI fails.

Any appearance/disappearance, length difference, or hash difference must throw.

- [ ] **Step 5: Require tests before live audit by default**

```powershell
& node --no-warnings --test $CoreTest $IntegrationTest
if ($LASTEXITCODE -ne 0) { throw "V1.9.1 synthetic tests failed with exit code $LASTEXITCODE" }
```

`-SkipTests` remains available only for controlled repeat diagnostics; README should instruct normal operators not to use it for the first live acceptance run.

- [ ] **Step 6: Implement operator output**

The wrapper should print:

```text
EOD Chart Corporate Action Phase 1 - Historical ISIN Evidence Bootstrap Audit V1.9.1
Mode    : READ ONLY
Target  : V1.9 LIKELY_MISSING_EVIDENCE rows only
Safety  : official structured evidence + exact event identity + conflict-free history + unchanged unique active destination
IMPORTANT: Close the EOD Chart application before running this live database audit.
```

On success:

```text
Database byte/sidecar immutability guard PASS.
V1.9.1 audit PASS. Database remained read-only.
Send these files back to ChatGPT:
  ...\historical-isin-bootstrap-audit-summary.txt
  ...\historical-isin-bootstrap-audit.csv
  ...\bootstrap-safe-candidates.csv
```

- [ ] **Step 7: Write README and change report with exact non-goals**

README must state that `BOOTSTRAP_SAFE` is not identity resolution and not Corporate Action approval. The change report must explicitly list the V1.9.1/V1.9.2 boundary and state that no production source files are included.

- [ ] **Step 8: Run full test suite fresh**

From package root:

```powershell
node --no-warnings --test tests\historical-isin-bootstrap-audit-core.test.cjs tests\historical-isin-bootstrap-audit-integration.test.cjs
```

Expected: `0 fail`.

- [ ] **Step 9: Run syntax checks fresh**

```powershell
node --check tools\historical-isin-bootstrap-audit-core.cjs
node --check tools\historical-isin-bootstrap-audit-db.cjs
node --check tools\historical-isin-bootstrap-audit-export.cjs
node --check tools\historical-isin-bootstrap-audit-cli.cjs
```

Expected: exit code 0 for all.

- [ ] **Step 10: Run actual supplied V1.9 baseline through baseline loader**

Expected current target count: `295`. If not 295, do not force the count; inspect whether the supplied baseline changed and document it. The live Windows run will revalidate state anyway.

- [ ] **Step 11: Run a synthetic end-to-end no-mutation test with file hashes**

Create a fixture DB, hash it, run CLI, hash again, and assert equal. Include a WAL/SHM fixture scenario where sidecars exist before run and verify they do not change.

- [ ] **Step 12: Static production-surface safety scan**

Package must contain no path under `src/` or `src-tauri-shell/`.

Run:

```bash
find . -type f | sort
rg -n "\b(INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER)\b" tools Run-EOD-Corporate-Action-Historical-ISIN-Evidence-Bootstrap-Audit-V1-9-1.ps1
```

Expected: no executable mutating SQL in production audit files. Descriptive README/change-report prose is irrelevant to this scan.

- [ ] **Step 13: Package and verify ZIP integrity**

Create a timestamped ZIP containing exactly the standalone package folder. Then:

```powershell
Get-FileHash .\<V1.9.1-package>.zip -Algorithm SHA256
```

and verify archive integrity with `unzip -t` or equivalent before handoff.

- [ ] **Step 14: Commit/checkpoint**

If Git is available:

```bash
git add Run-EOD-Corporate-Action-Historical-ISIN-Evidence-Bootstrap-Audit-V1-9-1.ps1 README.md docs/changes tests
git commit -m "chore: package V1.9.1 read-only bootstrap audit"
```

---

## Final Live Windows Acceptance Gate

Do not claim V1.9.1 live acceptance until the user runs the packaged wrapper against the active database with the application closed.

Expected operator flow:

```powershell
Set-Location "E:\TA Projects\EOD Charting Platform"

& ".\EOD_Chart_Corporate_Action_Phase1_Historical_ISIN_Evidence_Bootstrap_Audit_V1_9_1_<TIMESTAMP>_IST\Run-EOD-Corporate-Action-Historical-ISIN-Evidence-Bootstrap-Audit-V1-9-1.ps1" `
    -ProjectRoot "E:\TA Projects\EOD Charting Platform"
```

If unsigned-script policy blocks it in a new PowerShell process, use only process-scoped bypass:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
```

The live run is accepted only when:

```text
synthetic/unit/integration tests PASS
read-only SQLite/schema guards PASS
V1.9 baseline count reported
all baseline rows reconciled exactly once
classification counts reported
four required outputs produced
database byte/sidecar immutability guard PASS
```

The operator must then return:

```text
historical-isin-bootstrap-audit-summary.txt
historical-isin-bootstrap-audit.csv
bootstrap-safe-candidates.csv
```

No V1.9.2 write-capable implementation begins until the V1.9.1 live output is reviewed and a nonzero `BOOTSTRAP_SAFE` population is justified by the evidence.

---

## Plan Self-Review Checklist

Before implementation begins, verify:

- Spec coverage: all sections 1–24 are represented by Tasks 1–7 or the live acceptance gate.
- Placeholder scan: no `TBD`, `TODO`, “implement later,” or unspecified validation step remains.
- Type/interface consistency: baseline, DB loaders, classification, fingerprint, reconciliation, CLI, and wrapper names match across tasks.
- Safety: no production source change is planned; no write-capable SQL/API exists in V1.9.1.
- Classification determinism: every baseline row receives exactly one primary class and retains detailed failed-gate evidence.
- Fingerprint: only `BOOTSTRAP_SAFE` rows receive `ca-isin-bootstrap-v1` fingerprints.
- Output contract: four filenames exactly match the approved spec.
- V1.9.2 boundary: not implemented by this plan.
