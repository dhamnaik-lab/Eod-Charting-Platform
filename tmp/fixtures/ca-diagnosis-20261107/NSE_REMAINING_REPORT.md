# Remaining NSE Corporate Actions diagnosis — 7 November 2026 (IST)

## Scope and evidence limits

Read-only input: `tmp/fixtures/ca-diagnosis-20261107/market-data.sqlite3`, SHA-256
`774555A7FE16A67963F1034974B66D8AE90394CE0ECE0D9AA1ED5594157FCDE7`.
Reproduce with `python tmp/fixtures/ca-diagnosis-20261107/diagnose_remaining.py`.
Exact rows, scans, identity histories and owners are retained in `remaining-evidence.json`.

The script opens the pinned main file with SQLite `mode=ro&immutable=1` and
`query_only=ON`. Existing WAL/SHM files are excluded because the supplied hash
pins only the main file. Main/WAL/SHM hashes were unchanged after inspection.
No live database, `.eod` file or referenced source file was opened. No approval
writer was invoked and no approval rule was changed.

There are **zero SQL price bars for every requested symbol** in this snapshot.
All prices below are **saved scan evidence**, not a fresh reconstruction of local
history. The current authoritative binary price windows cannot be certified from
this SQLite file alone. A copied, hash-pinned price window would be needed to
test adjacent sessions, scan freshness, or the cause of a missing ex-date.
Runtime feedback supplied for this task: blocked 140 (Split 33, Bonus 29, Other 78),
NSE Issues 77. The older diagnosis snapshot cannot certify those current counts.

## Task 3 — seven mismatch rows

Factors use `previous close / ex price`; expected factors are share multipliers.
Open/close jump percentages use `(ex price / previous close - 1) * 100`.
Two JMFINANCIL components are counted separately, giving seven import rows.

| Import / event | Saved previous session / close | Saved ex session / open / close | Expected factor | Actual factor open / close | Price jump open / close |
|---|---|---|---|---|---|
| SBIN #19888, Split 10→1, 2014-11-20 | 2014-11-19 / 10800 | 2014-11-20 / 11300 / 11300.78 | 10 | 0.955752 / 0.955686 | +4.63% / +4.64% |
| BRITANNIA #41783, Split 10→2, 2010-09-08 | 2010-09-07 / 2123.25 | 2010-09-08 / 175.95 / 174.25 | 5 | 12.067349 / 12.185079 | −91.71% / −91.79% |
| BRITANNIA #40789, Bonus 1:1, 2010-03-08 | 2010-03-05 / 1767.4 | 2010-03-08 / 1697.7 / 1640.1 | 2 stored; see non-equity wording below | 1.041056 / 1.077617 | −3.94% / −7.20% |
| JMFINANCIL #38511, Split 10→1, 2008-09-08 | 2008-09-05 / 1402.2 | 2008-09-08 / 66 / 67.35 | 10 component; **25 combined** | 21.245455 / 20.819599 | −95.29% / −95.20% |
| JMFINANCIL #46788, Bonus 3:2, 2008-09-08 | 2008-09-05 / 1402.2 | 2008-09-08 / 66 / 67.35 | 2.5 component; **25 combined** | 21.245455 / 20.819599 | −95.29% / −95.20% |
| AJANTPHARM #17442, Bonus 1:2, 2013-09-17 | 2013-09-03 / 876.2 | **2013-10-07** / 726.7 / 708.65 | 1.5 | 1.205725 / 1.236435 | −17.06% / −19.12% |
| NAVKARURB #10934, Split 2→1, 2025-05-09 | 2025-04-30 / 5.82 | **2025-06-02** / 2.29 / 2.53 | 2 | 2.541485 / 2.300395 | −60.65% / −56.53% |

- **SBIN:** the saved prices look continuous at the stated ex-date; the expected
  90% split drop is absent. Already-adjusted history is a hypothesis, not proven:
  wrong prices or a date mismatch could produce the same observation. No nearby
  sessions are available to distinguish these causes. Do not mark this Ready.
- **BRITANNIA split:** a large discontinuity exists, but its ratio is about 12.1,
  rather than 5. The saved ex-date equals the event date; there is no evidence
  here locating a correct nearby session or proving an alternative official ratio.
- **BRITANNIA bonus:** source purpose is exactly `Sch Of Agmt- Bonus Deb1:1`.
  This explicitly describes **bonus debentures**, so the stored equity-style
  factor 2 is not evidence that equity history needs a 50% price adjustment.
  The scan has no such drop. Do not classify this as proven already-adjusted
  equity history. No non-equity or approval rule is changed in this task.
- **JMFINANCIL:** expected combined multiplier is `10 × (1 + 3/2) = 25`.
  The scan messages already use the combined factor and identify both component
  IDs, although each stored `expected_factor` column remains the component value.
  Observed factors 21.25/20.82 differ from 25. This is a ratio/price discrepancy,
  not a no-jump pattern. Saved ex-date matches; adjacent-session diagnosis is unavailable.
- **AJANTPHARM:** the scan spans 2013-09-03 to 2013-10-07, skipping the
  2013-09-17 event. Its selected ex bar is 20 calendar days later. This is a
  missing-window/date-selection discrepancy, not proof that the official date
  is wrong. The exact session offset cannot be counted from this snapshot.
- **NAVKARURB:** the scan spans 2025-04-30 to 2025-06-02, skipping the
  2025-05-09 event. Its selected ex bar is 24 calendar days later. The observed
  2.54/2.30 factors cover a much wider window; neither a different official ratio
  nor a shifted official ex-date is established. Exact session offset is unavailable.

**Approval-rule decision:** no rule change, automatic approval, or already-adjusted
exception is implemented. This input does not prove that any row's authoritative
history was already adjusted, so no bypass rule is proposed for approval. First
obtain copied price-window/provenance evidence; continuity alone must not become
financial eligibility proof. Any subsequent proposal requires user approval.

## Task 4 — exact identity gates

These are static evaluations against the pinned snapshot and the inspected
`split_isin_price_proof::evaluate` source, using the exact active same-symbol
candidate. They are not live executions of the proof or fresh price checks.
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
  This is another continuous saved pair, not certified adjusted history. The
  identity link JSWSTL→JSWSTEEL is dated 2005-09-16 and carries today's ISIN;
  it supplies no exact 2017-01-04 historical raw-ISIN evidence.
- **PCBL:** no saved price window. Name changes dated 2022-01-13 and 2025-01-20
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
ownership. Later gates have not been independently certified. Explicit financial
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

Validation logs remain beside this report (`remaining-*.log`). Native acceptance,
current price-window freshness and runtime count changes remain unverified.
