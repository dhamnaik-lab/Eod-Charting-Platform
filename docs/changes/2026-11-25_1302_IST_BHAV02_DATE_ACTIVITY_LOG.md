# BHAV-02 — Date-wise activity log and outcome presentation

IST timestamp: 2026-11-25T13:02:50+05:30. Base: `828c9172d46d3c6067995dcadfa30cc1cbdb8387`. Candidate: `fix/bhav-02-date-activity-20261125`.

## Objective

The accepted BHAV-01 runtime logged weekend skips before downloads, discarded individual prefiltered dates from terminal results, exposed raw source/fallback/timing diagnostics by default, and had no concise synchronous-checkpoint message. The November 1–25 operator log is the acceptance reference (41 prefiltered exchange/date pairs, 24 weekend skips, 35 jobs, 68 inserted, 24,900 unchanged, 12 immediate-sync files, 0 deferred sync).

## Implementation and preservation

- Separate tracked batch presentation report; include exact planner prefiltered pairs without changing raw download results, coverage decisions, or the legacy batch API. Group terminal outcomes by date and selected exchange; default normal log, optional Detailed Logs retaining raw events. Count date/exchange results once, separately count existing, skipped, pending, incomplete, failed and unresolved absence.
- Saved holiday context is display-only. Genuine source error/rejection is retained; only explicit absence, transport error or wrong-session rejection can receive holiday or pre-cutoff context. Invalid OHLC, worker and import errors stay visible. Special session overrides holiday context. Current-day context uses IST and existing 18:00 Bhavcopy cutoff, not an assertion of actual exchange session hours. Missing calendar does not invent a holiday.
- Existing weekend scheduling and known special-session list are preserved; weekend is described as not requested under current planner, not proven absence. No new hard-coded dates. Removal of blanket historical weekend skips and database-backed special-session migration remain separately approved behaviour/schema work, not silently implemented here.
- No changes to fallback, worker count, security admission, file format, journal contents, checkpoint logic, retry/coverage certification, or dependencies. Only checkpoint progress notification is added/clarified; completion notification follows successful journal cleanup. No inference of durability from zero new rows.
- All processed source errors and diagnostics remain in the existing detailed log with its existing bounded retention. Normal date results appear together after terminal reconciliation; execution remains concurrent and progress continues during the run.

## Files

- `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`
- `HANDOFF.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `docs/changes/2026-11-25_1302_IST_BHAV02_DATE_ACTIVITY_LOG.md`
- `src-tauri-shell/src/bhavcopy/activity_report.rs`
- `src-tauri-shell/src/bhavcopy/ingestion.rs`
- `src-tauri-shell/src/bhavcopy/mod.rs`
- `src-tauri-shell/src/bhavcopy/tests.rs`
- `src-tauri-shell/src/bhavcopy/types.rs`
- `src/components/BhavcopyDownloadWindow.tsx`
- `src/components/__tests__/BhavcopyDownloadRerun.test.ts`
- `src/features/bhavcopy/__tests__/activityLog.test.ts`
- `src/features/bhavcopy/activityLog.ts`
- `src/store/bhavcopyStore.ts`
- `src/types/desktop.ts`

## Validation

Preparation: 51 replacement anchors verified against pinned GitHub source; isolated new formatter strict TypeScript compile and Node assertion smoke passed. Rustfmt and complete project suites require actual Windows execution. Commands and results appended by runner. No production DB, online dependency retrieval, live download, release build or push authorized by this runner. Native acceptance and standard portable build remain pending after automated checks.

## Risks and rollback

Read-only calendar context can be unavailable/stale; no raw error is changed or new coverage certified. Existing shared cash-calendar fallback is labelled saved calendar, not independent exchange proof. Existing current-day explicit Date Range policy stays unchanged. Historical data quality and retry work are excluded. Preserve protected local files, exact pre-edit backup and local RECOVERY-01B hold commit. Return to verified main only after preserving candidate changes; do not reset/clean or restore databases.

## Actual local validation results

- Exit 0: `git switch --no-track -c fix/bhav-02-date-activity-20261125`
- Exit 0: `rustfmt --version`
- Exit 0: `rustfmt --edition 2021 --config skip_children=true src-tauri-shell/src/bhavcopy/activity_report.rs src-tauri-shell/src/bhavcopy/ingestion.rs src-tauri-shell/src/bhavcopy/mod.rs src-tauri-shell/src/bhavcopy/tests.rs src-tauri-shell/src/bhavcopy/types.rs`
- Exit 0: `rustfmt --edition 2021 --check src-tauri-shell/src/bhavcopy/activity_report.rs src-tauri-shell/src/bhavcopy/ingestion.rs src-tauri-shell/src/bhavcopy/mod.rs src-tauri-shell/src/bhavcopy/tests.rs src-tauri-shell/src/bhavcopy/types.rs`
- Exit 0: `git diff --check -- src-tauri-shell/src/bhavcopy/mod.rs src-tauri-shell/src/bhavcopy/types.rs src-tauri-shell/src/bhavcopy/ingestion.rs src-tauri-shell/src/bhavcopy/tests.rs src/store/bhavcopyStore.ts src/components/BhavcopyDownloadWindow.tsx src/types/desktop.ts src/components/__tests__/BhavcopyDownloadRerun.test.ts HANDOFF.md NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`
- Exit 0: `pwsh.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; & .\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Preview -CargoAction test -CargoArguments @('bhav02_'); if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }"`
- Exit 0: `pwsh.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; & .\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction test -CargoArguments @('bhav02_'); if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }"`
- Exit 0: `pwsh.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; & .\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Preview -CargoAction test -CargoArguments @('bhavcopy::'); if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }"`
- Exit 0: `pwsh.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; & .\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction test -CargoArguments @('bhavcopy::'); if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }"`
- Exit 0: `pwsh.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; & .\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Preview -CargoAction test -CargoArguments @('bhavcopy_recovery::'); if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }"`
- Exit 0: `pwsh.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; & .\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction test -CargoArguments @('bhavcopy_recovery::'); if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }"`
- Exit 0: `pwsh.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; & .\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Preview -CargoAction test -CargoArguments @('database::binary_eod::'); if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }"`
- Exit 0: `pwsh.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; & .\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction test -CargoArguments @('database::binary_eod::'); if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }"`
- Exit 0: `pwsh.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; npm test -- src/features/bhavcopy/__tests__ src/components/__tests__/BhavcopyDownloadRerun.test.ts src/components/__tests__/BhavcopyMarketHolidayLayoutStatus.test.ts src/components/__tests__/BhavcopyMarketHolidayRefresh.test.ts src/components/__tests__/BhavcopyOfficialHolidaySync.test.ts; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }"`
- Exit 0: `pwsh.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; npm run typecheck:renderer; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }"`
- Exit 0: `pwsh.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; npm run build:renderer; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }"`

Overall: **PASS_LOCAL_AUTOMATED_VALIDATION**.
Backup: `E:\TA Projects\EOD Charting Platform\backups\pre_bhav02_date_activity_20261125-130250-456500`.
Native portable/manual acceptance and GitHub publication remain pending.
