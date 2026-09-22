# Identity Import I2-R2 — Official Preview Transition Correction

Status: APPROVED BOUNDED I2 CORRECTION
Date: 2026-09-05
Project: `E:\TA Projects\EOD Charting Platform`

## Root cause

The I2 compact UI made NSE and BSE look symmetrical, but their Official preview prerequisites remained different:

- NSE Official Preview can resolve its managed source set without a frontend file path.
- BSE Preview requires a concrete `masterFilePath`.
- I2 stored that BSE path only after `Refresh BSE Sources` completed.
- Therefore switching from NSE to BSE left `Preview Changes` disabled until Refresh populated the BSE path.

Separately, the Exchange/Source selectors cleared preview result objects but did not clear the shared `status` string, so an old NSE status could remain visible after switching to BSE (and vice versa).

## Approved correction

1. Official mode primary action becomes `Refresh & Preview` for both NSE and BSE.
2. NSE: refresh current master + de-listed workbook, then preview.
3. BSE: download Active + De-listed + Suspended master, then preview the exact returned file path immediately.
4. Official mode retains a separate `Preview Saved Sources` action.
5. Exchange/Source changes clear the old preview results, search filter, and contextual status.
6. Manual mode retains `Preview Changes`.
7. `Apply Reviewed Changes` remains a separate explicit operation with existing semantics.

## Explicit non-goals

- no backend/database behavior change;
- no BSE Apply during this task;
- no Preview-to-Apply binding redesign;
- no combined NSE+BSE preview;
- no historical BSE identity work;
- no Manual Entry change;
- no Official Imports R1C-I1 change;
- no chart-price change.

## Manual checkpoint

After automated PASS:

1. Preview NSE Official.
2. Switch to BSE Official.
3. Confirm the old NSE status/summary/table is gone immediately.
4. `Refresh & Preview` must be enabled without a pre-existing BSE path.
5. Click it; BSE refresh should flow directly into BSE preview without a second click.
6. Confirm the final status says BSE and the table contains BSE rows.
7. Do not click Apply; BSE reconciliation counts remain a separate validation task.
