# CA R1-C3 — SONAMLTD 3494 Controlled TEST-DB Re-scan Acceptance

IST timestamp: 2026-09-26T01:54:05.504196+05:30

## Objective
Refresh only the stored Corporate Action price-scan evidence for import 3494 after accepted R1-B3A1 historical-symbol price-window fallback, first on an isolated rehearsal copy and then on the authorized TEST DB.

## Previous limitation
Import 3494 still carried the pre-R1-B3A1 latest official scan `NO_PRICE_DATA`, although local SONAMCLOCK Binary EOD contains the proven event-time 2022-07-13/2022-07-14 window. R1-B3A1 fixed lookup behavior but intentionally performed zero DB writes.

## Files / data changed
- TEST DB scan evidence only: one new `scan_runs` row and one new `corporate_action_scan_results` row, plus completion update of that new scan-run row.
- This change record.
- Production source unchanged.

## Final execution
- Target: import 3494 only.
- Production scan owner: `run_corporate_action_scan_internal()` targeted `official_imports` scan.
- Exact connection logical changes: 3 = one scan-run insert + one target scan-result insert + one scan-run completion update.
- Latest result: MATCHED, previous 2022-07-13 close 88.55, ex-side 2022-07-14 open 42.0 / close 45.1, confidence 0.9817073170731707.
- No Corporate Action approval, canonical action, identity rewrite, resolution or migration.

## Behavior preserved
Safe V1/0.95, PENDING_ISIN_MISMATCH, Quick Resolve, AUTO-ID1, R1-B1/R1-B2, raw imported identity, explicit CA approval and raw-price adjustment behavior remain unchanged. Source remains exact post-R1-B3A1 authority.

## Validation commands / actual results
- Parent R1-B3A1 GREEN evidence verified by exact SHA.
- Source authority: 569/569 exact, protected 563.
- Pre-change TEST DB matched accepted R1-B3A/R1-C2 byte authority.
- SONAMLTD/SONAMCLOCK Binary EOD hashes matched accepted R1-B3A evidence.
- Rehearsal precheck: exact old latest scan 11576/run 38/NO_PRICE_DATA.
- Rehearsal targeted scan: 1/1 PASS; 3 exact logical changes; MATCHED confidence >= 0.98.
- Rehearsal R1-A target + 112-row postcheck: PASS, approvalWrites=0, executedRepairs=0.
- Current-source R1-B3A1 regression: 10/10 PASS.
- Live DB and Binary EOD hashes reverified unchanged before live write.
- Live targeted scan: 1/1 PASS; exact 3 logical changes.
- Live postcheck: {"accountedFor": 112, "actualCloseFactor": 1.9634146341463414, "actualOpenFactor": 2.1083333333333334, "confidence": 0.9817073170731707, "corporateActionId": null, "databaseComplete": false, "exClose": 45.1, "exOpen": 42.0, "exTradeDate": "2022-07-14", "expectedFactor": 2.0, "inScopeBlockedRows": 98, "outcomeCounts": {"ALREADY_LINKED_REVIEW": 6, "CLASSIFICATION_REVIEW": 43, "DEFERRED_SCOPE": 0, "EVIDENCE_BLOCKED": 59, "MISSING_IMPORT": 0, "PREPARATION_ERROR": 0, "READY_FOR_EXISTING_APPROVAL_RECHECK": 1, "REPAIR_CANDIDATE": 3}, "prevClose": 88.55, "prevTradeDate": "2022-07-13", "runTotalResults": 1, "scanStatus": "MATCHED", "targetApprovedId": null, "targetOutcome": "READY_FOR_EXISTING_APPROVAL_RECHECK", "targetPriceStatus": "MATCHED", "targetReviewStatus": "PENDING"}
- Rehearsal/live invariant comparison: exact.

## Risks / limitations
This refresh does not approve import 3494 and does not create a canonical Corporate Action. Full R1-C remains open. The scan is append-only; do not rerun this acceptance runner merely to reproduce evidence.

## Rollback guidance
If this exact scan refresh must be reverted, do not delete individual scan rows manually. Close EOD Chart/database tools and restore the complete pre-change TEST DB/WAL(+SHM) set from `E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260926_010623_CA_R1C3_SONAMLTD_RESCAN` under a separately reviewed rollback step.

## Evidence / hashes
- pre-change database set: `{"market-data.sqlite3": {"bytes": 83812352, "sha256": "3140EE0B5BEED16D9B95FB5E8D7FE4BF01D84830DE258ACC1DB8143C412A2DF6"}, "market-data.sqlite3-shm": {"bytes": 32768, "sha256": "FD4C9FDA9CD3F9AE7C962B0DDF37232294D55580E1AA165AA06129B8549389EB"}, "market-data.sqlite3-wal": {"bytes": 0, "sha256": "E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855"}}`
- post-change database set: `{"market-data.sqlite3": {"bytes": 83812352, "sha256": "731D41B7B20CF3E11B5F2B3A557E1E20257401FEBB47139113130F509A046EDC"}, "market-data.sqlite3-shm": {"bytes": 32768, "sha256": "FD4C9FDA9CD3F9AE7C962B0DDF37232294D55580E1AA165AA06129B8549389EB"}, "market-data.sqlite3-wal": {"bytes": 0, "sha256": "E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855"}}`
- Binary EOD authority: `{"SONAMCLOCK.eod": {"bytes": 59840, "sha256": "E5CC2A067850F71895B24C2EB86A2755CE31ABE259D33A422C911FB84D7D76DE"}, "SONAMLTD.eod": {"bytes": 42688, "sha256": "A8B9DDD479636FC7FA3934CFEADB272B2689F62FBAF5A227A99C54AEFFBB1FC0"}}`
- R1-B3A1 GREEN evidence: `011DA723AC7EE900F4D8C6C4C40B5EC489B417979F1F5B81C215167FBFD73B5B`
