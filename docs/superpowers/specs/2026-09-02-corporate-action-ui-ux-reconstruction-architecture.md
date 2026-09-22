# Corporate Action UI/UX Reconstruction Architecture

**Status:** APPROVED DESIGN — DOCUMENTATION ONLY  
**Approved:** 2026-09-02 13:26 IST  
**Project root:** `E:\TA Projects\EOD Charting Platform`

## Objective

Reconstruct the Corporate Action experience so that routine work is simple while every intentional pre-modernization capability remains available. The reconstruction may reorganize presentation and ownership, but it must not weaken or redesign the established Corporate Action engine, database semantics, identity rules, equivalent-event dedupe, compound-event handling, price validation, approval eligibility, batching, idempotency, provenance, or fail-closed behavior.

> **Functional parity first. UX simplification second. Legacy retirement last.**

## Source authority

| Role | Archive | Snapshot root | Bytes | SHA-256 |
|---|---|---|---:|---|
| OLD / pre-UI/UX behavioral authority | `90dd5cf0-8ec0-48c4-a1b1-a17dac2de3fa.zip` | `Eod Charting Platform Source Code 2026-09-01_203433_IST` | 5,171,097 | `ABEC169DD675B3AB319451BB95C152D9A24328F22F105D6495F5EC1157543581` |
| FRESH / current-source preimage | `b5b0f03a-f754-4d52-9657-3b2197673da6.zip` | `Eod Charting Platform Source Code 2026-09-02_125004_IST` | 5,204,688 | `37437F713C20FD4C6419FFEA5D711C2108A82188678FDB697BB3B2AE79118C8F` |

Authority precedence:

1. FRESH is the current-source preimage authority unless the user later supplies a newer confirmed snapshot.
2. OLD is the behavioral/capability reference for the pre-modernization Corporate Action window.
3. Accepted V1.14AD backend behavior remains semantic authority.
4. Task 2 remains workflow-state authority.
5. Task 3 remains grouped economic-event presentation authority.
6. Task 4 remains full-page host/chart-restoration authority.
7. Never replace a FRESH whole file with its OLD counterpart.

### Verified OLD ↔ FRESH continuity

| Path | OLD SHA-256 | FRESH SHA-256 | Result |
|---|---|---|---|
| `src/RootApp.tsx` | `AE36B18D5C225A049799C9226F5800D987466290B65F5CB9467D5CDE91A9AC00` | `03336EA05F89D0D92FCE38DAF189E1E458A866F7568E3FAAE59C8E6A554DE172` | Task 4 host integration changed |
| `src/components/DatabaseToolsDialogs.tsx` | `1CEFF93CBBDCDC394BB7E9644864C2CA91B2CE888331E510D545C3A9D3F36816` | `1CEFF93CBBDCDC394BB7E9644864C2CA91B2CE888331E510D545C3A9D3F36816` | identical |
| `src/store/uiStore.ts` | `0E32E754C1FAF77C524454AA17FC038BD0B385FD5EC873CD7A5079AFC73B5B2E` | `0E32E754C1FAF77C524454AA17FC038BD0B385FD5EC873CD7A5079AFC73B5B2E` | identical |
| `src/platform/tauriDesktop.ts` | `C1AFC01FD099A82EEDA6EA8F62207852AF0DDFEC909EFAEAB40F5AD1373E7350` | `C1AFC01FD099A82EEDA6EA8F62207852AF0DDFEC909EFAEAB40F5AD1373E7350` | identical |
| `src/platform/types.ts` | `72A4B9B6A0C3B6287C59D2764292C5F73DDAE9579175F2ABC2E3FCFCF1A927EF` | `72A4B9B6A0C3B6287C59D2764292C5F73DDAE9579175F2ABC2E3FCFCF1A927EF` | identical |
| `src/types/desktop.ts` | `86CA99006D77872271655D06C54D21CF2CAE08987F9960A6091D8C9727A27A22` | `86CA99006D77872271655D06C54D21CF2CAE08987F9960A6091D8C9727A27A22` | identical |

The key finding is that the legacy Corporate Action implementation was not deleted. It remains in `DatabaseToolsDialogs.tsx`. Task 4 changed host ownership in `RootApp.tsx` and added the new full-page shell.

Accepted new-model sentinels:

- Task 2 workflow: `1C1E9E584EA5E8BF90FDC886CC7C3E8645F7D29E39C9E6E6AA1EE0B7C535AD23`
- Task 2 test: `0EF337A3650ECB57CE0353DA7B21C1C91B9D0B072051A0669601549C441F47F3`
- Task 3 view-model: `8D10D62C40F00D9C484E372D3DE43D02E3C5CC3018995C042A77892F96D7B814`
- Task 3 test: `C642370878046EC03DE0ADBFC93B7670410DC8957A666D697FF3A6CEB2001A4C`
- Task 4 workspace: `B0F010C3F9768207E2AA86027A10E4074F4E2B6430F095009E448ED8150198F3`
- Task 4 workflow header: `7520F51DE7626F25A1205EA0775D8347B60C203ACCD85A21CE8946645E2E3516`
- Task 4 CSS: `0BEC7D4CA18E0E6DA3348A48712087B9E4FF6D4FEA80BBFEC3F3CD07AD21B3E7`
- Task 4 corrected test: `2B3538F92AC700DCF946C48D5E846EDFB1BFE9FFA8F6ADF197B705F6717F657C`
- Task 4 R1B evidence ZIP: `079A7683E0BE17C764F572B7DCBF1CE7AC7CB3C8A828E0B7EE52398120316D49`

## Approved Design Section 1 — workspace ownership

The product has two Corporate Action entry points.

### Corporate Actions

Dedicated normal full-page workflow:

`Fetch Data → Load → Review → Approve`

This is the routine operational surface.

### Corporate Action Maintenance

Separate full-page specialist workspace under Database Tools with these sections:

- Manual Actions
- Identity & Symbol History
- Official Data Fetch
- Historical Backfill
- Database Scan
- Issue Resolution
- Exceptions & Overrides
- Sources & Configuration
- Audit & Export

Normal Corporate Actions and Maintenance are mutually exclusive. The chart workspace stays mounted underneath both so Close returns to the exact prior chart tab/sheet state.

## Approved Design Section 2 — normal workflow

### Fetch Data

Normal primary action: **Fetch Latest Data**.

The application owns the routine date range, routine source behavior, already-fetched detection, and duplicate avoidance. Custom dates, source overrides, force re-fetch, and local CSV remain Maintenance operations.

### Load

Normal primary action: **Load & Process**.

The application coordinates the already-established safe operations:

- normalization;
- identity matching;
- equivalent-event dedupe;
- authoritative event grouping;
- compound processing;
- price validation;
- conflict detection;
- classification.

Ambiguous or unsafe cases remain fail-closed as `NEEDS REVIEW` or `CONFLICT`.

### Review

Review is exception-first and remains an explicit checkpoint.

Normal vocabulary is limited to:

- `READY`
- `NEEDS REVIEW`
- `CONFLICT`
- `APPROVED`
- `ALREADY PROCESSED`

Task 3's authoritative `eventKey` rule remains mandatory: one eventKey produces one card; all source/import rows remain preserved in evidence.

Normal Review is evidence-only for unresolved cases. Repair and override controls live in Maintenance.

### Approve

Normal approval is one-click **Approve All Ready**.

There are no normal-user Select All Ready or per-row approval mechanics. Existing backend eligibility is rechecked before write. Partial success is valid: still-valid events approve, already-processed events report separately, and changed events return to Review.

### Resume

Reopening Corporate Actions resumes the next required stage from authoritative persisted/import state. Unresolved exceptions carry forward without blocking future cycles.

## Approved Design Section 3 — Maintenance capability ownership

### Manual Actions

Preserve Split, Bonus, Dividend, Rights Issue, Name Change, Symbol Change, Symbol + Name Change, and their applicable fields including dates, ISIN, ratios, face values, names/symbols, notes, rights price, dividend amount, and volume/delivery adjustment.

### Identity & Symbol History

Preserve NSE/BSE master download, de-listed data, preview/apply flows, archive root, NSE identity archive import, official source URLs, historical ISIN evidence, aliases, and effective identity history.

### Official Data Fetch

Preserve custom exchange/date/action filters, Fetch Official, Force Re-fetch, local CSV fallback, and specialist source controls.

### Historical Backfill

Preserve single-symbol and batch backfill, Current Chart, Watchlist, Sparse History, Old Aliases, Major Liquid, stop-on-error, BSE code where applicable, run history, and progress.

### Database Scan

Preserve Scan Official, Blind Scan, results paging, filters, and handoff to Issue Resolution.

### Issue Resolution

Preserve Load/More Imports, Recheck Selected, Quick Resolve Selected, identity recommendations, manual candidate search, historical identity inspection, and hint classes `1 Active`, `Multiple Active`, `No Active`, `No Hint`.

### Exceptions & Overrides

Preserve Historical ISIN exception, price-validation exception, required exception reason, manual identity resolution, and specialist individual approval through the existing guarded command paths.

### Sources & Configuration

Preserve official URLs, archive root, local import paths, and source settings.

### Audit & Export

Preserve review/matching audit, All Matching export, TSV/CSV export, scan/import evidence, progress, and cancellation.

## Approved Design Section 4 — migration architecture

Architecture:

`Existing backend/database/Tauri commands → Corporate Action feature/controller layer → Normal Workspace or Maintenance Workspace`

Rules:

- one implementation per business operation;
- progressively extract only the smallest behavior needed by the current migration task;
- the legacy dialog remains usable/reference code until parity is certified;
- Task 2 and Task 3 remain pure;
- Task 3 does not acquire identity logic, compound math, price-validation calculation, persistence, or approval execution;
- Normal → Maintenance navigation carries only context identifiers, not duplicated authoritative evidence;
- after Maintenance work, affected events are reloaded/rechecked and may remain unresolved.

## Approved Design Section 5 — revised sequence

1. Task 5A — exhaustive capability inventory + preservation matrix
2. Task 5B — controlled legacy component-boundary extraction
3. Task 5C — Normal Fetch + Load adapter
4. Task 5D — Normal Review + evidence drawer
5. Task 5E — Normal Approve
6. Task 6A — Maintenance shell/navigation
7. Task 6B — Manual Actions + Identity
8. Task 6C — Custom Fetch + Historical Backfill
9. Task 6D — Database Scan + Issue Resolution
10. Task 6E — Exceptions + Sources + Audit/Export
11. Task 7 — full parity certification
12. Task 8 — legacy CorporateActionDialog retirement

Each implementation task must create its own IST change report and stop for review at its defined gate.

## Zero-capability-loss rule

Every user-triggerable OLD capability must receive exactly one disposition:

- `NORMAL_WORKFLOW`
- `MAINTENANCE`
- `AUTOMATIC_APPLICATION_RESPONSIBILITY`

Hard acceptance invariant:

`OLD capabilities = Normal Workflow + Maintenance + Automatic Application Responsibility`

Required:

- unclassified = 0;
- lost = 0;
- silently removed = 0;
- competing duplicate implementations = 0.

Removing obsolete selection mechanics from the normal UI is allowed only when the underlying business capability remains preserved through an approved disposition and the matrix documents that distinction.

## Legacy-dialog retirement gate

The legacy Corporate Action presentation cannot be removed until Task 7 proves:

- 100 percent disposition coverage;
- Normal workflow complete;
- Maintenance complete;
- automatic-operation coverage complete;
- focused and required full validation green;
- current-working-tree portable build green;
- routine and specialist manual smoke green;
- Normal ↔ Maintenance escalation/return green;
- 100/125/150 percent scaling green;
- exact chart tab/sheet restoration green.

Only Task 8 may retire the legacy presentation.

## PowerShell rule

Any PowerShell runner supplied for this reconstruction must avoid the PowerShell `else` keyword entirely. Use guard clauses, separate `if` blocks, `return`, `continue`, or `throw`.

## Not authorized by this document

This documentation does not authorize Task 5A execution, source edits, backend/database changes, Git staging/commit, legacy dialog removal, or a new portable build.
