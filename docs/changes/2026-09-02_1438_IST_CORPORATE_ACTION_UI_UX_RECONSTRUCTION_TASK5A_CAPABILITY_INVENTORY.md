# Corporate Action UI/UX Reconstruction — Task 5A Capability Inventory

## IST timestamp
2026-09-02 14:38:59.824 IST

## Objective
Exhaustively inventory the pre-modernization Corporate Action capability surface and establish a machine-checkable 100% preservation matrix before any Task 5B extraction or reconstruction implementation.

## Previous defect or limitation
Task 4 correctly introduced the approved dedicated full-page shell, but corporateActionOpen stopped routing the still-present legacy Corporate Action dialog. That made the intentionally built legacy controls inaccessible in the new workspace. Task 5A prevents capability loss by assigning every discovered capability to Normal Workflow, Corporate Action Maintenance, or Automatic Application Responsibility before further migration.

## Authority
- OLD behavioral archive SHA-256: ABEC169DD675B3AB319451BB95C152D9A24328F22F105D6495F5EC1157543581
- FRESH current-source archive SHA-256: 37437F713C20FD4C6419FFEA5D711C2108A82188678FDB697BB3B2AE79118C8F
- FRESH legacy DatabaseToolsDialogs.tsx SHA-256: 1CEFF93CBBDCDC394BB7E9644864C2CA91B2CE888331E510D545C3A9D3F36816
- FRESH Task 4 RootApp.tsx SHA-256: 03336EA05F89D0D92FCE38DAF189E1E458A866F7568E3FAAE59C8E6A554DE172
- Live source authority files verified against FRESH: 52
- Project HEAD: 2103e9ffcaaad28bd903c9cb71310316c68f2ffd
- Project tree: 6bc7dd2b393b3baf78ff97539c9eb7b8c8f42c77

## Files inspected
- OLD and FRESH src/components/DatabaseToolsDialogs.tsx
- src/RootApp.tsx, src/store/uiStore.ts, platform bridge/types
- all src/features/corporateActions/** files represented in the FRESH snapshot
- relevant Rust Corporate Action import/identity/mutation modules and command registration
- approved reconstruction architecture, matrix specification, and implementation plan

## Files created
- docs\superpowers\specs\2026-09-02-corporate-action-capability-preservation-matrix.md — matrix document created from the verified Task 5A package
- docs\changes\2026-09-02_1438_IST_CORPORATE_ACTION_UI_UX_RECONSTRUCTION_TASK5A_CAPABILITY_INVENTORY.md — this report
- External audit evidence under E:\TA Projects\EOD Charting Platform Source Audit\CA_UX_RECONSTRUCTION_TASK5A_CAPABILITY_INVENTORY_20260902_143859_824

## Files modified
- Runtime/source/backend/config/database files: none
- Existing approved reconstruction documents: none
- Git index/history: none

## Final Task 5A inventory
- Preservation matrix rows: 200
- NORMAL_WORKFLOW: 11
- MAINTENANCE: 170
- AUTOMATIC_APPLICATION_RESPONSIBILITY: 19
- TypeScript AST interactive source prototypes: 128
- Unmapped AST prototype lines: 0
- Approved known-minimum control sentinels: 85 / missing 0
- Known-minimum API sentinels: 35 / missing 0
- Actual legacy API dependencies: 37 / unmapped 0
- Additional shared API dependencies found beyond the original 35-method sentinel: listCorporateActionImportResolutionSuggestions; searchSymbols
- Persisted CA settings: 1 key / 8 fields
- CorporateActionDialog transient local 'useState': 81
- Historical-run helper local 'useState': 1
- Relevant OLD/FRESH backend source files compared: 22 / failures 0
- API/progress-event mappings to Rust implementation: 37 / continuity failures 0
- Corporate Action frontend continuity rows: 19 / failures 0
- Approved target coverage rows: 17 / missing 0
- Shared floating-window presentation-only exclusions explained: 5
- unclassifiedCount: 0
- lostCount: 0
- retiredBeforeParityCount: 0
- controlledOverrideNonMaintenanceCount: 0

## Exact disposition policy
Every matrix row has exactly one approved disposition: NORMAL_WORKFLOW, MAINTENANCE, or AUTOMATIC_APPLICATION_RESPONSIBILITY. Controlled ISIN/price exceptions are Maintenance-only. No RETIRED_AFTER_PARITY row exists. Legacy-only rows remain source-present and are not deletion-authorized.

## Validation commands / checks
- SHA-256 verification of the Task 5A static evidence package and every manifest file
- exact FRESH SHA-256 verification for 52 live source/backend files
- SHA-256 verification of the four approved reconstruction documents
- matrix CSV structural/required-field/disposition validation
- control inventory: exact 128 prototypes, all MATRIXED
- API inventory: exact 37 dependencies, all MAPPED
- known-minimum control sentinel validation
- Normal/Maintenance/Automatic target-coverage validation
- backend source continuity + Rust command/event mapping validation
- frontend CA source continuity validation
- full src + src-tauri-shell/src byte-manifest pre/post comparison
- package/Cargo configuration pre/post comparison
- HEAD/tree/index-content/staged/source-status pre/post comparison
- live DB/WAL/SHM byte snapshot pre/post comparison

No npm, Vitest, renderer build, Cargo, Tauri, or portable build was run because Task 5A changes no runtime behavior and is explicitly an audit/documentation gate.

## Actual validation results
- Package SHA: PASS — B397771CC3A9C5A215375477EB33FCC529F9FE7A26AE0BAABACDA082E428D705
- Matrix package SHA: PASS — A9A1123670FB9E33D849CDBFB5C2E8F13ECA38F5305D4D65A5DFADD07127D953
- 100% disposition coverage: PASS
- Known minimum controls: PASS — 85 / 85
- Legacy API mapping: PASS — 37 / 37
- Approved target coverage: PASS — 17 / 17
- Backend OLD/FRESH continuity: PASS — 22 / 22
- FRESH live-source authority: PASS — 52 / 52
- Source/config/DB/Git preservation: PASS
- Task 5B authorization: NO
- Classification: CORPORATE_ACTION_UI_UX_RECONSTRUCTION_TASK5A_CAPABILITY_INVENTORY_PASSED__100_PERCENT_DISPOSITION_COVERAGE__IMPLEMENTATION_NOT_AUTHORIZED

## Behaviour deliberately preserved
All current application behavior is deliberately unchanged. Task 2 workflow semantics, Task 3 economic-event grouping, Task 4 full-page shell/restoration, all legacy Corporate Action source behavior, V1.14AD identity/dedupe/compound/validation/approval safeguards, Quote Editor ownership, platform bridge commands, Rust backend commands, and live database contents remain untouched.

## Risks or limitations
Task 5A is a source-characterization and preservation audit, not runtime parity certification. LEGACY_ONLY capabilities remain inaccessible through the Task 4 normal workspace until Tasks 5B–6E progressively rewire them. Shared FloatingWindow minimize/maximize/drag/resize/focus mechanics are documented as presentation-only exclusions because the approved design intentionally replaces floating chrome with a dedicated full-page workspace. The original 35-method API sentinel understated the actual source dependency set by two line-broken/shared calls; Task 5A records the actual 37-method surface.

## Rollback guidance
Delete docs\superpowers\specs\2026-09-02-corporate-action-capability-preservation-matrix.md and this report only if Task 5A documentation is intentionally discarded. External audit evidence may also be deleted. No source, backend, package, database, Git index/history, Task 2, Task 3, or Task 4 rollback is required.

## Next step
STOP. Task 5B remains not authorized until this Task 5A evidence is independently reviewed and explicitly approved.
