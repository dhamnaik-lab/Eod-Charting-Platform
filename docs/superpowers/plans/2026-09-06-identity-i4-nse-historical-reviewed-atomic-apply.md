# Identity I4 NSE Historical Reviewed Preview + Atomic Apply Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This project does not authorize Git commands by default, so no commit steps are included.

**Goal:** Replace direct NSE historical identity mutation with a reviewed, filterable Preview → Apply workflow whose complete historical/master/current-universe operation commits atomically or rolls back fully.

**Architecture:** Capture the three NSE historical source files once, execute the exact historical operation inside an outer SQLite transaction, and use the resulting complete operator-visible plan to produce `NSE_HISTORICAL_IDENTITY_PLAN_V1` SHA-256 authority. Preview always rolls back. Apply rebuilds the same plan under one locked transaction, compares the expected SHA, and commits only on an exact match with zero plan errors.

**Tech Stack:** React + TypeScript + Vitest; Tauri 2; Rust; rusqlite; existing `sha2`; PowerShell evidence runner.

**Spec:** `docs/superpowers/specs/2026-09-06-identity-i4-nse-historical-reviewed-atomic-apply-design.md`

## Global Constraints

- Project root: `E:\TA Projects\EOD Charting Platform`.
- NSE remains functional/data acceptance authority.
- BSE history/parity/production Apply acceptance remains deferred.
- Review surface: Option C — Actionable default + All/Duplicates/Skipped/Errors filters.
- Transaction model: Option A — one reviewed atomic historical Apply transaction.
- Preserve I3 reviewed current-universe Apply behavior.
- Preserve Manual Entry and Official Imports R1C-I1.
- Do not modify BSE backend behavior.
- Do not add package/crate dependencies.
- No production database path accepted by the implementation runner.
- No source-control command unless separately authorized.
- PowerShell runners: guard clauses + separate `if` blocks; no `else`/`elseif`.
- Exact preimage hashes must be verified before mutation.
- Any failed implementation gate restores exact preimages.

---

## File map

**Create**

- `src/features/corporateActions/__tests__/corporateActionIdentityHistoricalReviewedAtomicApply.test.ts` — I4 frontend/cross-layer contract.
- `docs/superpowers/specs/2026-09-06-identity-i4-nse-historical-reviewed-atomic-apply-design.md` — approved I4 design.
- `docs/superpowers/plans/2026-09-06-identity-i4-nse-historical-reviewed-atomic-apply.md` — this plan.
- `docs/changes/<IST>_IDENTITY_I4_NSE_HISTORICAL_REVIEWED_ATOMIC_APPLY.md` — closeout report.

**Modify**

- `src/components/DatabaseToolsDialogs.tsx` — historical Preview/Apply controls, Option C filters, historical reviewed authority.
- `src/types/desktop.ts` — I4 inputs/result/rows + Desktop API.
- `src/platform/types.ts` — re-export/import I4 desktop types.
- `src/platform/tauriDesktop.ts` — invoke new Preview/Apply commands; retire direct import invoke.
- `src-tauri-shell/src/database.rs` — Rust I4 serialized input/result/row types.
- `src-tauri-shell/src/database/nse_identity_imports.rs` — source snapshot, dry-run plan, plan SHA, Preview, atomic Apply, I4 tests.
- `src-tauri-shell/src/database/instrument_mutations.rs` — make identity persistence caller-transaction-aware without changing standalone behavior.
- `src-tauri-shell/src/main.rs` — register new Preview/Apply commands; retire unreviewed historical command.

**Preserve**

- `src-tauri-shell/src/database/bse_identity_imports.rs`.
- package files / dependency set.
- chart-price authority files.
- Official Imports R1C-I1 authority files.

---

### Task 1: Freeze exact I3 authority and establish I4 TDD RED

**Files:**
- Create: `src/features/corporateActions/__tests__/corporateActionIdentityHistoricalReviewedAtomicApply.test.ts`
- Inspect: every file in the File map.

**Interfaces:**
- Consumes current I3 source authority.
- Produces a focused failing source-contract test proving the historical reviewed/atomic contract does not yet exist.

- [ ] **Step 1: Verify exact preimages**

Hash-verify at minimum:

```text
DatabaseToolsDialogs.tsx  E406F237E2CCCD5703B73FB6869D6E99C487AE3452F755877AD6E35C4B7A58F2
src/types/desktop.ts      E7963F6A8C1E79B7B3F4901679C7F09026D7694E547F509D487D926B93D380B3
database.rs               4AE58E628B5466884CBC8C8E6002F5E0F70BCCBE48236CFF5FBC201B5EB24310
nse_identity_imports.rs   D54BBBC30DD3E2CD9B6A058A8617F8B1C2FEB069D49BA5571BE7BEF3E9EF73CB
tauriDesktop.ts           C1AFC01FD099A82EEDA6EA8F62207852AF0DDFEC909EFAEAB40F5AD1373E7350
main.rs                   1785FBC94BA334ED0D03A19D490D5B1E446216A13C5C0F2BF682104D3A87BF75
instrument_mutations.rs   656521287985B46E44518CDE5FFF8A855EC3E76B8D3D25B1AC558BCD2F7C70BF
```

If `instrument_mutations.rs` or any authority differs in the live worktree, stop for read-only reinspection.

- [ ] **Step 2: Write focused I4 failing test**

The test reads source files and requires markers that are absent pre-I4:

```ts
expect(desktopTypes).toContain('export interface NseHistoricalIdentityApplyInput');
expect(desktopTypes).toContain('expectedPlanSha256: string');
expect(desktopTypes).toContain('export interface NseHistoricalIdentityResult');
expect(databaseRs).toContain('pub struct NseHistoricalIdentityApplyInput');
expect(nseBackend).toContain('NSE_HISTORICAL_IDENTITY_PLAN_V1');
expect(nseBackend).toContain('preview_nse_historical_identity_archive');
expect(nseBackend).toContain('apply_nse_historical_identity_archive');
expect(databaseTools).toContain("'actionable' | 'all' | 'duplicates' | 'skipped' | 'errors'");
expect(databaseTools).toContain('nseHistoricalReviewedApplyAuthority');
```

Also require retirement of the interactive legacy path after GREEN:

```ts
expect(tauriDesktop).not.toContain("tauriInvoke('import_nse_identity_archive'");
```

- [ ] **Step 3: Run I4 focused RED**

```powershell
npm.cmd test -- src\features\corporateActions\__tests__\corporateActionIdentityHistoricalReviewedAtomicApply.test.ts
```

Expected: FAIL because new historical reviewed contracts do not exist yet.

---

### Task 2: Add I4 cross-language types and public command surface

**Files:**
- Modify: `src/types/desktop.ts`
- Modify: `src/platform/types.ts`
- Modify: `src/platform/tauriDesktop.ts`
- Modify: `src-tauri-shell/src/database.rs`
- Modify: `src-tauri-shell/src/main.rs`

**Interfaces:**
- Produces `NseHistoricalIdentityPreviewInput`.
- Produces `NseHistoricalIdentityApplyInput`.
- Produces `NseHistoricalIdentityPreviewRow` and `NseHistoricalIdentityResult`.
- Produces Desktop API Preview/Apply methods.

- [ ] **Step 1: Add TypeScript row and result contracts**

Add exactly the interfaces/unions from the I4 spec, including:

```ts
export type NseHistoricalIdentityPreviewDisposition =
  | 'NEW'
  | 'DUPLICATE'
  | 'SKIPPED'
  | 'ERROR';
```

and result fields:

```ts
canApply: boolean;
planSha256: string;
currentUniversePlanSha256: string | null;
historyRows: NseHistoricalIdentityPreviewRow[];
currentUniversePreviewRows: NseCurrentUniverseSyncPreviewRow[];
```

- [ ] **Step 2: Add Rust serialized contracts**

Mirror all I4 fields in `database.rs` using `#[serde(rename_all = "camelCase")]`.

- [ ] **Step 3: Change Desktop API**

Remove:

```ts
importNseIdentityArchive(input: NseIdentityImportInput): Promise<NseIdentityImportResult>;
```

Add:

```ts
previewNseHistoricalIdentityArchive(
  input: NseHistoricalIdentityPreviewInput,
): Promise<NseHistoricalIdentityResult>;

applyNseHistoricalIdentityArchive(
  input: NseHistoricalIdentityApplyInput,
): Promise<NseHistoricalIdentityResult>;
```

- [ ] **Step 4: Change Tauri transport**

Remove the active legacy invoke and add:

```ts
previewNseHistoricalIdentityArchive: async (input) =>
  tauriInvoke('preview_nse_historical_identity_archive', { input }),

applyNseHistoricalIdentityArchive: async (input) =>
  tauriInvoke('apply_nse_historical_identity_archive', { input }),
```

- [ ] **Step 5: Change command registration**

In `main.rs` remove `import_nse_identity_archive` from `generate_handler!` and register:

```rust
preview_nse_historical_identity_archive,
apply_nse_historical_identity_archive,
```

Do not change menus or unrelated commands.

---

### Task 3: Make nested I4 write paths caller-transaction-aware

**Files:**
- Modify: `src-tauri-shell/src/database/instrument_mutations.rs`
- Modify: `src-tauri-shell/src/database/nse_identity_imports.rs`

**Interfaces:**
- Produces transactionless persistence helpers that are safe only when caller owns an outer transaction.
- Preserves current top-level transaction behavior when `connection.is_autocommit()` is true.

- [ ] **Step 1: Refactor identity mutation persistence body**

Extract the SQL body currently inside the `record_identity_change` transaction into a helper conceptually:

```rust
fn persist_identity_change_in_open_transaction(
    connection: &Connection,
    prepared: &PreparedIdentityChange,
) -> AppResult<CorporateActionResult>
```

If introducing a `PreparedIdentityChange` struct would create excessive churn, pass the normalized values explicitly; do not duplicate the SQL body.

- [ ] **Step 2: Preserve standalone transaction behavior**

`record_identity_change` must use:

```rust
if connection.is_autocommit() {
    return run_connection_transaction(connection, |connection| {
        persist_identity_change_in_open_transaction(connection, ...)
    });
}

persist_identity_change_in_open_transaction(connection, ...)
```

Thus ordinary Manual Entry remains independently atomic while I4 can nest it inside the historical outer transaction.

- [ ] **Step 3: Refactor security-master upsert**

Extract:

```rust
fn upsert_security_master_rows_in_open_transaction(
    connection: &Connection,
    rows: &[NseSecurityMasterRow],
) -> AppResult<HashSet<String>>
```

and make the existing wrapper choose top-level transaction vs direct execution using `connection.is_autocommit()`.

- [ ] **Step 4: Refactor current-universe plan Apply**

Extract:

```rust
fn apply_nse_current_universe_sync_plan_in_open_transaction(
    connection: &Connection,
    plan: &NseCurrentUniverseSyncPlan,
) -> AppResult<()>
```

and preserve existing standalone transaction behavior with the same `is_autocommit()` rule.

- [ ] **Step 5: Add focused Rust nesting test**

Open `BEGIN IMMEDIATE`, call each nested-capable helper through a representative operation, force outer `ROLLBACK`, and prove no persistent state survives.

---

### Task 4: Capture immutable historical source snapshots

**Files:**
- Modify: `src-tauri-shell/src/database/nse_identity_imports.rs`

**Interfaces:**
- Produces private `NseHistoricalIdentitySourceSnapshot`.
- Preview and Apply consume the exact same parsed snapshot representation.

- [ ] **Step 1: Define source snapshot**

```rust
struct NseHistoricalIdentitySourceSnapshot {
    archive_root_path: String,
    securities_available_path: String,
    symbol_changes_path: String,
    company_name_changes_path: String,
    securities_available_sha256: String,
    symbol_changes_sha256: String,
    company_name_changes_sha256: String,
    master_rows: Vec<NseSecurityMasterRow>,
    symbol_change_rows: Vec<NseSymbolChangeRow>,
    name_change_rows: Vec<NseNameChangeRow>,
}
```

- [ ] **Step 2: Read each file exactly once**

Use `fs::read` once per file. Compute SHA-256 from those bytes.

- [ ] **Step 3: Parse captured bytes**

Add byte-based parsing helpers for symbol-change and name-change CSVs so parsing never reopens the path.

Existing path-based helpers may delegate to the byte-based parser to avoid semantic duplication.

- [ ] **Step 4: Add source-snapshot test**

Prove the reported SHA equals SHA-256 of the exact bytes and that parsing uses captured bytes rather than a later path reread.

---

### Task 5: Build complete historical outcome rows in one shared execution function

**Files:**
- Modify: `src-tauri-shell/src/database/nse_identity_imports.rs`

**Interfaces:**
- Consumes `&NseHistoricalIdentitySourceSnapshot` and transaction-visible `&Connection`.
- Produces complete `NseHistoricalIdentityResult` before the caller decides ROLLBACK or COMMIT.

- [ ] **Step 1: Replace count-only row recording with classified outcome**

Refactor `record_identity_payload` to return an enum:

```rust
enum HistoricalIdentityPayloadOutcome {
    New,
    Duplicate,
    Error(String),
}
```

Preserve existing duplicate semantics while producing a row disposition.

- [ ] **Step 2: Emit `SKIPPED` rows**

When existing chain-filter logic excludes a source row, append a preview row with:

```text
disposition = SKIPPED
detail = "Outside the included NSE identity symbol chain for the current database/source set."
```

- [ ] **Step 3: Emit combined/symbol/name rows deterministically**

Keep current chronological ordering rules. For every attempted payload append exactly one row with `NEW`, `DUPLICATE`, or `ERROR`.

- [ ] **Step 4: Withhold master/current sync on historical errors**

If `error_rows > 0`:

```rust
result.can_apply = false;
result.current_universe_plan_sha256 = None;
return Ok(result);
```

No master/current-universe operation executes.

- [ ] **Step 5: Execute master + current-universe effects inside the same outer transaction**

When no historical errors exist:

```rust
let upserted = upsert_security_master_rows(connection, &snapshot.master_rows)?;
let current_plan = build_nse_current_universe_sync_plan(...)?;
let current_sha = nse_current_universe_plan_sha256(&current_plan);
apply_nse_current_universe_sync_plan(connection, &current_plan)?;
```

Populate current-universe counts and preview rows from `current_plan` before moving it.

- [ ] **Step 6: Set `canApply` only after full dry-run success**

```rust
result.can_apply = result.error_rows == 0;
```

Fatal errors return `Err`, not an applicable result.

---

### Task 6: Add deterministic I4 plan SHA

**Files:**
- Modify: `src-tauri-shell/src/database/nse_identity_imports.rs`

**Interfaces:**
- Produces `fn nse_historical_identity_plan_sha256(result: &NseHistoricalIdentityResult) -> String`.

- [ ] **Step 1: Add version marker**

```rust
const NSE_HISTORICAL_IDENTITY_PLAN_HASH_VERSION: &str =
    "NSE_HISTORICAL_IDENTITY_PLAN_V1";
```

- [ ] **Step 2: Reuse I3 length-prefixed encoding discipline**

Do not use delimiter-only concatenation.

- [ ] **Step 3: Canonicalize rows**

Sort cloned history rows by a deterministic tuple including disposition, change type, effective date, symbols, names, source file, detail.

- [ ] **Step 4: Hash complete reviewed authority**

Include exact source SHA values, all rows/counts/errors, `can_apply`, and current-universe plan SHA/counts.

- [ ] **Step 5: Add determinism/content-sensitivity test**

Logically equivalent ordering must hash the same; one operator-visible or write-driving field change must change the hash.

---

### Task 7: Implement rollback-only Historical Preview

**Files:**
- Modify: `src-tauri-shell/src/database/nse_identity_imports.rs`

**Interfaces:**
- Public command: `preview_nse_historical_identity_archive`.

- [ ] **Step 1: Add rollback-only transaction helper local to NSE historical I4**

Use explicit `BEGIN IMMEDIATE` and unconditional `ROLLBACK`. Ensure callback failure still attempts rollback before returning the original error.

- [ ] **Step 2: Execute exact plan inside transaction**

```text
capture source snapshot
BEGIN IMMEDIATE
execute shared historical plan
compute plan SHA
ROLLBACK
return applied=false result
```

- [ ] **Step 3: Do not emit database change events**

Preview must not invalidate stats or emit `db:changed`.

- [ ] **Step 4: Add no-persistent-write Preview test**

Snapshot both `instruments` and `instrument_identity_history` before and after Preview and assert exact equality.

---

### Task 8: Implement one reviewed atomic Historical Apply

**Files:**
- Modify: `src-tauri-shell/src/database/nse_identity_imports.rs`

**Interfaces:**
- Public command: `apply_nse_historical_identity_archive`.

- [ ] **Step 1: Normalize expected SHA**

Use exact stale message from the spec for malformed values.

- [ ] **Step 2: Keep one transaction open through plan reconstruction and authority decision**

```text
capture source snapshot
BEGIN IMMEDIATE
execute shared historical plan tentatively
compute rebuilt SHA
```

- [ ] **Step 3: Reject non-applicable plans**

If `can_apply == false`, rollback and return an explicit preview-error rejection.

- [ ] **Step 4: Reject stale authority**

If expected SHA != rebuilt SHA:

```text
ROLLBACK
NSE historical identity preview is stale because the source or database state changed. Preview Historical Identity again before applying.
```

- [ ] **Step 5: Commit exact match**

On match with no plan errors:

```rust
connection.execute_batch("COMMIT")?;
result.applied = true;
```

- [ ] **Step 6: Emit app database change only after commit**

Only a committed Apply invalidates cached stats and emits `database_changed`.

---

### Task 9: Add I4 atomicity/staleness Rust tests

**Files:**
- Modify test module in `src-tauri-shell/src/database/nse_identity_imports.rs`
- Modify/add narrow tests in `instrument_mutations.rs` only if needed for the nested helper.

**Interfaces:**
- Tests all database safety guarantees directly against temporary/in-memory databases.

- [ ] **Step 1: Preview rollback test**

Verify historical and instrument tables are identical before/after Preview.

- [ ] **Step 2: Classification test**

Construct archive/DB fixtures producing NEW, DUPLICATE, SKIPPED, and ERROR outcomes and verify deterministic rows/counts.

- [ ] **Step 3: Matching Apply commit test**

Preview → capture SHA → Apply → verify history + master + current-universe changes all committed.

- [ ] **Step 4: Later historical-row failure rollback test**

Ensure at least one earlier historical row succeeds tentatively, then inject a later failure. Assert **zero** history/instrument changes survive.

- [ ] **Step 5: Master failure rollback test**

Inject a master-upsert failure after successful tentative historical changes. Assert all history changes roll back.

- [ ] **Step 6: Current-universe failure rollback test**

Inject failure during tentative current-universe mutation. Assert history + master changes roll back.

- [ ] **Step 7: Source stale test**

Preview → modify one source file → Apply old SHA → exact stale error → zero persistent Apply changes.

- [ ] **Step 8: Database stale test**

Preview → alter relevant test DB state → capture that altered state → Apply old SHA → stale error → assert state after rejection equals immediately-pre-Apply altered state.

- [ ] **Step 9: Malformed SHA test**

Malformed SHA rejects and changes nothing.

- [ ] **Step 10: Duplicate/skip applicability test**

Plan with duplicates/skips and no errors remains `canApply=true`.

Run new tests with a shared prefix such as:

```powershell
cargo.exe test --manifest-path "src-tauri-shell\Cargo.toml" i4_historical_
```

---

### Task 10: Implement frontend Historical Preview / Apply authority and Option C review

**Files:**
- Modify: `src/components/DatabaseToolsDialogs.tsx`

**Interfaces:**
- Consumes `NseHistoricalIdentityResult`.
- Produces separate historical reviewed authority + filter state.

- [ ] **Step 1: Add frontend state**

```ts
type NseHistoricalIdentityFilter =
  | 'actionable'
  | 'all'
  | 'duplicates'
  | 'skipped'
  | 'errors';

type NseHistoricalReviewedApplyAuthority = {
  planSha256: string;
  activeDatabasePath: string;
  archiveRootPath: string;
};
```

Add result/filter/authority state. Default filter is `'actionable'`.

- [ ] **Step 2: Replace direct Import button**

Remove operator action label `Import Historical Identity` and render:

```text
Preview Historical Identity
Apply Reviewed Historical Identity
```

- [ ] **Step 3: Implement Historical Preview handler**

At start:

```ts
setNseHistoricalReviewedApplyAuthority(null);
setNseReviewedApplyAuthority(null);
```

Call Preview API with trimmed archive root. On success store result, reset filter to actionable, and create authority only when active DB path remained unchanged during await.

- [ ] **Step 4: Implement Historical Apply readiness**

Require result, `canApply`, matching plan SHA, DB path, archive root, Manual/NSE context, and not busy.

- [ ] **Step 5: Implement Historical Apply handler**

Consume authority before invoke. Send required `expectedPlanSha256`. On success/failure keep authority null. On success refresh/reload current instrument using the existing pattern.

- [ ] **Step 6: Add invalidation rules**

Clear historical authority on every transition listed in the spec. Starting current-universe Preview/Apply/refresh must clear historical authority.

- [ ] **Step 7: Render summary badges**

Show at minimum:

```text
Symbol
Name
Combined
Duplicate
Skipped
Error
Master
Activate
Update
Deactivate
```

- [ ] **Step 8: Render Option C filter controls**

Exact five labels:

```text
Actionable | All | Duplicates | Skipped | Errors
```

- [ ] **Step 9: Render historical rows**

Use columns:

```text
Outcome | Type | Effective Date | Old Symbol | New/Current Symbol | Old Name | New/Current Name | Detail
```

- [ ] **Step 10: Render current-universe effects as a separate subsection**

Reuse the existing current-universe preview row presentation semantics rather than inventing another lifecycle vocabulary.

---

### Task 11: Turn I4 focused TypeScript test GREEN and run Identity regressions

**Files:**
- Test: `src/features/corporateActions/__tests__/corporateActionIdentityHistoricalReviewedAtomicApply.test.ts`
- Existing Identity tests preserved unless an assertion must evolve for the approved replacement of the direct historical button/API.

**Interfaces:**
- Proves public unreviewed path is gone and reviewed UI contract exists.

- [ ] **Step 1: Require all five filters and actionable default**

Test source contains the filter union and `useState<NseHistoricalIdentityFilter>('actionable')`.

- [ ] **Step 2: Require separate reviewed authority**

Assert plan/database/archive-root binding exists.

- [ ] **Step 3: Require cross-authority invalidation**

Assert Historical Preview clears I3 authority and current-universe Preview/Apply clears historical authority.

- [ ] **Step 4: Require legacy route retirement**

Assert current source/transport/main handler do not expose direct interactive import.

- [ ] **Step 5: Run I4 focused GREEN**

```powershell
npm.cmd test -- src\features\corporateActions\__tests__\corporateActionIdentityHistoricalReviewedAtomicApply.test.ts
```

- [ ] **Step 6: Run I3 + I2-R2/I2/I0/I1 tests**

Require all PASS.

- [ ] **Step 7: Run full Corporate Action suite**

Require all PASS.

---

### Task 12: Compile/build verification, preservation hashes, and evidence closeout

**Files:**
- Create: `docs/changes/<IST>_IDENTITY_I4_NSE_HISTORICAL_REVIEWED_ATOMIC_APPLY.md`
- Evidence under `E:\TA Projects\EOD Charting Platform Source Audit`.

**Interfaces:**
- Produces final auditable I4 evidence and rollback authority.

- [ ] **Step 1: Run renderer typecheck**

```powershell
npm.cmd run typecheck:renderer
```

- [ ] **Step 2: Run renderer build**

```powershell
npm.cmd run build:renderer
```

- [ ] **Step 3: Run Cargo check**

```powershell
cargo.exe check --manifest-path "src-tauri-shell\Cargo.toml"
```

- [ ] **Step 4: Run portable build**

```powershell
npm.cmd run tauri:portable:win
```

- [ ] **Step 5: Re-hash preservation sentinels**

Require no drift in BSE backend, Official Imports R1C-I1, chart-price files, package files, and unrelated Corporate Action authority.

- [ ] **Step 6: Write closeout report**

Report:

```text
Goal / scope / constraints
exact pre/post hashes
TDD RED
I4 TS GREEN
I4 Rust atomicity/stale/no-write results
I3 regressions
full CA suite
renderer typecheck/build
Cargo check
portable SHA
production DB access by runner: NO
Git command: NO
BSE historical acceptance: DEFERRED
manual checkpoint: REQUIRED
```

- [ ] **Step 7: Package evidence**

Include manifest, preimages/postimages, spec, plan, test logs, build logs, hashes, report.

- [ ] **Step 8: Roll back on any failure**

Restore exact preimages for every mutated source/test/doc file and verify hashes before reporting failure evidence.

---

## Manual acceptance after automated PASS

Use a disposable/private test database.

- [ ] Historical Apply disabled before Preview.
- [ ] Preview shows Actionable default.
- [ ] All five filters display the correct subsets without changing authority.
- [ ] Archive-root change invalidates Apply.
- [ ] Fresh Preview restores Apply when `canApply=true`.
- [ ] Successful Apply consumes authority and disables Apply.
- [ ] A second Apply requires another Preview.
- [ ] Existing I3 current-universe Preview/Apply lifecycle still behaves as previously accepted.

Do not manually inject stale/failure corruption into production data.

---

## Plan self-review

- **Spec coverage:** Option C filters, Option A transaction, public direct-route retirement, source snapshot, deterministic SHA, rollback-only Preview, atomic Apply, cross-authority invalidation, and BSE boundary all map to explicit tasks.
- **Nested transaction constraint:** explicitly resolved at the three bounded nested write call sites; no generic transaction helper redesign is required.
- **TOCTOU safety:** Apply keeps `BEGIN IMMEDIATE` open from plan execution through SHA decision and commit.
- **Preview persistence:** Preview always rolls back and emits no DB change event.
- **Error policy:** historical ERROR rows block Apply; DUPLICATE/SKIPPED rows do not.
- **Type consistency:** `expectedPlanSha256` ↔ `expected_plan_sha256`; `planSha256` ↔ `plan_sha256`; filter values match disposition mapping.
- **Placeholder scan:** no TODO/TBD implementation gaps remain.
- **Project policy:** no Git step and no production database argument is required.
