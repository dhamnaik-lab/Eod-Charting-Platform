# EOD Charting Platform — Identity Import Read-Only Functional and UI Consolidation Audit

**Audit timestamp:** 2026-09-04 20:43 IST (UTC+05:30)  
**Active workstream:** EOD Charting Platform  
**Project root:** `E:\TA Projects\EOD Charting Platform`  
**Mode:** Read-only source and UI audit  
**Source modification:** None  
**Database access:** None  
**Network access:** None  
**Git/source-control command:** None  
**Test/build/package execution:** None

## 1. Goal

Audit the current **Corporate Actions / Identity → Identity Import** experience before any redesign, while leaving **Manual Entry unchanged**. Determine:

1. what every control actually does;
2. which actions are read-only, network/file writes, or database writes;
3. which controls may be consolidated safely at the presentation/orchestration layer;
4. which controls must remain separate for safety;
5. what functionality, validation, and operator feedback are missing;
6. the smallest sensible sequence of future implementation tasks.

## 2. Scope and current authority

The active Corporate Action product remains the restored existing `CorporateActionDialog` in `src/components/DatabaseToolsDialogs.tsx`. The reconstructed Normal/Maintenance workspaces remain donor/reference code and are not part of this audit's proposed active route.

Current accepted Corporate Action authority includes the closed R1C-I1 Official Imports improvements. This audit does **not** alter those improvements.

### Source basis

- Fresh post-rollback snapshot: `Eod Charting Platform Source Code 2026-09-04_135301_IST After CA RollBack.zip`
- Snapshot SHA-256 recorded by current handoff: `011E11CE3752CDDD64F459EA08DD82D0DE84628C67E21E0E7F59EE464030184D`
- Accepted post-I1 `DatabaseToolsDialogs.tsx` SHA-256: `8FC0CA2056D1E471D0602C123A2B73F249D4936CBB3843920A92F396F98F8DF2`

R1C-I1 changed the Official Imports behavior. The Identity Import functions and controls audited here are the preserved existing workflow.

## 3. Files inspected

### Active frontend and API surface

- `src/components/DatabaseToolsDialogs.tsx`
- `src/types/desktop.ts`
- `src/platform/tauriDesktop.ts`

### Identity backend

- `src-tauri-shell/src/database/nse_identity_imports.rs`
- `src-tauri-shell/src/database/bse_identity_imports.rs`
- `src-tauri-shell/src/database/official_source_urls.rs`
- `src-tauri-shell/src/database/instrument_mutations.rs`
- `src-tauri-shell/src/database.rs` — transaction helper

### Tests and preservation authority

- `src/features/corporateActions/__tests__/corporateActionExistingWorkflowRecovery.test.ts`
- Identity-related Rust tests in the NSE/BSE identity modules
- `docs/superpowers/specs/2026-09-02-corporate-action-capability-preservation-matrix.md`
- Post-I1 recovery/current-authority documentation and evidence

### User-visible evidence

- Manual Entry screenshot — retained unchanged by request
- Identity Import screenshot — current flat-toolbar layout

## 4. Executive conclusion

The user's concern is correct.

The current Identity Import screen is not merely “too large.” Its deeper problem is that it exposes **implementation steps** rather than the operator's goals. Network downloads, local file inputs, read-only previews, database writes, historical identity import, source configuration, and filtering are presented as one flat set of similarly weighted controls.

The current behavior should **not** be replaced wholesale. It contains valuable safety separation between preview and apply. The best direction is:

1. keep **Manual Entry unchanged**;
2. retain the existing backend operations;
3. reorganize Identity Import into three clear operator tasks;
4. consolidate routine download/preview presentation, not database-write semantics;
5. keep Apply explicitly separate and review-gated;
6. move manual paths and source URLs into an Advanced/Sources area;
7. add characterization tests before changing the UI.

## 5. Current operator jobs hidden inside one screen

The flat UI currently mixes three distinct jobs.

### A. Current Universe maintenance — routine

Purpose: synchronize current NSE/BSE symbols, metadata, active/inactive status, delisted/suspended state, and visibility.

Current controls:

- Download NSE Master
- Download NSE De-listed
- Preview NSE
- Apply NSE
- BSE current master CSV path
- Download BSE Master
- Preview BSE
- Apply BSE

### B. Historical identity/history import — specialist

Purpose: import NSE symbol-change and company-name history from a manually prepared archive, then synchronize the current NSE universe when the history import succeeds.

Current controls:

- Archive Root
- Preview Sync
- Apply Sync
- Import NSE Identity

### C. Sources, fallback paths, and diagnostics — advanced

Purpose: override source URLs, use manual/offline files, inspect help text, and filter a preview.

Current controls:

- Official source URL icon/dialog
- Identity information icon/dialog
- manual BSE CSV path
- manual NSE Archive Root
- Find
- Current

These jobs should not remain visually equal in the default routine workflow.

## 6. Exact capability and side-effect inventory

| ID | Current control | Actual operation | Network | File write | DB write | Current classification |
|---|---|---|---:|---:|---:|---|
| IDN-001–003 | Identity info / close / OK | Open or close explanatory modal | No | No | No | Read-only |
| IDN-004 | Download NSE Master | Downloads NSE equity master, SME master, and symbol-change CSV to the active database's managed reference-data area | Yes | Yes | No instrument mutation | Download/file write |
| IDN-005 | Download NSE De-listed | Downloads and saves official NSE delisted workbook | Yes | Yes | No instrument mutation | Download/file write |
| IDN-006 | Preview NSE | Builds NSE current-universe plan without applying instrument changes | **Possible** if delisted workbook is absent | No managed save in fallback path | No | Preview |
| IDN-007 | Apply NSE | Rebuilds and applies NSE current-universe plan; refreshes app/chart context | **Possible** if delisted workbook is absent | No managed save in fallback path | Yes | Database write |
| IDN-008 | BSE CSV path | Holds local BSE master path in component state | No | No | No | Read-only input |
| IDN-009 | Download BSE Master | Downloads Active, Delisted, and Suspended BSE lists and combines them into a timestamped managed CSV | Yes | Yes | No instrument mutation | Download/file write |
| IDN-010 | Preview BSE | Builds BSE current-universe plan from supplied CSV | No | No | No | Preview |
| IDN-011 | Apply BSE | Rebuilds and applies BSE plan; refreshes app/chart context | No | No | Yes | Database write |
| IDN-012 | Archive Root | Holds manual NSE archive root in component state | No | No | No | Read-only input |
| IDN-013 | Preview Sync | Uses manual NSE archive root to preview current-universe sync | Possible if local delisted workbook is absent | No managed save in fallback path | No | Preview |
| IDN-014 | Apply Sync | Uses manual NSE archive root to apply current-universe sync | Possible if local delisted workbook is absent | No managed save in fallback path | Yes | Database write |
| IDN-015 | Import NSE Identity | Imports historical symbol/name changes; on zero row errors, upserts master and applies current-universe sync | Possible during later delisted lookup | No routine managed download | Yes | Database write |
| IDN-016 | Find | Filters the currently loaded preview | No | No | No | Read-only |
| IDN-017 | Current | Copies active chart symbol into filter, but currently requires active exchange `NSE` | No | No | No | Read-only with BSE defect |
| CFG-014 | Apply URLs | Persists official source URL overrides for the active database | No fetch at save time | No | Yes, setting write | Configuration write |

### Important clarification

The older capability matrix uses the broad word `WRITE` for downloads because they save files. This audit separates:

- network access;
- filesystem writes;
- instrument/database mutations.

That distinction should be visible in the future UI.

## 7. Current behavior that should be preserved

### Preview/apply separation

NSE and BSE have separate Preview and Apply operations. This is good safety behavior and should remain visible.

### Apply transaction for current-universe plans

NSE current-universe Apply runs its instrument mutations in one transaction. BSE Apply also runs its plan in one transaction.

### Stale NSE master protection

The NSE current master and optional SME master are rejected when older than 14 days. The error directs the operator to download a fresh NSE master before Preview/Apply.

### BSE lifecycle coverage

The BSE download combines:

- Active → `CURRENT`
- Delisted → `DELISTED`
- Suspended → `SUSPENDED`

BSE Apply handles current, officially inactive, and unlisted/missing current database symbols.

### Active chart refresh after writes

Apply NSE, Apply BSE, and Import NSE Identity refresh the application snapshot and force-reload the active chart while preserving its viewport.

### Preview invalidation on source changes

Changing the BSE path or Archive Root clears the corresponding prior preview. Downloads also clear previews. This is useful and should remain.

### Raw price isolation

Identity synchronization updates identity/instrument metadata and visibility. It does not rewrite historical quote files or raw prices.

## 8. Confirmed UI and functional problems

### P0 — Frontend identity authority is under-tested

The frontend test search found only a route/source-presence check for the text `Identity Import`. There is no focused frontend characterization suite that locks down all Identity controls, API mappings, state invalidation, preview/apply separation, write labels, active-chart refresh behavior, or source configuration.

The preservation matrix itself marks these controls for a future Task 6B characterization/parity test.

**Consequence:** redesigning first would create a high risk of silently losing or misrouting a capability.

### P0 — “Current” filter is hard-coded to NSE

The Identity preview search invokes:

```ts
applyCurrentSymbolFilter(setIdentitySearchQuery, 'NSE')
```

Therefore an active BSE chart produces a message telling the operator to switch to NSE instead of filtering the BSE preview.

**Recommendation:** rename to `Current Chart` and use the exchange of the loaded preview, or disable it with a clear reason when no matching preview exists.

### P0 — Preview/apply are not bound to the same reviewed source state

NSE Apply and BSE Apply do not require a previous Preview. They independently rebuild a plan from the then-current source files and database state.

Even after a Preview, there is no source-file hash, plan fingerprint, database revision, or explicit reviewed-preview token binding Apply to what the operator saw.

**Consequence:** a file or database can change between Preview and Apply, and Apply can commit a different plan.

This is a backend safety improvement, not merely a visual issue. It should be handled as a later bounded task rather than silently added during styling.

### P0 — NSE Preview may unexpectedly use the network

When a local NSE delisted workbook is not found, preview/apply tries to fetch and parse the workbook. The plan builder currently converts any delisted-source error to an empty set:

```rust
load_nse_official_delisted_symbols(...).unwrap_or_else(|_| HashSet::new())
```

This means a control labelled `Preview NSE` is not guaranteed to be offline. It also means delisted-source failure degrades classification to `UNKNOWN_INACTIVE` rather than visibly reporting that official delisted classification was unavailable.

**Recommendation:** routine `Refresh Sources & Preview` should fetch all sources explicitly. A later `Preview Saved Sources` should be deterministic and local-only, with source completeness shown.

### P1 — The screen exposes mechanics instead of intent

All of the following appear with similar visual weight:

- downloads;
- previews;
- database writes;
- file paths;
- historical import;
- source URL configuration.

The operator cannot quickly distinguish routine, advanced, and potentially destructive actions.

### P1 — Labels are technically incomplete

`Download NSE Master` actually downloads:

- equity master;
- SME master;
- symbol-change CSV.

It does not include the separately downloaded delisted workbook.

`Download BSE Master` actually downloads and combines Active, Delisted, and Suspended lifecycle datasets.

The future UI should use operator labels such as `Refresh NSE Sources` and `Refresh BSE Sources`, with details available in an expandable log.

### P1 — Preview state is single-exchange and mutually exclusive

Loading NSE preview clears BSE preview. Loading BSE preview clears NSE preview. The preview selector uses a ternary and can represent only one exchange at a time.

**Consequence:** a combined NSE+BSE workflow needs a new combined result model or clearly sequential review flow. It cannot be achieved safely by adding only one `NSE + BSE` button.

### P1 — The table omits Exchange

The current table has no Exchange column. That is acceptable only while one preview is loaded at a time. A combined preview requires Exchange as an explicit column/filter.

### P1 — Status is a single unstructured text line

One string must communicate:

- running operation;
- success/failure;
- source path;
- row counts;
- source freshness;
- errors.

There is no structured per-source freshness, last refresh, last preview, or reviewed-plan status.

### P1 — Manual paths have no dedicated picker and are not persisted

`identityArchiveRoot` and `bseMasterFilePath` start as empty component state. Closing/reopening the window loses them. The Identity screen does not wire a dedicated CSV/folder Browse control even though general file-picking support exists elsewhere in the app.

### P2 — BSE source freshness is not checked

The inspected BSE preview/apply path validates the file structure and content but does not enforce an age/freshness rule comparable to NSE's 14-day guard.

A manual BSE file can therefore be structurally valid but old.

### P2 — Historical NSE import has no read-only historical preview

`Preview Sync` previews only current-universe synchronization. It does **not** preview the historical symbol/name identity rows that `Import NSE Identity` will write.

The historical import is therefore a write action without an equivalent operator review screen.

### P2 — Historical import may permit partial history commits

**Source-based inference, not runtime-tested in this audit:** each historical identity row is recorded through `apply_corporate_action_internal`, whose identity path opens and commits its own transaction. The archive importer loops over rows and, if any row fails, withholds master upsert/current-universe synchronization—but earlier successful identity rows appear able to remain committed.

This needs a dedicated transaction-semantics test before the historical import is simplified or combined with routine current-universe refresh.

### P3 — No BSE historical identity parity

Current BSE support covers current lifecycle/metadata synchronization. The inspected source does not provide a BSE equivalent of the NSE historical symbol/name archive importer.

Whether that is a defect depends on product requirements and available authoritative BSE history. It should not be invented during UI cleanup.

## 9. Safe consolidation recommendations

### Safe at presentation/orchestration level

#### 1. One routine `Current Universe` task

Default view:

```text
Current Universe
Exchange: [ NSE + BSE | NSE | BSE ]

[ Refresh Sources & Preview Changes ]
[ Preview Saved Sources ]

Source status: NSE current / BSE current / warnings
Summary: Add 12 · Update 3 · Reactivate 1 · Deactivate 4

[preview table occupies most of the window]

[ Apply Reviewed Changes ]
```

For NSE, `Refresh Sources & Preview Changes` may orchestrate:

1. download current NSE master bundle;
2. download NSE delisted workbook;
3. run Preview NSE.

For BSE, it may orchestrate:

1. download BSE lifecycle master;
2. run Preview BSE on the returned managed file.

This hides mechanics while retaining the existing backend capabilities.

#### 2. Keep Apply separate

`Apply Reviewed Changes` should remain a distinct, clearly labelled database-write action below the preview, ideally disabled until a valid preview exists.

#### 3. Separate `Historical Identity`

A second task/tab/section should contain:

- archive root;
- source structure/help;
- historical preview when implemented;
- import history action;
- historical result/log.

Do not mix historical identity writes into routine current-universe refresh.

#### 4. Put manual/source controls under `Advanced / Sources`

Move these out of the default workflow:

- official source URL overrides;
- manual BSE CSV path;
- manual NSE Archive Root for current sync;
- source diagnostics;
- default/custom URL indicator;
- Browse controls.

#### 5. Compact trading-platform density

Recommended baseline:

- 28–30 px control height;
- 12 px labels and buttons;
- 6–8 px internal gaps;
- lower card/panel padding;
- one primary button per task;
- subdued secondary/advanced controls;
- preview table receives the majority of vertical space;
- tab/header structure remains sober, not card-heavy.

## 10. Consolidations that are not safe

Do **not**:

1. merge Preview and Apply into one one-click operation;
2. automatically apply after download;
3. hide a database write behind a button labelled only `Refresh`;
4. merge historical NSE identity import into routine current-universe refresh;
5. present NSE+BSE Apply as one operation before a combined reviewed-preview model exists;
6. remove manual/offline paths merely because they are advanced;
7. suppress source/freshness/error details;
8. reactivate the reconstructed Normal/Maintenance architecture as part of this cleanup;
9. change Manual Entry during the Identity task.

## 11. Proposed compact information architecture

```text
Corporate Actions / Identity
[ Manual Entry ] [ Identity Import ] [ Official Imports ] [ Scan Database ] [ Review Issues ]

Identity Import
[ Current Universe ] [ Historical Identity ]                    [ Sources ⚙ ] [ Help ? ]

CURRENT UNIVERSE
Exchange   [ NSE + BSE ▼ ]
Source     Current / warning summary

[ Refresh & Preview ]   [ Preview Saved ]

Changes    Add 12   Update 3   Reactivate 1   Deactivate 4
Find       [ symbol / company / ISIN................ ] [ Current Chart ]

┌ Exchange | Action | Symbol | Series | Current | Proposed | Match | Reason ┐
│ ...                                                                   │
└────────────────────────────────────────────────────────────────────────┘

Last operation / compact expandable log
                                              [ Apply Reviewed Changes ]
```

The “Sources” panel can expose technical file paths and URLs without permanently consuming the main workspace.

## 12. Recommended implementation sequence

### Identity I0 — Characterization and authority freeze

**First and mandatory. No UI change.**

Create focused frontend tests that prove:

- every current Identity control remains present;
- each control calls the correct API;
- download actions do not call Apply;
- previews do not call Apply;
- Apply actions remain explicit;
- source/path changes invalidate previews;
- writes refresh snapshot and active chart;
- source URLs load/save per active database;
- Manual Entry remains untouched;
- Official Imports R1C-I1 remains untouched.

Record the `Current` hard-coded NSE behavior as a known defect, not as desired parity.

### Identity I1 — Correct the `Current Chart` filter

Small bounded behavior fix:

- make it exchange-aware for the currently loaded preview;
- add focused tests;
- no other layout change.

### Identity I2 — Compact presentation-only reorganization

Reorganize into:

- Current Universe;
- Historical Identity;
- Advanced/Sources.

Keep existing API calls and backend behavior exactly unchanged.

### Identity I3 — Routine refresh/preview orchestration

Add explicit NSE/BSE/BOTH refresh-and-preview orchestration with structured lifecycle status.

For BOTH, introduce a combined preview result model and Exchange column. Do not create a combined Apply until reviewed-preview semantics are defined.

### Identity I4 — Reviewed-preview binding and stale-source protection

Add source hashes/fingerprints, database revision/state binding, and an explicit stale-preview rejection or re-preview confirmation.

This is a safety/backend task, not styling.

### Identity I5 — Manual source usability and freshness

Add:

- BSE CSV picker;
- NSE archive folder picker;
- latest managed BSE file discovery;
- persisted recent path where appropriate;
- source age/freshness display;
- explicit online/offline behavior.

### Identity I6 — Historical import safety

Before simplifying historical import:

- add read-only historical row preview;
- test partial-failure transaction behavior;
- decide and document all-or-nothing vs resumable partial-import policy;
- bind Apply/Import to the reviewed source artifact.

### Identity I7 — BSE history parity, only if required

Treat as a separate product/data-source requirement. Do not infer historical BSE behavior from NSE.

## 13. Best next bounded task

Proceed with **Identity I0 — Characterization and Authority Freeze only**.

This is the safest next step because the UI currently lacks dedicated frontend parity coverage, and the capability matrix explicitly anticipated such characterization work.

I0 should not:

- modify the Identity UI;
- access a database;
- access the network;
- modify backend behavior;
- touch Manual Entry;
- touch Official Imports R1C-I1;
- perform Git operations.

After I0 passes, produce and approve an exact compact UI specification before any production layout implementation.

## 14. Files changed and validation status

### Files created by this audit

- This Markdown audit report
- Companion CSV control/side-effect matrix

### Project files modified

- None

### Validation performed

- Source inspection
- Capability matrix reconciliation
- Function/API mapping
- backend transaction/source-flow inspection
- frontend test inventory search
- screenshot/UI hierarchy review

### Not performed

- No test execution
- No typecheck
- No build
- No portable build
- No database inspection
- No network call
- No runtime mutation check

These were intentionally unnecessary for a read-only design audit.
