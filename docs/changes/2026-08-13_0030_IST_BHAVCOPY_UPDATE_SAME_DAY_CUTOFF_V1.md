# Bhavcopy Update Same-Day Cutoff V1

**IST timestamp:** 2026-08-13 00:30 IST (+05:30)  
**Project:** EOD Charting Platform  
**Scope:** Bhavcopy automatic `Update` date-window resolution only  
**Status:** GUARDED SOURCE PATCH; WINDOWS VALIDATION AND RUNTIME ACCEPTANCE PENDING

## Objective

Prevent automatic Bhavcopy `Update` mode from probing the new calendar date immediately after midnight, while preserving legitimate same-day EOD updates later in the evening.

## Runtime evidence

At 00:15 IST on 2026-08-13, the active database was already current through 2026-08-12. Existing `Update` logic used the current local calendar date as its upper bound and therefore created four unnecessary 2026-08-13 provider jobs. NSE, BSE, NSE Index and BSE Index all returned unavailable/missing-style skips because the 2026-08-13 trading session had not happened yet.

A fixed `yesterday` upper bound was rejected because it would break an already-proven valid workflow: on 2026-08-12 at 19:47 IST, same-day 2026-08-12 data was successfully downloaded and imported. Therefore the correction is time-gated rather than permanently one-day delayed.

## Final rule

Automatic `Update` mode uses:

- **before 18:00 local time:** previous calendar day as the maximum probe date;
- **18:00 or later:** current calendar day may be probed.

Existing market-calendar logic still decides whether a resulting date is a weekend, exchange holiday, or special trading day.

This rule applies only to `DownloadMode::Update`.

The following behaviors remain unchanged:

- manual `Date Range` mode;
- `Full History` mode;
- provider candidate generation;
- NSE/BSE/BSE Index source handling;
- Phase 2C APPEND_NEWEST durability;
- interrupted-checkpoint resume fix;
- Phase 2D background checkpointing;
- binary format and database schema.

## Implementation

`src-tauri-shell/src/bhavcopy.rs`:

1. Adds `UPDATE_SAME_DAY_PROBE_AFTER_LOCAL_HOUR = 18`.
2. Replaces the `Update` upper bound from `today_trade_date()` to `update_end_trade_date()`.
3. Adds deterministic helper `update_end_trade_date_for(local_date, local_hour)` for regression testing.
4. Adds a unit test proving the rollover contract:
   - 00:xx and 17:xx on 2026-08-13 resolve to 2026-08-12;
   - 18:xx and 23:xx resolve to 2026-08-13.

## Guarding

The installer does not replace the whole Bhavcopy source file. It performs exact, count-checked text edits against the live file and requires the already-applied Phase 2D markers to be present. This preserves newer Bhavcopy work outside the date-window block.

## Validation

Run:

```powershell
cargo test --manifest-path ".\\src-tauri-shell\\Cargo.toml" test_update_end_date_defers_current_day_until_evening_cutoff -- --nocapture
cargo test --manifest-path ".\\src-tauri-shell\\Cargo.toml" bhavcopy -- --nocapture
cargo check --manifest-path ".\\src-tauri-shell\\Cargo.toml"
```

## Runtime acceptance

Before 18:00 local time, with all selected exchanges imported through yesterday, `Update` should report them already up to date and create zero jobs for today.

At or after 18:00 local time, `Update` may create jobs for the current date, preserving the same-day EOD workflow.
