# NSE Bhavcopy Series-Collision — Deep Audit + Repair Plan

- Date: 2026-11-08 (IST)
- Status: **audit complete, repair not started** (read-only audit; no source, DB or build change made)
- Active database under audit: `EOD DATABASE/` (`market-data.sqlite3`, `eod_data/`, `eod_binary_state.sqlite`)
- Secondary evidence database: `New Database/` (the 2014-11 run that produced the reported log)
- Authority: this plan + `AGENTS.md` + `docs/plans/2026-11-08_CA_SERIES_COLLISION_DESIGN.md` (file is referenced by code but currently **missing** — see P7)

---

## 1. Executive summary

1. **It is an application (import-pipeline) defect, not a database defect.** `PRAGMA quick_check` is `ok` on both `market-data.sqlite3` and `eod_binary_state.sqlite`; the SBIN binary file is header/length/record-count exact and its index row is `VERIFIED`. Every corrupt bar is a verbatim copy of a real non-equity source row — a wrong row *choice*, not damaged bytes.
2. **Mechanism:** prices are keyed on `(symbol, exchange, date)` with no series in the key, and the write path is last-row-wins (`INSERT OR REPLACE INTO eod_prices` for hybrid, `BTreeMap<date, record>::insert` for binary). NSE emits `EQ` first and `BL/IL/IQ/SL/SI/SQ` and `N1…N9/Y*/P*/D*` after it, so whenever those rows exist for the same symbol/date the equity bar was replaced.
3. **Confirmed damage in `EOD DATABASE`:** SBIN has **1,724 of 7,878 bars** (21.9 %) holding another security's bar — 1,670 debenture bars (2010-11-12 → 2017-09-20) and 54 block-print bars (2005-02-07 → 2009-02-27). Nine more symbols are confirmed clobbered in the 2014-11 source snapshot; 15 further symbols carry debenture bars under an equity symbol that had no equity row at all.
4. **The pasted download log is from a pre-fix build.** Its message format (`separated N non-equity rows, blocked M rows`) predates the current working-tree gate, which already implements the correct rule (`separated … , kept M auxiliary-market rows out of daily prices, blocked …`, `SecurityClass` + `auxiliary_market()` + `qualified`/`auxiliary_only`). The 41 dropped equity bars and 17 false failures in that log are **already addressed in the tree but not yet compiled/validated/run**.
5. **Repair is data work, not schema surgery:** re-download + re-import the affected date ranges through the app's own pipeline (the gate then prefers `EQ` and writes it over the wrong bar), then delete residual non-equity bars for dates that have no `EQ` row, then verify source-anchored.

---

## 2. Confirmed damage (audit evidence)

### 2.1 SBIN, `EOD DATABASE/eod_data/NSE/SBIN.eod`

| Metric | Value |
|---|---|
| Records | 7,878 (`1994-11-03 → 2026-11-05`), one record per date, strictly ascending, no duplicates |
| Clean equity bars | 6,154 |
| **Debenture-substituted bars** | **1,670** — `2010-11-12 → 2017-09-20` |
| **Block-print-substituted bars** | **54** — `2005-02-07 → 2009-02-27` |
| Missing sessions vs DB calendar (7,879 dates) | 1 (`1997-06-02`) |
| `prev_close = 0` bars | 2,066 (every bar `2017-09-21 → 2026-05-27`) |

Boundaries (raw file values):

```
2010-11-11  c=  3175.95  v= 2315997   equity
2010-11-12  c= 10490.33  v=   37637   <- N1/N2 debentures list 2010-11-12, takeover starts
...
2017-09-20  c= 11060.00  v=       4   (N-series)
2017-09-21  c=   268.50  v= 8509419   equity resumes, prev_close written as 0
```

Proof that bars are whole-row copies, not blends (2014-11-05):

| source row | ISIN | close | volume |
|---|---|---|---|
| `EQ` | INE062A01012 | 2781.90 | 2,660,510 |
| `N5` | INE062A08058 | **11198.83** | 205 |
| stored | — | **11198.83** | **205** |

2014-11-03 stored = `N6` exactly (`o=h=l=c 10650, pc 10600, v 2`). Across the window the file alternates between different ISINs date by date (11-18 `N5` 11,308.66 → 11-19 `N6` 10,800 → 11-20 `N5` 11,300.78 → 11-21 `N6` 10,500), so it is not even one bond series.

Block-print variant (whole single-trade bar replaced the equity bar):

```
2006-08-10  c=862.85  v=1,487,989  equity
2006-08-11  c=1027.00 v=50   o=h=l=c, pc=973.00 (previous block bar)
2006-08-14  c=871.45  v=809,075  equity again
```

### 2.2 Cross-symbol confirmation (2014-11-05 source snapshot)

24 NSE symbols carry non-equity rows under their own equity symbol. Stored vs equality-row close:

| symbol | stored | equity row | winner |
|---|---|---|---|
| SBIN | 11198.83 | 2781.90 | N5 |
| JSWSTEEL | 6.15 | 1232.40 | P2 |
| ZEEL | 0.80 | 354.90 | P1 |
| NTPC | 1275.00 | 145.25 | N6 |
| NHPC | 1235.00 | 21.10 | N6 |
| RECLTD | 1212.64 | 303.05 | N9 |
| MUTHOOTFIN | 1250.00 | 197.10 | NB |
| SHRIRAMCIT | 1052.10 | 1799.55 | NE |
| SRTRANSFIN | 1020.01 | 948.25 | YB |

Debt-only symbols whose files hold debenture bars with no equity row at all: `IRFC`, `HUDCO`, `NHAI`, `ECLFINANCE`, `IIFLFIN`, `RELIFIN`, `IREDA`, `TCFSL`, `L&TFINANCE`, `IIHFL`, `NHBTF2014`, `NHBTF2023`.

Heuristic scope estimate (not yet source-verified): 464 NSE files with a median volume ≥ 100k contain single-price, sub-5 %-of-median-volume bars — 25,052 rows total, peaking in 2013–2018. Treat as a worklist, not as confirmed damage; the `N`-series window (2010-11 → 2017-09) is the reliable interval.

### 2014-11 download gap explained

`2014-11-04` and `2014-11-06` are **NSE holidays** (Muharram, Guru Nanak Jayanti): no symbol in the database has those dates and 2014 has 243 sessions like other holiday-reduced years. The pasted log labelled them "source unavailable" only because `market_holidays` starts 2023-02-19 and `official_exchange_holidays` holds 2026 only.

### 2.3 Storage health (rules the database out)

| Check | Result |
|---|---|
| `PRAGMA quick_check` `market-data.sqlite3` | ok |
| `PRAGMA foreign_key_check` | no violations |
| `PRAGMA quick_check` `eod_binary_state.sqlite` | ok |
| SBIN `.eod` header vs size | 7,878 records, 504,320 B = 128 + 7,878×64 exact |
| SBIN index row | `record_count 7878 / scale 10000 / len 504320 / 19941103→20261105 / VERIFIED / gen 6` — matches file |

### 2.4 Other data-quality defects found while auditing SBIN

| Defect | Evidence |
|---|---|
| Exchange-wide holes | `2013-09-04 → 2013-10-04` (23 sessions, `download_log` status `error`, note `error sending request for url (nsearchives…)`), `2025-05-02 → 2025-05-30` (21, no log row), `2026-10-27 → 2026-10-30` (4, no log row), `1997-10-02 → 1997-10-08` (5, no log row) |
| `prev_close = 0` DB-wide | 2017-09-21 → 2026-05-27 on every symbol (`RELIANCE`, `TCS`, `HDFCBANK`, `INFY`, `AXISBANK`, `NTPC` identical pattern); repaired only at read time by `recompute_prev_close()` |
| `download_log` shape | complete 1994-2017 (minus holes), **empty 2018–2024**, partial 2025/2026; cannot be used as a coverage record |
| `download_log` lies on failure | `upsert_download_log_entry_once` failure branch writes `rows_inserted=0, max_volume=0, status='error'` (`ingestion.rs:3256`) |
| No corporate actions for SBIN | `corporate_actions` has 0 SBIN rows; 2014-11-20 1:10 split unadjusted; `instrument_isin_history` does hold `INE062A01012` effective 2014-11-20 |
| Evidence growth | one `bhavcopy_admission/security-*.json` per batch holds **every** input row (18.7 MB for 29,010 rows) with no retention rule |

---

## 3. Root cause

1. NSE publishes several rows per symbol per day: a regular segment row (`EQ`, `BE`, `BZ`, `SM`, `ST`, `SZ`) plus auxiliary-market rows (`IL`, `IQ`, `BL`, `SL`, `SI`, `SQ`) and non-equity rows (`N*`, `Y*`, `P*`, `D*`, `M*`) that **reuse the same trading symbol** for a different security.
2. The price store keys on `(symbol, exchange, date)` only. `INSERT OR REPLACE` (hybrid, `ingestion.rs:2361`) and `BTreeMap::insert(date, record)` (binary, `binary_eod.rs::rewrite_from_first_incoming_record`) both make **the last row for a date win**.
3. `EQ` sorts before `N*`/`BL`/`IL` in the source, so the non-equity row always won — silently, with `download_log.status='ok'`.
4. Nothing validated stored content against source series, so the substitution stayed invisible for a decade of history.

---

## 4. Current code state (working tree, untracked WIP)

Already implemented (do **not** redo):

- `security_admission.rs`: `SecurityClass::{Equity,Separate,Other,Unknown}`; `auxiliary_market()` for `IL|IQ|BL|SL|SI|SQ`; `AdmissionReport { separated, market_rows, conflicted, duplicates }`; `qualified` rule (primary regular row is `Equity`, 12-char `IN…` ISIN, all regular rows equal, all auxiliary rows share the primary ISIN) → auxiliary rows masked as `AUXILIARY_MARKET_QUOTE`; `auxiliary_only` keys write no daily price; genuine conflicts still block the whole key; `describe_result()` prefixes `Security subset:` when `conflicted > 0`.
- `IT` is now in the equity legend (the 4 rows `BDR`/`MRO`/`3RDROCK` from 2014-11 are no longer "unqualified").
- Tests encode this behaviour, including order-independence and both storage modes: `security_admission_native_eq_auxiliary_and_it_failures_have_complete_daily_quotes`, `security_admission_auxiliary_missing_or_wrong_identity_stays_a_conflict`, `security_admission_auxiliary_cannot_hide_disagreeing_regular_rows`, `security_admission_auxiliary_only_is_retained_without_fabricating_daily_prices`, `security_admission_market_selection_preserves_trade_for_trade_and_sme_primary`.

Implemented since this audit (2026-11-08, verified):

- **C1** `download_log` contract — a date that imported rows now persists real
  `rows_inserted`/`max_volume` with `status='partial'` when a subset was held
  back; zero-count `'error'` is reserved for genuine nothing-imported loss.
  Test: `download_log_distinguishes_held_back_subset_from_total_row_loss`.
- **C2** module header repointed to this plan. The referenced
  `docs/plans/2026-11-08_CA_SERIES_COLLISION_DESIGN.md` still does not exist;
  restoring it would mean writing new design content, so it stays open as a
  documentation item, not a code item.
- **P1.5** binary-mode coverage answered from the `eod_binary_state` sidecar
  (`binary_store_has_imported_rows_for_date`) instead of `download_log`; the
  log remains notes/status only.
- **P5/P4-prep tooling** `scripts/bhavcopy-source-verification.py` (`verify`,
  `residual-manifest` with own-identity verdict) and
  `scripts/eod-store-integrity-validator.py` (C3 checks), documented in
  `docs/BHAVCOPY_INTEGRITY_AND_VERIFICATION_TOOLS.md`.

Still open in code / tooling:

| ID | Item | Location |
|---|---|---|
| P1.6 | ~~`--plateau-merge-gap` default is 5~~ — **done 2026-11-08**: default 60 plus the `--plateau-merge-level` 0.25 guard | `scripts/eod-store-integrity-validator.py` |
| P1.7 | ~~Superseded manifests (`residual-2014-11.json`, `verify-2014-11.json`) unguarded~~ — **done 2026-11-08**: 4 files renamed `*.superseded.json`; both tools force the `-v1` suffix on `--out` | `tmp/fixtures/bhavcopy-series-repair/`, `scripts/*-verification.py`, `scripts/eod-store-integrity-validator.py` |
| P1.8 | `storage_mode_load_imported_trade_dates` / latest-date anchoring still start from `download_log` | `ingestion.rs` (`metadata_*` helpers) |
| C4 | Admission evidence keeps all input rows with no retention policy (TMP-01 interaction; ~18 MB per batch, ≈3 GB over the repair range) | `security_admission.rs` evidence writer |

---

## 5. Work items

### P0 — Preparation (no writes to source or DB)
- [ ] Backup: `scripts/create-project-backup.ps1 -ShortName bhavcopy-series-repair -Paths src-tauri-shell/src/bhavcopy/security_admission.rs,src-tauri-shell/src/bhavcopy/security_admission,src-tauri-shell/src/bhavcopy/ingestion.rs,src-tauri-shell/src/bhavcopy/mod.rs`
- [ ] Snapshot the database (approx. 713 MB `eod_data` + 257 MB sqlite): a dated copy of `EOD DATABASE/eod_data/NSE` (or the affected symbol files only) **plus** `market-data.sqlite3` and `eod_binary_state.sqlite`, stored outside `target/`; record SHA-256 of each artifact.
- [ ] Record the pre-repair manifest: SBIN 1,724 suspect dates, the 9 confirmed symbols, the 12 debt-only symbols, and the four coverage holes.

### P1 — Code fixes (small, focused)
- [x] **C1 log contract** — done (real counts + `partial`; zero-count `error` only for total loss).
- [x] **C2** — done by repointing the module header to this plan.
- [x] **C3 validator** — done (`scripts/eod-store-integrity-validator.py`), checks (a) duplicate dates, (b) index/file divergence, (c) `prev_close = 0`, (d) `prev_close` ≠ prior close, (e) single-price low-volume bars, (f) plateau+collapsed-volume windows.
- [x] Focused Rust tests — `security_admission` 20/20, log-contract 1/1, storage-mode 2/2, range-mode 1/1, `download_log` 5/5 (run via `scripts/Invoke-EOD-SharedCargo.ps1`).
- [x] **P1.6** `--plateau-merge-gap` default raised 5 → 60 **and** a `--plateau-merge-level` guard added (default 0.25) so fragments at different price levels are never bridged — NTPC merged a 13.10 segment with a 1,180 segment before the guard; SBIN still reports one 1,669-session era range.
- [x] **P1.7** superseded manifests quarantined and recurrence blocked: `verify-2014-11`, `residual-2014-11`, `integrity-sbin`, `integrity-sbin-repair-range` renamed to `*.superseded.json`, and both scripts now force the schema version into every `--out` name (a name without it is suffixed and reported on stderr).
- [ ] **P1.8** (after the repair) make the date-set prefilter and latest-date anchoring read the binary index so `Update`/`Resume` stops depending on `download_log` for 2018–2024.

### P2 — Source probe and dry-run manifest (no DB writes)
- [ ] Probe the app's NSE historical URLs for the repair ranges (2010-11 and 2005-2010 slices) through the app's own transport; record per-date availability. (Plain `curl -I` on `nsearchives` returns 503 for *all* dates including ones that worked, so it is not a usable probe.)
- [ ] Build a dry-run manifest per session: symbol → {`EQ` present, auxiliary present, non-equity present}; no writes.

### P3 — Repair by re-import (the main fix)
- [ ] Vehicle: Bhavcopy **Date Range** mode (Range never uses the imported-date prefilter), one exchange (NSE), `workers 2`.
- [ ] Order: `2017-01-01 → 2017-09-30` → `2016` → `2015` → `2014` → `2013` → `2012` → `2011` → `2010-11-01 → 2010-12-31` → `2010-01-01 → 2010-10-31` → `2009 → 2005` (chunked so a failure is contained; each chunk verified before the next).
- [ ] Each chunk must report `inserted/changed existing` counts, not just `ok`; archive the batch log lines as evidence.
- [ ] Write path expectation: overlapping dates take the `UPDATE_EXISTING` / `REWRITE_TAIL` path (immediately durable, `sync_data` per call). Confirm no `APPEND_NEWEST` deferral is applied to repair chunks.
- [ ] After each chunk: refresh/verify the binary index state (`VERIFIED`, generation bump) before the next chunk.

### P4 — Residual non-equity bars (explicit approval required)
For (symbol, date) pairs where the source has **no** equity row (debt-only symbols and auxiliary-only days) the re-import writes nothing and the stale non-equity bar survives. **Decided 2026-11-08: (A) delete, narrowed to `delete_candidate` pairs only** — the symbol's own `instruments.series` must be a regular equity series AND the source must have no equity row; `keep_non_equity_instrument` and `keep_unknown_identity` are never proposed (2014-11: 51 candidates — HUDCO 18, IRFC 18, IREDA 15 — against 187 keepers).
- [ ] Generate the per-batch dry-run manifest and review it before each deletion batch (execution approval is per batch, decision D8).
- [ ] Quote-only deletion (`delete_quote_date` / `delete_quote_range`), identity and series metadata preserved.
- [ ] No provenance-scoped cleanup via Manual Import Recovery; that path is for manual imports only.

### P5 — Verification (blocking)
- [ ] Source-anchored diff: for every (symbol, date) in the repaired ranges, the stored bar must equal the source `EQ` row (open/high/low/close/prev_close/volume/OI) within scale rounding.
- [ ] SBIN acceptance: all 1,724 previously-wrong bars now match source (1,670 debenture-substituted `2010-11-12 → 2017-09-20` + 54 block-print-substituted `2005-02-07 → 2009-02-27`); `1994-11-03…2026-11-05` still 7,878 records, one per date, ascending, `flags 0`, scale 10000; index row still `VERIFIED` and equal to the file.
- [ ] Hole-fill verification for the four coverage holes (see P6).
- [ ] Re-run the C3 validator across all NSE symbols; require zero leakage hits in the repaired ranges before sign-off.

### P6 — Adjacent data remediation (separate approvals)
- [ ] Re-download the four coverage holes: `2013-09-04 → 2013-10-04`, `2025-05-02 → 2025-05-30`, `2026-10-27 → 2026-10-30`, `1997-10-02 → 1997-10-08`, plus SBIN `1997-06-02`.
- [ ] Corporate actions: SBIN 2014-11-20 1:10 split (and any other pre-2006 splits/bonuses) through the accepted Fetch → Load & Validate → Approve workflow. Chart default here is `adjusted`, and with no CA row the split stays raw.
- [ ] `prev_close = 0` window: decide whether to leave it (read-path recompute covers charts) or repair the stored field during a rewrite pass.
- [ ] Holiday history: import/derive pre-2023 NSE holidays so historical ranges stop planning real holidays as trading days.

### P7 — Documentation and handoff
- [ ] Update `HANDOFF.md` (immediate resume point, affected paths, backups, checks, remaining acceptance) and `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md` (phases).
- [ ] Keep `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md` aligned with the admission gate + repair contract.
- [ ] Record the evidence locations and the TMP-01 retention decision for `bhavcopy_admission/*.json`.

---

## 6. Acceptance criteria

1. `security_admission` + log-contract focused tests pass; both storage modes covered.
2. Repair chunks complete with `errors 0`, and every repaired chunk's `changed existing` count is explained by the manifest.
3. SBIN: all 1,724 suspect bars now equal the source `EQ` row; no debenture (`N*`) or auxiliary (`BL/IL`) bar remains inside `2010-11-12 → 2017-09-20` except where explicitly approved under P4(B).
4. `PRAGMA quick_check ok`; index state `VERIFIED`; record count vs file length exact; no duplicate dates.
5. C3 validator reports zero leakage in repaired ranges; the four coverage holes either filled or explicitly deferred in writing.
6. No change to raw `.eod` immutability rules, the recovery journal, durability policy, or manual import recovery.

---

## 7. Risks / rollback

| Risk | Mitigation |
|---|---|
| Re-import writes through the *old* binary path and re-corrupts (if the gate is not actually effective) | P1 tests first; dry-run manifest; verify the first chunk (2017-09 slice) against source before proceeding |
| Irreversible binary overwrite | P0 snapshot + per-chunk verification; recovery journal is not a substitute for a snapshot |
| Source unavailability mid-run | chunked ranges; 2013-09 shows transport errors are real; resume from the last verified chunk |
| Repair scope creep (1,800 symbols × ~3,100 sessions) | fixed ranges, chunk order, explicit stop conditions |
| Deleting debt-only bars looks like data loss | decision under P4, with an explicit list and evidence |
| Evidence folder growth (18 MB/run) | TMP-01 decision in P7 |
| Portable rebuild required for users to benefit | the user rebuilds the portable Windows build manually after P1 |

Rollback: restore the P0 snapshot of the affected `.eod` files + `market-data.sqlite3` + `eod_binary_state.sqlite`; the snapshot is the only authoritative rollback (no reverse-journal exists for content).

---

## 8. Decisions (resolved 2026-11-08)

Status legend: **decided** = approved, no further sign-off needed; **open** =
still needs user action.

| ID | Decision | Status |
|---|---|---|
| D1 | Repair range `2005-01-01 → 2017-09-30` (3,120 NSE sessions), yearly chunks, canary `2017-01-01 → 2017-09-30` first; nothing before 2005 (earlier years are dominated by genuinely thin trading) | **decided** |
| D2 | Residual non-equity bars: **delete**, narrowed to `delete_candidate` pairs only — the symbol's own `instruments.series` is a regular equity series and the source has no equity row; `keep_non_equity_instrument` / `keep_unknown_identity` are never proposed; quote-only deletion; 2014-11 measured 51 candidates (HUDCO 18, IRFC 18, IREDA 15) vs 187 keepers | **decided**; per-batch execution approval is D8 |
| D3 | `prev_close = 0`: repair only inside rewrites the repair already performs; no global 8,036-file rewrite (charts recompute on read via `recompute_prev_close()`); the validator measures the residual window | **decided** |
| D4 | `download_log` 2018–2024: **not** rebuilt (no fabricated history); binary coverage derives from the store/sidecar instead (P1.5). Known residual: the bulk date-set and latest-date paths still read the log | **decided**; follow-up open (P1.8) |
| D5 | Coverage holes: fill `2013-09-04 → 2013-10-04` (23 sessions, log-recorded transport errors) and `2026-10-27 → 2026-10-30` (4 sessions) in this package; defer `2025-05-02 → 2025-05-30` (21) and `1997-10-02 → 1997-10-08` (+ SBIN `1997-06-02`) until the archive is proven fetchable | **decided** |
| D6 | Verifier partition: adopt `verified`(equity only) / `field_mismatches` / `residual_bars`, with residual = "no admitted equity row". The earlier 27,376 / 175 / 413 baseline is **withdrawn** (it counted matches against any admitted row as verified and hid 27 real substitutions). 2014-11 re-measured: 27,789 stored / 27,349 verified / 202 field / 238 residual / 440 total | **decided** |
| D7 | Validator plateau merge: default is now 60 (58–90 all yield the two-range SBIN shape) with a `--plateau-merge-level` 0.25 guard so fragments at different price levels are never bridged; `--plateau-merge-gap 0` returns raw fragments | **decided and implemented** (P1.6) |
| D8 | P4 execution: which `delete_candidate` pairs are actually deleted, batch by batch | **open** — after each batch's reviewed dry-run manifest |

Recorded facts from the 2026-11-08 review:

- All five original decisions were taken as recommended (full 2005–2017 range,
  delete-narrowed, opportunistic `prev_close`, no log rebuild, two holes now).
- Residual split for 2014-11 is **51 delete_candidate / 187
  keep_non_equity_instrument / 0 unknown**; the audit note's "IREDA 18 /
  IRFC 15" was transposed (store says IRFC 18, IREDA 15).
- SBIN damage total is **1,724 bars** (1,670 debenture + 54 block-print), not
  1,674.
- Four superseded manifests (`verify-2014-11`, `residual-2014-11`,
  `integrity-sbin`, `integrity-sbin-repair-range`) were quarantined as
  `*.superseded.json` on 2026-11-08 and the tools now force the schema version
  into `--out` names, so an unguarded manifest cannot recur (P1.7 done).

---

## 9. Prompt history (historical — do not re-run)

The prompt below was used for the **P1/P1.5/tooling implementation round**
and is kept only as a record of what was asked. It is **superseded**: P1,
P1.5, the C3 validator and the P5/P4-prep tools are implemented and
review-signed-off, so re-running it would duplicate work. The next
action is not a prompt — it is the user-operated repair sequence in
`docs/plans/2026-11-08_BHAVCOPY_REPAIR_RUNBOOK.md` (after P1.6/P1.7 and
the portable rebuild).

```
Project: E:\TA Projects\EOD Charting Platform
Read first (do not scan the repo):
  GETTING STARTED: AGENTS.md (project), E:\TA Projects\AGENTS.md, README.md
  THIS PLAN: docs/plans/2026-11-08_BHAVCOPY_SERIES_COLLISION_AUDIT_AND_REPAIR_PLAN.md
  CODE: src-tauri-shell/src/bhavcopy/security_admission.rs,
        src-tauri-shell/src/bhavcopy/security_admission/tests.rs,
        src-tauri-shell/src/bhavcopy/ingestion.rs (lines ~2060-2080, ~2350-2420, ~3220-3300),
        src-tauri-shell/src/database/binary_eod.rs (rewrite_from_first_incoming_record, upsert_single_record_by_date),
        src-tauri-shell/src/database/eod_data.rs (apply_corporate_adjustments, recompute_prev_close)

Task: implement Phase P1 (code fixes only) of that plan.
  C1: fix the download_log contract so a date that imported rows is never stored as rows_inserted=0 /
      max_volume=0 / status='error'; keep success=false only for genuine row loss.
  C2: restore docs/plans/2026-11-08_CA_SERIES_COLLISION_DESIGN.md or repoint the module header.
  C3: add the read-only non-equity-leakage / prev_close / duplicate-date validator (design only if the
      change grows beyond one module).
Do NOT: change the admission decision rules (EQ-preferred / auxiliary separation / conflict blocking),
        touch EOD DATABASE data, run any repair re-import, or change binary format, durability, or
        recovery-journal behaviour in this step.

Constraints:
  - Back up every file in scope with scripts/create-project-backup.ps1 before editing.
  - Focused Rust tests only, via scripts/Invoke-EOD-SharedCargo.ps1 -Mode Preview then -Mode Run (serial).
  - Report: files read, findings, files changed, intentionally unchanged, risks, validation PASS/FAIL, next step.
  - Do not rely on earlier chat history; the plan file is the source of truth.

Acceptance for this step: focused security_admission + log-contract tests pass; no data or DB write;
HANDOFF.md updated with the resume point.
```

---

## 10. Path reference

| Purpose | Path |
|---|---|
| Audit target DB | `EOD DATABASE/market-data.sqlite3`, `EOD DATABASE/eod_data/NSE/*.eod`, `EOD DATABASE/eod_binary_state.sqlite` |
| 2014-11 source snapshot | `New Database/bhavcopy_admission/security-1794124331333180200-56848-0.json` |
| Admission gate | `src-tauri-shell/src/bhavcopy/security_admission.rs` + `security_admission/tests.rs` |
| Key/upsert | `ingestion.rs:2361`, `binary_eod.rs::rewrite_from_first_incoming_record` |
| Success + log contract | `ingestion.rs:2069`, `ingestion.rs:3224-3290` |
| Read-time adjustment | `database/eod_data.rs::apply_corporate_adjustments`, `recompute_prev_close` |
| Backups | `scripts/create-project-backup.ps1` |
| Cargo wrapper | `scripts/Invoke-EOD-SharedCargo.ps1` |
