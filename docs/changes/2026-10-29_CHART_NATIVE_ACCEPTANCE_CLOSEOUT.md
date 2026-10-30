# Chart UI native acceptance closeout - 29 October 2026

## Current disposition

The user rebuilt/restarted their portable app and supplied the native screenshots
listed below. The reported axis-label/tool-status issues and the visible Adj
reload-failure symptom are closed for the demonstrated workflows. The temporary
startup database status also settled normally according to the user's restart
check. No further implementation task is selected by this closeout.

This is scoped acceptance based on user-supplied native evidence. It is not a
claim of exhaustive GUI testing, complete historical data, or manual verification
of every automated race/fault case.

## Native evidence

Screenshots were copied unchanged from the user's attachments into
`docs/evidence/2026-10-29-chart-native/` so the record does not depend on temporary
clipboard paths. Originals were retained.

| Check | Result and evidence |
| --- | --- |
| Daily calendar density | PASS in the supplied view: [quarterly month labels on WIPRO](../evidence/2026-10-29-chart-native/daily-quarter-wipro.png). |
| Weekly calendar density | PASS in the supplied view: [years with July between them](../evidence/2026-10-29-chart-native/weekly-half-year-wipro.png). |
| Monthly intermediate zoom | PASS: [WIPRO half-year labels](../evidence/2026-10-29-chart-native/monthly-half-year-wipro.png). |
| Monthly closer zoom | PASS: quarterly month labels on [WIPRO](../evidence/2026-10-29-chart-native/monthly-quarter-wipro.png) and [NIFTY](../evidence/2026-10-29-chart-native/monthly-quarter-nifty.png). |
| Yearly labels and crosshair | PASS in the supplied view: [NIFTY yearly chart](../evidence/2026-10-29-chart-native/yearly-nifty.png). No label overlap is visible; crosshair shows the year. |
| Persistent tool instructions | Absent in the supplied cursor/crosshair views. Every drawing tool was not separately exercised. |
| Adj OFF | PASS for visible completion: [WIPRO retained, raw mode and raw-prices-loaded notification](../evidence/2026-10-29-chart-native/adj-raw-wipro.png). |
| Adj ON | PASS for visible completion: [WIPRO retained, adjusted mode and capital-adjustments-loaded notification](../evidence/2026-10-29-chart-native/adj-capital-wipro.png). The prior load-failure notification is absent in these captures. |
| Startup database status | PASS for settling: user reports a few seconds after restart; [settled screenshot](../evidence/2026-10-29-chart-native/startup-settled.png) shows green `EOD DATABASE` and range `1991-01-02` to `2026-10-26`. No status-display fix is needed for this observation. |

## Retained limits

- Rapid ON/OFF/ON stress and all hidden-tab loaded-state assertions are covered by
  the 37-test automated regression run, but not explicitly attested by the static
  native screenshots. Deliberate pending-read database/tab/symbol switches and
  comparison/source failure injection also lack separate native acceptance here.
- Static screenshots show successful state/notifications, not exact reload timing
  or numerical adjustment correctness for every historical quotation.
- No exhaustive check of every pane size, zoom level or drawing tool is claimed.
- The absence of May 2025 bars in the inspected WIPRO file was explained in the
  monthly report; no data was repaired or downloaded. The earlier history/parity
  work does not prove complete history and is not broadened by this closeout.

## Related implementation records

- [Initial time-axis/tool-overlay correction](2026-10-29_CHART_TIME_AXIS_AND_TOOL_OVERLAY.md)
- [Daily/weekly density follow-up](2026-10-29_CHART_AXIS_DENSITY_FOLLOWUP.md)
- [Monthly density and May-label review](2026-10-29_MONTHLY_AXIS_DENSITY_AND_MAY_LABEL_REVIEW.md)
- [Adjustment-mode reload race fix](2026-10-29_ADJUSTED_MODE_RELOAD_RACE_FIX.md)
- [Earlier chart request-consistency audit](2026-10-29_CHART_HISTORY_REQUEST_CONSISTENCY.md)

## Documentation-only closeout

Updated `HANDOFF.md`, `docs/CURRENT_WORK_STATUS.md`, the five related reports and
this closeout. Pre-edit documentation backup:
`backups/pre_opencode_changes_20261029_172558_chart_native_docs_closeout`.
Nine native screenshot copies were preserved under the evidence directory above.
Source code, application data, settings, builds and memories were unchanged.
No application tests, compilation, release build, commit or push was run.
Validation is limited to documentation references and scoped whitespace checks.
