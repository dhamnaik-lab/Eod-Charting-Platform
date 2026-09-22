# Corporate Action — Current Authority and Incremental Improvement Policy

**Project:** EOD Charting Platform  
**Date:** 2026-09-04 IST  
**Status:** CURRENT AUTHORITY  
**Supersedes:** reconstruction-as-primary-product-direction

## 1. Current authority statement

The active Corporate Action product is the existing working `CorporateActionDialog` experience.

Current route:

```text
Database -> Corporate Actions / Identity
         -> DatabaseToolsDialogs
         -> CorporateActionDialog
```

The active product must preserve the existing capability set and backend semantics.

The R1C reconstruction is a donor/reference implementation only.

## 2. Functional authority

The following existing areas are the functional authority unless a future task explicitly changes one of them:

| Area | Current authority |
|---|---|
| Manual corporate-action operations | Existing Manual Entry |
| Identity/history workflows | Existing Identity Import / existing identity tooling |
| Official source fetch/import | Existing Official Imports |
| Manual CSV fallback | Existing Official Imports CSV fallback |
| Historical fetch/backfill | Existing Historical Backfill |
| Database anomaly scan | Existing Scan Database |
| Specialist issue handling | Existing Review Issues |
| Existing approval/identity/dedupe/validation safeguards | Existing backend + current proven frontend integrations |
| Corporate Action window behavior | Existing current floating/internal window integration |

## 3. Newer work that remains active

### 3.1 Task 5B shared import-operation boundary

This is an accepted newer internal improvement and remains active.

```text
src\features\corporateActions\legacy\corporateActionImportOperations.ts
```

It owns the extracted existing fetch/list sequencing while the legacy dialog retains UI state, status text, filters, progress/error presentation, CSV/backfill/specialist controls and surrounding workflow.

The active source authorities at recovery were:

```text
src\components\DatabaseToolsDialogs.tsx
F96BBD084058C95BC019EA5D5F8B1AE56DA75614CE6265396996F707A27773C1

src\features\corporateActions\legacy\corporateActionImportOperations.ts
71AB68E06056B0A147AE6139D6CD327873B1116ED3B4BF6B85456F70E2721709
```

### 3.2 Current application shell

The restored dialog runs inside the current application shell rather than restoring the entire historical project snapshot.

Unrelated post-snapshot application work remains in place.

## 4. Donor/reference code policy

Reconstruction files remain in the project deliberately.

Their existence does **not** authorize their route or workflow.

A donor feature may be reused only when all of these conditions hold:

1. it improves the existing active capability;
2. the existing business semantics remain authoritative;
3. the donor change does not create a parallel workflow;
4. the donor does not duplicate backend algorithms;
5. the change is independently tested;
6. the user explicitly approves the incremental change.

## 5. Preferred reuse order

When implementing a requested improvement:

```text
1. Existing active implementation
2. Existing backend/API semantics
3. Task 5B shared import boundary
4. Small presentation/observability donor feature
5. Larger donor adapter/model only after explicit need is proven
```

Never begin with the reconstructed four-stage workflow and then force the old functionality into it.

## 6. Explicitly non-authoritative donor concepts

The following are not current workflow requirements:

- `Fetch -> Load -> Review -> Approve` as the mandatory top-level CA flow;
- a separate Corporate Action Maintenance product surface;
- separate Normal and Maintenance menu entries;
- automatic replacement of the existing Review/Issues UX;
- automatic replacement of legacy Manual/Identity/Scan capabilities;
- automatic pagination/validation/identity orchestration merely because donor code exists.

These may be mined for individual ideas only.

## 7. Incremental change protocol

Every future Corporate Action task should be narrow.

Required sequence:

```text
A. State one requested improvement.
B. Inspect the exact active old/current implementation.
C. Identify any donor code relevant to that one improvement.
D. Decide whether reuse is safer than a small direct enhancement.
E. TDD the requested behavior.
F. Preserve all unrelated CA behavior.
G. Build a portable.
H. Manual review on private/test DB.
I. Stop.
```

No next improvement begins automatically.

## 8. Database rule

Corporate Action UI/UX development and manual validation should use the private/test database unless the user explicitly authorizes work against another database.

A UI task must not silently become a database repair/migration task.

## 9. PowerShell rule

Project PowerShell runners must use guard clauses and separate `if` blocks.

Do not use `else` or `elseif`.

## 10. Git rule

No Git staging or commit is implied by this authority document.

Any Git write requires separate explicit authorization.

## 11. Current next step

Wait for the user's first incremental Corporate Action improvement request.
