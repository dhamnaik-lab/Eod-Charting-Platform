# Bhavcopy Integrity and Verification Tools

- Date: 2026-11-08 (IST)
- Status: current
- Authority: `docs/plans/2026-11-08_BHAVCOPY_SERIES_COLLISION_AUDIT_AND_REPAIR_PLAN.md`
- Related runbook: `docs/plans/2026-11-08_BHAVCOPY_REPAIR_RUNBOOK.md`

All three tools are **read-only** against the active database. They open SQLite
databases with URI `mode=ro`, open `.eod` files `'rb'`, and write only to the
project `tmp\` tree (any `--out` path outside `tmp\` is refused) or stdout.
They never modify `EOD DATABASE\` or `New Database\`.

Manifest schemas: the source-verification manifests carry
`"schema": "bhavcopy-source-verification-v1"`; the integrity report carries
`"schema": "eod-store-integrity-v1"`. Prices in all manifests are decimal
values (raw stored integer / scale); volume and open interest are unscaled
counts in the store and are emitted as integers; `scale` / `price_scale` is
explicit.

## 1. `scripts/eod-store-integrity-validator.py` (C3)

Store-only integrity scan, per exchange/symbol, over the binary `.eod` files
and the `eod_binary_state.sqlite` index:

| Check | Report key | Meaning |
|---|---|---|
| a | `duplicate_dates` | same trading date appears twice in one symbol file |
| b | `index_divergence` / `record_count_mismatch` / `trailing_bytes` | header/length/record-count/first/last-date disagrees with the index row or the file size |
| c | `prev_close_zero` | stored `prev_close = 0` (the first record of a file is expected and excluded) |
| d | `prev_close_mismatch` | stored `prev_close` != previous record's `close`, **excluding** bars whose stored `prev_close` is 0 — the two counts never double-count the same bar |
| e | `single_price_low_volume_bars` | `o=h=l=c` bars with volume below `--volume-ratio` (default 1%) of the symbol's median volume — auxiliary/block-print leakage candidates |
| f | `price_plateau_collapsed_volume_windows` | consecutive low-volume bars whose close stays within `--plateau-tolerance` (default 1%) for at least `--plateau-min-days` (default 5), merged into ranges across gaps of up to `--plateau-merge-gap` sessions (default 60) and only while consecutive fragments stay within `--plateau-merge-level` (default 0.25) of each other; the unmerged `fragments` list is kept as secondary detail — a worklist, not confirmed damage |

```powershell
# Single symbol, whole history (evidence baseline for the audit)
python scripts/eod-store-integrity-validator.py --database "EOD DATABASE" `
  --exchange NSE --symbol SBIN `
  --out tmp/fixtures/bhavcopy-series-repair/integrity-sbin-v1.json

# Whole exchange, restricted analysis range (post-repair sign-off)
python scripts/eod-store-integrity-validator.py --database "EOD DATABASE" `
  --exchange NSE --from 2005-01-01 --to 2017-09-30 `
  --out tmp/fixtures/bhavcopy-series-repair/integrity-repaired-range-v1.json
```

Interpretation rules:

- Checks (a)–(d) are exact structural facts. Check (c) is a known defect
  (2017-09-21 → 2026-05-27 window; charts repair it at read time via
  `recompute_prev_close()`), so zero counts are only expected *after* a
  deliberate stored-field repair, which is out of scope for the series repair.
- Checks (e)–(f) are heuristics. They are a **worklist, not confirmed damage**
  (audit plan §2.2). Genuinely illiquid early history produces hits; the
  reliable debt-leakage interval identified by the audit is 2010-11 → 2017-09.
- Plateau merging: inside a long debt takeover the collapsed-volume stretches
  are interrupted by ordinary-volume sessions (SBIN 2010-2017 has 36 gaps of
  6–58 sessions between fragments), so the default `--plateau-merge-gap 5`
  yields many medium ranges. Measured on SBIN (2026-11-08):

  | `--plateau-merge-gap` | windows | shape |
  |---|---|---|
  | 0 | 99 | raw fragments (5–29 sessions each) |
  | 5 | 38 | medium ranges |
  | 20 | 11 | coarse ranges |
  | 58 | 2 | one 1,669-session range `2010-11-15 → 2017-09-20` + the separate 1994-11 fragment |
  | 90 | 2 | same as 58 — stable |
  | **60 (default)** | **2** | era shape above |

  Any gap between 58 and 90 produces the same era-level shape, so the flag is
  not fragile; the default is 60, so a plain run already shows the era range.
  `--plateau-merge-gap 0` returns the raw fragments.

- Level guard (`--plateau-merge-level`, default 0.25). Fragments are only
  bridged while consecutive fragments stay within 25% of each other. Without
  the guard a long session gap could bridge unrelated plateaus: NTPC merged a
  13.10 segment with a 1,180 segment into one meaningless 2015-09 → 2016-07
  range. With the guard NTPC reports four coherent ranges while SBIN still
  reports one 1,669-session range `2010-11-15 → 2017-09-20`. If a merged
  range's `close_first` and `close_last` differ wildly, treat it as
  untrustworthy and re-run with a tighter `--plateau-merge-level`.
- Post-repair acceptance requires zero leakage-class findings inside the
  repaired ranges; findings outside the ranges are informational.

## 2. `scripts/bhavcopy-source-verification.py` (P5 verification harness)

Source-anchored comparison of stored bars against what the source actually
contained. Two subcommands, identical common options:

- `verify` — for every stored (symbol, date) bar in the range:
  1. no source anchor at all → `unverifiable_no_source_anchor`;
  2. no admitted **regular (equity)** source row → `residual_bars` (kind
     `stored_bar_without_admitted_source_row`). This is the same pair set the
     `residual-manifest` lists, so `residual_bars` in the `verify` summary must
     equal the residual-manifest pair count. A bar that matches the admitted
     quote of a fund/depositary instrument under the same symbol is still a
     residual here (it is not an equity bar); it is a P4 decision, not damage;
  3. otherwise the bar is compared with the admitted anchor row
     (open/high/low/close/prev_close/volume/oi after scale rounding):
     equal → `verified`; else `field_mismatch`.

  The summary separates the classes so the totals read correctly:
  `stored_symbol_dates`, `verified`, `field_mismatches`, `residual_bars`,
  `unverifiable_no_source_anchor`, `dates_with_source_anchor`,
  `total_findings` (= field mismatches + residual bars). Repair acceptance is
  `field_mismatches == 0`; `residual_bars` are expected until the P4 decision.

  Partition invariant (assert it whenever the schema is touched):
  `stored_symbol_dates == verified + field_mismatches + residual_bars +
  unverifiable_no_source_anchor`, and `verify.residual_bars` equals the
  `residual-manifest` pair count for the same range and anchors.

  **Do not regress to "stored matches any admitted row = verified".** A bar
  that matches its own admitted non-equity quote (fund/DR/debenture under the
  same symbol) is a `residual_bars` entry, not a verification: there is no
  equity row to verify, and a corrected re-import will not change it. That
  earlier reading reported 27,376 verified / 175 field mismatches / 413 total
  for 2014-11 and hid 27 real substitutions (IDFC 2, IPCALAB 1, STAR 1,
  YESBANK 1, MUKANDLTD 9, SREINFRA 13).
  When admission evidence covers the file the anchor is the gate's own
  admitted rows; otherwise it is the regular-series rows of the raw source
  CSVs given via `--csv-dir`.
- `residual-manifest` (P4-prep) — pairs where the store holds a bar but the
  source anchor proves there was **no regular/equity row** for that date:
  outputs symbol, date, stored OHLCV, the source rows (series/ISIN), the
  no-EQ-row proof, and an **own-identity verdict** read read-only from
  `instruments (exchange, symbol)`:
  - `delete_candidate` — the symbol's own `series` is a regular equity series
    (EQ, BE, BZ, SM, ST, SZ, SP, SL, SI, SO, SQ, BT, BL, BO, IL, IQ, TT, IT);
    the bar is leakage under an equity identity and may be proposed for the
    P4 deletion decision;
  - `keep_non_equity_instrument` — the symbol itself is a debt/fund/other
    instrument (N*, Y*, P*, D*, M*, DR, DE, MF, ME, GS/GB/GF/GT, TB, SG,
    IV/ID, RR/RT, …); the bar belongs to that instrument's own quote and must
    never be proposed for deletion;
  - `keep_unknown_identity` — no `instruments` row for the symbol; fails
    closed.

  The summary counts the three verdicts separately. This is the review list
  for the residual non-equity bar decision (plan P4, revised: delete only
  equity-identity bars). It performs **no deletion**.

```powershell
# Canary chunk verification (after the 2017-01-01..2017-09-30 Date Range run)
python scripts/bhavcopy-source-verification.py verify --database "EOD DATABASE" `
  --exchange NSE --from 2017-01-01 --to 2017-09-30 `
  --evidence-dir "EOD DATABASE/bhavcopy_admission" `
  --out tmp/fixtures/bhavcopy-series-repair/verify-canary-v1.json

# Residual dry-run manifest for user review (no writes, no deletions)
python scripts/bhavcopy-source-verification.py residual-manifest --database "EOD DATABASE" `
  --exchange NSE --from 2005-01-01 --to 2017-09-30 `
  --evidence-dir "EOD DATABASE/bhavcopy_admission" `
  --out tmp/fixtures/bhavcopy-series-repair/residual-dry-run-v1.json
```

Reading a `verify` manifest:

- `field_mismatch` entries list every differing field. `prev_close` mismatches
  are expected inside the known zero window until the stored field is repaired
  (decision deferred per plan §8.3); price/volume mismatches are the
  substitution damage the repair must clear.
- `unverifiable_no_source_anchor` means the tool found no evidence JSON and no
  source CSV for that date. Verification coverage is only as complete as the
  supplied anchors; add `--csv-dir` folders with raw source bhavcopy files to
  widen it. The tool never infers "verified" from absence of an anchor.

Validated against known damage (2014-11 snapshot, `New Database`
evidence), re-measured independently on 2026-11-08:

| metric | value |
|---|---|
| `stored_symbol_dates` | 27,789 |
| `verified` (stored == admitted equity row) | 27,349 |
| `field_mismatches` (equity admitted, stored differs) | 202 |
| `residual_bars` (no admitted equity row) | 238 |
| `unverifiable_no_source_anchor` | 0 |
| `dates_with_source_anchor` | 18 |
| `total_findings` | 440 |

Spot checks: SBIN 2014-11-05 stored close 11,198.83 / volume 205 vs source
`EQ` 2,781.90 / 2,660,510 (substitution); IDFC 2014-11-05 stored 157.00 /
932,800 (IL row) vs `EQ` 153.45 / 10,016,896 (substitution); STAN 2014-11-05
stored 88.70 / 75,199 == its admitted `DR` row (residual, not verified);
MUKANDLTD 2014-11-05 stored == `EQ` (verified).

The residual manifest carries the own-identity guard: in 2014-11 the 238
residual pairs split into 51 `delete_candidate` under equity identities
(HUDCO 18, IRFC 18, IREDA 15 — store-measured) and 187
`keep_non_equity_instrument` (N3/N4/N5/N6/N8/N9/NA/NC/NE/DR/MF-series
instruments such as BSLRGES1RG, NHBTF2014, NHAI, L&TFINANCE, IIFLFIN,
ECLFINANCE, IIHFL, RELIFIN), with 0 unknown. An earlier audit note listing
"IREDA 18 / IRFC 15" is transposed; the store is authoritative.

## 3. Artifact authority (manifests are acceptance evidence)

Manifests under `tmp/fixtures/bhavcopy-series-repair/` are read by humans and
agents before a deletion or sign-off decision, so authority is decided by the
**content**, never by the file name alone:

> A manifest is actionable only if its `schema` ends in `-v1` **and**, for a
> residual manifest, every entry carries a `verdict`. Anything else is
> superseded: read-only, never a deletion list, never an acceptance figure.

The version suffix is now enforced by the tools: if `--out` does not already
end in `-<schema version>` (currently `-v1`), both scripts append it and print
`--out does not carry the manifest schema version; writing <path>` to stderr.
A runbook command written as `--out …/verify-<chunk>.json` therefore writes
`verify-<chunk>-v1.json`; the containment rule (`tmp\` only) is applied to the
final, suffixed path.

Current state of this directory (2026-11-08 audit):

| artifact | status |
|---|---|
| `verify-2014-11-v1.json` | authoritative (27,349 verified / 202 field / 238 residual / 440 total) |
| `residual-2014-11-v1.json` | authoritative (51 `delete_candidate` / 187 `keep_non_equity_instrument` / 0 unknown) |
| `integrity-sbin-v1.json`, `integrity-sbin-merged-era-v1.json` | authoritative (`eod-store-integrity-v1`) |
| `verify-2014-11.superseded.json` | superseded — retired `mismatches: 413`, pre-partition |
| `residual-2014-11.superseded.json` | superseded — 238 pairs **without** the own-identity `verdict` |
| `integrity-sbin.superseded.json`, `integrity-sbin-repair-range.superseded.json` | superseded — pre-merge plateau fragmentation |

Superseded files are kept only as the pre-change baseline (the current scripts
cannot reproduce their shape). They must never be used for a P4 decision or an
acceptance count.

A manifest is also only valid for the exact `--database`, `--from/--to`,
`--evidence-dir` and tool schema that produced it; re-run instead of reusing a
manifest across ranges or after a tool change.

## 4. Evidence locations and retention

- Tool outputs belong in `tmp/fixtures/bhavcopy-series-repair/` (TMP-01:
  retained task evidence, not marked disposable scratch).
- Admission evidence JSONs (`security-*.json`) grow ~18 MB per affected batch;
  retention is a separate TMP-01 decision (plan P7), not decided here.
