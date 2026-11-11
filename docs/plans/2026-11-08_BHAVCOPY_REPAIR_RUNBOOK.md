# Bhavcopy Series-Collision Repair Runbook (user-operated)

- Date: 2026-11-08 (IST)
- Authority: `docs/plans/2026-11-08_BHAVCOPY_SERIES_COLLISION_AUDIT_AND_REPAIR_PLAN.md`
- Operator: the user, through the app's own Bhavcopy **Date Range** mode.
- The agent does NOT run the repair. This runbook is the user's procedure.
- Tooling reference: `docs/BHAVCOPY_INTEGRITY_AND_VERIFICATION_TOOLS.md`

## 0. Preconditions (all mandatory, in order)

1. **Portable rebuild.** The C1 log-contract fix, the store-based binary
   coverage prefilter (P1.5) and the admission gate must be in the running
   build. The user rebuilds the portable Windows build manually
   (`scripts/prepare-tauri-portable.ps1` workflow). Old binaries must not be
   used for the repair.
2. **P0 code backup** (already taken):
   `backups/pre_opencode_changes_20261109_000330_bhavcopy-series-repair/`
   (covers `security_admission.rs`, `security_admission/`, `ingestion.rs`,
   `mod.rs`, `tests.rs`, `HANDOFF.md`).
3. **P0 database snapshot.** With the app **closed**, copy to a location
   outside `target/` and outside `backups/`:
   - `EOD DATABASE/eod_data/NSE/` (whole folder, ~8,036 files)
   - `EOD DATABASE/market-data.sqlite3`
   - `EOD DATABASE/eod_binary_state.sqlite`
   Record SHA-256 of each artifact:
   ```powershell
   Get-ChildItem <snapshot folder> -Recurse -File | Get-FileHash -Algorithm SHA256 |
     Export-Csv <snapshot folder>\sha256.csv -NoTypeInformation
   ```
   The snapshot is the **only authoritative rollback**. The recovery journal is
   not a content rollback.
4. **Pre-repair manifest** (already recorded in the audit plan §2): SBIN
   1,724 suspect dates; the 9 confirmed 2014-11 symbols; the 12 debt-only
   symbols; the coverage holes. The integrity validator's SBIN baseline is at
   `tmp/fixtures/bhavcopy-series-repair/integrity-sbin-v1.json` (the older
   `integrity-sbin.superseded.json` is the pre-merge baseline only).
5. Confirm the admission gate is active in the running build: imports must
   show `Security admission: separated … kept … auxiliary-market rows …`
   messages, not the pre-fix `blocked M rows` wording.
6. **Superseded manifests — already quarantined, keep it that way.** On
   2026-11-08 the four pre-change manifests were renamed to
   `*.superseded.json`: `verify-2014-11`, `residual-2014-11`,
   `integrity-sbin`, `integrity-sbin-repair-range`. They keep the pre-change
   baseline but must never be used for a P4 decision or an acceptance count
   (the residual one has no own-identity `verdict`; the verify one reports the
   retired `mismatches: 413`). Authority is content-based: a manifest is
   actionable only if `schema` ends in `-v1` and every residual entry carries
   `verdict`. Both tools now enforce the suffix, so a command written as
   `--out …/verify-<chunk>.json` writes `verify-<chunk>-v1.json`
   (`docs/BHAVCOPY_INTEGRITY_AND_VERIFICATION_TOOLS.md` §3).

## 1. The repair runs (Date Range mode + the repair switch)

**Range mode does NOT re-import dates the store already covers.** The planning
prefilter (`bhavcopy/mod.rs`, "Prefiltered N already imported trading days")
skips them by design — that is gap-filling, and it is covered by
`test_range_mode_prefilters_already_imported_trading_days`. A repair needs the
explicit switch:

> **Tick `Re-download existing dates (repair)`** in the Bhavcopy window before
> starting a chunk. The checkbox is only enabled in **Date Range** mode; the
> backend now rejects the flag in Update/Full History (it would be a silent
> no-op there), and switching mode clears it. It sets `forceRedownload: true`, which plans every session
> in the range and replaces stored bars with the source rows. The batch log then
> starts with `[NSE] Repair re-download: existing coverage ignored for this
> range …`. Leave it unticked for normal downloads.

A repaired date reports `Replaced N existing records (repair re-import)` (not
`Already present; 0 new rows`), and `Download complete … imported rows: N`
counts replacements, so a login of `0` means nothing was written.

Settings for every run: **Exchange NSE only**, **Workers 2**, mode **Date
Range** (Range never uses the imported-date prefilter). Do not run BSE, do not
run NSE Index in these runs.

Run the chunks in exactly this order; **never start a chunk before the
previous chunk's checks pass**:

| # | Range | Note |
|---|---|---|
| 1 | 2017-01-01 → 2017-09-30 | **Canary.** Stop the whole repair if this chunk fails its checks. |
| 2 | 2016-01-01 → 2016-12-31 | |
| 3 | 2015-01-01 → 2015-12-31 | includes the 2014-11 confirmed window's tail |
| 4 | 2014-01-01 → 2014-12-31 | includes the confirmed 2014-11 snapshot window |
| 5 | 2013-01-01 → 2013-12-31 | 2013-09-04 → 2013-10-04 hole is inside this chunk (separate hole-fill decision, plan §8.5) |
| 6 | 2012-01-01 → 2012-12-31 | |
| 7 | 2011-01-01 → 2011-12-31 | |
| 8 | 2010-11-01 → 2010-12-31 | N-series listing starts 2010-11-12 |
| 9 | 2010-01-01 → 2010-10-31 | |
| 10–14 | 2009, 2008, 2007, 2006, 2005 (yearly) | block-print window 2005-02-07 → 2009-02-27 is covered |

Nothing before 2005-01-01 is in scope. 2025-05 and 1997 holes are deferred
(D5) and are not part of these runs.

Expected write path: overlapping dates take the immediately-durable
`UPDATE_EXISTING` / `REWRITE_TAIL` / `INSERT_HISTORICAL` paths; a repair chunk
must never run through the deferred `APPEND_NEWEST` checkpointing path. If the
app reports an `APPEND_NEWEST` write for a repair chunk, stop and investigate.

## 1b. After the identity repair (P1.10, applied 2026-11-09)

Six symbols (`HDFC`, `DHFL`, `IBULHSGFIN`, `IDFCBANK`, `SREINFRA`, `SRTRANSFIN`) had their `instruments`
row restored to `EQ` + the equity ISIN from NSE's own admitted bhavcopy row. Their stored bars are still
bond values until the affected range is imported again:

1. Rebuild the portable app (the evidence writer changed).
2. Re-run with the repair switch in 2-year chunks: `2010-11-01 → 2012-12-31`,
   `2013-01-01 → 2014-12-31`, `2015-01-01 → 2016-12-31`, `2017-01-01 → 2017-09-30`.
3. Expect those six symbols to report `Replaced … existing records` and to flip to equity-scale prices;
   the per-date `Security subset` should shrink to SGB/IRBINVIT/HCLTECH/unequal-row cases.

## 2. Checks after every chunk

After each chunk completes:

1. **Batch report.** The result must show `errors 0` and report
   inserted/changed-existing counts, not just "ok". Archive the batch log
   lines (evidence under `tmp/fixtures/bhavcopy-series-repair/logs/`).
   - `success=false` rows are acceptable only where the message starts with
     `Security subset:` and a `bhavcopy_admission/security-*.json` evidence
     file exists for that date (the gate held a genuine conflict back).
   - A plain transport error (`error sending request for url …`) means the
     source was unavailable: stop, and resume later from the last verified
     chunk. It must not be relabelled as a holiday.
2. **Binary index state.** `eod_binary_state.sqlite` rows for touched files
   must be `VERIFIED` with a generation bump; no file may end `DIRTY`.
3. **Source-anchored verification** for the chunk's range (the store is read;
   the evidence JSONs written by the chunk's own imports are the anchor):
   ```powershell
   python scripts/bhavcopy-source-verification.py verify --database "EOD DATABASE" `
     --exchange NSE --from <chunk-from> --to <chunk-to> `
     --evidence-dir "EOD DATABASE/bhavcopy_admission" `
     --out tmp/fixtures/bhavcopy-series-repair/verify-<chunk>-v1.json
   ```
   Pass criterion for the chunk: `field_mismatches == 0` **and**
   `anchor_coverage_ratio >= 0.9` (equivalently `verification_vacuous` is
   false). A manifest with a handful of anchored sessions and
   `field_mismatches: 0` proves nothing — the tool now prints
   `WARNING: verification is VACUOUS for this range …` in that case; the summary's `field_mismatches == 0`
   (open/high/low/close/volume/oi equality against the admitted anchor for
   every symbol with an admitted equity row). `residual_bars` are expected and
   acceptable until the P4 decision — they are pairs whose source has no
   regular/equity row (the residual-manifest set), not repair failures.
   `prev_close` mismatches are recorded but expected until the stored-field
   decision (plan §8 D3) is taken; `unverifiable_no_source_anchor` entries must
   be listed in the chunk log.
   Sanity invariants for every chunk manifest:
   `stored_symbol_dates == verified + field_mismatches + residual_bars +
   unverifiable_no_source_anchor`, and `residual_bars` equals the
   `residual-manifest` pair count for the same range and anchors. Do not
   regress to "stored matches any admitted row = verified": a bar matching its
   own admitted non-equity quote is a residual, never a verification
   (`docs/BHAVCOPY_INTEGRITY_AND_VERIFICATION_TOOLS.md` §2). Expected magnitude
   from the 2014-11 baseline: 238 residual pairs per 18-session batch, of which
   only 51 are `delete_candidate` (the other 187 are debt/fund instruments and
   must be kept).
   Known-damage spot check after chunk 1: SBIN closes in 2017-01..09 must be
   equity-scale values (~₹200-350), never five-digit debenture prices.
4. **Integrity spot check** (fast) on a few known-damaged symbols:
   ```powershell
   python scripts/eod-store-integrity-validator.py --database "EOD DATABASE" `
     --exchange NSE --symbol SBIN --from <chunk-from> --to <chunk-to> `
     --out tmp/fixtures/bhavcopy-series-repair/integrity-<chunk>-sbin-v1.json
   ```
   No leakage findings may appear inside the repaired range. The validator's
   defaults now merge fragments into era-level ranges (`--plateau-merge-gap 60`
   plus the `--plateau-merge-level 0.25` guard); pass `--plateau-merge-gap 0`
   when you need the raw fragments for one symbol.

### New failure mode to expect (S3, since 2026-11-09)

Per-row NSE equity date validation can now reject an archive with
`Mixed-date NSE archive: requested <date>, row for <symbol> contains <date>`.
That is a **HOLD, not a data problem**: it means the source archive mixed
sessions. Do not retry blindly; record the date and move to the next chunk.

## 3. Stop conditions

Stop the repair immediately and reassess if any of these occur:

- The canary chunk fails its §2 checks.
- Any chunk reports binary errors, `DIRTY` index rows, or a non-`VERIFIED`
  index after a completed chunk.
- `Security subset:` conflicts appear for dates/symbols that were clean in the
  audit manifest.
- The source becomes unavailable mid-run (resume later from the last verified
  chunk; do not skip ahead).

## 4. Rollback (from the P0 snapshot)

Only if a chunk is corrupted or verification fails irrecoverably:

1. Close the app (no writer processes on the database files).
2. Restore, from the P0 snapshot, into `EOD DATABASE\`:
   `eod_data/NSE/` (affected or whole folder), `market-data.sqlite3`,
   `eod_binary_state.sqlite`.
3. Verify restored SHA-256 values against `sha256.csv`.
4. Re-run the integrity validator on SBIN and confirm the pre-repair baseline
   matches before considering any retry.

Never "partially" roll back by editing stored bars by hand; the snapshot is
whole-artifact restore only.

## 5. After the repair runs

1. Full-range verification (2005-01-01 → 2017-09-30) with the `verify`
   subcommand; zero price/volume mismatches required for sign-off.
2. Full-NSE integrity scan; zero leakage findings inside the repaired range.
3. Residual non-equity bars: generate the dry-run manifest and review it with
   the user **before** any deletion decision — expect ≈51 `delete_candidate`
   pairs per 18-session batch and 187 `keep_non_equity_instrument` pairs, never
   one undifferentiated list. The manifest's own-identity
   verdict narrows the deletion rule (plan P4, revised): only
   `delete_candidate` pairs — bars under a symbol whose own `instruments.series`
   is a regular equity series — may be proposed for deletion;
   `keep_non_equity_instrument` pairs (the symbol itself is a debt/fund/other
   instrument) and `keep_unknown_identity` pairs (fail closed) must never be
   proposed. Deletion, if approved, is quote-only and is a separate approved
   step — not part of this runbook's runs.
4. Portable rebuild if further code changes were made during the repair.
5. Update `HANDOFF.md` with the completed chunks, evidence paths and the
   remaining P4/P6 decisions.
