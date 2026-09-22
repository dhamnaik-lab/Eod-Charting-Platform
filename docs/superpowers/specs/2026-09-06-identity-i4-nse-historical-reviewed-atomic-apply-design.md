# Identity I4 — NSE Historical Identity Reviewed Preview + Atomic Apply Design

**Status:** DESIGN DECISIONS APPROVED / WRITTEN SPEC REVIEW GATE  
**Date:** 2026-09-06 IST  
**Project:** `E:\TA Projects\EOD Charting Platform`

## Goal

Replace the direct NSE `Import Historical Identity` mutation path with a reviewed historical Preview → Apply workflow that:

1. shows operator-reviewable historical identity outcomes before persistence;
2. binds Apply to the exact reviewed historical plan with deterministic SHA-256 authority; and
3. commits historical identity changes, security-master effects, and current-universe synchronization as **one atomic transaction** or rolls back everything.

## Approved design decisions

### Review surface — Option C

Historical Preview defaults to **Actionable** rows and provides filters:

- Actionable
- All
- Duplicates
- Skipped
- Errors

Summary badges always describe the complete plan, regardless of the active filter.

### Transaction model — Option A

The complete reviewed historical operation is one transaction:

```text
Historical Preview
→ reviewed historical plan + deterministic plan SHA
→ Apply Reviewed Historical Identity
→ rebuild the same operation under one write transaction
→ compare expected SHA against rebuilt plan
→ match + no errors: COMMIT everything
→ mismatch/error/failure: ROLLBACK everything
```

No historical row, security-master upsert, or current-universe state change may remain partially committed after a rejected or failed I4 Apply.

## Current authority / preimage baseline

Implementation must first verify the live worktree. Do not assume these values are current if the project has moved.

Known I3 authorities at I4 design time:

- `src\components\DatabaseToolsDialogs.tsx` — `E406F237E2CCCD5703B73FB6869D6E99C487AE3452F755877AD6E35C4B7A58F2`
- `src\types\desktop.ts` — `E7963F6A8C1E79B7B3F4901679C7F09026D7694E547F509D487D926B93D380B3`
- `src-tauri-shell\src\database.rs` — `4AE58E628B5466884CBC8C8E6002F5E0F70BCCBE48236CFF5FBC201B5EB24310`
- `src-tauri-shell\src\database\nse_identity_imports.rs` — `D54BBBC30DD3E2CD9B6A058A8617F8B1C2FEB069D49BA5571BE7BEF3E9EF73CB`
- `src\platform\tauriDesktop.ts` — `C1AFC01FD099A82EEDA6EA8F62207852AF0DDFEC909EFAEAB40F5AD1373E7350`
- `src-tauri-shell\src\main.rs` — `1785FBC94BA334ED0D03A19D490D5B1E446216A13C5C0F2BF682104D3A87BF75`
- `src-tauri-shell\src\database\instrument_mutations.rs` — inspection baseline `656521287985B46E44518CDE5FFF8A855EC3E76B8D3D25B1AC558BCD2F7C70BF`
- I3 focused test — `F9FFF6D5086C89AAF8B879B1AA42FEC607C019CAEEE89B1D20E6A933A2B94ADE`
- I3 evidence — `40FBC4660253C11F5F84DB63FEA41BD3B0AE27DDF6F9E7CA2A62CA6CE1A86586`
- I3 documentation closeout evidence — `AF4D1E7C8676317B4583E1737C3BC96B4E02714952410D02F4594C6D3DBC5B22`

The implementation runner must stop on drift rather than patch by line number or approximate string match.

## Existing behavior that I4 replaces

The current manual NSE historical action performs:

```text
Import Historical Identity
→ parse SecuritiesAvailable
→ parse SymbolChanges
→ parse CompanyNameChanges
→ write historical identity rows one-by-one
→ if no row errors: upsert security master
→ apply the archive's current-universe synchronization
```

Historical identity rows currently reach `record_identity_change`, where each row is independently transaction-wrapped. Security-master upsert and current-universe synchronization are separately transaction-wrapped. Therefore the direct import is not one atomic unit.

I4 removes the operator-facing unreviewed direct mutation path.

## Scope

### In scope

- NSE Manual `Archive Root` historical identity workflow.
- Historical Preview with Option C filters.
- Deterministic historical reviewed-plan SHA-256.
- One atomic reviewed Apply transaction covering:
  - historical symbol changes;
  - historical name changes;
  - combined symbol+name changes;
  - security-master upserts;
  - current-universe synchronization.
- Fail-closed stale reviewed-plan handling.
- Exact rollback behavior on any failure.
- Frontend reviewed-authority lifecycle.
- Retirement of the public unreviewed `import_nse_identity_archive` command from the interactive Desktop API.
- TDD, Rust behavioral tests, Identity/Corporate Action regressions, typecheck/build/portable evidence.

### Out of scope

- BSE historical identity import/parity.
- BSE reviewed-plan parity.
- Corporate Action price-action transaction redesign.
- Manual Entry redesign.
- Official Imports R1C-I1 redesign.
- I3 current-universe fingerprint redesign.
- Generic application-wide transaction framework replacement.
- New dependency/crate addition.
- Git/source-control operations.

## Operator workflow

For `Exchange = NSE` and `Source = Manual`:

```text
NSE Archive Root [path] [Browse Folder]

Historical NSE symbol/name chains
[Preview Historical Identity] [Apply Reviewed Historical Identity]

Filter: [Actionable] [All] [Duplicates] [Skipped] [Errors]
Summary: Symbol | Name | Combined | Duplicate | Skipped | Error | Master | Activate | Update | Deactivate

Historical preview table
Outcome | Type | Effective Date | Old Symbol | New/Current Symbol | Old Name | New/Current Name | Detail

Current-universe effects
(existing NSE current-universe preview row representation)
```

`Actionable` is selected automatically after every successful historical Preview.

## Public command contract

### Retire direct unreviewed import

Remove the interactive Desktop/Tauri route:

```text
importNseIdentityArchive(...)
import_nse_identity_archive
```

from:

- `DesktopApi`;
- Tauri desktop transport;
- active Tauri `generate_handler!` registration.

No interactive route may remain that can bypass historical Preview authority.

### New Preview input

TypeScript:

```ts
export interface NseHistoricalIdentityPreviewInput {
  archiveRootPath: string;
}
```

Rust:

```rust
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NseHistoricalIdentityPreviewInput {
    pub archive_root_path: String,
}
```

### New Apply input

TypeScript:

```ts
export interface NseHistoricalIdentityApplyInput
  extends NseHistoricalIdentityPreviewInput {
  expectedPlanSha256: string;
}
```

Rust:

```rust
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NseHistoricalIdentityApplyInput {
    pub archive_root_path: String,
    pub expected_plan_sha256: String,
}
```

### Historical preview row

```ts
export type NseHistoricalIdentityPreviewDisposition =
  | 'NEW'
  | 'DUPLICATE'
  | 'SKIPPED'
  | 'ERROR';

export type NseHistoricalIdentityChangeType =
  | 'SYMBOL_CHANGE'
  | 'NAME_CHANGE'
  | 'BOTH';

export interface NseHistoricalIdentityPreviewRow {
  disposition: NseHistoricalIdentityPreviewDisposition;
  changeType: NseHistoricalIdentityChangeType;
  effectiveDate: string | null;
  oldSymbol: string | null;
  newSymbol: string | null;
  currentSymbol: string | null;
  oldName: string | null;
  newName: string | null;
  sourceFile: string;
  detail: string;
}
```

Rust mirrors these serialized fields.

### Historical result

```ts
export interface NseHistoricalIdentityResult {
  archiveRootPath: string;
  applied: boolean;
  canApply: boolean;
  planSha256: string;

  securitiesAvailableSha256: string;
  symbolChangesSha256: string;
  companyNameChangesSha256: string;

  masterRowsRead: number;
  masterRowsPlanned: number;
  currentEquitySymbols: number;
  symbolChangeRowsRead: number;
  nameChangeRowsRead: number;

  newSymbolChanges: number;
  newNameChanges: number;
  newCombinedChanges: number;
  duplicateRows: number;
  skippedRows: number;
  errorRows: number;

  currentUniversePlanSha256: string | null;
  activeSyncActivateCount: number;
  activeSyncUpdateCount: number;
  activeSyncDeactivateCount: number;
  activeSyncUnchangedCount: number;

  historyRows: NseHistoricalIdentityPreviewRow[];
  currentUniversePreviewRows: NseCurrentUniverseSyncPreviewRow[];
  errors: string[];
}
```

The Rust result uses `snake_case` fields serialized with `camelCase`.

`canApply` is true only when the historical dry-run completed successfully and `errorRows == 0`.

## Source snapshot authority

Preview and Apply must each read the three historical source files exactly once into an immutable source snapshot before execution:

- SecuritiesAvailable/current equity CSV;
- SymbolChanges CSV;
- CompanyNameChanges CSV.

The snapshot stores:

- normalized archive-root path;
- exact source file paths;
- exact source bytes or parsed rows derived from those bytes;
- SHA-256 for each source file.

Parsing must use the captured bytes so the plan cannot combine rows from different file versions if a file changes during processing.

## Historical plan execution model

Introduce a private execution object, conceptually:

```rust
struct NseHistoricalIdentityExecutionPlan {
    result: NseHistoricalIdentityResult,
    current_universe_plan_sha256: Option<String>,
}
```

The exact internal name may differ, but Preview and Apply must share one execution function. There must not be two independent implementations of historical classification/apply semantics.

The shared execution function runs **inside an already-open outer transaction** and:

1. loads current NSE symbols from the transaction-visible database state;
2. builds the included historical symbol chain exactly as current behavior does;
3. processes symbol changes in deterministic effective-date/symbol order;
4. combines same-key name changes into `BOTH` as current behavior does;
5. processes remaining name changes deterministically;
6. classifies every candidate as `NEW`, `DUPLICATE`, or `ERROR`;
7. records every filtered-out source row as `SKIPPED` with an explanatory detail;
8. if any historical `ERROR` exists, withholds master/current-universe execution and returns `canApply = false`;
9. otherwise applies security-master upserts inside the same outer transaction;
10. builds and applies the current-universe plan inside the same outer transaction;
11. records the I3 current-universe plan SHA and current-universe preview rows in the I4 result;
12. computes the I4 plan SHA over the complete reviewed result.

## Transaction nesting rule

I4 must not globally replace `run_connection_transaction`.

Instead, the three existing write paths that I4 nests must become caller-transaction-aware while preserving current standalone behavior:

1. identity mutation in `instrument_mutations.rs`;
2. `upsert_security_master_rows`;
3. `apply_nse_current_universe_sync_plan`.

Pattern:

```rust
if connection.is_autocommit() {
    super::run_connection_transaction(connection, |connection| {
        persist_change_in_open_transaction(connection, ...)
    })
} else {
    persist_change_in_open_transaction(connection, ...)
}
```

The persistence body is factored into a helper. Existing standalone calls still receive their current transaction. I4 outer transactions avoid nested `BEGIN IMMEDIATE` failures.

Do not modify generic transaction semantics outside these bounded call sites.

## Preview semantics

Historical Preview uses a rollback-only outer transaction:

```text
capture source snapshot
→ BEGIN IMMEDIATE
→ execute exact historical plan tentatively
→ calculate complete I4 plan SHA
→ ROLLBACK unconditionally
→ return result with applied=false
```

Preview may execute SQL inside the rollback-only transaction in order to simulate exact downstream identity/master/current-universe effects. **It must leave zero persistent database changes.**

Preview does not invalidate DB stats and does not emit `database_changed`.

## Apply semantics

Historical Apply uses one outer write transaction from the first tentative historical mutation through final commit:

```text
capture source snapshot
→ BEGIN IMMEDIATE
→ execute exact historical plan tentatively
→ calculate rebuilt I4 plan SHA
→ validate expected SHA format
→ compare expected vs rebuilt SHA
→ if errorRows > 0: ROLLBACK + reject
→ if SHA mismatch: ROLLBACK + stale-preview error
→ if match: COMMIT
→ invalidate cache / snapshot / database_changed after COMMIT only
```

Because the transaction remains open from execution through comparison and commit, no other writer can change the relevant database state between plan reconstruction and commit.

A mismatch may have produced tentative SQL changes inside the uncommitted transaction, but **no persistent mutation is permitted before authority validation succeeds**; mismatch always rolls back the full transaction.

Exact stale message:

```text
NSE historical identity preview is stale because the source or database state changed. Preview Historical Identity again before applying.
```

Malformed or missing expected SHA uses the same fail-closed stale message.

## I4 plan SHA-256

Version marker:

```text
NSE_HISTORICAL_IDENTITY_PLAN_V1
```

Hash with the same length-prefixed field encoding discipline used by I3.

The I4 hash covers at minimum:

- version marker;
- normalized archive-root path;
- SHA-256 of all three exact source snapshots;
- all history rows, including `NEW`, `DUPLICATE`, `SKIPPED`, and `ERROR`;
- every history row field exposed to the operator;
- all historical counts;
- master-row counts;
- `canApply`;
- current-universe plan SHA when available;
- current-universe counts;
- errors in deterministic order.

History rows and errors must be canonicalized deterministically before hashing. UI filter choice is **not** part of plan authority because filters do not change the operation.

## Frontend reviewed authority

Add component-local authority:

```ts
type NseHistoricalReviewedApplyAuthority = {
  planSha256: string;
  activeDatabasePath: string;
  archiveRootPath: string;
};
```

Historical Apply is enabled only when:

- `Exchange === NSE`;
- `Source === Manual`;
- an active database exists;
- a historical Preview result exists;
- `result.canApply === true`;
- `result.planSha256 === authority.planSha256`;
- active database path matches;
- trimmed archive root matches;
- operation is not busy.

## Frontend authority invalidation

Clear historical reviewed authority on:

- active database change;
- Exchange change;
- Source mode change;
- NSE Archive Root text change;
- Browse Folder selection;
- start of Historical Preview;
- start of Historical Apply;
- every Historical Apply outcome;
- start of NSE current-universe Preview;
- start of NSE current-universe Apply;
- start of NSE source refresh.

Starting Historical Preview or Historical Apply also clears the I3 current-universe reviewed authority. This establishes a **single active NSE reviewed-write authority** and avoids two simultaneously actionable reviewed plans against the same database.

## Historical review filters

Frontend-only filter state:

```ts
type NseHistoricalIdentityFilter =
  | 'actionable'
  | 'all'
  | 'duplicates'
  | 'skipped'
  | 'errors';
```

Mapping:

- `actionable` → `disposition === 'NEW'`
- `all` → all rows
- `duplicates` → `DUPLICATE`
- `skipped` → `SKIPPED`
- `errors` → `ERROR`

The filter resets to `actionable` after each successful Preview.

## Error policy

- `ERROR` rows are reviewable but not applicable.
- Any `errorRows > 0` makes `canApply = false`.
- Duplicates and skipped rows are valid no-op classifications and do not block Apply.
- Fatal source/parsing/current-universe failures return command errors rather than a misleading applicable result.
- Apply revalidates `canApply` in the backend; the frontend disabled state is not the safety boundary.

## Preservation boundaries

I4 must preserve:

- I3 interactive current-universe reviewed SHA contract;
- I2/I2-R2 compact Identity UI behavior outside the historical subsection;
- Manual Entry;
- Official Imports R1C-I1;
- BSE UI/workflow/backend capability;
- NSE-first / BSE-deferred policy;
- Corporate Action recovery authority;
- chart-price authorities;
- package/dependency authorities.

## Expected files to change

- `src/components/DatabaseToolsDialogs.tsx`
- `src/types/desktop.ts`
- `src/platform/types.ts`
- `src/platform/tauriDesktop.ts`
- `src-tauri-shell/src/database.rs`
- `src-tauri-shell/src/database/nse_identity_imports.rs`
- `src-tauri-shell/src/database/instrument_mutations.rs`
- `src-tauri-shell/src/main.rs`
- `src/features/corporateActions/__tests__/corporateActionIdentityHistoricalReviewedAtomicApply.test.ts` (new)
- I4 spec/plan/change report documentation.

No BSE backend file is expected to change.

## TDD / behavioral acceptance

### Rust

Require tests for:

1. historical Preview leaves instruments and identity-history state unchanged after rollback;
2. Preview reports NEW/DUPLICATE/SKIPPED/ERROR row classifications deterministically;
3. Option C result includes all rows even though frontend defaults to actionable;
4. matching reviewed SHA commits historical + master + current-universe changes together;
5. successful early historical rows followed by a later injected historical failure leave zero persistent changes;
6. injected master-upsert failure after successful historical rows rolls back the historical rows;
7. injected current-universe failure after successful history/master work rolls back all prior I4 writes;
8. source change after Preview yields stale SHA and zero persistent Apply changes;
9. relevant database change after Preview yields stale SHA and zero persistent Apply changes;
10. malformed expected SHA fails closed and leaves zero persistent changes;
11. duplicates/skips do not block an otherwise valid Apply;
12. existing I3 current-universe reviewed Apply tests remain green;
13. standalone Manual Entry identity mutation remains transactionally correct.

### TypeScript

Focused source/contract test must prove:

- direct `importNseIdentityArchive` interactive route is retired;
- Preview and Apply historical APIs exist with Apply-specific required SHA;
- historical authority is separate from I3 authority;
- default filter is actionable;
- all five filter modes exist;
- `errorRows/canApply` block Apply;
- required transitions invalidate historical authority;
- current-universe actions invalidate historical authority;
- Historical Preview/Apply invalidate I3 authority;
- BSE dispatcher/backend surface remains unchanged.

### Regression/build gates

Require:

- I4 focused TypeScript GREEN;
- I3 focused test;
- I2-R2/I2/I0/I1 Identity tests;
- full Corporate Action test suite;
- focused I4 Rust tests;
- existing I3 Rust tests;
- relevant historical NSE tests;
- renderer typecheck;
- renderer build;
- Cargo check;
- portable Windows build.

## Manual acceptance checkpoint

Use a disposable/private test database only.

Verify:

1. Historical Apply disabled before Preview.
2. Preview creates summary + Actionable default view.
3. All/Duplicates/Skipped/Errors filters change only the displayed row set.
4. Changing archive root invalidates Apply.
5. New Preview restores Apply when `canApply` is true.
6. Successful Historical Apply consumes authority and disables Apply.
7. Fresh Preview is required before another Historical Apply.
8. Existing I3 current-universe Preview/Apply behavior still matches I3 acceptance.

Do not deliberately corrupt production data to reproduce stale/rollback cases; automated Rust tests are the authority for those failure paths.
