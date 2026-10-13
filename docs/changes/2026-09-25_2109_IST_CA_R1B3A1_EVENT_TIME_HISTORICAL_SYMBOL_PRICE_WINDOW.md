# CA R1-B3A1 — Strict Event-Time Historical-Symbol Price-Window Fallback

IST timestamp: 2026-09-25T21:09:48.353065+05:30

## Objective
Add the smallest strict fallback that lets Corporate Action price validation use a uniquely proven historical symbol when the current/resolved symbol has no complete local price window for the event date.

## Previous defect / limitation
The current `load_trade_window()` tried only the resolved/current symbol: Binary EOD first, then same-symbol SQLite. Import 3494 SONAMLTD therefore reported `NO_PRICE_DATA` for the 2022-07-14 BONUS even though the verified pre-transition symbol SONAMCLOCK has the complete local Binary EOD window.

## Files changed
- `src-tauri-shell/src/database/corporate_action_imports.rs`
- this change record only

## Final implementation
Current-symbol Binary EOD and same-symbol SQLite remain first authority. Only if both are unavailable, a private read-only helper walks backwards through `instrument_identity_history` using strict transition chronology. A predecessor step qualifies only when the transition is strictly after the Corporate Action ex-date, belongs to the same current lineage, is a symbol-changing `SYMBOL_CHANGE`/`BOTH` record, and is uniquely determined. Ambiguity, cycles, excessive lineage depth, exact-transition-date cases, missing identity-history schema, or an incomplete historical price window fail closed to the pre-existing no-window behavior.

No factor/confidence logic was changed.

## Behavior preserved
- current-symbol price window remains first authority;
- Binary EOD precedes same-symbol SQLite for every selected symbol;
- exact transition date uses the new/current symbol;
- Safe V1 and 0.95 threshold unchanged;
- PENDING_ISIN_MISMATCH, Quick Resolve, AUTO-ID1, R1-B1/R1-B2 unchanged;
- raw imported symbol/ISIN unchanged;
- no Corporate Action approval or canonical-action creation path changed;
- no schema, frontend, Tauri command, dependency or raw-price adjustment change;
- no database was opened or written by this implementation runner.

## Validation commands / actual results
{
  "acceptedRed": "6 PASS / 4 intended FAIL / 0 compile errors",
  "autoApproval": "11/11 PASS",
  "autoId1": "6/6 PASS",
  "candidateCargoCheck": "PASS",
  "focusedR1B3A1": "10/10 PASS",
  "fullRust": "712 passed / exact inherited V1.14Y RED only / 3 ignored",
  "postInstallCargoCheck": "PASS",
  "postInstallR1B3A1": "10/10 PASS",
  "quickResolve": "5/5 PASS",
  "r1a": "39/39 PASS",
  "r1b1": "10/10 PASS",
  "r1b2": "5/5 PASS"
}

## Risks / limitations
The fallback intentionally trusts only an unambiguous persisted identity-transition chain and does not infer aliases from names, ISIN similarity, local file names, or price behavior. It does not itself refresh stored scan results or approve import 3494. Real-data re-scan/acceptance remains a separately controlled next step.

## Rollback guidance
Restore `src-tauri-shell/src/database/corporate_action_imports.rs` from `E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260925_205405_CA_R1B3A1_EVENT_TIME_HISTORICAL_PRICE` and remove this change record in a separately reviewed rollback. No database rollback is required because this implementation performed zero database writes.

## Hash evidence
- pre-change corporate_action_imports.rs: `B1A7FCDC1D1FCBE759DFB59D3A92B70418D05E48B3FE6447C8386A2A226E0D2B`
- post-change corporate_action_imports.rs: `E4DC11C28D3C395A229A869C718EDB438D40180A4FEECE1AC01A24ED913B990D`
- accepted R1-B3A1 RED evidence: `553477AE7C2BBFA71737BC098E90D99DDF25835EA939490CB7BD4F2F61EDBF10`
- accepted R1-B3A parent evidence: `4AF0A26DB27C8775DECB4FADFFBB78433647B22F2A822CCD29D61D5CCF29C980`
