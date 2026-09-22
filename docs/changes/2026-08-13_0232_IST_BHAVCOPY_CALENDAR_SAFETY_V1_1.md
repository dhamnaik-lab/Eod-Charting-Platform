# Bhavcopy Calendar Safety V1.1

**Timestamp:** 2026-08-13 02:15 IST (+05:30)  
**Project:** EOD Charting Platform  
**Scope:** Bhavcopy trading-calendar classification only

## Trigger

A review of the pre-download holiday filter identified an important correctness requirement: a Saturday, Sunday, or declared holiday can still contain a valid exchange trading session. Examples include Muhurat Trading, Union Budget sessions, and special live disaster-recovery sessions. A holiday/weekend filter must therefore never outrank a known special trading-day override.

The existing runtime already emitted date-by-date `SKIP` results for known weekends and exchange holidays. This change preserves that useful behavior and makes the special-session path equally explicit.

## Changes

- Replaces the NSE-only date list with exchange-aware special-session calendars for:
  - NSE / NSE Index
  - BSE / BSE Index
- Covers audited recent cash-market special sessions from 2023 through the currently announced 2026 calendar, including:
  - Muhurat Trading sessions
  - Union Budget live trading sessions
  - 2024 special live / disaster-recovery sessions
- Special-session overrides take precedence over weekend and holiday skipping.
- Adds one progress/info line per selected exchange when an override is active:

```text
[NSE] 2026-02-01: Special trading day override (Union Budget live trading session); treated as trading day
```

- Preserves existing date-by-date holiday/weekend logs such as:

```text
SKIP: [BSE] 2026-06-26: Exchange holiday (Muharram)
SKIP: [NSE Index Symbols / Full Index List] 2026-08-16: Weekend (Sunday)
```

- Removes the word `holiday` from generic post-network source-miss messages. Dates that reach the downloader have already passed the known calendar filter, so a missing source is reported as unavailable/missing rather than being automatically classified as a holiday.

## Safety / non-goals

This patch does not modify:

- download providers or URL candidates;
- parsing or symbol identity;
- binary EOD format or import semantics;
- recovery journals, Phase 2C, or Phase 2D checkpointing;
- Update same-day 18:00 cutoff;
- Manual Import Recovery;
- frontend layout or Market Holiday management UI.

The exchange-aware special-session tables are deliberately separate even where current dates are shared, so a future exchange-specific exception can be added without changing the other exchange.

## Validation contract

Focused tests verify:

1. the audited recent special-session calendar is recognized for NSE/NSE Index and BSE/BSE Index;
2. Sunday 2026-02-01 bypasses weekend filtering and creates four download tasks;
3. a normal shared cash-market holiday still produces one date-by-date skip result for each of the four selected sources;
4. the complete Bhavcopy suite remains green;
5. `cargo check` remains green.

## Runtime acceptance

After automated validation, a useful historical acceptance probe is a one-day Date Range run for `2026-02-01` with all four cash/index sources selected. The expected behavior is an explicit special-day override log and real download attempts instead of `Weekend (Sunday)` skips. Existing data may be prefiltered if that date is already present.


## Installer correction

V1.1 corrects a PowerShell quoting/parser defect in the V1 installer verification marker. The V1 parser failed before execution, so the reported failed V1 attempt did not modify project source or documentation. Runtime intent is otherwise unchanged.
