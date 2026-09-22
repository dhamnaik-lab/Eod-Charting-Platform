# Corporate Action Phase 1 V1.13B-1 Six-Row Historical ISIN Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fail-closed V1.13B-1 maintenance writer that can atomically insert exactly six V1.13A.2-authorized historical ISIN evidence rows and nothing else.

**Architecture:** Add a dedicated V1.13B-1 maintenance path rather than reusing V1.9.2 Apply, because V1.9.2 also records decisions and Quick Resolves imports. Reuse strict no-promotion insertion semantics through a provenance-aware helper, bind Apply to a frozen six-row authorization manifest and live preflight DB-family hashes, and require an independent V1.13C-1 post-audit before `FULL_SUCCESS`.

**Tech Stack:** Rust, rusqlite, serde/serde_json, existing Tauri maintenance-startup branch, PowerShell 7, SHA-256 package/report guards, Python only for package/static-contract tests where already established.

**Spec:** `docs/superpowers/specs/2026-08-18-corporate-action-v1-13b-1-six-row-historical-isin-repair-design.md`

## Global Constraints

- Exact authorized import IDs: `12841, 19888, 23036, 24025, 24224, 42274`.
- Exact protected import IDs: `819, 19896, 19973, 19977, 22969, 41025, 41574, 42863`.
- Parent candidate fingerprint: `b4f61783db9a84958b3a278a0ff00d2687925463dea63a97bd39e46a28e504cf`.
- Parent mutation fingerprint: `60b411e1bbc564fcdd28870f0eb4dd3b273df87c13297548fe2621a7834c6fa7`.
- Authorization-tranche fingerprint: `4289fd6be38777fafac3af253d1e201b976b79cdf8f9cc1c1f8ccef5a0f44ef7`.
- Only `instrument_isin_history` may be mutated.
- Corporate Action approvals: `0`.
- Quick Resolves: `0`.
- Corporate Action status promotions: `0`.
- `instrument_identity_history` writes: `0`.
- Raw EOD writes: `0`.
- Factor/adjustment writes: `0`.
- Transaction policy: `ALL_SIX_OR_ROLLBACK`.
- Live Apply is not authorized until a separate V1.13C-1 post-audit tool is ready.
- No Git operations. Each task ends in an explicit verification checkpoint instead of a commit.

---

## File structure

**Create**
- `src-tauri-shell/src/database/corporate_action_imports/controlled_identity_repair.rs` — V1.13B-1 parser, authority types, semantic preflight, plan fingerprint, transaction and Apply reporting.
- implementation-package PowerShell wrappers `Run-V1-13B-1-Preflight.ps1` and `Run-V1-13B-1-Controlled-Apply.ps1`.
- implementation-package frozen six-row authority JSON copied from `docs/changes/evidence/2026-08-18-corporate-action-v1-13b-1-six-row-authority.json`.
- focused package-contract tests for no Quick Resolve/approval/status mutation.

**Modify**
- `src-tauri-shell/src/database/instrument_mutations.rs` — provenance-aware strict no-promotion insertion helper while preserving V1.9.2 behavior.
- `src-tauri-shell/src/database/corporate_action_imports.rs` — register/export V1.13B-1 maintenance module.
- `src-tauri-shell/src/main.rs` — route the explicit V1.13B-1 maintenance flag before normal Tauri startup.

**Do not modify for V1.13B-1 behavior**
- React/UI source.
- Corporate Action approval/Quick Resolve functions.
- schema/migrations unless implementation evidence proves a schema change is unavoidable; the approved design assumes no schema migration.
- adjustment engine or raw EOD storage.

### Task 1: Preserve strict no-promotion insertion while adding V1.13 provenance recognition

**Files:**
- Modify: `src-tauri-shell/src/database/instrument_mutations.rs`

**Interfaces:**
- Consumes: existing `insert_historical_isin_evidence_strict_no_promotion(...)`.
- Produces: an internal provenance-aware strict helper plus a V1.13B-1 wrapper that returns `Inserted`, `MatchingAuthorizedRow`, `ExistingExternalMatch`, or `Conflict` without promoting imports.

- [ ] **Step 1: Write a failing Rust test for an exact V1.13 provenance-bound match**

Add a test that creates one `instrument_isin_history` row with:

```text
exchange=NSE
symbol=TITAN
isin=INE280A01010
effective_date=2011-06-23
source=V1.12.1_EXTERNAL_EVIDENCE
source_ref=V112-EVID-0001
note=V1.13 controlled identity repair; importIds=12841; evidence=V112-EVID-0001
```

Call the new V1.13 strict helper and assert that it returns the idempotent matching outcome and does not insert a second row.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
cargo test --manifest-path src-tauri-shell/Cargo.toml v113b1_strict_insert_recognizes_matching_authorized_provenance -- --exact --nocapture
```

Expected: test compilation/failure because the V1.13 helper does not exist.

- [ ] **Step 3: Add failing tests for external-match and conflicting-ISIN behavior**

Use the same exact slot and assert:

- same ISIN but unrelated note/source => `ExistingExternalMatch`;
- different ISIN => `Conflict`;
- two exact-date rows => error;
- no exact row => one insert.

- [ ] **Step 4: Implement a minimal shared strict helper**

Refactor only the strict insert internals so provenance recognition is parameterized. Keep the existing V1.9.2 wrapper's recognition prefix unchanged. Add a V1.13B-1 wrapper that recognizes the exact V1.13 source/source-ref/note contract.

Do not call `promote_matching_pending_isin_mismatch_imports`.

- [ ] **Step 5: Run focused and existing mutation regressions**

Run:

```powershell
cargo test --manifest-path src-tauri-shell/Cargo.toml instrument_mutations::tests::phase1_v192_strict_insert -- --nocapture
cargo test --manifest-path src-tauri-shell/Cargo.toml instrument_mutations::tests::v113b1_ -- --nocapture
```

Expected: all V1.9.2 strict-insert regressions remain green and all V1.13B-1 strict-insert tests pass.

- [ ] **Step 6: Verification checkpoint**

Static-search the changed function scope and prove it contains no Corporate Action import update, Quick Resolve, approval, or decision-recording call.

### Task 2: Build the frozen six-row authority parser and plan fingerprint

**Files:**
- Create: `src-tauri-shell/src/database/corporate_action_imports/controlled_identity_repair.rs`
- Modify: `src-tauri-shell/src/database/corporate_action_imports.rs`

**Interfaces:**
- Consumes: machine-readable six-row authority values and parent V1.13A.2 fingerprints.
- Produces:
  - `ControlledIdentityRepairMaintenanceInput`
  - `ControlledIdentityRepairCandidate`
  - `ControlledIdentityRepairMutation`
  - deterministic candidate/tranche/mutation plan validation
  - `try_run_controlled_identity_repair_maintenance(...)`

- [ ] **Step 1: Write a failing parser test for the exact six IDs**

Test that the maintenance parser rejects:

- five or seven candidates;
- duplicate IDs;
- any protected ID;
- any ID outside the exact six;
- wrong parent mutation fingerprint;
- wrong authorization-tranche fingerprint.

- [ ] **Step 2: Run parser test and verify RED**

Run:

```powershell
cargo test --manifest-path src-tauri-shell/Cargo.toml v113b1_authority_parser_ -- --nocapture
```

Expected: fail because the module/types do not exist.

- [ ] **Step 3: Implement canonical authority types and exact constants**

Encode the exact six/8 partition and controlling fingerprints from `docs/changes/evidence/2026-08-18-corporate-action-v1-13b-1-six-row-authority.json`. Parse a JSON authority artifact, then compare every semantic field against the compiled constants. Do not accept a caller-supplied alternative candidate set.

- [ ] **Step 4: Add mutation-plan canonicalization**

Build the six exact mutations sorted deterministically by the same fields represented in the V1.13A.2 mutation plan. Recompute and require parent mutation-set fingerprint `60b411e1bbc564fcdd28870f0eb4dd3b273df87c13297548fe2621a7834c6fa7`.

- [ ] **Step 5: Run parser/fingerprint regressions**

Expected: exact authority passes; any changed import ID, symbol, ISIN, date, source, source-ref, note, or per-row mutation fingerprint fails closed.

- [ ] **Step 6: Verification checkpoint**

Confirm the module contains no write operation yet; this task ends at pure parsing/canonicalization.

### Task 3: Implement semantic Preflight against the live database

**Files:**
- Modify: `src-tauri-shell/src/database/corporate_action_imports/controlled_identity_repair.rs`

**Interfaces:**
- Consumes: exact six-row authority and live read-only SQLite connection.
- Produces: six `READY_INSERT` or provenance-bound `ALREADY_SATISFIED` dispositions plus a frozen Apply manifest carrying current DB-family hashes and plan fingerprint.

- [ ] **Step 1: Write failing synthetic-SQLite tests**

Create fixtures for all six imports. Assert Preflight blocks when:

- an import no longer exists;
- exchange/symbol/ISIN/date/action type changed;
- `review_status != UNRESOLVED`;
- `approved_corporate_action_id` is non-null;
- destination/current identity differs from accepted authority;
- exact history slot now contains unrelated matching provenance;
- exact history slot contains conflicting ISIN;
- an eighth protected candidate is accidentally included in the plan.

- [ ] **Step 2: Verify RED**

Run focused `v113b1_preflight_` tests and confirm the missing Preflight implementation causes failure.

- [ ] **Step 3: Implement read-only semantic revalidation**

Use the current database state to rebuild the six dispositions. The implementation must not require that DB bytes still equal the old V1.13A.2 hash; instead it semantically revalidates current state and records the current quiescent DB/WAL/SHM hashes into the new READY manifest.

- [ ] **Step 4: Require all six writable/accounted**

Preflight status is `READY` only when all six are either exact authorized inserts or exact V1.13B-1 provenance-bound idempotent matches and zero protected rows enter the plan.

- [ ] **Step 5: Add integrity and protected-state baselines**

Capture logical fingerprints needed by V1.13C-1, including all user tables, with explicit before-state records for:

`instrument_isin_history`, `instrument_identity_history`, `instruments`, `corporate_action_imports`, `corporate_action_import_evidence`, `corporate_action_import_decisions`, `corporate_actions`, and EOD/raw-price tables present in the DB.

- [ ] **Step 6: Run Preflight regressions and query-only proof**

Expected: tests pass and a read-only/query-only connection rejects attempted writes.

### Task 4: Implement the all-six-or-rollback transaction

**Files:**
- Modify: `src-tauri-shell/src/database/corporate_action_imports/controlled_identity_repair.rs`

**Interfaces:**
- Consumes: exact READY manifest, current live DB-family hashes, verified backup-path metadata.
- Produces: `ControlledIdentityRepairApplyResult` with transaction state `ROLLED_BACK` or `COMMITTED_PENDING_POST_AUDIT`.

- [ ] **Step 1: Write a failing transaction rollback test**

Create six synthetic authorized rows and force the third mutation to conflict after transaction entry. Assert:

```text
instrument_isin_history count after == count before
```

and all protected table fingerprints remain unchanged.

- [ ] **Step 2: Verify RED**

Run:

```powershell
cargo test --manifest-path src-tauri-shell/Cargo.toml v113b1_transaction_rolls_back_all_six_on_mid_apply_failure -- --exact --nocapture
```

Expected: fail before transaction implementation exists.

- [ ] **Step 3: Implement transaction entry and in-transaction revalidation**

Inside one `rusqlite::Transaction`:

1. reload/revalidate all six;
2. rebuild exact mutation plan;
3. require candidate/tranche/mutation fingerprints and current DB-family manifest contract;
4. call only the strict V1.13 no-promotion insertion wrapper;
5. collect row IDs/outcomes;
6. commit only after all six succeed.

- [ ] **Step 4: Prohibit decision/status calls by construction**

Do not import or call:

```text
record_corporate_action_import_decision
quick_resolve_corporate_action_import_internal
apply_corporate_action_internal
upsert_instrument_isin_history_evidence
```

- [ ] **Step 5: Add success test**

Assert exactly six history rows are inserted, while the six underlying imports remain `UNRESOLVED` and `approved_corporate_action_id` remains null.

- [ ] **Step 6: Run transaction regressions**

Expected: success and forced-failure paths pass; no partial write survives.

### Task 5: Add explicit maintenance startup routing without changing normal Tauri startup

**Files:**
- Modify: `src-tauri-shell/src/database/corporate_action_imports.rs`
- Modify: `src-tauri-shell/src/main.rs`

**Interfaces:**
- Consumes: `try_run_controlled_identity_repair_maintenance(std::env::args())`.
- Produces: a maintenance-only exit path before `tauri::Builder::default()`.

- [ ] **Step 1: Write failing argument-routing tests**

Assert:

- no V1.13B-1 flag => normal startup path remains available;
- maintenance flag without required authority/manifest args => fail closed;
- Apply requires an explicit READY manifest;
- unknown mode is rejected.

- [ ] **Step 2: Verify RED**

Run focused routing tests.

- [ ] **Step 3: Wire the maintenance branch before Tauri startup**

Route V1.13B-1 separately from V1.9.2. Do not alter the existing V1.9.2 maintenance behavior.

- [ ] **Step 4: Run startup-routing regressions**

Expected: both V1.9.2 and V1.13B-1 maintenance parser tests pass; normal startup remains unchanged when neither flag is present.

### Task 6: Build fail-closed PowerShell Preflight and Apply wrappers

**Files:**
- Create in implementation package: `Run-V1-13B-1-Preflight.ps1`
- Create in implementation package: `Run-V1-13B-1-Controlled-Apply.ps1`
- Create in implementation package: frozen authority JSON and payload SHA manifest

**Interfaces:**
- Preflight produces the exact READY manifest, current DB-family hashes, protected-table baselines, and verification report.
- Apply consumes only that READY manifest and a verified backup.

- [ ] **Step 1: Write package-contract tests before wrapper implementation**

Tests must reject wrappers that:

- omit EOD process guard;
- omit DB/WAL/SHM quiescence/hash checks;
- omit verified backup before Apply;
- permit missing READY manifest;
- contain Git operations;
- contain Quick Resolve/approval commands;
- can run Apply against a different DB-family state than Preflight.

- [ ] **Step 2: Verify RED**

Run the package-contract suite and confirm expected failures.

- [ ] **Step 3: Implement Preflight wrapper**

Preflight must:

1. verify package/source/authority hashes;
2. require EOD Charting Platform closed;
3. hash current DB family;
4. invoke maintenance Preflight read-only;
5. verify resulting report hashes;
6. print `V1.13B-1 WRITE WINDOW READY` only when all six pass.

- [ ] **Step 4: Implement Apply wrapper**

Apply must:

1. require the accepted READY manifest;
2. rehash live DB family and require exact Preflight match;
3. create DB/WAL/SHM backup without checkpoint/vacuum;
4. hash-verify the backup;
5. invoke one Rust Apply transaction;
6. report only `COMMITTED_PENDING_POST_AUDIT` after commit.

- [ ] **Step 5: Add committed-report-failure handling**

If DB commit succeeds and final report serialization fails, return a distinct exit code/message. Do not automatically restore the backup.

- [ ] **Step 6: Run wrapper/package regressions**

Expected: all static and synthetic wrapper tests pass.

### Task 7: Full implementation verification before any live Apply authorization

**Files:**
- All V1.13B-1 changed/created files.

**Interfaces:**
- Produces a source/package validation record only; it does not authorize a production DB write.

- [ ] **Step 1: Run focused V1.13B-1 Rust tests**

Run all `v113b1_` tests with `--nocapture`.

- [ ] **Step 2: Run V1.9.2 historical-ISIN bootstrap regressions**

Prove the pre-existing controlled bootstrap behavior is unchanged.

- [ ] **Step 3: Run instrument-mutation regressions**

Confirm ordinary upsert/promotion behavior remains unchanged outside the new strict helper.

- [ ] **Step 4: Run `cargo check`**

Run:

```powershell
cargo check --manifest-path src-tauri-shell/Cargo.toml
```

Expected: exit code 0.

- [ ] **Step 5: Run static forbidden-call scan**

Fail if the V1.13B-1 module or wrappers reference Quick Resolve, Corporate Action approval, adjustment application, or Git operations.

- [ ] **Step 6: Run synthetic six-row success and rollback scenarios**

Capture machine-readable reports proving:

- success => exact six inserts and zero protected-table changes;
- forced failure => zero surviving inserts.

- [ ] **Step 7: Stop before live Apply**

Do not provide a live Apply command yet. First create and validate the independent V1.13C-1 post-audit tool, then request explicit operator approval for the production write window.

## Plan self-review

- Spec coverage: exact 6/8 partition, provenance, preflight, backup, transaction, no-promotion rule, committed-report state, and mandatory post-audit are all mapped to tasks.
- Placeholder scan: no unresolved implementation placeholders are present.
- Type/interface consistency: the same six-row authority and three controlling fingerprints flow from parser -> Preflight -> READY manifest -> transaction.
- Scope discipline: no UI, identity-history, status-promotion, Quick Resolve, approval, EOD, or factor work is included.
- Git discipline: no Git step is included.

## Execution handoff

Implementation is intentionally **not started by this documentation package**.

After this design/plan package is applied and validated, the implementation phase may proceed under the plan above. The live database write remains separately gated and cannot occur until V1.13C-1 is available and explicit operator approval is obtained.
