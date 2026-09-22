# V1.14AD Final Closeout

**IST timestamp:** 2026-08-28 11:21:42 +05:30 IST

## Objective

Formally close V1.14AD after the accepted source fix, automated regression/build evidence, fresh portable rebuild, focused manual smoke, and the corrected C2 forensic chain.

## Previous defect or limitation

The V1.14AD production defect counted equivalent historical/current alias imports as separate same-date compound economic events. For KSBPUMPS/KSB, AGCNET/BBOX, and NBVENTURES/NAVA this inflated the expected validation factor from the correct x2 to a false x4.

A separate UI limitation was observed during manual smoke: the Official Imports Review screen can retain NOT VALIDATED / MATCH REQUIRED identity-review presentation while successful price-validation evidence is already present. This remains a UX/state-presentation issue and is not classified as failure of the V1.14AD validator fix.

## Files inspected

- src-tauri-shell\\src\\database\\corporate_action_imports.rs
- src-tauri-shell\\src\\database\\corporate_action_imports\\v114ad_tests.rs
- package.json
- target\\release\\eod-charting-platform-shell.exe
- release\\tauri-portable-win\\EOD Chart Portable\\EOD Chart.exe
- R7 manual-smoke staging evidence ZIP
- R8 fresh-portable hygiene evidence ZIP and change report
- C2-R1 live-drift forensic evidence ZIP
- C2-R2 targeted provenance evidence ZIP
- C2-R2-R1 corrected provenance ZIP/JSON/report/state
- current live MAIN/WAL/SHM filesystem family
- generated build-info Git status

## Files created

- E:\TA Projects\EOD Charting Platform\docs\changes\2026-08-28_1121_IST_V1_14AD_FINAL_CLOSEOUT.md
- E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-14ad-c2-r3-final-closeout_20260828_112142_599\\reports\\*
- Final compact C2-R3 evidence ZIP under E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-14ad-c2-r3-final-closeout_20260828_112142_599

## Files modified

- No production source file.
- No persistent test file.
- No package/build configuration.
- No production database file by R3.

## Final implementation

The accepted V1.14AD implementation deduplicates same-date compound members only when their economic fields match and the existing event-date identity equivalence contract says they are the same economic event. Equivalent alias duplicates therefore collapse before compound multiplication, while distinct genuine Split+Bonus actions remain multiplicative.

## Behavior changed

- KSBPUMPS/KSB 2011-04-18 BONUS validates at x2 rather than false x4.
- AGCNET/BBOX 2012-12-19 BONUS validates at x2 rather than false x4.
- NBVENTURES/NAVA 2016-09-01 BONUS validates at x2 rather than false x4.

## Behavior deliberately preserved

- Genuine BHARATRAS same-date Split x2 + Bonus x2 remains combined x4.
- Genuine FCL same-date Split x2 + Bonus x5 remains combined x10.
- Phase 5B event-equivalence safeguards.
- Split/Bonus approval price-validation gate.
- Historical/current identity presentation.
- Existing append-only scan evidence from the manual-smoke session.

## Validation commands / evidence

### Carried-forward automated evidence — not rerun by R3

- V1.14AD focused Rust: 4 passed / 0 failed.
- Genuine compound Rust regression: 4 passed / 0 failed.
- Phase 5B regression: 5 passed / 0 failed.
- Split/Bonus price-validation gate: 2 passed / 0 failed.
- Full Rust suite from accepted B1 evidence: 375 passed / 0 failed / 1 ignored.
- cargo check: PASS.
- Renderer Vitest carried forward from accepted C1 evidence: 110 files / 632 tests.
- Renderer production build: 742 modules.
- Tauri release build: PASS.

### Fresh R3 evidence gates

- SHA-256 verification of source/test/package.
- SHA-256 + length verification of final target and portable EXEs.
- SHA-256 verification of R7/R8/R1/R2/R2-R1 evidence.
- Corrected R2-R1 classification and all required booleans re-read from the locked JSON/state.
- Current live MAIN+WAL filesystem identity locked to the accepted R1 post-manual-smoke persistent baseline.
- SHM treated as transient and checked only for quiescence during R3.
- generated build-info.json Git cleanliness.
- No SQLite connection opened on live database.

## Actual validation results

### Final code/build identity

- Production source SHA-256: 450507EA2E6E195FCA0B654BD359A1E956BC5DBC9F57C81FF08FC215FF5C749B
- V1.14AD tests SHA-256: F6CFC767B445AB87F40BA3739401FF51E349F80F8FC7F9783C8ED8596ADF057C
- package.json SHA-256: 62CA8FA100A46242C669877064C2332D93C842B16CC95B72045EC02A17F9F9EA
- Final target/portable SHA-256: 0590F96B45988CF2A35A9325A160EC2837CA17D2F60457E293E0598EB46C6054
- Final target/portable length: 23961600 bytes each.

### Manual and database-level validation

- KSBPUMPS -> KSB: MATCHED x2, UI confidence 98.86%; corrected Run 27 confidence 0.9886032093362509 — PASS.
- AGCNET -> BBOX: MATCHED x2, UI confidence 98.54%; corrected Run 27 confidence 0.9853846153846153 — PASS.
- NBVENTURES -> NAVA: MATCHED x2, UI confidence 99.46%; corrected Run 27 confidence 0.9945833333333333 — PASS.
- BHARATRAS genuine combined x4 — PASS.
- FCL genuine combined x10 — PASS.
- KSB/BBOX/NAVA chart smoke — PASS.

### Corrected forensic disposition

- Original C2 stopped correctly on pre-smoke filesystem drift.
- C2-R1 established real logical append activity, not merely physical SQLite checkpoint evolution.
- Protected Corporate Action business state remained unchanged.
- C2-R2's UNEXPECTED_SCAN_PROVENANCE verdict was a harness false negative.
- C2-R2-R1 corrected the mapping assumption and returned EXPECTED_MANUAL_VALIDATION_TELEMETRY_PLUS_WORKSPACE_STATE_ONLY.
- Run 27 contains the exact three repaired alias x2 cases and both genuine compound controls.
- Runs 28-30 contain repeated KSB import 12685 MATCHED x2 validation evidence.
- The only settings value change is workspace.chartLayout.v1, restricted to the exact seven chart-smoke paths.
- sqlite_sequence growth exactly matches the 4 new scan runs and 1430 new scan-result rows.
- Runs 27-30 are retained; no restore or deletion is warranted.

### Accepted current live persistent baseline

- MAIN: 82886656 bytes / 5B1614367C337708DC2AF5C39F6D30696AE4716E562978176B9BE7FE66237B35
- WAL: 4124152 bytes / 05DFF231E2014D1FEE6167591493F0009C95D7E964097834DDDEC5042F85D948
- SHM is transient and is not used as a historical persistent identity.

## Risks and possible regressions

- The Review-screen identity/price-validation state presentation remains a separate UX issue.
- R3 does not rerun tests or rebuild; it cryptographically locks the already-accepted automated/build evidence chain.
- The accepted current live database includes legitimate append-only validation telemetry and chart workspace persistence generated during manual smoke.
- If MAIN or WAL diverges from the accepted R1 post-smoke baseline before R3 finishes, closeout must stop and the new drift must be investigated rather than bypassed.

## Rollback guidance

R3 itself requires no production rollback because it changes no production source/configuration/database state.

Do not restore the pre-smoke R7 database and do not delete scan runs 27-30: corrected forensic evidence proves they are legitimate validation telemetry while protected Corporate Action business state remained unchanged.

If the V1.14AD production source implementation itself must ever be rolled back, use the preserved pre-V1.14AD B1 rollback/evidence rather than blindly restoring an older Git baseline.

## Final status

**V1_14AD_C2_R3_CLOSED**
