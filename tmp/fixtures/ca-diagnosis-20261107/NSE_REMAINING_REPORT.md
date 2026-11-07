# Remaining NSE Corporate Actions diagnosis — 7 November 2026 (IST)

## Scope and evidence limits

Read-only input: `tmp/fixtures/ca-diagnosis-20261107/market-data.sqlite3`, SHA-256
`774555A7FE16A67963F1034974B66D8AE90394CE0ECE0D9AA1ED5594157FCDE7`.
Reproduce SQLite diagnosis with `python tmp/fixtures/ca-diagnosis-20261107/diagnose_remaining.py`
and copied-price diagnosis with `python tmp/fixtures/ca-diagnosis-20261107/diagnose_eod_windows.py`.
Exact SQLite evidence remains in `remaining-evidence.json`; fresh copied binary
windows and neighboring bars are in `remaining-eod-evidence.json`.

The SQLite scripts open the pinned main file with `mode=ro&immutable=1` and
`query_only=ON`; unpinned WAL/SHM content is excluded. No live SQLite database
was opened. At the user's explicit follow-up instruction, the seven named live
`.eod` files were read only for hashing/copying while EOD Chart was closed.
Their source and destination hashes matched. All subsequent diagnosis reads
only `eod_data/NSE/` under this fixture. `EOD_COPY_SHA256.json` pins the seven
copies. Source prices and approval rules were not changed; no writer was invoked.

There are zero SQL price bars for these symbols in the pinned SQLite snapshot,
but copied binary bars are now available. All seven files pass EOD1 magic,
version, record-size, exact file-length, symbol/exchange, scale and strictly
increasing date checks, using the layout in `binary_eod.rs`. SQLite and copied
price hashes remain unchanged after analysis. All available selected binary
windows reproduce their saved scans exactly, including both JMFINANCIL components.
PCBL confirms the saved absence of a pre-event window. This verifies the copied
prices; adjustment provenance and missing trading sessions require separate evidence.
Runtime feedback supplied for this task: blocked 140 (Split 33, Bonus 29, Other 78),
NSE Issues 77. The older diagnosis snapshot cannot certify those current counts.

## Task 3 — seven mismatch rows

Factors use `previous close / ex price`; expected factors are share multipliers.
Open/close jump percentages use `(ex price / previous close - 1) * 100`.
Two JMFINANCIL components are counted separately, giving seven import rows.

| Import / event | Copied previous session / close | Copied selected ex session / open / close | Expected factor | Actual factor open / close | Price jump open / close |
|---|---|---|---|---|---|
| SBIN #19888, Split 10→1, 2014-11-20 | 2014-11-19 / 10800 | 2014-11-20 / 11300 / 11300.78 | 10 | 0.955752 / 0.955686 | +4.63% / +4.64% |
| BRITANNIA #41783, Split 10→2, 2010-09-08 | 2010-09-07 / 2123.25 | 2010-09-08 / 175.95 / 174.25 | 5 | 12.067349 / 12.185079 | −91.71% / −91.79% |
| BRITANNIA #40789, Bonus 1:1, 2010-03-08 | 2010-03-05 / 1767.4 | 2010-03-08 / 1697.7 / 1640.1 | 2 stored; see non-equity wording below | 1.041056 / 1.077617 | −3.94% / −7.20% |
| JMFINANCIL #38511, Split 10→1, 2008-09-08 | 2008-09-05 / 1402.2 | 2008-09-08 / 66 / 67.35 | 10 component; **25 combined** | 21.245455 / 20.819599 | −95.29% / −95.20% |
| JMFINANCIL #46788, Bonus 3:2, 2008-09-08 | 2008-09-05 / 1402.2 | 2008-09-08 / 66 / 67.35 | 2.5 component; **25 combined** | 21.245455 / 20.819599 | −95.29% / −95.20% |
| AJANTPHARM #17442, Bonus 1:2, 2013-09-17 | 2013-09-03 / 876.2 | **2013-10-07** / 726.7 / 708.65 | 1.5 | 1.205725 / 1.236435 | −17.06% / −19.12% |
| NAVKARURB #10934, Split 2→1, 2025-05-09 | 2025-04-30 / 5.82 | **2025-06-02** / 2.29 / 2.53 | 2 | 2.541485 / 2.300395 | −60.65% / −56.53% |

- **SBIN:** the copied series has **no 10x ex-date jump**. Both the previous
  and exact ex-date bars exist, and the saved scan agrees exactly. Across 20 stored
  records before/after (2014-10-20 through 2014-12-18), closes range from 10500 to
  11531.85; no adjacent pair matches factor 10 within the existing 15% tolerance.
  It looks continuous (already-adjusted-looking), but continuity does not establish
  the origin or correctness of those prices. There is no stored corporate action
  on that date in the pinned SQLite snapshot. No off-by-one-session explanation
  appears in the inspected neighborhood; no provenance proving prior adjustment exists here.
- **BRITANNIA split:** the factor discrepancy is reproduced from the copied raw
  file, but the nearby history repeatedly switches price levels. On 2010-09-02,
  close is 2053.25; 09-03 is 173.50; 09-06 is 173.68; 09-07 is 2123.25;
  09-08 is 174.25. The 09-08 record's own `prev_close` field is **173.68**,
  inconsistent with the immediately preceding stored close **2123.25**.
  Similar roughly 12x down-and-back transitions appear on 08-16/17 and 09-02/03.
  On 09-24 the level switches to 428.70, then back to 174.84 on 09-27.
  This is mixed-level/internally inconsistent history, not a clean alternate
  split ratio or defensible one-session date correction. Cause remains unproven.
  No nearby adjacent pair matches factor 5 within the existing tolerance.
- **BRITANNIA bonus:** source purpose is exactly `Sch Of Agmt- Bonus Deb1:1`.
  This explicitly describes **bonus debentures**. The stored equity-style factor
  2 does not establish that equity prices require a 50% adjustment. The copied
  event pair has no such drop and exactly matches the saved scan. Do not classify
  this as proven already-adjusted equity history or change the official date.
- **JMFINANCIL:** the copied file confirms the exact event date and the combined
  multiplier `10 × (1 + 3/2) = 25`. Both component scans agree with the copies.
  Actual factors are 21.245455/20.819599; the best confidence is
  **0.8498181818**, just below the unchanged **0.85** MATCHED threshold.
  The open factor would need to be at least **21.25**. At previous close 1402.20,
  that means ex open at most **65.98588235**; actual open is **66.00**.
  This is a narrow threshold miss (about 0.01412 in open price), not an absent
  jump or evidence of a different official ratio. Do not round the factor to
  pass or loosen the threshold. No matching alternate pair occurs within the
  inspected 20 stored records before/after.
- **AJANTPHARM:** the copied file has **no 2013-09-17 bar**. Its adjacent stored
  bars are 2013-09-03 and 2013-10-07, a **34-calendar-day gap**; the selected ex
  bar is **20 calendar days after** the official date. All five copied symbols
  whose histories already covered 2013 also lack every bar from 2013-09-04
  through 2013-10-04. This is a shared historical coverage gap, not evidence
  that the official date should move by a session. Exact missing trading-session
  counts cannot be inferred from these jointly incomplete files alone.
- **NAVKARURB:** the copy has **no 2025-05-09 bar** and **no May 2025 bars**.
  The selected pair is 2025-04-30 to 2025-06-02, a **33-calendar-day gap**;
  the selected ex bar is **24 calendar days late**. All seven copied files lack
  all May 2025 bars despite having later data. Thus 2.541485/2.300395 are ratios
  across a missing month, not reliable ex-session split evidence. Do not infer
  a new official date or ratio. Exact session offsets require calendar/source evidence.

**Approval-rule decision:** no rule change, automatic approval, or already-adjusted
exception is implemented. The copied SBIN and JSWSTEEL histories establish no
ex-date split jump and no nearby matching split-sized jump; they do **not** prove
that a verified upstream adjustment already occurred. Neither has an event-date
stored corporate action in the SQLite snapshot. Inconsistent levels elsewhere
also caution against inferring adjustment provenance from continuity alone.
No approval bypass is proposed on that evidence. Keep both blocked until source
provenance/official comparison distinguishes prior adjustment from wrong or mixed
history. Any subsequent safe-rule proposal requires explicit user approval.

## Task 4 — exact identity gates

These are static evaluations against the pinned SQLite snapshot and the inspected
`split_isin_price_proof::evaluate` source, using the exact active same-symbol
candidate. They are not live executions of the proof. The supplied JSWSTEEL and
PCBL price copies now corroborate their saved price status; CGCL/AVANTIFEED
price files were not included and their earlier owner rejection is unchanged.
All four pass its initial status/type/parse/active/symbol/exchange/equity-split
preconditions and the `same_equity_issuer` comparison (first nine characters,
security code `01`, distinct 12-character ISINs).

| Event / imports | Raw ISIN → current NSE ISIN | First failing `evaluate` check | Owners involved |
|---|---|---|---|
| JSWSTEEL 2017-01-04 #23962 | INE019A01020 → INE019A01038 | `validation.scan_status != "MATCHED"`: latest scan is `REVIEW` | Current JSWSTEEL owns INE019A01038. No current/historical owner of raw INE019A01020 exists in the snapshot. |
| PCBL 2018-04-19 #26195 | INE602A01023 → INE602A01031 | `validation.scan_status != "MATCHED"`: latest scan is `NO_PRICE_DATA` | Current PCBL owns INE602A01031. No current/historical owner of raw INE602A01023 exists. |
| CGCL 2016-11-23 #23903 | INE180C01018 → INE180C01042 | `if other_owner { return Ok(false); }`, before price checks | Raw INE180C01018 belongs to inactive NSE:MMFSL in both `instruments` and `instrument_isin_history`; current CGCL owns INE180C01042. |
| AVANTIFEED 2018-06-26 #26322 Bonus and #44293 Split | INE871C01012 → INE871C01038 | `if other_owner { return Ok(false); }`, before price checks | Raw INE871C01012 belongs to inactive NSE:AVANTI in both owner tables. AVANTIFEED also has an old historical entry, dated 2015-11-26; current AVANTIFEED owns INE871C01038. |

- **JSWSTEEL price detail:** saved previous close 8 (2017-01-03), ex open/close
  7.95/7.95 (2017-01-04); actual factors 1.006289/1.006289 versus 10 expected.
  The copied pair matches this exactly. Across 20 stored records before/after
  (2016-12-07 through 2017-02-02), closes stay between 7.85 and 8.10, with no
  nearby factor-10 match. This is continuous history, not certified adjustment
  provenance. No event-date corporate action is stored in the pinned SQLite
  snapshot. The
  identity link JSWSTL→JSWSTEEL is dated 2005-09-16 and carries today's ISIN;
  it supplies no exact 2017-01-04 historical raw-ISIN evidence.
- **PCBL:** no saved price window; the copied file starts **2022-01-13**,
  almost four years after the 2018 event, confirming missing historical coverage. Name changes dated 2022-01-13 and 2025-01-20
  carry INE602A01031; PCBL's recorded ISIN history is also INE602A01031 dated
  2022-04-11. None satisfies `has_instrument_isin_history_evidence` for raw
  INE602A01023 on **2018-04-19**. A shared issuer cannot replace this proof.
- **CGCL:** a stored MMFSL→CGCL identity transition dated 2013-08-05 carries
  INE180C01042, but it does not override the global raw-ISIN owner exclusion.
  MMFSL has exact raw-ISIN history dated 2016-07-14 and 2018-07-19 (among other
  dates), not the event date. Latest price scan is `MATCHED` (278.5→54.55/58.45),
  but is never reached by this proof because the owner check fails first.
- **AVANTIFEED:** there is no `instrument_identity_history` link involving
  AVANTIFEED in this snapshot. AVANTI has **event-date** historical raw-ISIN
  evidence on 2018-06-26; AVANTIFEED's raw-ISIN evidence is only 2015-11-26.
  Thus AVANTIFEED fails the exact-date historical evidence test, and ownership
  cannot be silently transferred from AVANTI. Both saved price scans are
  `MATCHED` for combined factor **3** (1563.35→538/599.3), but neither bypasses
  the earlier owner rejection.

For JSWSTEEL/PCBL, `is_split_bonus_validation_current` and the final
`ensure_scan_uses_current_price_window` are short-circuited after scan-status
failure. For CGCL/AVANTIFEED, even scan-status testing is short-circuited by
ownership. Copied JSWSTEEL/PCBL availability is corroborated, but later proof gates have
not been executed or independently certified for all rows. Explicit financial
approval, backend rechecks, raw-file immutability and advanced maintenance remain intact.

## Delivery and verification

Source branch: `feat/ca-nse-remaining-20261107`, from `1a3a293` on the
unmerged later-reason branch. Fetched main was `44bbf21`; main was not switched
or pulled. Tasks 1–2 touch only the parser and informational-closure modules,
with two new Rust tests (including generated spelling combinations, financial
negatives, ordinals, missing cash, financial fields and raw-purpose preservation).
No release/portable output was generated. A portable rebuild is needed.

- Renderer typecheck: PASS.
- `npx.cmd vitest run --dir src src/features/corporateActions`: PASS, 562 tests,
  72 files; no ` tmp/` collection.
- Focused Rust: PASS 6/6, after restoring the existing dangling-slash negative.
- First seven-filter Rust: FAIL, 817 passed / 1 failed / 26 ignored (`AGM/`).
- Corrected seven-filter Rust: PASS, 818 passed / 0 failed / 26 ignored;
  baseline 816 plus two new tests. Filters: `corporate_action`,
  `instrument_mutations`, `eod_data`, `bse_identity`, `nse_identity`,
  `identity_evidence_resolver`, `price_store_operation_lock`; `--jobs 2`.
- Shared-Cargo Preview: PASS before each Run; shared root `target` only.
- Docs profile, scoped whitespace and CRLF checks: PASS.

Validation logs remain beside this report (`remaining-*.log`). Native acceptance and runtime count changes remain unverified. The follow-up
copies independently reproduce all available saved windows; no live financial
eligibility or adjustment provenance is certified.

## Copy follow-up verification

- User-supplied PowerShell copy/hash block: **PASS**, 7/7 files, none missing.
- Closed-app precondition: **PASS** (`EOD Chart` process absent).
- Read-only binary diagnosis: **PASS**, 7/7 format/hash checks, strictly ordered
  dates, and copied-window comparison; no database or copied-price modification.
- Backup: `backups/pre_opencode_changes_20261107_171614_ca-nse-price-copy`.
- Only evidence scripts/reports and immediate status documents changed in this
  follow-up. Runtime source and approval rules are unchanged; runtime test suites
  are not repeated for evidence-only work. Documentation references, scoped
  whitespace and CRLF checks: **PASS** (`remaining-eod-docs.log`).
