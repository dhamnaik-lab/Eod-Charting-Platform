# Identity Import I2-R2 — Official Preview Transition Correction

Status: AUTOMATED PASS / MANUAL TRANSITION CHECK REQUIRED
Generated: 2026-09-05 20:07:50 IST

## Root cause

I2 cleared preview result objects on Exchange/Source changes but left the shared status string intact. BSE Official Preview also required a concrete frontend master path that existed only after Refresh BSE Sources, creating a two-click prerequisite not present in NSE.

## Production change

- Official primary action is now Refresh & Preview for NSE and BSE.
- BSE previews the exact path returned by the just-completed download.
- Official mode retains Preview Saved Sources as a separate secondary action.
- Exchange/Source changes clear stale status, preview results, and search context.
- Manual mode retains Preview Changes.
- Apply Reviewed Changes remains explicit with existing semantics.

## Preserved

- Identity I1 Current behavior
- Manual Entry
- Identity backend/database behavior
- Preview-to-Apply semantics
- Official Imports R1C-I1
- chart-price behavior
- package dependencies

## Validation

- I2-R2 TDD RED: PASS
- I2-R2 focused GREEN: PASS
- I2 compact regression: PASS
- Identity characterization regression: PASS
- I1 Current regression: PASS
- full Corporate Action regression: PASS
- renderer typecheck: PASS
- renderer build: PASS
- portable Windows build: PASS

## Hashes

- DatabaseTools preimage: 2754864BE58B1CFD62A091AB7991533881BA982C23B875D587A0BE5F0A9C9412
- DatabaseTools postimage: 9F26E22A07BF8CE6454594F564B0E67C9E2D42F884B21498BCA9722B3791C488
- portable: 02FAD133546A8CB022C1BC68D46503B2FFBB31BE74DA297D67750C689741644D

## Manual checkpoint

1. Preview NSE Official.
2. Switch to BSE Official: old NSE status/summary/table must clear immediately.
3. Refresh & Preview must be enabled even before a BSE managed path exists.
4. One click must download BSE sources and immediately preview BSE rows.
5. Final status must identify BSE.
6. Do not click Apply; BSE reconciliation counts are a separate validation task.
