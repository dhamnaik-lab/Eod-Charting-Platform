# Corporate Action Task 6A Post-R1B Independent Windows + Fetch Observability

Generated: 2026-09-03 19:31:48 IST
Project: E:\TA Projects\EOD Charting Platform
Baseline bundle: E:\TA Projects\EOD Charting Platform Source Audit\Task6A_Post_R1B_Independent_Windows_Source_2026-09-03_162900_IST.txt
Baseline bundle SHA-256: 47D1D9FD33AC9A05F39FC5E5CA18D030FF7CECC4598DC465956D232463BEB95B

## Scope
- Normal and Maintenance Corporate Action windows are independently open/minimized/closed.
- Repeated menu/palette open requests restore/focus the existing mounted window.
- Normal Official Fetch exchange selector supports NSE + BSE, NSE, or BSE; default is NSE + BSE.
- Existing From/To dates, cache reuse, and forceRefresh=false behavior are preserved.
- Per-exchange high-level status log is added while existing live progress remains.
- Existing FETCH_SUCCEEDED -> Load workflow transition is preserved.
- Last successful fetch is stored in frontend localStorage per exact active database path.
- Last-success storage updates only after the complete selected fetch returns successfully.
- Maintenance business operations remain foundation-only.
- Display-scale retesting is deferred until functional UX settles.
- Task 6B remains blocked.

## Files changed or created
- src\RootApp.tsx
- src\store\uiStore.ts
- src\components\Sidebar.tsx
- src\features\corporateActions\workspace\CorporateActionManagedWindow.tsx
- src\features\corporateActions\workspace\CorporateActionNormalWorkflowWorkspace.tsx
- src\features\corporateActions\workspace\corporateActionWorkspace.css
- src\features\corporateActions\workflow\corporateActionNormalWorkflowAdapter.ts
- src\features\corporateActions\__tests__\corporateActionMaintenanceNavigation.test.ts
- src\features\corporateActions\workflow\corporateActionNormalFetchHistory.ts
- src\features\corporateActions\__tests__\corporateActionPostR1BIndependentWindowsFetch.test.ts
- src\features\corporateActions\__tests__\corporateActionNormalFetchHistory.test.ts

## Preservation
- Rust/backend source: PASS unchanged
- package.json/package-lock.json: PASS unchanged
- Git HEAD/tree/index/staged set: PASS unchanged
- Private database family: NOT SUPPLIED - no SQLite database inspected or opened by runner
- No Maintenance business operation was wired.
- No Git stage or commit was performed.

## Validation
- Focused TDD RED: PASS expected failure before production patch
- Focused GREEN: PASS
- Task 6A regression: PASS
- Task 5E regression: PASS
- Task 5D R2 15-file regression: PASS
- Renderer typecheck: PASS
- Renderer build: PASS
- Cargo check: PASS
- Portable build: PASS

## Portable
- Path: E:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\EOD Chart.exe
- SHA-256: 35753240FDB7F0842ADDC51926810CBDAE3129AB9B342B966121C6614C7BBD78
- Bytes: 23858176

## Remaining manual checkpoint
Use the private/test database only.
1. Start Normal Fetch and minimize Normal.
2. Open Maintenance and minimize Maintenance; verify two distinct minimized entries.
3. Restore Normal and verify fetch/controller state survived.
4. Close Maintenance and verify Normal remains.
5. Test NSE + BSE, NSE, and BSE selection.
6. Verify per-exchange status log and successful advance to Load.
7. Verify Last successful fetch below Fetch and persistence after restart for the same private DB.
8. Verify another database has separate last-success metadata.
9. Do not repeat display-scale testing yet.
10. Do not start Task 6B.

## Rollback
Restore changed preimages from: E:\TA Projects\EOD Charting Platform Source Audit\CA_TASK6A_POST_R1B_INDEPENDENT_WINDOWS_FETCH_20260903_190514_272\preimage
Remove new files: src\features\corporateActions\workflow\corporateActionNormalFetchHistory.ts, src\features\corporateActions\__tests__\corporateActionPostR1BIndependentWindowsFetch.test.ts, src\features\corporateActions\__tests__\corporateActionNormalFetchHistory.test.ts