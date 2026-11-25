# BHAV-02-R1 — Concise date outcomes and verified no-new-write reporting

IST timestamp: 2026-11-25T14:51:16+05:30. Active candidate: `fix/bhav-02-date-activity-20261125`; HEAD `828c9172d46d3c6067995dcadfa30cc1cbdb8387`. Input evidence SHA-256 `67BE5E5538DAF69BF0F27050A166DDDDA13F61772592D5B29018D8CC372A3730`; previous native test executable `6D091220BC23211A077CECEEF0CD305ABC97ACF9F62BBDE5579BBF6A9C19223C`.

## Objective and previous limitation
The native November 1–25 run showed all 25 dates and 100 exchange/date pairs: 48 existing, 32 skipped, 4 pending, 15 incomplete, 1 failed; 0 inserted. Detailed log: 15 accepted NSE Index archives, 2,070 identical existing rows, no conflicting/invalid rows in accepted archives; Nov 6 archive rejected separately. Normal presentation repeated calendar names and retained noisy transport errors on contextual skips/pending dates. No no-write checkpoint message was shown. Both original source outcome and contextual display counts were correct.

## Changes and preservation
- Shorten ordinary weekend entries; group identical presentation outcomes, with positive row counts kept per exchange. Collapse equivalent holiday separators only; keep distinct saved names and special sessions visible. Holiday/pending source error text remains in Detailed Logs, not the compact line. Genuine failed dates remain errors.
- Label the detailed terminal summary as raw source results, explicitly excluding planner-prefiltered dates.
- Propagate backend no-new-quotation-write evidence from the staged CSV import branch, requiring the filtered files to be empty before journal/writer entry; no alternative import jobs, cancellation, worker/import failure, or unknown write path. A no-task run after successful prior recovery also qualifies. No inference from zero rows inserted. The status concerns new quotation writes in this download, not metadata/evidence writes or prior recovery. Immediate/background checkpoint events remain as before.
- Add focused formatter, handler and Rust regression cases; preserve raw outcomes, date planning, import behavior, metadata, coverage/retry decisions, recovery journal/checkpoint sequencing, worker count, and legacy batch result shape. No dependency changes. No database access except existing synthetic regression fixtures.

## Files changed
- `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`
- `HANDOFF.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `docs/changes/2026-11-25_1451_IST_BHAV02_R1_LOG_REFINEMENTS.md`
- `src-tauri-shell/src/bhavcopy/ingestion.rs`
- `src-tauri-shell/src/bhavcopy/mod.rs`
- `src-tauri-shell/src/bhavcopy/tests.rs`
- `src/components/BhavcopyDownloadWindow.tsx`
- `src/components/__tests__/BhavcopyDownloadRerun.test.ts`
- `src/features/bhavcopy/__tests__/activityLog.test.ts`
- `src/features/bhavcopy/activityLog.ts`
- `src/types/desktop.ts`

## Validation
Preparation: exact candidate archive and all 15 file hashes verified; isolated strict TypeScript compile, five formatter test cases via a Node assertion harness (not Vitest), reconstructed 100-pair monthly fixture passed. Windows results appended below.

## Limitations and rollback
Holiday name normalization is display-only, not proof of exchange closure. The no-write flag is deliberately conservative for other import paths and cancelled/failed imports. The remaining NSE Index coverage and historical weekend/special-session work are excluded. Back up the complete 15-file candidate and both protected files before modifying; preserve both older executables. Restore exact backed-up files only with operator approval; do not reset, clean, alter or recover a database. R1 native acceptance and publication remain pending.

## Actual validation results

- Exit 0: `pwsh.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; foreach ($p in @('.\scripts\create-project-backup.ps1','.\scripts\Invoke-EOD-SharedCargo.ps1')) { $t=$null; $e=$null; [System.Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location).Path $p),[ref]$t,[ref]$e) | Out-Null; if ($e.Count -gt 0) { throw ($e | Out-String) } }; Write-Host 'PASS: PowerShell script parser'"`
- Exit 0: `pwsh.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; & .\scripts\create-project-backup.ps1 -ShortName 'BHAV02-R1-20261125-145116-097868' -Paths @('ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md','HANDOFF.md','NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md','docs/changes/2026-11-25_1302_IST_BHAV02_DATE_ACTIVITY_LOG.md','src-tauri-shell/Cargo.toml','src-tauri-shell/gen/build-info.json','src-tauri-shell/src/bhavcopy/activity_report.rs','src-tauri-shell/src/bhavcopy/ingestion.rs','src-tauri-shell/src/bhavcopy/mod.rs','src-tauri-shell/src/bhavcopy/tests.rs','src-tauri-shell/src/bhavcopy/types.rs','src/components/BhavcopyDownloadWindow.tsx','src/components/__tests__/BhavcopyDownloadRerun.test.ts','src/features/bhavcopy/__tests__/activityLog.test.ts','src/features/bhavcopy/activityLog.ts','src/store/bhavcopyStore.ts','src/types/desktop.ts')"`
- Exit 0: `rustfmt --version`
- Exit 0: `rustfmt --edition 2021 --config skip_children=true src-tauri-shell/src/bhavcopy/ingestion.rs src-tauri-shell/src/bhavcopy/mod.rs src-tauri-shell/src/bhavcopy/tests.rs`
- Exit 0: `rustfmt --edition 2021 --check src-tauri-shell/src/bhavcopy/ingestion.rs src-tauri-shell/src/bhavcopy/mod.rs src-tauri-shell/src/bhavcopy/tests.rs`
- Exit 0: `git diff --check -- ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md HANDOFF.md NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md docs/changes/2026-11-25_1302_IST_BHAV02_DATE_ACTIVITY_LOG.md docs/changes/2026-11-25_1451_IST_BHAV02_R1_LOG_REFINEMENTS.md src-tauri-shell/src/bhavcopy/activity_report.rs src-tauri-shell/src/bhavcopy/ingestion.rs src-tauri-shell/src/bhavcopy/mod.rs src-tauri-shell/src/bhavcopy/tests.rs src-tauri-shell/src/bhavcopy/types.rs src/components/BhavcopyDownloadWindow.tsx src/components/__tests__/BhavcopyDownloadRerun.test.ts src/features/bhavcopy/__tests__/activityLog.test.ts src/features/bhavcopy/activityLog.ts src/store/bhavcopyStore.ts src/types/desktop.ts`
- Exit 0: `pwsh.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; & .\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Preview -CargoAction test -CargoArguments @('bhav02_r1_'); if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }"`
- Exit 0: `pwsh.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; & .\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction test -CargoArguments @('bhav02_r1_'); if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }"`
- Exit 0: `pwsh.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; & .\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Preview -CargoAction test -CargoArguments @('bhavcopy::'); if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }"`
- Exit 0: `pwsh.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; & .\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction test -CargoArguments @('bhavcopy::'); if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }"`
- Exit 0: `pwsh.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; & .\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Preview -CargoAction test -CargoArguments @('bhavcopy_recovery::'); if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }"`
- Exit 0: `pwsh.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; & .\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction test -CargoArguments @('bhavcopy_recovery::'); if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }"`
- Exit 0: `pwsh.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; & .\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Preview -CargoAction test -CargoArguments @('database::binary_eod::'); if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }"`
- Exit 0: `pwsh.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; & .\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction test -CargoArguments @('database::binary_eod::'); if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }"`
- Exit 0: `pwsh.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; npm test -- src/features/bhavcopy/__tests__ src/components/__tests__/BhavcopyDownloadRerun.test.ts src/components/__tests__/BhavcopyMarketHolidayLayoutStatus.test.ts src/components/__tests__/BhavcopyMarketHolidayRefresh.test.ts src/components/__tests__/BhavcopyOfficialHolidaySync.test.ts; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }"`

Overall: **BLOCKED**.

Backup: `E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20261125_145118_BHAV02-R1-20261125-145116-097868`.
Blocker: Expected validation marker missing: Tests\s+[1-9][0-9]* passed
Native functional acceptance and publication remain pending.


## Validation continuation — 2026-11-25T16:04:52+05:30

Prior evidence `9977BEDB48BAEFE3461EA9657A04EDF9BDACB13520E1FF3064F2A0D26849AD67`: runner stopped only because ANSI codes interrupted the Vitest marker. Verified after stripping ANSI: 54 passed across 8 files; all prior 15 commands exited 0. Rust 189 Bhavcopy + 19 recovery + 29 binary tests passed, 4 ignored; focused R1 test included in Bhavcopy. No source implementation modifications or repeated tests in this continuation.

- Exit 0: `npm run typecheck:renderer`
- Exit 0: `npm run tauri:build -- --no-bundle -- --offline --locked`

Continuation status: **PASS_LOCAL_AUTOMATED_AND_NATIVE_BUILD**.
Native candidate: `E:\TA Projects\EOD Charting Platform\tmp\BHAV02-R1-Native-Acceptance-20261125-160452-475720\EOD Chart.exe`; SHA-256 `1479F48B14298AD802B40710B590E54544C9C7AD2839613FE5C9FB554060DC09`.
Native functional acceptance and publication remain pending.


## Final native acceptance

PASS — see `docs/changes/2026-11-25_1732_IST_BHAV02_R1_FINAL_ACCEPTANCE.md`. Owner authorized guarded publication; remote integration remains pending receipt.
