# Corporate Action — Auto-Approval Implementation Plan R1

**Status:** READY FOR REVIEW / SOURCE IMPLEMENTATION NOT YET AUTHORIZED  
**Date:** 2026-09-21 IST  
**Design authority:** `docs\superpowers\specs\2026-09-21-corporate-action-auto-approval-design-r1.md`  
**Current source authority:** `Eod Charting Platform Source Code 2026-09-21_142059_IST.zip`  
**Snapshot SHA-256:** `5469014EE9588B1B83ACCB7F853F97B0FFFB27BA7C39B4BD610A91DC0CC6C010`  
**Current source:** `560` exact / protected source `554`

## Objective

Implement the approved backend-owned NSE Split/Bonus auto-approval policy with the smallest maintainable source delta, while preserving every existing manual approval and exceptional-review path.

This plan is written for Codex/another coding agent and is self-contained. It must not rely on hidden chat context.

## Minimum-step execution strategy

To reduce user execution cycles without collapsing safety gates, the later authorized implementation should use **one combined fail-closed implementation runner** for:

1. exact `142059` source-authority preflight;
2. isolated TDD RED -> minimal GREEN;
3. focused Rust policy/approval regressions;
4. relevant frontend Vitest regressions;
5. TypeScript typecheck/frontend build as required by touched frontend/public API surfaces;
6. `cargo check --locked --offline`;
7. writer-excluded TEST-DB stable-copy characterization and rollback acceptance, **only if that DB access is explicitly authorized with the implementation run**;
8. real-source installation only after every preceding automated gate passes;
9. post-install focused regression;
10. required `docs\changes\...AUTO_APPROVAL...md` record and one evidence ZIP under `project\tmp`.

This combines implementation validation and non-destructive TEST-DB rollback proof in one future execution cycle where possible. It does **not** combine a real live-DB autonomous approval or final source snapshot into that cycle.

## Intended bounded source delta

### Create

`src-tauri-shell\src\database\corporate_action_imports\auto_approval.rs`

Responsibilities:

- exact R1 eligibility policy;
- machine-identity proof classification;
- forbidden-decision checks;
- current strong-price-validation verification;
- scope filtering;
- deterministic skipped reasons;
- bounded per-row auto-approval orchestration;
- `AUTO_APPROVAL_SAFE_V1` audit recording.

### Modify

`src-tauri-shell\src\database\corporate_action_imports.rs`

Minimal changes only:

- register private `auto_approval` module;
- expose a narrow Tauri command wrapper that resolves the active DB/folder and delegates policy/orchestration;
- reuse existing `verify_import_lookup_database`, ordinary approval writer, current validation owner and change-event/cache behavior;
- no duplicated canonical writer.

`src-tauri-shell\src\database.rs`

Add only the request/result/disposition contracts required for auto-approval. Recommended input:

```text
CorporateActionAutoApprovalInput
  import_ids: Vec<i64>          // completed preparation scope only
  expected_database_path: String
```

The IDs define scope only; the backend determines eligibility.

Recommended result:

```text
requested
eligible
auto_approved
linked_existing
already_approved
skipped
failed
results[]
dispositions[]
policy_version = AUTO_APPROVAL_SAFE_V1
message
```

`src-tauri-shell\src\main.rs`

Register exactly one new Tauri command. No other command ownership change.

`src\platform\types.ts`

Expose the new platform request/result types and method name.

`src\platform\tauriDesktop.ts`

Add the direct invoke binding only.

`src\features\corporateActions\legacy\corporateActionImportOperations.ts`

At the end of a fully successful preparation:

- use the complete prepared import-ID scope;
- require a current expected database path;
- invoke backend auto-approval in bounded batches compatible with the existing 100-item write-lock policy;
- merge returned updated import rows;
- reload/refresh approved/skipped states where required;
- preserve all preparation errors and fail-closed cancellation semantics.

Do not make frontend readiness the policy authority.

`src\components\DatabaseToolsDialogs.tsx`

Minimal integration only:

- pass the captured active database context into preparation;
- display truthful completion status including auto-approved count and remaining review count;
- preserve `Apply Selected` and `Apply All Ready` for the remaining queue;
- do not introduce expert policy controls or remove existing exception workflows.

### Tests expected to be modified/created

Prefer adding tests beside existing owners instead of creating duplicate harnesses.

Likely touched test surfaces:

- Rust tests in `auto_approval.rs` and/or `corporate_action_imports.rs`;
- `src\features\corporateActions\__tests__\corporateActionPendingPreparation.test.ts`;
- `src\features\corporateActions\__tests__\corporateActionOfficialImportsFix2.test.ts`;
- existing approval/validation UX tests only when integration behavior requires updates.

Do not redesign dormant Corporate Action workspaces.

## TDD sequence

### RED — policy contract

Use isolated current-source copy. Add focused tests that reference the new R1 policy/command while production behavior remains the accepted `142059` behavior.

RED must prove missing auto-approval authority, not an unrelated sandbox/configuration problem.

Minimum RED/GREEN behavior matrix:

1. NSE SPLIT + current exact identity + `MATCHED` confidence `0.95` is eligible;
2. NSE BONUS + strong match is eligible;
3. confidence just below `0.95` is skipped;
4. `REVIEW` validation is skipped;
5. `NO_PRICE_DATA` is skipped;
6. missing validation is skipped;
7. stale validation is skipped;
8. factor/fingerprint drift is skipped;
9. BSE is skipped;
10. DIVIDEND is skipped;
11. RIGHTS is skipped;
12. unsupported/OTHER is skipped;
13. `UNRESOLVED` is skipped;
14. `PENDING_ISIN_MISMATCH` is skipped;
15. manual-resolution provenance is skipped;
16. `ISIN_MISMATCH_APPROVAL` provenance is skipped;
17. `PRICE_VALIDATION_EXCEPTION` provenance is skipped;
18. same-date compound Split/Bonus is skipped in R1;
19. ordinary exact current identity is accepted;
20. approved machine decision provenance is accepted only when still current;
21. database-context mismatch fails before mutation;
22. out-of-scope IDs are never approved;
23. safe approval records `AUTO_APPROVAL_SAFE_V1`;
24. canonical write still flows through the existing ordinary approval owner;
25. raw EOD price rows remain unchanged.

### Minimal GREEN

Implement only enough new production logic to satisfy the frozen Design R1 policy. No Dividend/Rights/BSE/compound expansion.

## Backend policy implementation detail

### Eligibility evaluator

Recommended internal shape:

```text
evaluate_auto_approval_r1(connection, import_id)
  -> Eligible { evidence }
  -> Ineligible { deterministic reason }
```

The evaluator must be side-effect free.

### Execution

For an Eligible row:

1. create savepoint/transaction context using existing patterns;
2. call `approve_corporate_action_import_without_transaction(..., false, false)`;
3. require successful ordinary approval/link result;
4. append `AUTO_APPROVAL_SAFE_V1` decision using existing decision table;
5. release savepoint;
6. return updated import row/result.

No exceptional approval function may be called.

### Identity verification

Do not infer machine safety merely from `review_status = PENDING`.

The evaluator must positively establish either:

- ordinary exact active identity; or
- whitelisted machine-resolution provenance still consistent with current row/evidence.

Any manual/exception provenance on the import makes R1 ineligible.

### Price verification

Reuse the existing current validation helpers/queries. R1 adds the stricter confidence requirement:

```text
scan_status == MATCHED
confidence >= 0.95
```

The backend must enforce `0.95`; frontend `STRONG MATCH` classification is not sufficient authority.

## Frontend preparation integration

Current accepted sequence already performs:

- full pending-queue enumeration;
- strict Quick Resolve for eligible `UNRESOLVED` rows;
- identity-hint collection;
- targeted Split/Bonus validation;
- completion/cancellation/staleness handling.

Add auto-approval only after `result.complete == true` equivalent conditions and while the captured active database path is still current.

Do not run auto-approval when:

- preparation enumeration is incomplete;
- cancellation is requested;
- preparation has row-level blocking errors for the target row;
- active database changed;
- required validation call failed.

After auto-approval, the returned queue must truthfully show remaining pending rows and approved rows. No stale Ready checkbox may remain for an already auto-approved row.

## Required regression validation

### Rust focused

- new `auto_approval_` suite;
- ordinary approval tests;
- bulk approval tests;
- price-validation / compound validation tests;
- `auto_id1_` tests;
- `historical_isin_transition_` tests;
- `quick_resolve_` tests;
- `recheck_` tests;
- full `corporate_action_imports::tests::` suite.

### Frontend focused

At minimum:

- `corporateActionPendingPreparation.test.ts`;
- `corporateActionOfficialImportsFix2.test.ts`;
- `corporateActionValidation` tests;
- approval UX tests affected by new preparation completion messaging;
- no dormant-workspace activation regression.

### Broader compile/build

Because the plan adds a Tauri command and platform API surface:

- TypeScript typecheck;
- frontend build;
- `cargo check --locked --offline`.

Use project `tmp` for Cargo targets/evidence; ordinary implementation runners should use no network.

## Combined TEST-DB rollback gate for speed

If explicitly authorized at implementation time, include this in the same fail-closed implementation runner **before real-source installation**:

1. verify accepted TEST DB family and writer exclusion;
2. raw-copy DB + WAL (+ SHM when present) to project `tmp`;
3. open SQLite only on the stable copy;
4. characterize current pending NSE Split/Bonus rows against R1 policy;
5. record exact Eligible/Ineligible IDs and reasons;
6. run auto-approval only on the copy inside `BEGIN IMMEDIATE`;
7. prove only R1 Eligible rows were approved/linked;
8. prove all other CA imports, exceptional rows, identity evidence and raw EOD prices are unchanged;
9. verify `AUTO_APPROVAL_SAFE_V1` audit rows for every autonomous approval;
10. `ROLLBACK`;
11. verify exact selected logical state restoration;
12. delete stable DB bytes before evidence packaging.

If no real eligible row exists, report that truthfully. Do not fabricate eligibility. Fixture/TDD evidence may still validate code, but formal real-data acceptance remains pending until an eligible real case is available or a separately approved synthetic-copy characterization is defined.

## Real-source install gate

Do not modify the real project until all authorized pre-install gates pass.

Then:

1. create bounded pre-change backup;
2. install only the approved source delta;
3. verify exact expected source inventory/protected-source transition;
4. create required `docs\changes\YYYY-MM-DD_HHMM_IST_CA_AUTO_APPROVAL_R1.md`;
5. run post-install focused Rust + affected frontend tests;
6. package one evidence ZIP under `E:\TA Projects\EOD Charting Platform\tmp`;
7. no app launch in the automated implementation runner.

## Manual checkpoint / controlled live TEST DB

Because R1 creates autonomous canonical Corporate Action writes, formal closure should include one controlled live TEST-DB checkpoint after source installation and independent evidence review.

The checkpoint must:

- use a backed-up TEST database;
- deliberately invoke `Load & Prepare` on a known scope;
- capture exact auto-approved IDs;
- prove zero unexpected approvals;
- prove skipped/manual rows remain available;
- prove canonical actions and `AUTO_APPROVAL_SAFE_V1` decisions are exact;
- prove raw EOD data remains unchanged;
- confirm chart behavior under existing price-mode settings;
- avoid operational `D:` database access.

Do not activate on an operational production database as the first real write.

## Minimum future user execution cycles

After this documentation-only design/plan cycle, the target is **three** future user cycles, assuming all gates pass:

### Cycle 1 — combined implementation

One runner: TDD + regressions + build/check + optional authorized stable-copy rollback characterization + source install + evidence.

### Cycle 2 — controlled TEST-DB manual acceptance + final closeout

Run the deliberate real TEST-DB checkpoint. After independent review, install additive final current-authority/handoff/change documentation in the same bounded closeout cycle.

### Cycle 3 — Snapshot V3

Run the existing accepted Snapshot V3 script from the real project and independently promote the resulting ZIP.

Do not collapse the final snapshot into implementation or closeout; the snapshot must represent an already accepted project state.

## Rollback guidance

Implementation runner must capture preimages of every intended source/document file before installation. On any post-install automated failure, restore exact preimages and verify the full accepted source manifest.

For the controlled TEST-DB checkpoint, use a dedicated backup before mutation. A failed live checkpoint must stop further approval attempts and preserve evidence; database rollback/restore guidance must be explicit in that runner.

## Behavior that must remain preserved

- AUTO-ID1 remains closed/current;
- 20MICRONS transition-window remains closed/current;
- `PENDING_ISIN_MISMATCH` ordinary-approval block;
- manual ISIN exception remains explicit;
- manual price-validation exception remains explicit;
- existing manual Apply Selected / Apply All Ready;
- existing Split/Bonus ordinary approval threshold of `MATCHED` for manual approval;
- R1 auto-approval is stricter at `>= 0.95`;
- Dividend/Rights manual behavior unchanged;
- BSE unchanged;
- raw EOD prices unchanged;
- existing adjustment-on-read behavior unchanged;
- no schema migration unless a later separately approved design requires one.

## Stop conditions

Stop and return for design clarification if implementation reveals that R1 requires any of the following:

- a new database schema/table/column;
- replacement of the existing approval writer;
- automatic approval of Dividend/Rights/BSE/compound actions;
- automatic use of exceptional approval paths;
- a new persistent settings/feature-flag subsystem;
- architectural redesign of `Load & Prepare`;
- source-control operations;
- operational database access.

## Authorization boundary

This Implementation Plan R1 is documentation only. It does **not** authorize source implementation.

Source implementation starts only after the user explicitly approves execution of this written plan.
