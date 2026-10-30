# AMIRCHAND identity investigation

29 October 2026. Read-only investigation of `EOD DATABASE`, its saved NSE sources,
the current identity/chart read paths, and the official NSE circular.

## Finding

**AMIRCHAND became AEROPLANE on 20 July 2026.** NSE circular
[NSE/CML/75196, issued 14 July 2026](https://nsearchives.nseindia.com/content/circulars/CML75196.pdf)
specifies the old/new symbol and effective date. The official PDF was opened and
its single page inspected through the web tool in this investigation.

The saved symbol-change CSV already contains the exact transition. The saved
current equity master contains AEROPLANE, company Amir Chand Jagdish Kumar
(Exports) Limited, ISIN `INE05TO01019`. AMIRCHAND is absent from that master.

The database contains active CURRENT instrument rows for both symbols with that
same ISIN, but **zero matching persisted identity-history rows**. Current-universe
classification only builds dated transition edges from `instrument_identity_history`.
It does not consume the saved symbol-change CSV directly. Consequently the required
transition is unavailable to that classifier, so AMIRCHAND falls into REVIEW_REQUIRED.

The current source provides the missing evidence; the gap is between saved official
history and the persisted identity history used by the current-universe flow.

## Why the chart continues under the old label

The chart resolver in `src-tauri-shell/src/database/eod_data.rs` adds same-ISIN NSE
instruments to `related_symbols`. With no persisted alias/transition, it retains the
requested symbol as `current_symbol`. The unified reader loads both files and can
select a related symbol's record when the requested symbol has no record for a date.
This accounts for a continuous chart carrying the AMIRCHAND title.

| Raw file | Records | First date | Last date | Records from 20 July onward |
|---|---:|---|---|---:|
| AMIRCHAND.eod | 72 | 2 Apr 2026 | 17 Jul 2026 | 0 |
| AEROPLANE.eod | 68 | 20 Jul 2026 | 26 Oct 2026 | 68 |

The files have no overlapping dates. AEROPLANE's last raw close is **206.15**, which
matches the supplied chart's latest displayed close. The file split agrees with the
official effective date. There is no evidence here requiring a rewrite of raw prices.

Limit: the screenshot footer says **148 bars**, whereas this read-only snapshot has
**140 distinct raw dates** across the two files and no SQLite price rows for either
symbol. The eight-bar discrepancy is not reconciled by this investigation. A fresh
native reload/cache/display check is needed before claiming full chart reconciliation;
no cache invalidation or application state change was performed.

## Scope beyond this case

Fresh read-only matching finds **62 active covered-series symbols absent from the
saved current masters**. Nine have a direct saved-official transition to a symbol
present in the current master:

| Old symbol | Current-master target | Effective date in saved official CSV |
|---|---|---|
| AMIRCHAND | AEROPLANE | 20 Jul 2026 |
| ASHIKA | ASHIKAG | 27 Jul 2026 |
| KEL | VISDEM | 6 Aug 2026 |
| LYPSAGEMS | AURUS | 14 Jul 2026 |
| SILLYMONKS | CRESTO | 10 Sep 2026 |
| MANBRO | KDGREEN | 3 Sep 2026 |
| HEG | HEGAM | 22 Sep 2026 |
| ICICIPRULI | ICICILIFE | 23 Oct 2026 |
| SANGINITA | AGASTYAEN | 25 Sep 2026 |

Eight pairs match the same full ISIN in the local current master. KEL -> VISDEM
has a different current-master ISIN and needs additional temporal identity review.
ISIN equality is corroboration, not independent dated-transition authority. Only AMIRCHAND's
separate NSE circular was researched in this pass. The other eight remain source
backed candidates for the generic identity review, not applied or approved mappings.
The remaining 53 need further categorization/evidence. Do not deactivate them from
absence alone or treat all 62 as resolved.

## Recommended next implementation phase

1. Repair the generic Historical identity import's already identified no-op,
   equivalent-transition duplicate and same-date chronology cases. Its current
   code prevents application when historical preview errors exist. This pass did
   not rerun historical preview or reproduce its current error count on the live DB.
2. Produce a reviewed, source-fingerprinted, dated identity plan and persist accepted
   transitions through the existing explicit Apply transaction. Do not insert one
   AMIRCHAND-specific mapping manually or weaken chronology checks.
3. Re-preview current universe. With the reviewed edge persisted, its existing
   classifier can recognize AMIRCHAND as OLD_SYMBOL and retain AEROPLANE as current.
   Verify that old-symbol navigation resolves to the current label while displaying
   pre/post-transition prices from their original raw files.
4. Verify native chart reload and the 148-versus-140 count discrepancy separately.
   Preserve event-date identity requirements for financial Corporate Actions.

## Evidence and limits

- [audit.py](audit.py) resolves the profile registry and database manifest, uses
  SQLite URI mode=ro, query_only=ON and an explicit transaction, and reads only the
  relevant identity/reference/price data. [evidence.json](evidence.json) contains
  exact queried rows, source/file hashes and counts. `total_changes=0`.
- PASS: read-only identity/source comparison and binary record/date examination.
- PASS: official NSE circular verification. Web CSV viewing was unsupported by the
  web tool; the already-saved local CSVs were inspected instead and were not refreshed.
- Runtime source inspection only: `nse_identity_imports.rs` functions
  `load_identity_history_hints`, `validated_current_successor`,
  `classify_nse_inactive_lifecycle`; `eod_data.rs` functions
  `resolve_instrument_context`, `load_unified_price_rows_with_mode`,
  `select_preferred_price_row`.
- NOT TESTED: native resolver call, native historical preview/apply, chart cache
  behavior, corrected persisted mapping or financial approval eligibility.
- No runtime edits, builds, source imports, identity applies, financial approvals,
  raw-data changes, commits or pushes occurred. Only investigation documents and
  the related HANDOFF checkpoint were written. Existing unrelated work was preserved.

Control-file backup:
`backups/pre_opencode_changes_20261029_183404_amirchand_investigation_notes`.
