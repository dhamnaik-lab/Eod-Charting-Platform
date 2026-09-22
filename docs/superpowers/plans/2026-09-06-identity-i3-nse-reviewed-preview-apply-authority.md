# Identity I3 NSE Reviewed-Preview → Apply Authority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use the approved TDD workflow. This project does not authorize Git commands by default, so checkpoint/evidence artifacts replace commit steps.

**Goal:** Bind interactive NSE Apply to the exact current-universe plan reviewed by the operator and reject stale plans before any database write.

**Architecture:** Preview returns a deterministic SHA-256 of the backend `NseCurrentUniverseSyncPlan`. Interactive Apply requires that SHA, rebuilds the current plan, compares hashes before the transaction, and rejects on mismatch. The frontend records the reviewed SHA together with active database/source context and enables NSE Apply only while that authority remains current.

**Tech Stack:** React + TypeScript + Vitest; Tauri 2; Rust; rusqlite; `sha2 = "0.10"`; PowerShell evidence runner.

**Spec:** `docs/superpowers/specs/2026-09-06-identity-i3-nse-reviewed-preview-apply-authority-design.md`

## Global Constraints

- Project root: `E:\TA Projects\EOD Charting Platform`.
- NSE is the functional/data acceptance authority.
- Preserve BSE capability; BSE parity and Apply acceptance remain deferred.
- No Manual Entry redesign.
- No Official Imports R1C-I1 change.
- No BSE command-contract or backend change.
- No package/dependency change; `sha2 = "0.10"` already exists.
- No production database path accepted by the runner.
- No source-control command.
- PowerShell runner uses guard clauses and separate `if` blocks only; no `else`/`elseif` tokens.
- Exact current authorities must be verified before mutation.
- Any failure after mutation restores preimages and emits failure evidence.

---

## File map

**Create**

- `src/features/corporateActions/__tests__/corporateActionIdentityReviewedApplyAuthority.test.ts` — focused cross-layer source/type contract and frontend invalidation contract.
- `docs/superpowers/specs/2026-09-06-identity-i3-nse-reviewed-preview-apply-authority-design.md` — approved written design.
- `docs/superpowers/plans/2026-09-06-identity-i3-nse-reviewed-preview-apply-authority.md` — this plan.
- `docs/changes/<IST>_IDENTITY_I3_NSE_REVIEWED_PREVIEW_APPLY_AUTHORITY.md` — implementation closeout.

**Modify**

- `src-tauri-shell/src/database.rs` — add `NseCurrentUniverseApplyInput`; add `plan_sha256` to result.
- `src-tauri-shell/src/database/nse_identity_imports.rs` — deterministic fingerprint, reviewed public Apply guard, behavioral tests.
- `src/types/desktop.ts` — TypeScript Apply input and result/API contract.
- `src/components/DatabaseToolsDialogs.tsx` — reviewed authority state, invalidation, fail-closed Apply readiness and payload.

**Inspect/preserve**

- `src/platform/tauriDesktop.ts` — invoke transport should remain structurally unchanged.
- `src-tauri-shell/src/main.rs` — command registration unchanged.
- BSE identity backend.
- Official Imports R1C-I1 authority files.
- chart-price authority files.
- `package.json` / `package-lock.json` / Cargo dependency set.

---

### Task 1: Freeze exact live authority and create a TDD RED

**Files:**
- Create test: `src/features/corporateActions/__tests__/corporateActionIdentityReviewedApplyAuthority.test.ts`
- Inspect only: all files in the File map.

**Interfaces:**
- Consumes current I2-R2 production authority and current Rust/desktop contracts.
- Produces one focused test that fails on the current pre-I3 source for the intended missing safety contract.

- [ ] **Step 1: Hash-verify current preimages**

Verify at minimum the known current authorities before installing any test or source change. Fail closed on any drift. Also verify the live `database.rs` and Cargo hashes against the inspected baseline; if either differs, stop and inspect rather than patching by offset/string guess.

- [ ] **Step 2: Write the focused cross-layer failing test**

Create a Vitest source-contract test that reads:

```ts
const DATABASE_TOOLS = resolve(process.cwd(), 'src/components/DatabaseToolsDialogs.tsx');
const DESKTOP_TYPES = resolve(process.cwd(), 'src/types/desktop.ts');
const NSE_BACKEND = resolve(process.cwd(), 'src-tauri-shell/src/database/nse_identity_imports.rs');
const DATABASE_RS = resolve(process.cwd(), 'src-tauri-shell/src/database.rs');
```

Assertions must require these missing pre-I3 markers:

```ts
expect(desktopTypes).toContain('export interface NseCurrentUniverseApplyInput');
expect(desktopTypes).toContain('expectedPlanSha256: string');
expect(desktopTypes).toContain('planSha256: string');
expect(databaseRs).toContain('pub struct NseCurrentUniverseApplyInput');
expect(databaseRs).toContain('pub expected_plan_sha256: String');
expect(databaseRs).toContain('pub plan_sha256: String');
expect(nseBackend).toContain('NSE_CURRENT_UNIVERSE_SYNC_PLAN_V1');
expect(nseBackend).toContain('nse_current_universe_plan_sha256');
expect(databaseTools).toContain('nseReviewedApplyAuthority');
expect(databaseTools).toContain('expectedPlanSha256: reviewedAuthority.planSha256');
```

Also assert the existing BSE dispatcher remains present:

```ts
expect(databaseTools).toContain('await applyBseCurrentUniverseSync()');
```

- [ ] **Step 3: Run the focused test and verify RED**

Run:

```powershell
npm.cmd test -- src\features\corporateActions\__tests__\corporateActionIdentityReviewedApplyAuthority.test.ts
```

Expected: FAIL because the reviewed-plan contract does not yet exist. The runner must record the failure log and explicitly reject a false GREEN.

---

### Task 2: Add the cross-language Apply/result types

**Files:**
- Modify: `src-tauri-shell/src/database.rs`
- Modify: `src/types/desktop.ts`
- Preserve: `src/platform/tauriDesktop.ts`

**Interfaces:**
- Produces Rust `NseCurrentUniverseApplyInput`.
- Produces TypeScript `NseCurrentUniverseApplyInput`.
- Extends `NseCurrentUniverseSyncResult` with `planSha256` / `plan_sha256`.
- Changes the Desktop API Apply method to require Apply-specific input.

- [ ] **Step 1: Add Rust Apply input**

Immediately after the existing `NseCurrentUniverseSyncInput`, add:

```rust
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NseCurrentUniverseApplyInput {
    pub archive_root_path: Option<String>,
    pub expected_plan_sha256: String,
}
```

- [ ] **Step 2: Extend Rust result**

Add to `NseCurrentUniverseSyncResult`:

```rust
pub plan_sha256: String,
```

Place it before `message` so preview rows and fingerprint remain grouped with result data.

- [ ] **Step 3: Add TypeScript Apply input**

After `NseCurrentUniverseSyncInput`, add:

```ts
export interface NseCurrentUniverseApplyInput extends NseCurrentUniverseSyncInput {
  expectedPlanSha256: string;
}
```

- [ ] **Step 4: Extend TypeScript result and Desktop API**

Add:

```ts
planSha256: string;
```

to `NseCurrentUniverseSyncResult`, and change:

```ts
applyNseCurrentUniverseSync(input: NseCurrentUniverseApplyInput): Promise<NseCurrentUniverseSyncResult>;
```

- [ ] **Step 5: Confirm transport requires no change**

`src/platform/tauriDesktop.ts` should continue to invoke:

```ts
applyNseCurrentUniverseSync: async (input) => {
  return tauriInvoke('apply_nse_current_universe_sync', { input });
},
```

Do not edit it merely to change formatting.

---

### Task 3: Implement deterministic backend plan fingerprinting

**Files:**
- Modify: `src-tauri-shell/src/database/nse_identity_imports.rs`

**Interfaces:**
- Consumes `NseCurrentUniverseSyncPlan`.
- Produces `fn nse_current_universe_plan_sha256(plan: &NseCurrentUniverseSyncPlan) -> String`.
- `plan_into_result` receives the fingerprint and serializes it.

- [ ] **Step 1: Import SHA-256 support**

Add:

```rust
use sha2::{Digest, Sha256};
```

No Cargo change is allowed because `sha2 = "0.10"` already exists.

- [ ] **Step 2: Add version and stale-message constants**

Add private constants near the existing NSE constants:

```rust
const NSE_CURRENT_UNIVERSE_SYNC_PLAN_HASH_VERSION: &str =
    "NSE_CURRENT_UNIVERSE_SYNC_PLAN_V1";
const NSE_REVIEWED_PLAN_STALE_ERROR: &str =
    "NSE reviewed preview is stale because the source or database state changed. Preview again before applying.";
```

- [ ] **Step 3: Add unambiguous hash field helpers**

Use explicit byte lengths rather than delimiter-only concatenation. The helper must distinguish `None` from `Some("")`.

Conceptual signatures:

```rust
fn hash_plan_bytes(hasher: &mut Sha256, bytes: &[u8]);
fn hash_plan_string(hasher: &mut Sha256, value: &str);
fn hash_plan_optional_string(hasher: &mut Sha256, value: Option<&str>);
```

Encode lengths as fixed-width little-endian integers before bytes.

- [ ] **Step 4: Canonicalize and hash the exact plan**

Implement:

```rust
fn nse_current_universe_plan_sha256(plan: &NseCurrentUniverseSyncPlan) -> String
```

The implementation must clone/sort the relevant collections before feeding them into the hasher:

```rust
let mut current_rows = plan.current_rows.clone();
current_rows.sort_by(|left, right| {
    (
        left.symbol.as_str(),
        left.company_name.as_deref(),
        left.isin.as_deref(),
        left.series.as_deref(),
    )
        .cmp(&(
            right.symbol.as_str(),
            right.company_name.as_deref(),
            right.isin.as_deref(),
            right.series.as_deref(),
        ))
});
```

Use equivalent deterministic sorting for deactivation symbols/lifecycle pairs and preview rows. Do not iterate `HashMap` directly into the hash.

Return lower-case 64-character hexadecimal SHA-256.

- [ ] **Step 5: Return fingerprint in every NSE result**

Change:

```rust
fn plan_into_result(
    plan: NseCurrentUniverseSyncPlan,
    applied: bool,
    plan_sha256: String,
) -> NseCurrentUniverseSyncResult
```

and assign:

```rust
plan_sha256,
```

Both preview and internal historical Apply calculate the plan fingerprint before moving the plan into the result.

---

### Task 4: Add fail-closed reviewed public Apply

**Files:**
- Modify: `src-tauri-shell/src/database/nse_identity_imports.rs`

**Interfaces:**
- Public Tauri command consumes `NseCurrentUniverseApplyInput`.
- Historical internal sync continues consuming `NseCurrentUniverseSyncInput` without interactive fingerprint requirement.

- [ ] **Step 1: Add fingerprint normalization/validation**

Create:

```rust
fn normalize_expected_nse_plan_sha256(value: &str) -> AppResult<String>
```

Rules:

```text
trim
→ lower-case
→ exactly 64 ASCII hex characters
→ otherwise return NSE_REVIEWED_PLAN_STALE_ERROR
```

- [ ] **Step 2: Add reviewed internal Apply helper**

Create conceptually:

```rust
fn apply_nse_current_universe_sync_reviewed_internal(
    connection: &Connection,
    input: &NseCurrentUniverseApplyInput,
    default_archive_root: Option<&Path>,
) -> AppResult<NseCurrentUniverseSyncResult>
```

It must:

```rust
let sync_input = NseCurrentUniverseSyncInput {
    archive_root_path: input.archive_root_path.clone(),
};
let plan = build_nse_current_universe_sync_plan(connection, &sync_input, default_archive_root)?;
let plan_sha256 = nse_current_universe_plan_sha256(&plan);
let expected = normalize_expected_nse_plan_sha256(&input.expected_plan_sha256)?;
if expected != plan_sha256 {
    return Err(NSE_REVIEWED_PLAN_STALE_ERROR.to_string());
}
apply_nse_current_universe_sync_plan(connection, &plan)?;
Ok(plan_into_result(plan, true, plan_sha256))
```

No transaction or mutation may occur before the equality check.

- [ ] **Step 3: Route only the public command through reviewed Apply**

Change the public command input to `NseCurrentUniverseApplyInput` and call the reviewed helper. Keep the existing post-success cache invalidation/snapshot/event sequence unchanged.

- [ ] **Step 4: Preserve the existing internal historical Apply helper**

Keep:

```rust
fn apply_nse_current_universe_sync_internal(
    connection: &Connection,
    input: &NseCurrentUniverseSyncInput,
    default_archive_root: Option<&Path>,
) -> AppResult<NseCurrentUniverseSyncResult>
```

It continues to build/apply directly for the historical import workflow, but now includes `planSha256` in its returned result.

---

### Task 5: Add Rust behavioral tests before accepting backend GREEN

**Files:**
- Modify test module in: `src-tauri-shell/src/database/nse_identity_imports.rs`

**Interfaces:**
- Tests private fingerprint and reviewed-Apply helpers directly.

- [ ] **Step 1: Add deterministic fingerprint test**

Create two logically identical plans with current rows / deactivation inputs arranged in different orders. Assert:

```rust
assert_eq!(
    nse_current_universe_plan_sha256(&plan_a),
    nse_current_universe_plan_sha256(&plan_b),
);
```

Then change one write-driving field such as company name or lifecycle classification and assert inequality.

- [ ] **Step 2: Add matching reviewed Apply test**

Use the existing temporary archive and identity-import connection fixtures:

```text
preview internal
→ capture result.plan_sha256
→ call reviewed internal Apply with that SHA
→ verify result.applied == true
→ verify expected instrument activation/deactivation state
```

- [ ] **Step 3: Add source-change rejection/no-write test**

```text
preview
→ capture SHA
→ rewrite current-master CSV so resulting plan changes
→ record relevant instrument DB state
→ reviewed Apply with old SHA
→ assert exact stale error
→ query DB again
→ assert state is byte/value-equivalent for affected instrument fields
```

- [ ] **Step 4: Add database-change rejection/no-write test**

```text
preview
→ capture SHA
→ mutate test DB so rebuilt plan differs
→ capture post-mutation state immediately before Apply
→ reviewed Apply with old SHA
→ assert exact stale error
→ query after rejection
→ assert equality to immediately-pre-Apply state
```

This proves I3 itself did not write on rejection; the deliberate test mutation is the baseline.

- [ ] **Step 5: Run focused Rust tests**

Name new tests with a shared `i3_reviewed_` prefix and run:

```powershell
cargo.exe test --manifest-path "src-tauri-shell\Cargo.toml" i3_reviewed_
```

Expected: all new I3 Rust tests PASS.

- [ ] **Step 6: Re-run existing historical sync regression**

Run the existing test that proves historical identity import still applies current-universe sync, plus the identity-error suppression regression.

---

### Task 6: Bind frontend reviewed authority and fail-closed NSE Apply readiness

**Files:**
- Modify: `src/components/DatabaseToolsDialogs.tsx`

**Interfaces:**
- Consumes backend `result.planSha256`.
- Produces a reviewed authority tied to DB/source context.
- Supplies `expectedPlanSha256` on interactive NSE Apply.

- [ ] **Step 1: Add reviewed authority type/state**

Add:

```ts
type NseReviewedApplyAuthority = {
  planSha256: string;
  activeDatabasePath: string;
  sourceMode: 'official' | 'manual';
  requestedArchiveRootPath: string | null;
};
```

and state:

```ts
const [nseReviewedApplyAuthority, setNseReviewedApplyAuthority] =
  useState<NseReviewedApplyAuthority | null>(null);
```

- [ ] **Step 2: Invalidate on active database change**

Add a small effect keyed only to `activeDatabasePath`:

```ts
useEffect(() => {
  setNseReviewedApplyAuthority(null);
}, [activeDatabasePath]);
```

Do not alter database-opening behavior.

- [ ] **Step 3: Make Preview establish authority**

At the start of `previewCurrentUniverseSync`, clear prior authority.

After a successful preview:

```ts
if (activeDatabasePath) {
  setNseReviewedApplyAuthority({
    planSha256: result.planSha256,
    activeDatabasePath,
    sourceMode: identitySourceMode,
    requestedArchiveRootPath:
      archiveRootPath === undefined ? null : archiveRootPath.trim(),
  });
}
```

If active DB is unexpectedly absent, leave authority null.

- [ ] **Step 4: Invalidate all approved context transitions**

Add `setNseReviewedApplyAuthority(null)` to:

- `selectIdentityExchange`;
- `selectIdentitySourceMode`;
- Manual NSE Archive Root `onChange`;
- `browseNseIdentityArchiveRoot` after a selection is accepted;
- start of `refreshNseIdentitySources`;
- start of `importNseIdentityArchive`.

Do not change BSE state semantics other than this NSE authority variable being cleared.

- [ ] **Step 5: Compute NSE reviewed Apply readiness**

Near the existing `identitySelectedSourceReady`, derive:

```ts
const requestedNseArchiveRoot =
  identitySourceMode === 'manual' ? identityArchiveRoot.trim() : null;

const nseReviewedApplyReady = Boolean(
  currentUniverseSyncResult &&
    nseReviewedApplyAuthority &&
    activeDatabasePath &&
    nseReviewedApplyAuthority.planSha256 === currentUniverseSyncResult.planSha256 &&
    nseReviewedApplyAuthority.activeDatabasePath === activeDatabasePath &&
    nseReviewedApplyAuthority.sourceMode === identitySourceMode &&
    nseReviewedApplyAuthority.requestedArchiveRootPath === requestedNseArchiveRoot,
);

const identitySelectedApplyReady =
  identityExchange === 'NSE' ? nseReviewedApplyReady : identitySelectedSourceReady;
```

- [ ] **Step 6: Require reviewed authority inside NSE Apply handler**

At the start of `applyCurrentUniverseSync`, capture:

```ts
const reviewedAuthority = nseReviewedApplyAuthority;
```

If absent or not current, show:

```text
Preview the current NSE changes again before applying.
```

and return without invoking the API.

Send:

```ts
const result = await api.applyNseCurrentUniverseSync({
  ...(archiveRootPath === undefined
    ? {}
    : { archiveRootPath: archiveRootPath.trim() }),
  expectedPlanSha256: reviewedAuthority.planSha256,
});
```

- [ ] **Step 7: Consume authority after every Apply outcome**

On success, clear authority before/after storing the applied result. In `catch`, also clear authority before setting the surfaced error. Do not auto-preview.

- [ ] **Step 8: Change only Apply button readiness**

Keep Preview readiness unchanged. Change the Apply button to:

```ts
disabled={busy || !hasDatabase || !identitySelectedApplyReady}
```

Do not change its label or BSE dispatcher.

---

### Task 7: Turn I3 focused test GREEN and run Identity regressions

**Files:**
- Test: `src/features/corporateActions/__tests__/corporateActionIdentityReviewedApplyAuthority.test.ts`
- Existing regression tests remain byte-preserved unless a source-contract assertion is genuinely invalidated by I3 semantics.

- [ ] **Step 1: Expand the focused test to cover frontend invalidation**

Assert source slices contain authority clearing in all required NSE transitions and that Apply uses `identitySelectedApplyReady` rather than `identitySelectedSourceReady`.

- [ ] **Step 2: Run focused I3 GREEN**

```powershell
npm.cmd test -- src\features\corporateActions\__tests__\corporateActionIdentityReviewedApplyAuthority.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run I2-R2 / I2 / characterization / I1**

Run the four accepted Identity regression files together. Expected: all PASS.

If an old source-string assertion fails only because of harmless formatting or the approved safety contract, evolve that assertion semantically without weakening it. Do not change production behavior to satisfy brittle formatting tests.

- [ ] **Step 4: Run full Corporate Action suite**

```powershell
npm.cmd test -- src\features\corporateActions\__tests__
```

Expected: all files/tests PASS, including the new I3 focused test.

---

### Task 8: Compile/build verification and evidence closeout

**Files:**
- Create: `docs/changes/<IST>_IDENTITY_I3_NSE_REVIEWED_PREVIEW_APPLY_AUTHORITY.md`
- Evidence under `E:\TA Projects\EOD Charting Platform Source Audit`.

- [ ] **Step 1: Renderer typecheck**

```powershell
npm.cmd run typecheck:renderer
```

Expected: exit 0.

- [ ] **Step 2: Renderer build**

```powershell
npm.cmd run build:renderer
```

Expected: exit 0.

- [ ] **Step 3: Cargo check**

```powershell
cargo.exe check --manifest-path "src-tauri-shell\Cargo.toml"
```

Use the project-authorized external target behavior if the existing runner infrastructure already sets it. Expected: exit 0.

- [ ] **Step 4: Portable Windows build**

```powershell
npm.cmd run tauri:portable:win
```

Expected: exit 0 and a new portable SHA-256 recorded.

- [ ] **Step 5: Verify preserved authorities**

Re-hash all declared sentinels. In particular, verify no change to:

- `src/platform/tauriDesktop.ts` when no type-only edit was necessary;
- `src-tauri-shell/src/main.rs`;
- BSE identity backend;
- Official Imports R1C-I1 files;
- chart-price authority files;
- package files.

- [ ] **Step 6: Write the IST closeout report**

Record:

```text
Goal / scope / constraints
exact pre/post hashes
TDD RED evidence
I3 focused GREEN
Rust focused tests
Identity regressions
full CA regression
renderer typecheck/build
Cargo check
portable build SHA
production DB access: NO
Git command: NO
BSE authority: PRESERVED / DATA ACCEPTANCE DEFERRED
```

- [ ] **Step 7: Package evidence**

Create an evidence ZIP containing test/build logs, manifest, changed-file postimages, preimages needed for audit/rollback, spec, plan, and closeout report.

- [ ] **Step 8: On any failure, rollback**

Restore every mutated preimage and remove newly created I3 test/spec/plan/report files installed by the runner where appropriate. Verify restored hashes before reporting failure evidence.

---

## Plan self-review

- **Spec coverage:** every approved design requirement maps to Tasks 2–8; BSE boundary and historical internal path are explicit.
- **Placeholder scan:** no TODO/TBD implementation gaps remain.
- **Type consistency:** TypeScript `expectedPlanSha256` maps to Rust `expected_plan_sha256` through `camelCase`; result `planSha256` maps to `plan_sha256`.
- **Safety ordering:** mismatch comparison occurs before `apply_nse_current_universe_sync_plan`, so the rejected path cannot write.
- **Dependency check:** no new crate/package is required because `sha2 = "0.10"` already exists.
- **Project policy check:** no Git step is included; no production DB path is required.
