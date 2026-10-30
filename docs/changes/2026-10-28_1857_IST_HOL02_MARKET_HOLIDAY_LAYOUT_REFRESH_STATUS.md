# HOL-02 — Market Holiday Layout, Refresh Feedback and Status Bar

IST timestamp: 2026-10-28 18:57:44 +05:30
Workstream: E:\TA Projects\EOD Charting Platform
Result: HOL02_R1_APPLIED_FOCUSED_VALIDATION_PASS_NATIVE_PENDING

## Objective and previous limitation
- The entire Market Holiday page scrolled, hiding Refresh and pushing Add Holiday out of the visible viewport.
- A refresh had no persistent operation-result feedback, making successful same-data reloads indistinguishable from no refresh.
- Add/Delete had no unified operation-status feedback or synchronous duplicate-submit guard.

## Files changed
- src/components/BhavcopyDownloadWindow.tsx: modified (HOL-01 current source).
- src/components/BhavcopyDownloadWindow.styles.ts: modified.
- src/components/__tests__/BhavcopyMarketHolidayRefresh.test.ts: updated HOL-01 regression.
- src/components/__tests__/BhavcopyMarketHolidayLayoutStatus.test.ts: created.
- This IST change record: created.

## Final implementation
- Fixed Market Holiday toolbar and Refresh chip, independent scrolling holiday table with sticky Date/Name/Source/Actions header, fixed Add Holiday controls and a fixed status strip.
- Status shows loading, confirmed refresh count, confirmed add/remove, backend failures and database transitions; no invented success before API resolves.
- Request-ID/database gates preserve HOL-01 stale-response protection. Mutation-version gates and an in-flight guard suppress obsolete/duplicate operations.
- Backend desktop API commands list_market_holidays, add_market_holiday, delete_market_holiday remain unchanged.

## Behavior preserved
- Existing holiday records, built-in/custom values, date sorting, add/remove confirmation, download holiday calendar, special sessions and automatic/manual Bhavcopy paths.
- Charts, Sheets, Sidebar, settings, shared Cargo, database files, project profiles and standard portable folder.

## Validation commands and actual results
- 01_hol01_hol02_focused_vitest: exit 0 (C:\Program Files\nodejs\npm.cmd test -- src/components/__tests__/BhavcopyMarketHolidayRefresh.test.ts src/components/__tests__/BhavcopyMarketHolidayLayoutStatus.test.ts)
- 02_bhavcopy_renderer_regressions: exit 0 (C:\Program Files\nodejs\npm.cmd test -- src/features/bhavcopy/__tests__/bseHistoryDownload.test.ts src/features/bhavcopy/__tests__/downloadRunState.test.ts)
- 03_renderer_typecheck: exit 0 (C:\Program Files\nodejs\npm.cmd run typecheck:renderer)
- 04_renderer_vite_build: exit 0 (C:\Program Files\nodejs\npm.cmd run build:renderer -- --outDir E:\TA Projects\EOD Charting Platform\tmp\HOL02\builds\R1_20261028_185744_IST\renderer)
- Authoring environment (Node/TypeScript extracted behavior): 16/16 PASS. TS/TSX syntax parse 4/4 PASS.
- Rust tests: NOT RUN (no Rust change).
- Full Vitest suite: NOT RUN (focused suites only).
- Portable/Tauri executable: NOT REBUILT by this runner.
- Actual native Market Holiday interaction: MANUAL CHECKPOINT PENDING.

## Risks and limitations
- Rebuild standard portable separately after checking PACK-01 preservation status; manual UI acceptance remains necessary.
- A normal read may return the same holidays; successful read status confirms completion rather than changed data.
- Small-height window layout should be checked manually; no screenshot-based UI measurement is asserted.

## Rollback
- Verified backup folder: E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20261028_185744_HOL02_MARKET_HOLIDAY_LAYOUT_REFRESH_STATUS
- Restore three changed TypeScript files from exact-path pre-edit backup only after hashes are checked.
- Remove only new BhavcopyMarketHolidayLayoutStatus.test.ts after confirming its installed hash.
- Preserve all databases, Cargo caches, executable builds, runtime state and unrelated documentation.

## SHA-256 evidence
- Snapshot: 8FFCB62773D35BEA02CD7E2433C5597211F440A7C60DEAA97E9B04268CD3EDB3
- Manifest: C78467EAA2188A0D69F31F1A7321E88DB9575F183811AEF55543B39D1F57D3B6
- Before src/components/BhavcopyDownloadWindow.tsx: 48700AC3CD154DEC10A30C8D0E8196D749C5BF95050ABBEA88A5E0F6A8F79F7D
- Before src/components/BhavcopyDownloadWindow.styles.ts: F230C58001BFE514E410ABE29DFD41D2A3CB2B8EEFFFFA5DDD15B8225C2B3D2E
- Before src/components/__tests__/BhavcopyMarketHolidayRefresh.test.ts: A4C8AC4AFF6E0A36948F435478B4245746A80223317464C31973D3A8D1EF76C0
- After src/components/BhavcopyDownloadWindow.tsx: 86A67FE959F426B1586B0E8971FEDB74B23E7C77510EA6100559A9D360607559
- After src/components/BhavcopyDownloadWindow.styles.ts: 47FCEE769118505E6E2AE115FF2AE7577773967499198F246CBE27652ED607E2
- After src/components/__tests__/BhavcopyMarketHolidayRefresh.test.ts: A3A929D4D80C203F45AC781FE0FA187D7857F3890794C78461D9A9F11FEAF2A3
- After src/components/__tests__/BhavcopyMarketHolidayLayoutStatus.test.ts: A5618186743BF40DB764B0ACE021060F8CE0FE84151F9DCCD6C241F467E90B79
