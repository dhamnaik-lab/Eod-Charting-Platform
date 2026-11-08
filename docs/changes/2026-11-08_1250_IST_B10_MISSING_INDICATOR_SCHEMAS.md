# B10 — accurate STOCHRSI / CPR / AVWAP indicator settings schemas

- **IST timestamp:** 2026-11-08 12:50 IST (UTC+05:30)
- **Workstream:** EOD Charting Platform
- **Authorized local root:** `E:\TA Projects\EOD Charting Platform` (not accessed; GitHub-only)
- **Source baseline:** GitHub `main` `208b65e9841f861a311afa2f50f01a45353b5d4d`
- **Tracking:** [B10 issue #39](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/39), [master issue #28](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/28), [draft PR #80](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/80)
- **Authorization:** one bounded B10 renderer issue only; merge separate; no B11 work.

## Objective and previous defect

The three catalog indicator kinds `STOCHRSI`, `CPR` and `AVWAP` had no explicit schema in `INDICATOR_SETTINGS_SCHEMAS`; their settings dialog fell back to empty inputs/style, despite the builders consuming supported values.

## Files changed

1. `src/components/IndicatorSettingsDialog.tsx` — three bounded schema entries only:
   - STOCHRSI Inputs: `rsiPeriod`, `stochPeriod`, `kPeriod`, `dPeriod` with integer step and minimum 1. Style: `color` (%K) and `signalColor` (%D).
   - CPR Inputs: none. Style: `pivotColor`, `tcColor` and `bcColor`, matching the Pivot/Top Central/Bottom Central builder lines.
   - AVWAP Inputs: none. Style: existing `color`. No anchor input controls added.
2. `src/indicators/__tests__/indicatorMissingSchemasB10.test.tsx` — ten focused regression tests for the actual inputs/style markup, unrelated EMA fields, STOCHRSI numerical parameter effect and color parity, prior-completed-bar CPR pivots, AVWAP default and anchored values, and persisted chart config compatibility.
3. `docs/changes/2026-11-08_1250_IST_B10_MISSING_INDICATOR_SCHEMAS.md` — this IST change record.

## Final implementation and preserved behavior

- **Source-aligned controls only.** The active STOCHRSI builder consumes the four periods and two colors but currently fixes its direct price source to Close; therefore a misleading direct-price Source picker was **not** added even though the stored type permits optional source metadata. Existing study-as-source handling is unchanged.
- **CPR** uses previous completed bar's high, low and close to construct Pivot, TC and BC. Only the three existing plot color properties become editable. Calculations remain untouched.
- **AVWAP** line Color becomes editable; its `anchorDate`/`anchorIndex` numerical logic, default start index 0 and saved anchor fields remain unchanged. No new date/index input is introduced.
- Chart defaults, indicator registry/types/builders, rendering, layouts, workspace schema and serialization, backend/native code and database remain unchanged. No dependency added. Existing indicator defaults and calculations are identical.
- Existing saved indicator configurations keep their names, periods, colors, optional source metadata and anchors on restore.

## AVWAP anchor decision checkpoint (deferred)

Issue #39 explicitly requires a separate decision about date/index anchor UX and valid values. The existing builder gives `anchorDate` precedence when a chart date at/after it is found; if none is found, it falls back to `anchorIndex` or 0. Editing these fields safely requires a distinct UI contract (valid date string, chart history bounds, future/missing dates, date/index precedence and persistence). The three-color/period B10 correction is bounded without that expansion. No additional anchor UX behavior has been approved or implemented.

## Actual test and build evidence

First code/test head commit `4ecbe1b8df8f6b90bf2e2b6cdf5b46fe03068250`: [GitHub Actions #42458254365](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42458254365), **SUCCESS** verified via individual job steps and full logs.

- Locked dependency installation: **PASS**.
- `npm test`: **PASS**, **231 test files passed / 1 skipped**, **1,550 tests passed / 1 skipped / 0 failures**.
- New `indicatorMissingSchemasB10.test.tsx`: **10/10 PASS** (including actual SSR tab markup and numerical checks).
- `npm run typecheck:renderer`: **PASS**.
- `npm run build:renderer`: **PASS**, Vite built in **5.13 seconds**.

**Final-head CI** after this documentation commit must be checked independently; the first CI pass does not imply subsequent commits passed.

## Untested, risks and limitations

- Real Windows UI color picker interactions, actual Save/Reopen clicks and real database/workspace restoration have **not** been manually validated. Tests cover rendered controls and JSON restoration, not native pointer input.
- Windows portable/Tauri/Rust build and deployment have **not** been executed.
- Direct STOCHRSI Source picker deliberately absent because the builder currently uses Close; AVWAP anchor editing intentionally deferred. Both are potential separate tasks only with approval.
- One previously skipped Vitest remains skipped; no B10 tests disabled. No local checkout or DB accessed.

## Rollback and next step

Before merge, abandon draft PR #80. If later separately approved/merged, revert only the B10 merge commit after checking intervening changes. There is no schema migration or backend data rollback.

Verify full renderer Vitest, TypeScript typecheck and Vite build against the **final documented PR head**, maintain a draft PR and request explicit user approval for merge. Close B10 only after the approved integration; do not start B11 automatically.
