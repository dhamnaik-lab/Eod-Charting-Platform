# Corporate Action V1.14E Historical Event Identity Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved V1.14E historical event-identity resolution layer for the exact 184 reviewed Corporate Action imports across 44 NSE symbol-transition chains without rewriting raw import identity, inventing historical ISIN, Quick Resolving, or approving any Corporate Action.

**Architecture:** Add a dedicated structured event-identity resolution table whose creation is deliberately withheld from the normal automatic database bootstrap during the first controlled tranche. Read paths use one Rust projection that falls back to the raw import identity when the table is absent; scanner price validation uses the projected event-time symbol. A separately gated maintenance path creates the table and inserts only the exact fingerprint-bound 184 rows in one SQLite transaction, followed by an independent read-only post-audit.

**Tech Stack:** Tauri 2, Rust, rusqlite, serde/serde_json, SHA-256 (`sha2` already present), React, TypeScript, Vitest, PowerShell 7, Python for package/post-audit tooling.

**Spec:** `docs/superpowers/specs/2026-08-19-corporate-action-v1-14e-historical-event-identity-resolution-design.md`

## Global Constraints

- Fresh source basis: `Eod Charting Platform Source Code 2026-08-19_022835_IST`; uploaded ZIP SHA-256 `b60049ced542227f0c2fa66d7adbd6eaa2bc9756e4373523ae4ce6706dbf0299`.
- Approved V1.14E design authority fingerprint: `c1d118d3eaa6d4b75c32c3bfa5ed9e538fa2d25e0a84436957c708a8da181c6b`.
- Exact first tranche: 184 imports, 44 verified NSE symbol chains, 180 dividends, 4 bonuses.
- Exact candidate-ID fingerprint: `dafd118bd35acb11076296f24830d5722e3ef1b5715e829c7a1499910845961c`.
- Exact candidate-set fingerprint: `4ab5f8ca1625932e559f5207c1e7a4baa8a4fc84f766c5f449af7ba0cb6135ab`.
- Raw Corporate Action `symbol`, `isin`, source fields, evidence rows, and raw EOD are immutable under V1.14E.
- First-tranche `eventIsin` is always `null`; a symbol transition must never fabricate historical ISIN.
- V1.14E must not update `corporate_action_imports.review_status`, `message`, `symbol`, `isin`, or `company_name`.
- V1.14E must not call `quick_resolve_corporate_action_import_internal`.
- V1.14E must not insert into `corporate_action_import_decisions` in the first tranche.
- V1.14E must not approve or create canonical `corporate_actions`.
- **Do not add the V1.14E table to `bootstrap.rs::run_migrations` in this tranche.** Doing so would allow an ordinary app launch to create schema before a separately authorized live Apply. Table absence is a valid pre-Apply state.
- The table is created only inside the controlled Apply transaction. Read paths must treat table absence as “no event-identity resolution” and fall back to raw identity.
- Source implementation and validation must not open the production database.
- The application must remain closed for any private-snapshot Preflight or live Apply operation.
- Live Apply requires a separate explicit user approval after the exact READY Preflight and the independent post-audit tool are reviewed.
- Git operations are not authorized. Do not run `git add`, `git commit`, `git checkout`, `git restore`, or the project `validate-change.ps1` wrapper because that wrapper ends with `git diff --check`.
- Create a normal project backup before source edits using `scripts/create-project-backup.ps1 -ShortName corporate-action-v1-14e-implementation`.
- Validation is focused and serial. Do not run a portable build, installer build, full workspace test suite, or broad validation profile unless separately requested.

---

## Current Source Map

The fresh snapshot resolves the previously open implementation questions:

| Concern | Current owner |
|---|---|
| Database startup schema | `src-tauri-shell/src/database/bootstrap.rs:52-540` |
| Corporate Action command/export surface | `src-tauri-shell/src/database.rs:47-64` |
| Corporate Action public input/result types | `src-tauri-shell/src/database.rs:418-683`, `840-873` |
| Raw import loader | `src-tauri-shell/src/database/corporate_action_imports.rs:5819-5827`, `6134-6336` |
| Quick Resolve | `src-tauri-shell/src/database/corporate_action_imports.rs:5138-5197` |
| Price-validation currentness | `src-tauri-shell/src/database/corporate_action_imports.rs:5574-5605` |
| Split/Bonus scan candidate loading | `src-tauri-shell/src/database/corporate_action_imports.rs:6677-6730` |
| Controlled maintenance precedent | `src-tauri-shell/src/database/corporate_action_imports/controlled_identity_repair.rs` |
| Pre-Tauri maintenance dispatch | `src-tauri-shell/src/main.rs:754-771` |
| Tauri invoke list | `src-tauri-shell/src/main.rs:1110-1131` |
| Renderer domain types | `src/types/desktop.ts:311-356`, `442-473`, `1469-1496` |
| Desktop API pick list | `src/platform/types.ts:232-253` |
| Tauri invoke bridge | `src/platform/tauriDesktop.ts:209-249` |
| Corporate Action UI state | `src/components/DatabaseToolsDialogs.tsx:1315-1442` |
| Review Identity workspace | `src/components/DatabaseToolsDialogs.tsx:3188-3298` |
| Official Imports row | `src/components/DatabaseToolsDialogs.tsx:4375-4447` |
| Review Issues row | `src/components/DatabaseToolsDialogs.tsx:5304-5351` |

### Current-source conclusion on workflow

The existing `apply_import_row_resolution()` rewrites `symbol`, `isin`, `company_name`, `review_status`, and `message`. The existing Quick Resolve path also records a `VERIFIED_QUICK_RESOLUTION` decision and requires exact event-date historical ISIN evidence.

Those paths are therefore **not** appropriate V1.14E first-tranche writers. The first tranche will insert event-identity resolution state only and leave the existing import/workflow row unchanged.

---

### Task 1: Freeze the exact 184-event authority in production source

**Files:**
- Create: `src-tauri-shell/src/database/corporate_action_imports/v114e_event_identity_authority.json`
- Create: `src-tauri-shell/src/database/corporate_action_imports/event_identity_authority.rs`
- Modify: `src-tauri-shell/src/database/corporate_action_imports.rs:1-20`
- Test: inline `#[cfg(test)]` tests in `event_identity_authority.rs`

**Interfaces:**
- Consumes: exact reviewed V1.14C event report and V1.14D.1 chain-verification authority frozen by `docs/changes/evidence/2026-08-19-corporate-action-v1-14e-implementation-plan-basis.json`.
- Produces:
  - `pub(super) fn load_v114e_event_identity_authority() -> AppResult<V114EAuthority>`
  - `pub(super) fn compute_v114e_candidate_set_fingerprint(authority: &V114EAuthority) -> AppResult<String>`
  - immutable 184-candidate JSON embedded with `include_str!`.

- [ ] **Step 1: Create the failing authority test**

Add a test equivalent to:

```rust
#[test]
fn v114e_authority_is_exact_184_event_44_chain_tranche() {
    let authority = load_v114e_event_identity_authority().unwrap();

    assert_eq!(authority.version, "V1.14E");
    assert_eq!(authority.candidates.len(), 184);

    let chains = authority
        .candidates
        .iter()
        .map(|row| row.chain_id.as_str())
        .collect::<std::collections::BTreeSet<_>>();
    assert_eq!(chains.len(), 44);

    assert_eq!(
        compute_v114e_candidate_set_fingerprint(&authority).unwrap(),
        "4ab5f8ca1625932e559f5207c1e7a4baa8a4fc84f766c5f449af7ba0cb6135ab"
    );

    assert!(authority.candidates.iter().all(|row| row.event_isin.is_none()));
    assert!(authority.candidates.iter().all(|row| row.event_date < row.transition_date));
}
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```powershell
cargo test --manifest-path src-tauri-shell/Cargo.toml v114e_authority_is_exact_184_event_44_chain_tranche -- --nocapture
```

Expected: FAIL because the authority module/file does not yet exist.

- [ ] **Step 3: Add the parent module declaration**

At the top of `corporate_action_imports.rs`:

```rust
mod event_identity_authority;
```

Do not export it through Tauri.

- [ ] **Step 4: Create the authority data schema**

`v114e_event_identity_authority.json` must contain, for each of the exact 184 rows:

```json
{
  "importId": 22969,
  "exchange": "NSE",
  "rawSymbol": "NAVA",
  "rawIsin": "INE725A01022",
  "eventDate": "2016-09-01",
  "actionType": "BONUS",
  "eventSymbol": "NBVENTURES",
  "eventIsin": null,
  "chainId": "CHAIN-3070AD0C1A094900",
  "transitionDate": "2022-07-29",
  "transitionHistoryRowId": 602,
  "rawIdentitySourceLineNumber": 724,
  "rawIdentitySourceRef": "E:\\TA Projects\\Corporate Actions Raw\\NSE\\Identity\\SymbolChanges\\nse_identity_symbol_changes.csv",
  "rawIdentitySourceSha256": "921bd8679e7dff909b12efd152fe64b91a26b124976e919f120a2de1db3221e6"
}
```

The exact line number must come from V1.14D.1, not from a hand-entered value. The implementation package builder must derive the full JSON from the reviewed report files and verify their SHA-256 hashes before emitting source payload.

- [ ] **Step 5: Implement the authority loader**

Use serde structs and `include_str!`:

```rust
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct V114EAuthority {
    pub version: String,
    pub design_authority_fingerprint: String,
    pub candidate_set_fingerprint: String,
    pub v114c_events_sha256: String,
    pub v114d1_chain_verification_sha256: String,
    pub v114d1_evidence_sha256: String,
    pub candidates: Vec<V114ECandidate>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct V114ECandidate {
    pub import_id: i64,
    pub exchange: String,
    pub raw_symbol: String,
    pub raw_isin: Option<String>,
    pub event_date: String,
    pub action_type: String,
    pub event_symbol: String,
    pub event_isin: Option<String>,
    pub chain_id: String,
    pub transition_date: String,
    pub transition_history_row_id: i64,
    pub raw_identity_source_line_number: i64,
    pub raw_identity_source_ref: String,
    pub raw_identity_source_sha256: String,
}
```

Reject duplicate import IDs, duplicate candidate rows, non-NSE rows, non-null `eventIsin`, and `eventDate >= transitionDate`.

- [ ] **Step 6: Implement canonical candidate-set hashing**

Serialize only the safety-relevant candidate fields in sorted import-ID order. Do not hash a Rust `HashMap` directly.

- [ ] **Step 7: Re-run the focused test**

Expected: PASS.

- [ ] **Step 8: Record a no-Git checkpoint**

Record SHA-256 for the two new files and `corporate_action_imports.rs`. Do not invoke Git.

---

### Task 2: Add the dedicated resolution store and fallback projection

**Files:**
- Create: `src-tauri-shell/src/database/corporate_action_imports/event_identity_resolution.rs`
- Modify: `src-tauri-shell/src/database/corporate_action_imports.rs:1-48`
- Modify: `src-tauri-shell/src/database.rs:418-683`
- Test: inline Rust tests in `event_identity_resolution.rs`

**Interfaces:**
- Consumes: `CorporateActionImportRow`, rusqlite `Connection`.
- Produces:
  - `CorporateActionEventIdentityListInput`
  - `CorporateActionEventIdentity`
  - `CorporateActionEventIdentityListResult`
  - `pub(super) fn event_identity_resolution_table_exists(...)`
  - `pub(super) fn create_event_identity_resolution_schema_for_controlled_apply(...)`
  - `pub(super) fn load_effective_event_identity(...)`
  - `pub(super) fn list_effective_event_identities(...)`.

- [ ] **Step 1: Write the table-absence fallback test**

```rust
#[test]
fn v114e_effective_identity_falls_back_to_raw_import_when_table_is_absent() {
    let connection = Connection::open_in_memory().unwrap();
    create_import_fixture(&connection, 22969, "NAVA", Some("INE725A01022"), "2016-09-01");

    let identity = load_effective_event_identity(&connection, 22969).unwrap();

    assert_eq!(identity.raw_symbol.as_deref(), Some("NAVA"));
    assert_eq!(identity.event_symbol.as_deref(), Some("NAVA"));
    assert_eq!(identity.raw_isin.as_deref(), Some("INE725A01022"));
    assert_eq!(identity.event_isin.as_deref(), Some("INE725A01022"));
    assert!(!identity.resolved);
    assert!(identity.resolution_type.is_none());
}
```

- [ ] **Step 2: Run the test and confirm RED**

Expected: unresolved symbol because the module is absent.

- [ ] **Step 3: Define the public projection types in `database.rs`**

Use:

```rust
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionEventIdentityListInput {
    pub import_ids: Vec<i64>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionEventIdentity {
    pub import_id: i64,
    pub exchange: String,
    pub raw_symbol: Option<String>,
    pub raw_isin: Option<String>,
    pub event_symbol: Option<String>,
    pub event_isin: Option<String>,
    pub resolved: bool,
    pub resolution_type: Option<String>,
    pub resolution_authority: Option<String>,
    pub chain_id: Option<String>,
    pub transition_old_symbol: Option<String>,
    pub transition_new_symbol: Option<String>,
    pub transition_effective_date: Option<String>,
    pub raw_identity_source_ref: Option<String>,
    pub raw_identity_source_sha256: Option<String>,
    pub raw_identity_source_line_number: Option<i64>,
    pub resolution_fingerprint: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionEventIdentityListResult {
    pub requested: u32,
    pub identities: Vec<CorporateActionEventIdentity>,
    pub message: String,
}
```

For the fallback projection, `eventIsin = rawIsin`. For a V1.14E resolved row, `eventIsin` comes only from the resolution record and is therefore `null` in this first tranche.

- [ ] **Step 4: Define the controlled-only table DDL**

Do **not** modify `bootstrap.rs`.

The schema creation helper must execute:

```sql
CREATE TABLE IF NOT EXISTS corporate_action_event_identity_resolutions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  import_id INTEGER NOT NULL UNIQUE
    REFERENCES corporate_action_imports(id) ON DELETE CASCADE,
  exchange TEXT NOT NULL,
  raw_symbol TEXT NOT NULL,
  raw_isin TEXT,
  event_symbol TEXT NOT NULL,
  event_isin TEXT,
  resolution_type TEXT NOT NULL,
  resolution_authority TEXT NOT NULL,
  chain_id TEXT NOT NULL,
  transition_old_symbol TEXT NOT NULL,
  transition_new_symbol TEXT NOT NULL,
  transition_effective_date TEXT NOT NULL,
  raw_identity_source_ref TEXT NOT NULL,
  raw_identity_source_sha256 TEXT NOT NULL,
  raw_identity_source_line_number INTEGER NOT NULL,
  v114d1_evidence_sha256 TEXT NOT NULL,
  resolution_fingerprint TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ca_event_identity_event_symbol
  ON corporate_action_event_identity_resolutions(
    exchange,
    event_symbol,
    transition_effective_date
  );
```

Only `create_event_identity_resolution_schema_for_controlled_apply()` may execute this DDL.

- [ ] **Step 5: Implement table-existence detection**

```rust
pub(super) fn event_identity_resolution_table_exists(
    connection: &Connection,
) -> AppResult<bool> {
    connection
        .query_row(
            "SELECT EXISTS(
               SELECT 1 FROM sqlite_master
               WHERE type='table'
                 AND name='corporate_action_event_identity_resolutions'
             )",
            [],
            |row| row.get::<_, i64>(0),
        )
        .map(|value| value != 0)
        .map_err(|error| error.to_string())
}
```

- [ ] **Step 6: Implement the central projection**

`load_effective_event_identity()` first reads the raw import identity. If the table is absent, return the fallback immediately. If it exists, load by unique `import_id` and return raw + resolved event fields.

Do not mutate the import.

- [ ] **Step 7: Add the resolved-row test**

Create the table in the test, insert one row with:

```text
raw_symbol=NAVA
event_symbol=NBVENTURES
event_isin=NULL
```

Assert:

```rust
assert_eq!(identity.raw_symbol.as_deref(), Some("NAVA"));
assert_eq!(identity.event_symbol.as_deref(), Some("NBVENTURES"));
assert_eq!(identity.event_isin, None);
assert!(identity.resolved);
```

- [ ] **Step 8: Add a raw-immutability test**

Capture:

```sql
SELECT symbol, isin, company_name, review_status, message
FROM corporate_action_imports
WHERE id=?
```

before and after loading/projecting event identity. Assert byte/value equality.

- [ ] **Step 9: Run all `v114e_effective_identity` tests**

Expected: PASS.

- [ ] **Step 10: Record a no-Git checkpoint**

Hash the touched files. Do not invoke Git.

---

### Task 3: Add the read-only Tauri/TypeScript event-identity API

**Files:**
- Modify: `src-tauri-shell/src/database/corporate_action_imports.rs:568-635`
- Modify: `src-tauri-shell/src/database.rs:47-64`, `418-683`
- Modify: `src-tauri-shell/src/main.rs:1110-1131`
- Modify: `src/types/desktop.ts:311-356`, `913-970`, `1469-1496`
- Modify: `src/platform/types.ts:232-253`
- Modify: `src/platform/tauriDesktop.ts:209-249`
- Test: Rust unit test in `event_identity_resolution.rs`

**Interfaces:**
- Produces Tauri command:
  - `list_corporate_action_event_identities`
- Produces renderer API:
  - `listCorporateActionEventIdentities(input: CorporateActionEventIdentityListInput): Promise<CorporateActionEventIdentityListResult>`.

- [ ] **Step 1: Write the list-input validation test**

Require 1–500 unique positive IDs.

```rust
#[test]
fn v114e_event_identity_list_input_rejects_empty_zero_and_over_500() {
    assert!(validate_event_identity_import_ids(&[]).is_err());
    assert!(validate_event_identity_import_ids(&[0]).is_err());
    assert!(validate_event_identity_import_ids(&(1..=501).collect::<Vec<_>>()).is_err());
    assert_eq!(
        validate_event_identity_import_ids(&[3, 1, 3, 2]).unwrap(),
        vec![3, 1, 2]
    );
}
```

- [ ] **Step 2: Run the test and confirm RED**

Expected: FAIL because validator is absent.

- [ ] **Step 3: Implement the internal list function**

Use the central projection from Task 2. Do not duplicate SQL resolution logic in the Tauri command.

- [ ] **Step 4: Add the Tauri command**

Follow the existing `preview_corporate_action_repairs()` read-only pattern:

```rust
#[tauri::command]
pub async fn list_corporate_action_event_identities(
    app: AppHandle,
    input: CorporateActionEventIdentityListInput,
) -> AppResult<CorporateActionEventIdentityListResult> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let folder_path = resolve_active_database_folder(&app_handle)?
            .ok_or_else(|| "Open a database before listing Corporate Action event identities.".to_string())?;
        let connection = open_read_only_connection_for_folder(&folder_path)?;
        list_effective_event_identities(&connection, &input)
    })
    .await
    .map_err(|error| error.to_string())?
}
```

The command must never call `prepare_database_connection()`.

- [ ] **Step 5: Export and register the command**

Update `database.rs` public export list and `main.rs` invoke handler.

- [ ] **Step 6: Add TypeScript types**

Mirror the Rust camelCase fields exactly. Keep `rawSymbol`, `rawIsin`, `eventSymbol`, and `eventIsin` separate.

- [ ] **Step 7: Add the desktop bridge method**

```ts
listCorporateActionEventIdentities: async (input) => {
  return tauriInvoke('list_corporate_action_event_identities', { input });
},
```

- [ ] **Step 8: Run focused Rust tests**

Expected: PASS.

- [ ] **Step 9: Run renderer typecheck**

Run:

```powershell
npm run typecheck:renderer
```

Expected: PASS.

- [ ] **Step 10: Record a no-Git checkpoint**

No Git command.

---

### Task 4: Make Split/Bonus price validation consume the event-time symbol

**Files:**
- Modify: `src-tauri-shell/src/database/corporate_action_imports.rs:5574-5605`
- Modify: `src-tauri-shell/src/database/corporate_action_imports.rs:6677-6840`
- Test: existing `#[cfg(test)]` module in `corporate_action_imports.rs`

**Interfaces:**
- Consumes: `load_effective_event_identity()`.
- Produces scanner results whose `symbol` is the event-time symbol when a V1.14E resolution exists.

- [ ] **Step 1: Write the failing scanner test**

Use a raw import `NAVA` with event identity `NBVENTURES` and EOD bars stored under `NBVENTURES`.

```rust
#[test]
fn phase1_v114e_scan_uses_event_symbol_without_rewriting_raw_import() {
    let connection = Connection::open_in_memory().unwrap();
    create_split_bonus_scan_fixture(&connection);

    insert_import(&connection, 22969, "NAVA", "2016-09-01", 2.0);
    create_event_identity_resolution_schema_for_controlled_apply(&connection).unwrap();
    insert_test_resolution(&connection, 22969, "NAVA", "NBVENTURES", "2022-07-29");
    insert_price_bars(&connection, "NBVENTURES", "2016-08-31", "2016-09-01");

    let candidates = load_scan_candidates(&connection, Some(&[22969])).unwrap();
    assert_eq!(candidates[0].symbol.as_deref(), Some("NBVENTURES"));

    let raw: String = connection
        .query_row(
            "SELECT symbol FROM corporate_action_imports WHERE id=22969",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(raw, "NAVA");
}
```

- [ ] **Step 2: Run the test and confirm RED**

Expected: candidate still uses raw `NAVA`.

- [ ] **Step 3: Project effective identity after loading raw scan candidates**

Keep the raw SQL simple. After rows are mapped, resolve each candidate’s event symbol through the central helper.

Do not change factor, ex-date, or exchange.

- [ ] **Step 4: Fix compound same-date grouping**

`load_same_date_split_bonus_compound_context()` currently filters raw `corporate_action_imports.symbol = candidate.symbol`. That fails when `candidate.symbol` is an event symbol.

Change it to:

1. query candidate same-date Split/Bonus rows by `exchange + ex_date`;
2. resolve each row’s effective event symbol through the same helper;
3. keep only rows whose effective event symbol equals the candidate event symbol;
4. build the existing compound factor/fingerprint unchanged.

- [ ] **Step 5: Make validation-currentness compare the event symbol**

Change:

```rust
fn is_split_bonus_validation_current(
    connection: &Connection,
    import_row: &CorporateActionImportRow,
    validation: &CorporateActionScanResultRow,
) -> bool
```

and replace the raw-symbol comparison with:

```rust
let effective = load_effective_event_identity(connection, import_row.id)?;
if validation.symbol.as_deref() != effective.event_symbol.as_deref()
    || effective.event_symbol.is_none()
{
    return Ok(false);
}
```

If changing the return type to `AppResult<bool>`, update `ensure_split_bonus_price_validation()` accordingly.

- [ ] **Step 6: Add a currentness regression**

For raw `NAVA`, event `NBVENTURES`, and a validation row stamped `NBVENTURES`, assert the evidence is current. Stamp the validation as `NAVA` and assert stale.

- [ ] **Step 7: Add the no-table fallback regression**

Without the resolution table, the scanner must continue using the raw symbol exactly as before.

- [ ] **Step 8: Run focused scanner tests**

Run only the V1.14E scanner/currentness tests first.

- [ ] **Step 9: Run existing Split/Bonus scanner regressions**

Run the existing filtered corporate-action scanner tests that cover ordinary factor matching and compound-factor behavior.

- [ ] **Step 10: Record a no-Git checkpoint**

No Git command.

---

### Task 5: Surface raw vs historical event identity in the UI without changing workflow actions

**Files:**
- Create: `src/features/corporateActions/corporateActionEventIdentityPresentation.ts`
- Create: `src/features/corporateActions/__tests__/corporateActionEventIdentityPresentation.test.ts`
- Modify: `src/components/DatabaseToolsDialogs.tsx:1-48`, `1315-1442`, `3188-3298`, `4375-4447`, `5304-5351`

**Interfaces:**
- Consumes: `CorporateActionEventIdentity`.
- Produces:
  - `formatCorporateActionEventIdentityLabel(identity)`
  - `formatCorporateActionEventIdentityTitle(identity)`
  - read-only UI display of resolved event symbol/transition.

- [ ] **Step 1: Write the failing presentation tests**

```ts
it('shows raw and event symbols separately when V1.14E resolved', () => {
  expect(formatCorporateActionEventIdentityLabel({
    importId: 22969,
    exchange: 'NSE',
    rawSymbol: 'NAVA',
    rawIsin: 'INE725A01022',
    eventSymbol: 'NBVENTURES',
    eventIsin: null,
    resolved: true,
    resolutionType: 'NSE_VERIFIED_PRE_TRANSITION_EVENT_SYMBOL',
    resolutionAuthority: 'V1.14D.1_RAW_NSE_IDENTITY_EXACT_MATCH',
    chainId: 'CHAIN-3070AD0C1A094900',
    transitionOldSymbol: 'NBVENTURES',
    transitionNewSymbol: 'NAVA',
    transitionEffectiveDate: '2022-07-29',
    rawIdentitySourceRef: '...',
    rawIdentitySourceSha256: '...',
    rawIdentitySourceLineNumber: 724,
    resolutionFingerprint: 'abc',
  })).toBe('Event NSE:NBVENTURES');
});

it('does not invent a historical ISIN label', () => {
  expect(formatCorporateActionEventIsin(null)).toBe('Not independently established');
});
```

- [ ] **Step 2: Run the Vitest file and confirm RED**

Expected: helper module absent.

- [ ] **Step 3: Implement the presentation helper**

Keep it pure; no Tauri calls in the helper.

- [ ] **Step 4: Add UI state**

In `CorporateActionDialog`:

```ts
const [eventIdentityByImportId, setEventIdentityByImportId] =
  useState<Record<number, CorporateActionEventIdentity>>({});
```

- [ ] **Step 5: Add a batched read-only effect**

When `importRows` changes, batch IDs in groups of 500 and call `api.listCorporateActionEventIdentities`.

Use a cancellation boolean so stale async results cannot overwrite a newer import page.

If the database is closed or no rows are loaded, clear the map.

- [ ] **Step 6: Update the Official Imports instrument cell**

Keep the first line as the raw source value:

```tsx
<span>{row.symbol ? `${row.exchange}:${row.symbol}` : row.isin ?? '-'}</span>
```

When a resolved identity differs:

```tsx
<span style={corporateIssueHintTextStyle}>
  Event {identity.exchange}:{identity.eventSymbol}
</span>
```

Do not replace the raw line.

- [ ] **Step 7: Add the third Review Identity card**

Inside the existing auto-fit grid, add:

```tsx
<div style={corporateIdentityCardStyle}>
  <div style={officialImportSectionTitleStyle}>Historical Event Identity</div>
  <div style={corporateIdentityValueRowStyle}>
    <span>Event symbol</span>
    <strong>{eventIdentity?.eventSymbol ?? resolveTargetRow.symbol ?? '-'}</strong>
  </div>
  <div style={corporateIdentityValueRowStyle}>
    <span>Event ISIN</span>
    <strong>{eventIdentity?.resolved
      ? eventIdentity.eventIsin ?? 'Not independently established'
      : resolveTargetRow.isin ?? '-'}</strong>
  </div>
  <div style={corporateIdentityValueRowStyle}>
    <span>Transition</span>
    <strong>{eventIdentity?.transitionOldSymbol && eventIdentity?.transitionNewSymbol
      ? `${eventIdentity.transitionOldSymbol} → ${eventIdentity.transitionNewSymbol}`
      : '-'}</strong>
  </div>
  <div style={corporateIdentityValueRowStyle}>
    <span>Effective</span>
    <strong>{eventIdentity?.transitionEffectiveDate ?? '-'}</strong>
  </div>
</div>
```

The existing “Official Corporate Action” and “Current Database Candidate” cards stay unchanged.

- [ ] **Step 8: Update Review Issues display**

Keep raw symbol as the primary value and add the event-symbol hint underneath. Do not change Quick Resolve button eligibility.

- [ ] **Step 9: Run the new Vitest file**

Expected: PASS.

- [ ] **Step 10: Run renderer typecheck**

Expected: PASS.

- [ ] **Step 11: Record a no-Git checkpoint**

No Git command.

---

### Task 6: Implement the read-only V1.14E Preview maintenance path

**Files:**
- Create: `src-tauri-shell/src/database/corporate_action_imports/event_identity_maintenance.rs`
- Modify: `src-tauri-shell/src/database/corporate_action_imports.rs:1-20`
- Modify: `src-tauri-shell/src/database.rs:47-64`
- Modify: `src-tauri-shell/src/main.rs:754-771`
- Test: inline Rust tests in `event_identity_maintenance.rs`

**Interfaces:**
- Consumes: Task 1 authority and Task 2 projection/storage helpers.
- Produces:
  - `pub(crate) fn try_run_event_identity_resolution_maintenance(...) -> AppResult<Option<i32>>`
  - Preflight manifest with exact candidate and database-family fingerprints.
  - zero-write Preview reports.

- [ ] **Step 1: Write the maintenance-argument tests**

The unique activation flag is:

```text
--maintenance-corporate-action-v114e
```

Modes:

```text
--mode preflight
--mode apply
```

Assert normal startup arguments return `Ok(None)` and Apply requires both Preflight and backup manifests.

- [ ] **Step 2: Run the tests and confirm RED**

Expected: maintenance module absent.

- [ ] **Step 3: Add the pre-Tauri maintenance branch**

In `main()` before `tauri::Builder::default()`:

```rust
match try_run_event_identity_resolution_maintenance(std::env::args()) {
    Ok(Some(exit_code)) => std::process::exit(exit_code),
    Ok(None) => {}
    Err(error) => {
        eprintln!("V1.14E event identity resolution maintenance failed: {error}");
        std::process::exit(1);
    }
}
```

Do not disturb the existing V1.13B-1 and V1.9.2 branches.

- [ ] **Step 4: Define Preflight candidate outcomes**

Use only:

```text
READY_INSERT
READY_ALREADY_SATISFIED
BLOCKED
```

A candidate is `READY_INSERT` only when:

- import ID is in the embedded exact 184 authority;
- the live/snapshot import exists;
- exchange, raw symbol, raw ISIN, event date, and action type exactly match authority;
- `approved_corporate_action_id IS NULL`;
- event date is strictly less than transition date;
- no conflicting existing resolution exists.

- [ ] **Step 5: Define first-tranche workflow evaluation**

After candidate validation, report one of:

```text
EVENT_SYMBOL_RESOLVED_ISIN_REVIEW_REMAINS
EVENT_SYMBOL_RESOLVED_RAW_ISIN_ACCEPTABLE
BLOCKED
```

This evaluation is report-only. It must not update `corporate_action_imports`.

For first-tranche authority with `eventIsin = null`, do not claim ISIN resolution.

- [ ] **Step 6: Define the resolution fingerprint**

Hash a canonical ordered payload containing:

```text
version
import ID
exchange
raw symbol
raw ISIN/null
event date
action type
event symbol
event ISIN/null marker
chain ID
transition history row ID
transition old symbol
transition new symbol
transition effective date
raw identity source ref
raw identity source SHA-256
raw identity source line number
V1.14D.1 evidence SHA-256
resolution type
resolution authority
```

Use exact constants:

```text
resolution type:
NSE_VERIFIED_PRE_TRANSITION_EVENT_SYMBOL

resolution authority:
V1.14D.1_RAW_NSE_IDENTITY_EXACT_MATCH

V1.14D.1 evidence SHA-256:
d5a072eb85d7398556641e82a1a507daf63d82e56882ae663e094293f3ece1b2
```

- [ ] **Step 7: Define the apply-plan fingerprint**

Hash:

```text
database-family durable hashes
design authority fingerprint
candidate-set fingerprint
ordered 184 resolution fingerprints
ordered candidate outcomes
```

Do not include SHM as durable semantic state in the plan fingerprint.

- [ ] **Step 8: Build the in-memory exact-184 Preflight regression**

Insert all 184 authority imports into an in-memory fixture. Keep the resolution table absent.

Expected:

```text
authorized=184
READY_INSERT=184
READY_ALREADY_SATISFIED=0
BLOCKED=0
databaseWrites=0
mutationAuthorization=NONE
status=READY
```

- [ ] **Step 9: Add drift regressions**

At minimum:

- change one raw symbol;
- change one raw ISIN;
- change one ex-date;
- mark one import approved;
- add a conflicting prior resolution;
- set event date equal to transition date.

Each must produce `NOT_READY`/`BLOCKED`, never partial readiness.

- [ ] **Step 10: Add the 185th-row regression**

A database row not present in the embedded authority must never enter the plan, even if it appears structurally similar.

- [ ] **Step 11: Run focused V1.14E Preflight tests**

Expected: PASS.

- [ ] **Step 12: Record a no-Git checkpoint**

No Git command.

---

### Task 7: Implement the atomic controlled Apply without workflow mutation

**Files:**
- Modify: `src-tauri-shell/src/database/corporate_action_imports/event_identity_resolution.rs`
- Modify: `src-tauri-shell/src/database/corporate_action_imports/event_identity_maintenance.rs`
- Test: inline Rust tests in both modules

**Interfaces:**
- Consumes: exact READY Preflight manifest + verified backup manifest.
- Produces: one transactional table creation + exact resolution inserts, or full rollback.

- [ ] **Step 1: Write the rollback test first**

Arrange 184 valid candidates but inject a conflicting resolution at a mid-list import.

Expected after Apply returns `Err`:

```rust
assert!(!event_identity_resolution_table_exists(&connection).unwrap());
// or, when the fixture pre-created the table:
assert_eq!(resolution_row_count(&connection), initial_count);

assert_eq!(raw_import_fingerprint_after, raw_import_fingerprint_before);
```

DDL and DML must roll back together.

- [ ] **Step 2: Run the test and confirm RED**

Expected: Apply function absent.

- [ ] **Step 3: Implement strict insert semantics**

The writer accepts only a fully validated authority candidate + expected fingerprint.

Rules:

- no existing row: insert;
- existing row with exact material fields and matching fingerprint: `ALREADY_SATISFIED`;
- any material difference: `CONFLICTING_PRIOR_RESOLUTION`.

No update statement is permitted.

- [ ] **Step 4: Start one outer transaction**

Inside the transaction:

1. re-read/revalidate all 184 imports;
2. recompute candidate + plan fingerprints;
3. abort before DDL on any drift;
4. call `create_event_identity_resolution_schema_for_controlled_apply()`;
5. insert/match all exact authorized rows;
6. run read-only post-insert workflow evaluation;
7. verify raw import fields are unchanged;
8. verify no protected table count/fingerprint drift caused by V1.14E logic;
9. commit once.

- [ ] **Step 5: Explicitly prohibit existing mutating resolution paths**

The Apply implementation must not call:

```rust
apply_import_row_resolution(...)
quick_resolve_corporate_action_import_internal(...)
record_corporate_action_import_decision(...)
approve_corporate_action_import_without_transaction(...)
```

Add a package/source contract test that scans the V1.14E maintenance module for those forbidden calls.

- [ ] **Step 6: Define Apply result fields**

At minimum:

```rust
struct V114EApplyResult {
    result: String, // COMMITTED_PENDING_POST_AUDIT
    transaction_committed: bool,
    schema_created: bool,
    authorized_import_count: usize, // 184
    resolution_rows_inserted: usize,
    resolution_rows_already_satisfied: usize,
    blocked: usize,
    import_rows_updated: usize, // must be 0
    decision_rows_inserted: usize, // must be 0
    corporate_action_writes: usize, // 0
    quick_resolves: usize, // 0
    approvals: usize, // 0
    candidate_set_fingerprint: String,
    apply_plan_fingerprint: String,
}
```

- [ ] **Step 7: Add full-success test**

Expected first apply:

```text
schema_created=true
resolution_rows_inserted=184
resolution_rows_already_satisfied=0
import_rows_updated=0
decision_rows_inserted=0
corporate_action_writes=0
quick_resolves=0
approvals=0
transaction_committed=true
```

- [ ] **Step 8: Add idempotency test**

Second Apply against the already-applied fixture:

```text
resolution_rows_inserted=0
resolution_rows_already_satisfied=184
```

and no other write.

- [ ] **Step 9: Add protected-table regression**

Fingerprint before/after:

```text
corporate_action_imports
corporate_action_import_evidence
corporate_action_import_decisions
corporate_actions
instrument_identity_history
instrument_isin_history
instruments
scan_runs
corporate_action_scan_results
```

They must be identical.

- [ ] **Step 10: Add committed-report-failure sentinel behavior**

Follow the V1.13B-1 precedent: if the SQLite transaction commits but report writing fails, emit a distinct exit code/message that explicitly says **do not restore automatically**.

- [ ] **Step 11: Run focused Apply/rollback/idempotency tests**

Expected: PASS.

- [ ] **Step 12: Record a no-Git checkpoint**

No Git command.

---

### Task 8: Build fail-closed PowerShell wrappers and an independent post-audit before any live Apply

**Files:**
- Create in the implementation package, not canonical runtime source:
  - `Run-V1-14E-Preflight.ps1`
  - `Run-V1-14E-Controlled-Apply.ps1`
  - `Run-V1-14E-Post-Audit.ps1`
  - `audit/v114e/post_audit.py`
  - `authority/v1-14e-write-authority.json`
  - `Validate-V1-14E-Package.py`
  - `package-manifest.json`
- Documentation:
  - `docs/changes/2026-08-19_CORPORATE_ACTION_PHASE1_V1_14E_IMPLEMENTATION.md`

**Interfaces:**
- Preflight produces a hash-bound READY manifest and private-snapshot reports.
- Apply consumes only that exact manifest + verified pre-write backup.
- Post-audit is independently implemented in Python and does not import/call the Rust writer.

- [ ] **Step 1: Build the package contract test**

The validator must require:

```text
source basis hashes exact
design authority fingerprint exact
V1.14C events SHA exact
V1.14D.1 reports SHA exact
184 candidate IDs exact
44 chains exact
candidate-set fingerprint exact
no package Git operation
post-audit tool present before Apply can run
```

- [ ] **Step 2: Implement Preflight wrapper filesystem safety**

Preflight must:

- require `-IConfirmEODChartIsClosed`;
- hash the live main/WAL/SHM family;
- require WAL/SHM co-presence or co-absence;
- copy main + WAL when present to a private snapshot;
- treat SHM as transient: hash/record it but do not make it a durable authority requirement;
- verify copied main/WAL hashes;
- run Rust `--mode preflight` only against the private snapshot;
- re-hash the live database family after the audit and require unchanged.

- [ ] **Step 3: Make Preflight produce deterministic reports**

At minimum:

```text
v1-14e-ready-manifest.json
v1-14e-candidates.csv
v1-14e-resolution-plan.csv
v1-14e-preflight-summary.json
v1-14e-db-family-before.json
v1-14e-protected-table-fingerprints-before.json
```

Required READY result for the first live run is reviewed, not assumed. Do not hard-fail simply because some rows are `ALREADY_SATISFIED`; require `READY_INSERT + READY_ALREADY_SATISFIED = 184` and `BLOCKED = 0`.

- [ ] **Step 4: Implement the independent post-audit tool before Apply is enabled**

The Python auditor opens only a private post-Apply snapshot using SQLite read-only mode.

It must verify:

```text
exact authorized resolution rows present
each row matches frozen fingerprint
raw import symbol/ISIN/company/review_status/message unchanged
corporate_action_import_decisions unchanged
corporate_actions unchanged
instrument_identity_history unchanged
instrument_isin_history unchanged
instruments unchanged
scan_runs / scan results unchanged
quick resolves = 0
approvals = 0
quick_check = ok
foreign_key_check violations = 0
```

- [ ] **Step 5: Require post-audit readiness in the Apply wrapper**

Before Apply can open live SQLite, the wrapper verifies the exact hash of the independent post-audit payload/marker.

- [ ] **Step 6: Implement pre-write backup verification**

Backup main/WAL/SHM filesystem bytes before opening the live database. Hash each copied file and write a backup manifest.

- [ ] **Step 7: Add the explicit live-write switch**

Apply requires:

```powershell
-IConfirmEODChartIsClosed
-IApproveV114ELiveDatabaseWrite
```

The switch is a local safety guard only. **Do not run it until the user separately authorizes the live write in conversation after reviewing Preflight.**

- [ ] **Step 8: Bind Apply to exact Preflight live-family authority**

Before SQLite open, require current live main/WAL/SHM hashes to match the reviewed Preflight manifest’s represented live family.

If checkpointing changes the durable family, stop and require a new Preflight. Do not “adapt” the manifest.

- [ ] **Step 9: Run package tests only**

Use synthetic/private fixtures. Do not point the package at `EOD DATABASE\Nse\market-data.sqlite3` during implementation validation.

- [ ] **Step 10: Record a no-Git checkpoint**

No Git command.

---

### Task 9: Reconcile documentation and run focused source validation

**Files:**
- Modify: `FILE_INVENTORY.md`
- Modify: `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`
- Modify: `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- Modify: `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`
- Modify: `README.md`
- Create/update: `docs/changes/2026-08-19_CORPORATE_ACTION_PHASE1_V1_14E_IMPLEMENTATION.md`
- Preserve: approved V1.14E design spec and design-authority JSON

**Interfaces:**
- Documents source state as `IMPLEMENTED / NOT LIVE-APPLIED` until post-audit succeeds.

- [ ] **Step 1: Update file inventory**

Document the two new Rust modules, embedded authority JSON, read-only Tauri command, renderer presentation helper/tests, and external controlled package.

- [ ] **Step 2: Update architecture**

Add the four-layer identity model:

```text
raw Corporate Action import
verified event-time identity resolution
current/canonical instrument
decision/audit history
```

Explicitly state that V1.14E does not rewrite raw import identity.

- [ ] **Step 3: Update project/feature status**

Before live Apply, state:

```text
V1.14E source implementation: implemented/validated
V1.14E live database resolution tranche: NOT APPLIED
Mutation authorization: NONE
```

Do not mark Corporate Action Phase 1 complete.

- [ ] **Step 4: Run Rust formatting**

```powershell
cargo fmt --manifest-path src-tauri-shell/Cargo.toml --check
```

Expected: PASS.

- [ ] **Step 5: Run focused V1.14E Rust tests**

```powershell
cargo test --manifest-path src-tauri-shell/Cargo.toml v114e -- --nocapture
```

Expected: PASS.

- [ ] **Step 6: Run existing affected scanner regressions**

Run the specific scanner/currentness/compound filters touched in Task 4. Do not run every Rust test by default.

- [ ] **Step 7: Run the new renderer unit test**

```powershell
npx vitest run src/features/corporateActions/__tests__/corporateActionEventIdentityPresentation.test.ts
```

Expected: PASS.

- [ ] **Step 8: Run renderer typecheck**

```powershell
npm run typecheck:renderer
```

Expected: PASS.

- [ ] **Step 9: Run Tauri compile check**

```powershell
npm run tauri:check
```

Expected: PASS.

- [ ] **Step 10: Validate documentation references**

Run the documentation-reference checker directly if needed. Do **not** use `scripts/validate-change.ps1` because its final step invokes Git.

- [ ] **Step 11: Produce a source validation report**

Record every validation as PASS/FAIL/incomplete and SHA-256 the final touched source files.

- [ ] **Step 12: Stop before any production database operation**

At this point the implementation package may be delivered for user review. Do not run Preflight automatically.

---

## Operator Gates After Source Implementation

These are explicit conversation gates, not automatic continuation steps.

### Gate A — Source implementation review

Required before any database audit:

```text
source package hashes verified
focused Rust tests PASS
renderer tests/typecheck PASS
Tauri compile check PASS
post-audit tool already built and hash-bound
no production database opened
```

### Gate B — Read-only live-state Preflight

After the user approves running Preflight:

```text
application closed
private snapshot only
database writes 0
resolution writes 0
READY_INSERT + READY_ALREADY_SATISFIED = 184
BLOCKED = 0
live DB family unchanged
```

Upload and review all Preflight reports.

### Gate C — Separate live database write approval

Only after Gate B is reviewed may the user explicitly authorize V1.14E live Apply.

No approval is implicit from approving this implementation plan, source implementation, or Preflight.

### Gate D — Controlled Apply

Expected first-run intent:

```text
resolution rows inserted: up to 184
raw import updates: 0
decision rows inserted: 0
Quick Resolves: 0
Corporate Action approvals: 0
identity-history writes: 0
ISIN-history writes: 0
raw EOD writes: 0
```

Result remains:

```text
COMMITTED_PENDING_POST_AUDIT
```

### Gate E — Independent post-audit

Only the independent post-audit can establish full success.

Until it passes:

```text
V1.14E != FULL_SUCCESS
```

---

## Plan Self-Review

### Spec coverage

- Dedicated structured resolution state: Tasks 2 and 7.
- Raw import immutability: Tasks 2, 4, 7, 8.
- Nullable/unproven historical ISIN: Tasks 1, 2, 5, 7.
- Strict pre-transition date gate: Tasks 1 and 6.
- Central event identity projection: Tasks 2–5.
- Scanner event-symbol consumption: Task 4.
- UI raw/event distinction: Task 5.
- No implicit Quick Resolve/approval: Tasks 6–8.
- Exact 184/44 tranche: Tasks 1, 6, 7, 8.
- Preview → backup → atomic Apply → post-audit: Tasks 6–8.
- Idempotency/conflict blocking: Task 7.
- Independent post-audit: Task 8.
- Documentation/validation: Task 9.

No approved design requirement is intentionally omitted.

### Placeholder scan

No implementation placeholder remains in the plan. Exact file paths, interfaces, safety gates, test names, core schema, and command names are specified.

### Type consistency

The plan consistently uses:

```text
CorporateActionEventIdentityListInput
CorporateActionEventIdentity
CorporateActionEventIdentityListResult
list_corporate_action_event_identities
listCorporateActionEventIdentities
```

and the first-tranche resolution constants:

```text
NSE_VERIFIED_PRE_TRANSITION_EVENT_SYMBOL
V1.14D.1_RAW_NSE_IDENTITY_EXACT_MATCH
```

### Scope check

The plan is one coherent subsystem: historical event-time identity resolution for the fixed 184-event V1.14E tranche. Successor/restructure, missing-symbol, ambiguous identity, and broader generalized resolution remain outside this implementation.

### Git policy

The standard superpowers plan template normally uses per-task Git commits. This project has no Git authorization for the Corporate Action phase, so all commit steps are intentionally replaced with hash/checkpoint steps. No Git operation is part of this plan.
