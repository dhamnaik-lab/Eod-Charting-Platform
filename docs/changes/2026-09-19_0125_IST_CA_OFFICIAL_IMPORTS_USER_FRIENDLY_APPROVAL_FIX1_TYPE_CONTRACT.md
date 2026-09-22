# Corporate Actions â€” Official Imports User-Friendly Approval

**IST timestamp:** `2026-09-19 01:25:26 +05:30`  
**Workstream:** `E:\TA Projects\EOD Charting Platform`  
**Mode:** `BOUNDED OFFICIAL IMPORTS FRONTEND / EXISTING WORKFLOW ONLY / NO BACKEND OR SCHEMA CHANGE`

## Objective

Simplify the existing Official Imports review path so the application performs routine preparation work and the user reviews pending actions before explicitly applying either all ready actions in the current filter scope or only checked ready actions.

## Previous limitation

The active Official Imports Review surface required users to operate internal preparation mechanics directly, including Split/Bonus validation, quick/multiple identity resolution and recommendation checks. The controls were technically safe but exposed backend workflow mechanics that should normally be application-managed.

## Files changed

- `src\components\DatabaseToolsDialogs.tsx`
- `src\features\corporateActions\legacy\corporateActionImportOperations.ts`
- `src\features\corporateActions\__tests__\corporateActionPendingPreparation.test.ts` (new)
- `src\features\corporateActions\__tests__\corporateActionOfficialApprovalUx.test.ts` (new)
- `docs\CURRENT_WORK_STATUS.md`
- this change record

## Final implementation

- existing `CorporateActionDialog` remains the sole active Corporate Action surface;
- Review uses `Load & Prepare` to enumerate all outstanding pending imports using existing paging;
- duplicate IDs are deduplicated and paging fails closed on no-progress / safe-offset boundary conditions;
- strict backend-authorized unresolved rows are quick-resolved automatically only when existing hints report `quickResolvable`, `ONE_ACTIVE`, and one concrete top suggestion;
- PENDING_ISIN_MISMATCH evidence is checked but never approved automatically;
- eligible Split/Bonus imports are price-validated automatically through the existing scan command;
- row-specific preparation failures block only affected rows; incomplete queue enumeration blocks ordinary Apply entirely;
- pending rows are presentation-grouped by exchange/symbol without merging economic events or changing import IDs;
- symbol/action/search filters define the visible review scope;
- routine per-row `Validate`, `Quick Resolve`, `Approve`, and toolbar `Resolve Multiple` / identity-recommendation controls are removed from the normal approval path;
- manual identity and price exception decisions remain available contextually;
- two explicit ordinary actions remain: `Apply Selected (N)` and `Apply All Ready (N)`;
- an app-owned inline confirmation captures exact reviewed IDs and material row/scan fingerprints;
- before writing, the app reloads the pending queue and current scan evidence; changed/unready records invalidate confirmation;
- existing backend approval batching and final authority are preserved.

## Behavior preserved

- Manual Entry, Identity Import, Scan Database, Review Issues, Fetch & Import, Force Re-fetch, CSV fallback and Historical Backfill;
- all existing Rust/Tauri commands, database schema and approval/exception policies;
- current Split/Bonus factor/price validation policy and thresholds;
- existing batch limit and multi-batch ordinary approval behavior;
- existing Approved history view, including Load More Approved;
- Identity ER0â€“ER4 authority;
- Gann deferred status;
- no raw `.eod` rewrite introduced;
- no dormant workflow/workspace activation.

## Validation commands/results

- Genuine focused RED: `PASS — same genuine pre-implementation preparation RED preserved`
- Candidate focused GREEN: `PASS — focused GREEN after FIX1`
- Corporate Actions + Identity regression: `PASS — Corporate Actions + Identity regression after FIX1`
- Full Vitest: `PASS — full Vitest after FIX1`
- TypeScript typecheck: `PASS — TypeScript typecheck after Dispatch<SetStateAction<string>> FIX1`
- Renderer Vite build: `PASS — Vite renderer build after FIX1`
- Candidate protected source: `PASS — 550/550 exact with one deterministic FIX1 component hash`
- Installed postflight focused GREEN: `PASS — installed focused GREEN after FIX1`
- Installed protected source: `PASS — 550/550 exact with FIX1`

## Authority / evidence

- parent source snapshot: `Eod Charting Platform Source Code 2026-09-18_140123_IST.zip`
- parent snapshot SHA256: `0EF8966CD8F4C29DAE0F032372322B88827FF44985968688AE1C4BFA6897666F`
- approved scope: `docs\superpowers\specs\2026-09-18-official-imports-user-friendly-approval-approved-scope-r1.md`
- approved plan: `docs\superpowers\plans\2026-09-18-official-imports-user-friendly-approval-bounded-implementation-r1.md`
- pre-change backup: `E:\TA Projects\EOD Charting Platform\tmp\CA_OFFICIAL_IMPORTS_UX_FIX1_RESUME1_PRECHANGE_BACKUP_2026-09-19_012526_IST.zip`
- pre-change backup SHA256: `36F397AB36B3D33375637F2BC0A0CACF473577BD7AD0ACE0D6C615EA9F2A629E`
- automated evidence path: `E:\TA Projects\EOD Charting Platform\tmp\CA_OFFICIAL_IMPORTS_UX_FIX1_RESUME1_2026-09-19_012526_IST_evidence.zip`

## Risks / limitations

- Automated runners do not open the user TEST or ACTUAL database and do not perform live fetches.
- Manual WebView2 acceptance remains required on the declared TEST database before this task can be called fully complete.
- Identity Import UX is a separate later task.
- Existing exceptional identity/price decisions remain intentionally explicit.

## Rollback guidance

Restore the two replaced source files from the bounded pre-change backup, delete the two newly added tests, restore `docs\CURRENT_WORK_STATUS.md` from the backup, and delete this change record. No database rollback is required for this automated implementation step because the runner never opens a user database.

## Next step

Create one fresh portable Windows build and manually validate Fetch â†’ Load & Prepare â†’ symbol review â†’ Apply Selected / Apply All Ready using only `E:\TA Projects\EOD Charting Platform\EOD DATABASE\Nse` after taking a TEST-database backup.
## FIX1 — TypeScript search-setter contract correction

The first R1 execution completed genuine RED, focused GREEN, Corporate Actions + Identity regression and full Vitest, then stopped before installation at renderer TypeScript typecheck:

`TS2345: (value: string) => void` was not assignable to `Dispatch<SetStateAction<string>>` at the Official Imports Current Chart filter call.

FIX1 changes only the local `updateOfficialImportSearchQuery` wrapper declaration to `React.Dispatch<React.SetStateAction<string>>` and passes the state action through to the existing React setter. Selection/confirmation invalidation behavior is unchanged. No production backend, API, eligibility, approval, filtering, or database contract changed.