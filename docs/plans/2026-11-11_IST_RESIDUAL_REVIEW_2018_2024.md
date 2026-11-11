# Residual review 2018–2024 — findings and repair plan

- Timestamp (IST): 2026-11-11 00:40
- Root: `E:\TA Projects\EOD Charting Platform`
- Status: **findings and plan only — no data repair executed, no store or database modified**
- Preconditions recorded: the 2023–2024 repair chunk is closed and clean (498 jobs, 0 failed, `errors 0`, 233 non-trading calendar days, buckets reconciling to 731). See `docs/changes/2026-11-11_0020_IST_2023_2024_CHUNK_HOLIDAY_GAPS_AND_WARN_TOKEN.md`.

## Measurement basis

`eod_prices` is **not** the live bar store — it holds 0 rows for every date in 2018–2024. All counts below come from the binary `.eod` files (128-byte header, 64-byte records, little-endian `u32` date at record +0, `i64 prev_close` at record +40), cross-checked against `scripts/eod-store-integrity-validator.py --exchange NSE --from 2018-01-01 --to 2024-12-31`, which agrees exactly. Symbols are classified through `instruments.series`; `corporate_actions` supplies the split/bonus control.

## Finding A — zero-`prev_close`: 63,670 bars, not 20,919

The 10 November figure **20,919 does not reproduce**. Measured for NSE 2018–2024: **63,670** bars across 2,433 symbols.

| Class | Symbols | Bars | Share |
| --- | --- | --- | --- |
| Structural (zero on ≥90% of the symbol's bars) | 175 | 56,250 | 88.4% |
| Partial | 2,304 | 7,561 | 11.9% |
| — of which exactly one zero bar | 2,276 | — | dominated by 2023-09-28 |

By current identity: equity-series symbols 44,455 bars / 2,364 symbols; non-equity-series symbols 19,215 bars / 69 symbols. **19,215 is the closest match to the 20,919 checkpoint figure**, so that number was most likely the non-equity/structural class rather than an all-NSE total. Treat the two figures as different populations; neither is wrong, but only 63,670 is reproducible today.

- Structural leaders (SGBs and NCDs whose source rows carry no `PREV_CLOSE`): SGBMAR25 1,706, SGBNOV24 1,700, SGBJUL25 1,686, SGBMAY25 1,686, SGBSEP24 1,654, SGBAUG24 1,631, NHAI 1,569, ECLFINANCE 1,568, NHBTF2014 1,499, SGBFEB24 1,478, L&TFINANCE 1,470, ERFLNCDI 1,450, IIFCL 1,439, NABARD 1,439.
- Partial layer above 20 bars: IREDA 1,341 · IRFC 763 · TATASTEEL 591 · EMBASSY 495 · INDIGRID 495 · PGINVIT 495 · IBVENTURES 484 · NHIT 350 · HATSUN 140 · SHREMINVIT 40 · DHFL 32.
- `2020-03-06` spot check reproduces at **52 symbols** (13 with a non-equity current identity; 39 with an equity identity whose 2020 bar came from a debt/MF/SGB series row, including `TATASTEEL` and `IBVENTURES`).

## Finding B — duplicate dates: 89 files, 1,357 dates, all pre-2018

| Measure | Checkpoint | Measured |
| --- | --- | --- |
| Files | 89 | 89 |
| Distinct dates | 4,418 | **1,357** |
| Extra records | — | **6,107** |
| Inside 2018–2024 | — | **0** |

NSE-only; BSE, BSE_INDEX and NSE_INDEX are clean. Offenders are delisted shells: RELPETRO 1,486, JINDVIJSTL 826, TORRENGUJ 642, IIISL 346, ICICI 180, NIRMA 175, ESSARSHIP 127, HUGHESTELE 90. This item has no bearing on the 2018–2024 window.

## Finding C — pre-listing bond bars: 3 symbols, 2,582 bars, no corporate action behind them

| Symbol | Bars before listing | Level before | Listing date | First equity close | Applied CA rows |
| --- | --- | --- | --- | --- | --- |
| IRFC | 762 | ₹1,130–1,240 | 2021-01-29 | ₹24.80 | 0 |
| IREDA | 1,341 | ₹1,165–1,183 | 2023-11-29 | ₹60.00 | 0 |
| TATACAP | 479 | ~₹1,056 | 2025-10-13 | ₹330.50 | 0 |

₹1,000-face-value debt-series records filed under the equity symbol before listing, producing a 40–98% false cliff at the listing date.

**Control:** `TATASTEEL` 2022-07-28 ₹959.40 → ₹100.35 *is* an approved `SPLIT` (factor 10) and is correct behaviour. This is why a price-cliff scan cannot find this family — the same scan returned 912 hits, nearly all legitimate splits and bonuses.

## Finding D — 2023-09-28 contradicts the holiday table (blocking)

| Evidence | Result |
| --- | --- |
| Bars on 2023-09-28 | NSE 2,331 (neighbours 2,353 / 2,366), BSE 4,102 |
| Distinct from other sessions | No OHLCV match to any 2022–2024 date; 8 single-symbol coincidences only |
| Session chain | 09-29 `prev_close` == 09-28 close for every sampled symbol |
| Every bar's `prev_close` | 0 — the source for that date carried no `PREV_CLOSE` |
| `download_log` | no NSE entry for 2023-09-28 (and none for 09-19, a true holiday) |
| `market_holidays` | 2023-09-28 = Id-E-Milad (`BUILTIN`) |
| Control | both exchanges correctly omit 2023-09-19 (Ganesh Chaturthi) |

The store says the market traded (full session, both exchanges, internally consistent); the calendar says it was closed, so the 2023–2024 repair run skipped it as `Exchange holiday (Id-E-Milad)`. Either the `BUILTIN` row is a false holiday — suppressing a real session that then never gets refreshed — or 4,433 bars carry a wrong date. This cannot be settled from the store alone.

## Plan

**P0 · RESOLVED 11 November 2026 — 2023-09-28 traded.** The user supplied `sec_bhavdata_full_28092023.csv` (2,492 rows, all `DATE1 = 28-Sep-2023`) and `cm28SEP2023bhav.csv.zip` (2,517 rows, all `TIMESTAMP = 28-SEP-2023`). Store OHLC matches the source exactly on every sampled symbol (20MICRONS, SBIN, RELIANCE, TCS, TATASTEEL, INFY); only `prev_close` was lost (all 2,326 bars are 0 while the source carries values). The `BUILTIN` Id-E-Milad row is therefore **false**. Two supplied NSE Clearing PDFs are settlement circulars ("Sep 29, 2023 continues to be a settlement holiday"), not trading-holiday notices. Denominator is 63,670, not 61,344.

**P0b · Remaining from P0 (needs approval, data).** Delete the false `2023-09-28` row from `market_holidays`; it is already inert after HOL-05 Phase 1 but still asserts a closure. Then re-run that single date so the import writes the real `prev_close` rather than hand-editing binary files.

**HOL-05 Phase 1 · DONE 11 November 2026.** Calendar authority is official-only plus manual `USER` rows; the unverified `BUILTIN` seed no longer suppresses sessions, and stored bars outrank the calendar via `is_calendar_skip_contradicted` with a `CALENDAR CONTRADICTION` log line. See `docs/changes/2026-11-11_0200_IST_PHASE1_CALENDAR_AUTHORITY.md`. Consequence: 2023–2025 and 2027 have no holiday authority until official data exists (2026 only), so those years plan every weekday — a corroborated migration or Phase 2 ingestion is needed to restore clean skips.

**P1 · Fix the measurement before any repair.** Define "residual zero-`prev_close`" by identity class and date cluster; add a summary rollup to `eod-store-integrity-validator.py` so two populations can never again be compared as one number; correct the stale figures in `HANDOFF.md`.

**P2 · Pre-listing bond bars (highest visible impact, smallest surface).** 3 symbols, 2,582 bars. Build a per-bar evidence manifest (source series + ISIN) first, then decide per symbol: truncate the pre-listing debt bars from the equity file, or re-key them to their own bond identity. Re-keying is the correct model but depends on the identity-provenance design, so truncation with evidence is the lower-risk option. Requires a backup and a post-check that equity history still matches source from the listing date.

**P3 · Structural non-equity zero-`prev_close` (56,250 bars).** Correct fix is at import time: derive `prev_close` from the previous record's close when the source column is absent, which stops new occurrences without a 56k-bar write. Backfill only if historical `% change` on those instruments is wanted.

**P4 · Historical duplicates (89 files / 6,107 records, all pre-2018).** Run `scripts/eod-dedupe-duplicate-dates.py` in dry run for a manifest, then decide per batch. Lowest urgency.

**P5 · Identity conflicts (`TATASTEEL` E1, `IBVENTURES` E3).** Remains blocked behind the deferred identity-provenance design.

## Constraints that stay in force

No Corporate Action Approve; no automatic Split/Bonus/Dividend write stage; no release, installer, portable build or new Cargo target; no git commands; no data repair without an explicit per-item approval; backups before any file edit or direct SQL; Rust checks serially through `scripts/Invoke-EOD-SharedCargo.ps1`.

## Open questions for the user

1. The `2023-09-28` archive file — needed to unblock P0.
2. P2 policy: truncate pre-listing debt bars, or wait for re-keying?
3. P3: import-time fix only, or also a historical backfill?
