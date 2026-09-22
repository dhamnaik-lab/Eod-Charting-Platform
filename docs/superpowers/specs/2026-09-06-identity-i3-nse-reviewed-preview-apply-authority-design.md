# Identity I3 — NSE Reviewed-Preview → Apply Authority Design

**Status:** DESIGN APPROVED IN CHAT / WRITTEN SPEC REVIEW REQUIRED BEFORE IMPLEMENTATION  
**Date:** 2026-09-06 IST  
**Project:** `E:\TA Projects\EOD Charting Platform`

## Goal

Prevent NSE `Apply Reviewed Changes` from applying a materially different current-universe synchronization plan than the operator actually reviewed.

The safety rule is fail-closed: **NSE Apply requires the exact plan fingerprint returned by the most recent valid NSE Preview for the current database/source context.** If the source or database-driven plan changes, Apply rejects before any write and requires a new Preview.

## Current authority and preservation baseline

The implementation must begin by verifying the live worktree against the currently accepted authorities rather than assuming this document is newest.

Known accepted authorities at design time:

- `src\components\DatabaseToolsDialogs.tsx` — `9F26E22A07BF8CE6454594F564B0E67C9E2D42F884B21498BCA9722B3791C488`
- `src\features\corporateActions\__tests__\corporateActionIdentityImportCharacterization.test.ts` — `728D9298D20AC5AAAC7C7FA68D57FDAF05566BD10AAF8B67B1E1D1A59E43F76D`
- `src\features\corporateActions\__tests__\corporateActionIdentityCompactWorkspace.test.ts` — `7D422FEDEEEDD7F5B21E71B966575DDE311604329B8AA9AA2AC84333853E9930`
- `src\features\corporateActions\__tests__\corporateActionIdentityOfficialPreviewTransition.test.ts` — `E7452C5CB6E3846A1E33849A5F245ED2CF37EE6DC015A36AF03E86ED2D1AF909`
- `src\platform\tauriDesktop.ts` — `C1AFC01FD099A82EEDA6EA8F62207852AF0DDFEC909EFAEAB40F5AD1373E7350`
- `src\types\desktop.ts` — `86CA99006D77872271655D06C54D21CF2CAE08987F9960A6091D8C9727A27A22`
- `src-tauri-shell\src\database\nse_identity_imports.rs` — `393C84CFC45875066B7FDA51EAE7A43366C1481107C5487973F40BF581F6CDB2`
- `src-tauri-shell\src\main.rs` — `1785FBC94BA334ED0D03A19D490D5B1E446216A13C5C0F2BF682104D3A87BF75`
- I2-R2 automated evidence — `EDCC7C92452DAFF557F4FE15A45E2BAA9E1526EF8A400652C929B815FD26FF38`
- I2/I2-R2 NSE-first documentation closeout evidence — `D3878A1CFD38903DFBE7400B5BF38F6AF962E2FE3ED302633F76462A325F88DB`

The baseline source snapshot also contains:

- `src-tauri-shell\src\database.rs` — `26E213E92D0D58C5AD5E40E174788CA486DCA67EAED53D4F9B265512E2AA665D`
- `src-tauri-shell\Cargo.toml` — `D1199096F9EA2548FD011BC120ABD15407849A75D9AAA14240DF1D250A020D42`

These two hashes are inspection baselines and must be re-verified against the live worktree before mutation.

## Scope

### In scope

- NSE current-universe Preview/Apply authority binding.
- A deterministic backend SHA-256 fingerprint for the exact planned NSE synchronization.
- A required Apply-specific expected fingerprint.
- Frontend state that binds the reviewed fingerprint to the active database and current NSE source context.
- Fail-closed Apply behavior before any database write.
- Focused TypeScript source-contract tests and Rust behavioral tests.
- Regression verification of Identity I0/I1/I2/I2-R2 and the full Corporate Action suite.

### Out of scope

- BSE command-contract redesign.
- BSE data parity or BSE Apply acceptance.
- Combined NSE+BSE Preview or Apply.
- Historical BSE identity work.
- NSE source-freshness redesign beyond the existing freshness checks.
- Fixing the existing de-listed-workbook fallback behavior.
- Manual Entry changes.
- Official Imports R1C-I1 changes.
- Corporate Action approval/review redesign.
- Package/dependency additions.
- Git operations.

## Existing problem

The current NSE flow has two independently constructed plans:

1. Preview calls `previewNseCurrentUniverseSync` and the backend builds `NseCurrentUniverseSyncPlan` from the current source files and current database.
2. Apply calls `applyNseCurrentUniverseSync` and the backend builds a new `NseCurrentUniverseSyncPlan`, then immediately applies it transactionally.

The frontend stores the preview result but does not provide a reviewed-plan token to Apply. The current shared Apply button is enabled from source readiness rather than an actual reviewed NSE preview.

The existing transaction protects atomicity **after** a plan is chosen; it does not prove that the plan being applied is the one the operator reviewed.

## Selected design

### 1. Apply-specific contract

Keep the Preview input unchanged:

```ts
export interface NseCurrentUniverseSyncInput {
  archiveRootPath?: string | null;
}
```

Add an Apply-specific input:

```ts
export interface NseCurrentUniverseApplyInput extends NseCurrentUniverseSyncInput {
  expectedPlanSha256: string;
}
```

Change only the Desktop API Apply signature:

```ts
applyNseCurrentUniverseSync(
  input: NseCurrentUniverseApplyInput,
): Promise<NseCurrentUniverseSyncResult>;
```

The command name remains `apply_nse_current_universe_sync`. `src/platform/tauriDesktop.ts` should remain byte-preserved unless live inspection proves an explicit import/type change is required.

### 2. Preview result authority

Add:

```ts
planSha256: string;
```

to `NseCurrentUniverseSyncResult` in TypeScript and the equivalent serialized Rust result field.

Every NSE preview and apply result returns the SHA-256 of its exact plan.

### 3. Backend fingerprint

Add a private deterministic helper conceptually named:

```rust
fn nse_current_universe_plan_sha256(plan: &NseCurrentUniverseSyncPlan) -> String
```

Use the already-present `sha2 = "0.10"` dependency. Do not add a crate.

The hash format version is frozen as:

```text
NSE_CURRENT_UNIVERSE_SYNC_PLAN_V1
```

The fingerprint covers:

- version marker;
- exact resolved `archive_root_path`;
- every current master row that drives an upsert: symbol, company name, ISIN, series;
- every deactivation symbol;
- each deactivation lifecycle classification by symbol;
- every operator-visible preview row: action, symbol, company name, series, ISIN, current status, proposed status, matched symbol, reason.

Before hashing, collection order must be canonicalized. Hashing must not depend on CSV row order, SQLite row-return order, or `HashMap` iteration order.

Fields must be encoded unambiguously. A length-prefixed byte encoding is preferred over delimiter-only concatenation so values cannot collide through separator characters. `None` and empty string must hash differently.

### 4. Public reviewed Apply path

Add Rust:

```rust
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NseCurrentUniverseApplyInput {
    pub archive_root_path: Option<String>,
    pub expected_plan_sha256: String,
}
```

The public Tauri `apply_nse_current_universe_sync` command accepts this type.

The public Apply flow is:

```text
resolve active database
→ open connection
→ build current plan
→ calculate current plan SHA-256
→ validate/normalize expected SHA-256
→ compare
→ mismatch: return stale-preview error, no transaction, no writes
→ match: existing apply transaction
→ return applied result with planSha256
→ invalidate stats / emit database_changed as today
```

Exact operator-facing stale message:

```text
NSE reviewed preview is stale because the source or database state changed. Preview again before applying.
```

Malformed/missing fingerprint values fail with the same stale-preview message. This prevents a second code path from weakening the safety contract.

### 5. Preserve historical NSE internal behavior

`Import Historical Identity` currently runs the current-universe synchronization internally after successful historical identity import.

That internal path is **not** an interactive reviewed Apply and must remain supported.

Keep an internal apply helper that can apply a plan without an external reviewed fingerprint. Only the public interactive `apply_nse_current_universe_sync` command requires `expectedPlanSha256`.

No historical import semantics are changed by I3.

### 6. Frontend reviewed authority

Add a component-local authority state with these semantics:

```ts
type NseReviewedApplyAuthority = {
  planSha256: string;
  activeDatabasePath: string;
  sourceMode: 'official' | 'manual';
  requestedArchiveRootPath: string | null;
};
```

A successful NSE Preview creates this authority only when an active database path is present.

For Official source mode, `requestedArchiveRootPath` is `null` because the backend resolves the managed NSE identity root.

For Manual source mode, it is the trimmed archive-root value used for Preview.

### 7. Frontend validity rules

NSE Apply is enabled only when all are true:

- active exchange is NSE;
- a reviewed authority exists;
- a current NSE preview result exists;
- `result.planSha256 === authority.planSha256`;
- current active database path equals `authority.activeDatabasePath`;
- current source mode equals `authority.sourceMode`;
- current requested manual archive root, when Manual, equals `authority.requestedArchiveRootPath`;
- no operation is busy;
- a database is open.

BSE retains its existing readiness behavior unchanged.

### 8. Authority invalidation

Clear NSE reviewed authority:

- before every NSE Preview attempt;
- when active database path changes;
- when Exchange changes;
- when Source mode changes;
- when Manual NSE Archive Root changes;
- when Browse Folder selects a new Manual NSE Archive Root;
- before refreshing NSE official sources;
- before Historical NSE Identity Import starts;
- after successful NSE Apply;
- after any NSE Apply failure.

Existing preview-result clearing behavior remains unless a specific invalidation already clears it. A backend stale rejection may leave the old preview rows visible for diagnosis, but Apply stays disabled because the authority is consumed.

### 9. Frontend Apply call

Keep the existing dispatcher structure so I2 compact-workspace behavior stays stable:

```ts
applyCurrentUniverseSync(identityArchiveRoot)
applyCurrentUniverseSync()
```

Inside `applyCurrentUniverseSync`, require a current reviewed authority and send:

```ts
{
  archiveRootPath?: string,
  expectedPlanSha256: reviewedAuthority.planSha256,
}
```

If no current reviewed authority exists, do not invoke the backend. Show:

```text
Preview the current NSE changes again before applying.
```

### 10. BSE boundary

Do not modify BSE Preview/Apply command types or backend behavior.

BSE UI/workflow capability remains preserved under the current NSE-first / BSE-deferred authority. I3 acceptance is NSE-only.

## Error and write-safety guarantees

A fingerprint mismatch must occur before `apply_nse_current_universe_sync_plan` is called. Therefore:

- no `INSERT`/`UPDATE` executes;
- no transaction is opened for the rejected Apply;
- no cached DB stats invalidation occurs;
- no `database_changed` event is emitted;
- the frontend consumes the reviewed authority and requires a new Preview.

The existing transaction remains unchanged for a matching fingerprint.

## Tests and acceptance gates

### Rust behavioral tests

Add tests under the existing `nse_identity_imports.rs` test module for:

1. fingerprint determinism under logically equivalent reordered collections;
2. plan/content change produces a different fingerprint;
3. matching reviewed fingerprint applies successfully;
4. source change after Preview rejects before writes;
5. database-driven plan change after Preview rejects before writes;
6. historical identity import still applies its internal current-universe synchronization.

The no-write rejection tests must query the relevant instrument rows before and after rejection and prove equality.

### TypeScript focused contract test

Create:

`src/features/corporateActions/__tests__/corporateActionIdentityReviewedApplyAuthority.test.ts`

It should verify the source/type contract without mocking backend behavior:

- result exposes `planSha256`;
- Apply input requires `expectedPlanSha256`;
- Desktop API Apply uses the Apply-specific input;
- Preview stores reviewed authority;
- Apply sends the reviewed SHA;
- NSE Apply readiness depends on reviewed authority rather than source readiness alone;
- database/exchange/source/manual-root/refresh/historical-import transitions invalidate authority;
- success and failure consume authority;
- BSE Apply path remains present and unchanged in the dispatcher.

### Regression gates

Run and require PASS:

- I3 focused TypeScript test;
- I2-R2 focused test;
- I2 compact test;
- Identity characterization test;
- I1 Current test;
- full `src/features/corporateActions/__tests__` suite;
- focused Rust I3 tests;
- relevant existing NSE identity Rust tests;
- renderer typecheck;
- renderer build;
- Cargo check;
- portable Windows build.

No production database path is accepted by the implementation runner. Rust tests may use only their existing temporary/in-memory test databases.

## Files expected to change

- `src-tauri-shell/src/database.rs`
- `src-tauri-shell/src/database/nse_identity_imports.rs`
- `src/types/desktop.ts`
- `src/components/DatabaseToolsDialogs.tsx`
- `src/features/corporateActions/__tests__/corporateActionIdentityReviewedApplyAuthority.test.ts` (new)
- `docs/changes/<IST>_IDENTITY_I3_NSE_REVIEWED_PREVIEW_APPLY_AUTHORITY.md` (generated closeout report)

Expected byte-preserved sentinels include:

- `src/platform/tauriDesktop.ts` unless the live type structure makes a type-only edit unavoidable;
- `src-tauri-shell/src/main.rs`;
- BSE backend files;
- Official Imports R1C-I1 files;
- chart-price authority files;
- package files.

## Rollback and evidence

The implementation runner must:

- hash-verify exact preimages;
- create a pre-edit project backup using the existing project backup mechanism;
- establish a genuine TDD RED before production implementation;
- restore all mutated preimages if any GREEN/regression/typecheck/build step fails;
- write detailed logs to an external evidence directory;
- emit a compact console summary;
- create an evidence ZIP with pre/post hashes, tests, build results, and the final change report;
- invoke no Git command.
