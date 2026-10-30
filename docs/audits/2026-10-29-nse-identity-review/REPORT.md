# Read-only NSE identity audit — 29 October 2026

Recommendation: hold the current reviewed Apply proposal. Correct lifecycle coverage
and historical transition/no-op handling in bounded implementation phases first.
Healthy source transport/parsing does not certify the resulting identity plan.

## Method and authority

Resolved the current Documents profile registry to `EOD DATABASE`, then its manifest
to `market-data.sqlite3`. Queries used a SQLite URI with `mode=ro`,
`PRAGMA query_only=ON`, an explicit read transaction, and rollback/close. The recorded
connection `total_changes` is zero. Queries select record-level `exchange='NSE'`.

Inspected the currently saved equity, SME, symbol-change, company-name and delisted
sources. Input byte lengths, SHA-256 and modification times are in `evidence.json`.
The delisted sheet's Symbol column yields 459 symbols, matching the UI count.

The native historical preview executes `BEGIN IMMEDIATE` and temporary changes
before rollback. It was deliberately not invoked on the live database. Instead,
`historical_model.py` reconstructs its relevant identity validation/ordering logic
using Python objects. This is analytical reconstruction, not a native run, financial
approval certification, or permission to apply the plan.

## Reconciliation to the supplied preview

| Measure | Read-only reconstruction | Screenshot |
| --- | ---: | ---: |
| Supported current-master symbols | 3200 | 3200 |
| Existing exact-symbol matches | 3194 | 3194 |
| New symbols | 6 | 6 |
| Activations including inserts | 29 | 29 |
| Existing-row metadata updates | 259 | 259 |
| Unchanged active matches | 2912 | 2912 |
| Deactivations | 1052 | 1052 |
| Historical new symbol / name / combined rows | 16 / 19 / 16 | 16 / 19 / 16 |
| Historical duplicates / skipped / errors | 1325 / 1375 / 10 | 1325 / 1375 / 10 |

The 29 activations contain 23 existing inactive rows plus six inserts. Counts are
instrument/preview rows, not financial economic events. Current preview totals
reconcile as 29 + 259 + 1052 = 1340; the six new symbols are part of the 29, not
another six preview rows.

## P1 — The lifecycle plan compares different universes

The current master accepts EQ, BE, BZ, SM, ST and SZ. However,
`load_existing_nse_instrument_rows` selects every persisted NSE instrument, and
`plan_nse_current_universe_sync_from_rows` deactivates every active symbol absent
from that narrower master. The absence check does not establish that the source
can speak for the absent instrument's security category.

Of 1052 proposals, **990** have other series: 396 SG, 100 TB and 494 other-series
records. Their absence from the equity/SME masters is not evidence that they are
inactive. The other 62 have supported series: EQ 36, BE 17, ST 5, SM 1 and BZ 3.
Series alone is insufficient coverage evidence even within those 62.

The current code proposes **1051 UNKNOWN_INACTIVE** and **one OLD_SYMBOL**. None
of the proposed symbols is in the loaded delisted workbook. UNKNOWN_INACTIVE is
still a real deactivation: those rows are removed from normal active browsing.

Additional evidence within the 62:

- 27 have INF-prefixed ISINs. This is an identification clue, not a certified
  instrument classification or proof of inactivity.
- 17 have `-RE` / `-RE1`-style suffixes. This is a suffix heuristic, not proof that
  a rights entitlement expired or that it should be deleted/deactivated.
- Nine have a current-master symbol with the same full ISIN AND a direct dated
  old-to-new edge in the saved official symbol-change source. These are stronger
  rename-review candidates, not new approval authority by themselves.

| Stored symbol | Current source symbol | Official source effective date |
| --- | --- | --- |
| AMIRCHAND | AEROPLANE | 2026-07-20 |
| ASHIKA | ASHIKAG | 2026-07-27 |
| HEG | HEGAM | 2026-09-22 |
| ICICIPRULI | ICICILIFE | 2026-10-23 |
| KEL | VISDEM | 2026-08-06 |
| LYPSAGEMS | AURUS | 2026-07-14 |
| MANBRO | KDGREEN | 2026-09-03 |
| SANGINITA | AGASTYAEN | 2026-09-25 |
| SILLYMONKS | CRESTO | 2026-09-10 |

These are overlapping indicators, not mutually exclusive certified lifecycle groups.
All 1052 candidate records are retained in `deactivation-records.json`; the
62 supported-series rows are also listed in [the review table](SUPPORTED_CANDIDATES.md).

## P1 — Self-mapping is being treated as an old-symbol transition

AURIGROW is the only OLD_SYMBOL proposal. Its unique history target is AURIGROW
itself. `classify_nse_inactive_lifecycle` checks whether a mapping exists, without
requiring a different successor or verifying that successor is in the current
source. This does not prove an old-to-new ticker transition.

## All ten historical error rows

| Count | Affected preview rows | Cause |
| ---: | --- | --- |
| 1 | BOTH SGBNOV23, 2016-09-15 | Persisted GBNOV23 → SBNOV23 → SGBNOV23 has the same effective date on both edges; chart history requires strictly increasing dates. |
| 4 | SYMBOL_CHANGE INTERISE (2024-11-12), QUALITY30 (2025-07-21), VERTIS (2025-07-22), 805NMC29 (2026-03-09) | Official symbol-change rows repeat the same old/new symbol; rename validation correctly rejects them. |
| 4 | BOTH LANDSMILL (2026-04-02), BOTH HEALTHX (2026-04-30), NAME_CHANGE LANDSMILL (2015-05-05), NAME_CHANGE HEALTHX (2016-11-22) | Equivalent predecessor transitions split across BOTH and SYMBOL_CHANGE are counted as competing chart edges. |
| 1 | NAME_CHANGE WSTCSTPAPR, 2016-11-22 | The source repeats exactly the same old/new company name. |

Nine unchanged-symbol rows exist in the raw source, but only four are admitted by
this database/source inclusion set. The five excluded rows are not additional
errors in the ten-row preview. INTERISE/VERTIS paired name rows have already been
consumed by earlier symbol changes, so their repeated-symbol rows are SYMBOL_CHANGE
in the actual reconstruction, not BOTH.

### SGB ordering

Persisted row 451 represents GBNOV23 → SBNOV23 and row 452 represents
SBNOV23 → SGBNOV23, both dated 2016-09-15. Other raw records repeat the first
transition. The grouped chart path still has two same-day successive edges. Do not
invent dates, add a day, delete historical evidence, or weaken the date guard to
make this pass. A reviewed, reusable same-day-alias policy is required, or the
case must remain explicitly held outside an eligible plan.

### Four logical-duplicate predecessor failures

Persisted row 401 is BOTH EXCELINFO → EXCEL (2015-05-05); persisted row 455 is
BOTH MICROSEC → SASTASUNDR (2016-11-22). Processing the historical source proposes
another SYMBOL_CHANGE representation of each transition. The duplicate test also
compares change type and company-name fields, so it misses those representations.
The chart query groups by `change_type`, sees two predecessor groups and refuses
the later LANDSMILL/HEALTHX operations. This is a distinction between event
representation and actual ticker-edge ambiguity, not evidence to choose an
arbitrary predecessor. All four rows and the competing representations are recorded
in `historical_logical_reconstruction.errors` inside `evidence.json`.

## Recommended bounded remediation

1. **Lifecycle coverage first.** Keep source coverage distinct from ingestion-series
   support. A current equity/SME master must not deactivate uncovered security
   categories. Keep unknown absences for review unless explicit, applicable lifecycle
   evidence supports a transition. Preserve broad EQ/BE/BZ/SM/ST/SZ ingestion.
   Require a non-self, validated successor for OLD_SYMBOL. Do not automatically
   promote the nine rename candidates based solely on matching ISIN.
2. **Historical no-op dispositions.** Preserve raw source rows. Recognize unchanged
   symbol/name events as explicit no-op/unsupported dispositions; distinguish them
   from genuine name-only changes and invalid data. Do not silently discard errors
   or turn self-renames into approved history.
3. **Shared transition identity.** Reconcile equivalent ticker edges across
   SYMBOL_CHANGE/BOTH while retaining name-change evidence and detecting genuinely
   conflicting predecessors. Preserve reviewed fingerprints, rollback behavior,
   source authority and financial approval boundaries.
4. **Same-day chronology separately.** Keep SGB held until a reviewed temporal
   representation is designed. Do not make company-specific patches.
5. Verify the changes on a guarded copy, then obtain a fresh in-app preview and
   deliberate review. Saved audit artifacts never authorize Apply.

## Limits and preservation

No runtime source edits, live write transactions, imports, repairs, source downloads,
tests, release builds, identity Apply or financial approvals occurred. Only the
new audit files under `docs/` were written. No backup of user data was required or
created because the database was opened read-only; no source edits were made.

The Python model is explanatory evidence. It reproduces every visible historical
counter, but it is not a replacement for focused native acceptance after a fix.
No decision was made that any of the 1052 rows should actually be deactivated.
No new financial readiness or event-date price-routing conclusion is claimed.
Current sources were read locally; no web search was needed to demonstrate these
code/data mismatches. Query and source provenance remain inspectable in `audit.py`,
`historical_model.py`, `queries.json` and `evidence.json`.
