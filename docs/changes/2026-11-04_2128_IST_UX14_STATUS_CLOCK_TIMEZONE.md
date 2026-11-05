# UX-14 — IST-labelled status clock uses Asia/Kolkata

> **6 November 2026 (IST)** · Landed in `787fe7c44fa08fa11176976aaf2b9975105695af` via the [UI8 consolidation](2026-11-04_2336_IST_UI8_INTEGRATION_CANDIDATE.md#final-consolidation). Original proposal [PR #12](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/12). The later local focused suite passed. Finding-specific native acceptance remains unverified. The validation and rollback below describe the original proposal unless dated otherwise.

**IST timestamp:** 2026-11-04 21:28 IST (UTC+05:30)  
**Workstream:** EOD Charting Platform, `E:\TA Projects\EOD Charting Platform`  
**GitHub source:** `dhamnaik-lab/Eod-Charting-Platform`, `main` @ `4cf6c66ce65c6cfe76a97af8e1636dbd16e9519a`  
**Branch:** `fix/ux14-ist-status-clock-20261104`

## Objective / previous limitation
The status bar clock displayed a literal `IST` label but formatted the clock using `new Date().toLocaleTimeString('en-IN', { hour12: false })`, which reflects the host's local timezone, not necessarily India Standard Time. The locale name alone does not specify a timezone.

## Files changed
- Modified: `src/components/StatusBar.tsx` (one formatter option).
- Created: `src/components/__tests__/StatusBarIstClock.test.ts` (three focused tests).
- Created: this change record.

## Final implementation
Add `timeZone: 'Asia/Kolkata'` to the existing `toLocaleTimeString('en-IN', { hour12: false })` call. Preserve the `IST` label and all existing styling, refresh cadence, symbol, data-range, database status and download badges. No trading session, market data, exchange calendars, data timestamps or storage calculations are changed.

## Behavior preserved
- Status bar updates once per second.
- Format remains 24-hour `en-IN` with seconds.
- Displayed clock still reads local IST on the user's IST-configured Windows machine.
- No window, chart, backend, data or dependency changes.

## Validation performed / results
- Pinned GitHub main revision and source inspected: **PASS**.
- Created separate branch and changed only exact formatter source: **PASS static patch**.
- Added three focused test cases: **NOT EXECUTED**.
- `npm run test -- src/components/__tests__/StatusBarIstClock.test.ts`: **NOT RUN**.
- TypeScript typecheck and renderer build: **NOT RUN** at user request.
- Windows multi-timezone visual verification: **NOT RUN** at user request.
- No CI pass or runtime success inferred.

## Risks / limitations
- Requires normal modern JavaScript Intl timezone support in the runtime; Tauri 2 Windows WebView is expected to support it but was not executed.
- Clock `Date` uses host time; incorrect host system time remains incorrect. Explicit timezone only fixes timezone interpretation.
- The test uses a fixed UTC example; exact locale output is checked only once it is executed.
- No other timezone-sensitive behavior was audited in this task.

## Rollback
GitHub-only branch means no local PowerShell backup was run; pinned `main` is unchanged and remains rollback baseline. Close the unmerged draft PR to discard, or revert through a new reviewed PR if merged. Do not reset unrelated changes.

## Deferred acceptance
Run the focused test, renderer typecheck and build. On Windows, verify the IST label and time when the host timezone is set to Asia/Kolkata and, if available, another timezone; ensure all non-clock status bar fields remain unchanged.
