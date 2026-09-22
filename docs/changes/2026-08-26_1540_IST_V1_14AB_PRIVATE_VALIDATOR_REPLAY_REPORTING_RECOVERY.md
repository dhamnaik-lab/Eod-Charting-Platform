# V1.14AB Private Validator Replay — Reporting Recovery

**IST timestamp:** 2026-08-26 15:40:21 +05:30 IST

## Objective

Recover and complete reporting for the already-successful V1.14AB-B 405-row private current-production validator replay without rerunning Cargo or touching live SQLite.

## Previous defect or limitation

The Rust replay passed, source restoration passed, the exact 405-row replay contract passed, and private MAIN/WAL byte identity passed. The operator script then failed because it invoked Python without passing the generated reconciliation script path. Python therefore attempted to execute the prior JSON authority file as Python source and failed on the valid JSON token null.

## Files changed

- No production source file changed.
- No database file changed.
- Created recovery evidence under the existing V1.14AB-B run reports directory.
- Created this docs\\changes report.

## Final implementation

- Reused the preserved successful Rust replay report.
- Revalidated Cargo GREEN evidence: 1 passed / 0 failed.
- Revalidated 405 unique replay IDs.
- Revalidated 316/316 verified binary EOD copies.
- Revalidated private MAIN/WAL byte identity.
- Revalidated live MAIN/WAL/SHM against the pre-replay hashes.
- Reconciled prior-to-current status entirely in PowerShell; no Python interpreter used.

## Validation commands / evidence

- Preserved Cargo log: E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-14ab-b-current-validator-replay_20260826_142433_688\reports\06-current-validator-replay-cargo.log
- Preserved Rust replay JSON: E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-14ab-b-current-validator-replay_20260826_142433_688\reports\07-current-validator-replay.json
- Binary EOD manifest: E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-14ab-b-current-validator-replay_20260826_142433_688\reports\03-required-binary-eod-copy-manifest.json
- Private family before/after manifests: E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-14ab-b-current-validator-replay_20260826_142433_688\reports\02-private-family-before-replay.json / E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-14ab-b-current-validator-replay_20260826_142433_688\reports\11-private-family-after-replay.json
- Live family before/current manifests: E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-14ab-b-current-validator-replay_20260826_142433_688\reports\01-live-family-before.json / E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-14ab-b-current-validator-replay_20260826_142433_688\reports\12-live-family-after.json

## Actual validation results

- Candidate count: 405.
- Current MATCHED: 232.
- Current NO_PRICE_DATA: 156.
- Current REVIEW: 17.
- Other current statuses: 0.
- Current status counts: {"MATCHED":232,"NO_PRICE_DATA":156,"REVIEW":17}
- Transition counts: {"MISSING->MATCHED":214,"MISSING->NO_PRICE_DATA":88,"MISSING->REVIEW":10,"NO_PRICE_DATA->NO_PRICE_DATA":68,"REVIEW->MATCHED":18,"REVIEW->REVIEW":7}
- Cargo replay: PASS, 1 passed / 0 failed.
- Production source final SHA-256: 7FF8A707D2AE754324443EA64E6722F9599DF85C4EDBC6466C3B15CB9F168C14.
- Private SQLite writes: 0.
- Scan rows inserted: 0.
- Live database family unchanged: PASS.
- Cargo rerun during recovery: NO.
- SQLite opened during recovery: NO.

## Risks or limitations

- This measures the current validator against current local binary EOD history; it does not automatically revoke or approve historical actions.
- NO_PRICE_DATA remains a data-availability classification, not proof that an approved event was wrong.
- REVIEW rows require separate event-level analysis before any remediation decision.

## Rollback guidance

- No production rollback is required because this recovery changed no production source or database state.
- The generated recovery reports can be removed if desired after archival; the original successful Rust replay evidence remains unchanged.
