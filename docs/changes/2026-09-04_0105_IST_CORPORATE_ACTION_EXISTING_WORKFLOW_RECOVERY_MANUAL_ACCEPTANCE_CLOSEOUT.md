# Corporate Action Existing-Workflow Recovery — Manual Acceptance Closeout

**Project:** EOD Charting Platform  
**Area:** Corporate Actions / Identity  
**Date:** 2026-09-04 IST  
**Status:** MANUALLY ACCEPTED / CURRENT ACTIVE BASELINE  
**Classification:** `CORPORATE_ACTION_EXISTING_WORKFLOW_RECOVERY_MANUALLY_ACCEPTED__INCREMENTAL_IMPROVEMENT_ONLY`

## 1. Purpose

This record closes the recovery from the Corporate Action UI/UX reconstruction back to the proven existing Corporate Action workflow.

The reconstruction work is not deleted. It is retained as donor/reference source for selective future reuse. The active Corporate Action experience is again the existing `CorporateActionDialog` hosted by `DatabaseToolsDialogs`.

This closeout exists so that a future chat/session does not accidentally resume the superseded reconstruction roadmap.

## 2. Current active Corporate Action experience

The active application route is:

```text
Database
  -> Corporate Actions / Identity
      -> DatabaseToolsDialogs
          -> CorporateActionDialog
```

The manually accepted window contains the existing capability areas:

- Manual Entry
- Identity Import
- Official Imports
- Scan Database
- Review Issues

The manually accepted Official Imports presentation includes:

- Review
- Fetch & Import
- Historical Backfill
- Exchange selection
- From date
- To date
- Fetch Official
- Force Re-fetch
- action-type filters
- CSV fallback
- Browse
- Import CSV
- operation/status presentation

The window also visibly provides the existing internal minimize, maximize/restore, and close controls.

## 3. Manual acceptance result

**Result: PASS.**

After the Phase 1 portable was built, the operator opened the application with the private/test database and visually confirmed the restored existing Corporate Action window.

The acceptance screenshot showed:

- `Corporate Actions / Identity` as the active window title;
- all five existing top-level Corporate Action areas present;
- `Official Imports` selected;
- `Fetch & Import` selected;
- Exchange, From, To, Fetch Official and Force Re-fetch controls present;
- Split, Bonus, Rights, Dividend and Other type controls present;
- CSV fallback with Browse and Import CSV present;
- Historical Backfill navigation present;
- internal window controls present.

The status panel displayed an existing forced-re-fetch result. This closeout does **not** claim that the acceptance step itself initiated that fetch; the observation is only evidence that the existing status presentation is present.

This manual acceptance is a UI/workflow parity acceptance. It is not a new exhaustive certification of every write operation and is not a new SQLite byte-preservation audit.

## 4. Phase 0 authority

The reconstruction state was frozen before recovery.

Current R1C donor ZIP:

```text
E:\TA Projects\EOD Charting Platform Source Audit\
CA_EXISTING_WORKFLOW_RECOVERY_PHASE0_2026-09-03_233615_IST\
Current_R1C_CA_Donor_2026-09-03_233615_IST.zip
```

SHA-256:

```text
0F55A69FD205B7F5C76372550B13B3ACC2B761FC8230EAE0CBDA2C6BA82FD094
```

Historical Before-CA-UX source authority ZIP SHA-256:

```text
37437F713C20FD4C6419FFEA5D711C2108A82188678FDB697BB3B2AE79118C8F
```

Phase 0 also produced the old-vs-current audit and proved that no project source, Git state, or database was changed by the freeze/audit step.

## 5. Phase 1 automated recovery authority

Phase 1 report:

```text
E:\TA Projects\EOD Charting Platform\docs\changes\
2026-09-04_0022_IST_CORPORATE_ACTION_EXISTING_WORKFLOW_RECOVERY_PHASE1.md
```

Phase 1 evidence ZIP:

```text
E:\TA Projects\EOD Charting Platform Source Audit\
CA_EXISTING_WORKFLOW_RECOVERY_PHASE1_2026-09-04_002209_IST_evidence.zip
```

Evidence ZIP SHA-256:

```text
72A3441FB9067EEC175F8D79F3A58B77FE7CC0EBB468A057E163B5E3B3271F16
```

Accepted portable:

```text
E:\TA Projects\EOD Charting Platform\release\tauri-portable-win\
EOD Chart Portable\EOD Chart.exe
```

Portable SHA-256:

```text
D4E7E3EFA9A6E2CC663F22E145ABB2CD3B3487EB8B4F760AD0A01C8EBCB99808
```

Phase 1 automated result:

- recovery contract RED: expected failure;
- recovery contract GREEN: PASS;
- Task 5B legacy import boundary: PASS;
- reconstruction donor contracts: PASS;
- full Corporate Action test directory: PASS — 24 files / 125 tests;
- renderer typecheck: PASS;
- renderer build: PASS;
- Cargo check: PASS;
- portable build: PASS;
- `DatabaseToolsDialogs.tsx`: preserved;
- `corporateActionImportOperations.ts`: preserved;
- R1C donor production modules: preserved;
- package files: preserved;
- Git HEAD/tree/index/staged set: preserved;
- SQLite access by the Phase 1 runner: NONE.

## 6. Current code authorities intentionally retained

The current legacy dialog file is **not** restored to the older historical byte image. The current version contains the accepted Task 5B internal extraction and remains the correct active authority:

```text
src\components\DatabaseToolsDialogs.tsx
SHA-256:
F96BBD084058C95BC019EA5D5F8B1AE56DA75614CE6265396996F707A27773C1
```

The shared Task 5B operation boundary is also active:

```text
src\features\corporateActions\legacy\corporateActionImportOperations.ts
SHA-256:
71AB68E06056B0A147AE6139D6CD327873B1116ED3B4BF6B85456F70E2721709
```

This extraction is retained because it preserves the existing behavior while moving the fetch/list operation sequence into a reusable internal boundary.

## 7. Current governing rule

The Corporate Action product direction is now:

> **Existing working Corporate Action workflow first; incremental improvement only.**

Do not restart a broad reconstruction merely because reconstruction files remain in source.

For each future UI/UX improvement:

1. inspect the existing active behavior;
2. preserve its business semantics;
3. check whether a proven donor implementation already exists;
4. reuse only the smallest useful donor portion;
5. test the isolated change;
6. perform manual runtime review;
7. stop before the next change.

## 8. Superseded direction

The following are no longer the active product direction:

- replacing the existing CA tool with a four-stage `Fetch -> Load -> Review -> Approve` application;
- treating the separate Maintenance workspace as the required next architecture;
- Task 6B as the automatic next task;
- treating the existing floating-window presentation as obsolete;
- assuming legacy Corporate Action capabilities are intentionally unreachable.

Historical reports describing those decisions remain valid as historical evidence of what was attempted. They are not current architecture authority.

## 9. Known donor-path caution

The reconstructed four-stage path reached runtime and was useful as an experiment, but it should not be re-enabled wholesale.

During manual R1C runtime review, Load encountered a fail-closed economic-event consistency error for a Bonus compound event with inconsistent `shareFactor`. The validation was intentionally not weakened. That issue was not corrected because the project direction changed back to incremental improvement of the existing workflow.

Any future reuse of Review/economic-event presentation must therefore be selective and separately validated.

## 10. Deferred items

- Display scaling at 100% / 125% / 150% is deferred until a future UI change makes it useful to retest.
- No Task 6B continuation is authorized by this recovery.
- No Git stage/commit is authorized by this recovery documentation.
- Regular/live database work is not implied by this acceptance; Corporate Action experimentation should continue against the private/test database unless explicitly authorized otherwise.

## 11. Next step

**STOP.**

The recovery is closed.

The next Corporate Action action must be a user-requested incremental change to the restored existing workflow.
