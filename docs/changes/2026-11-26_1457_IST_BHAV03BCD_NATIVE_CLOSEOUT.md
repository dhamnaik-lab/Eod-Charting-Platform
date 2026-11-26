# BHAV-03BCD — Native acceptance closeout

IST: 2026-11-26T14:57:56+05:30

Status: FUNCTIONAL ACCEPTANCE PASS on New Database; owner approved documentation closeout. Original EOD DATABASE and RECOVERY-01B remain HOLD. This record supersedes the earlier candidate status, not the prior evidence.

## Objective and authority

Source: `79429074ee174f9a1c982061187b0492524fd890` (PR #143 merged). Portable SHA-256: `31262762F6DEE11A0B76B7F6065CFDD158E526FE09AA3E41F1B343925112AF4A`. Test database: `E:\TA Projects\EOD Charting Platform\New Database`. Prior implementation record: [BHAV-03BCD](2026-11-26_0223_IST_BHAV03BCD_COVERAGE_RETRY_RECOVERY.md).

## Windows evidence

- Rustfmt check passed for 8 changed Rust files; focused 8 passed; Bhavcopy 201 passed/4 ignored; recovery 19 passed; binary EOD 29 passed. 249 distinct module-test passes (focused tests overlap); no failures. Evidence ZIP SHA-256 `1450C4D0C5E049A6732B153915A2C432B06122C890640720EAFABFABBBB9FE88`.
- Standard portable build succeeded after the earlier memory-related failure; the accepted executable hash was rechecked by each native runner.
- Native evidence summaries were independently read from all five CRC-verified ZIP archives; exact SHA-256 follows. Physical manifest comparisons were performed by the local Windows verifier, not repeated on the full database here.

| Phase | Added records | Files | Receipts in its scoped window | Outcome |
|---|---:|---:|---:|---|
| Before | 0 | 13,876 | 0 | BASELINE_CAPTURED |
| After | 263 | 13,876 | 66 | PASS_PHYSICAL_PRESERVATION |
| Rerun | 0 | 13,876 | 67 | PASS_PHYSICAL_PRESERVATION |
| Historical | 152,672 | 14,033 | 76 | PASS_HISTORICAL_PHYSICAL_PRESERVATION |
| Update | 528 | 14,033 | 95 | PASS_UPDATE_PHYSICAL_PRESERVATION |

All existing quotation record bytes were preserved by the native comparisons; 153,463 additions in total. Final file count 14,033; final quotation count 2,207,236. No pending receipts or recovery sessions. Final manifest SHA-256 `63666F1CE25465CE37338FA3A4B1D293AE08105DA611EEDB181671DB1C7D27D7`.

November 2026: recovered 125 NSE Index rows on November 6 and 138 on November 25; rerun had zero new quotation writes and identical physical manifest. November 2025: added 152,672 records and 157 files, exactly matched the logged date/exchange additions. Update: 40 earlier jobs (10 per exchange), 154 deferred; 59 NSE and 469 BSE Index quotations recovered within August 28–November 25. All 76 prior November attempt summaries unchanged. 95 in-window receipt summaries passed reported hash and identity checks.

## Evidence SHA-256
- BHAV03BCD-Native-Before-20261126-132115-456059.zip: `37AE2414E77D73C5C597E7D72F220CCD6F7CF0CEEAA8ECBAB88EA88494674B7A`
- BHAV03BCD-Native-After-20261126-132838-606893.zip: `39105E3E585887C2C63774DCE2626EB2A78367E3A62006412E638A63C3F4BB92`
- BHAV03BCD-Native-Rerun-20261126-134516-963767.zip: `176B040DF6D22B498E1217BF9B134EED2DF28D1FB1641E65083793693B629DF2`
- BHAV03BCD-Native-Historical-20261126-142823-291427.zip: `7FEACB0DE58DBDD4E9626CC20EAA375D7799FBD969620DD639743862DEBC74B8`
- BHAV03BCD-Native-Update-20261126-143612-265357.zip: `F651444D5A2A24E8E29897DD1DC5EE638162C539DBAD411C963FE5B14F848610`

## Preserved behavior and limitations

- Source failures, malformed archive rows, incomplete receipts and fallback-only coverage remain unresolved. The final receipt summaries contain 17 held rows (16 NSE security rows and one NSE Index row); no forced approval or repair.
- Physical record-byte preservation is established by the native verifier, not independent exchange-source price parity or full-market membership certification. The seven-day confirmed-holiday cooldown is not independently proven by this native run.
- Current work did not touch the original EOD DATABASE, Corporate Actions or RECOVERY-01B. No new release build is needed for this documentation closeout.
- Performance observations: 18s initial November planning, 23s repeat planning, approximately 32.5s November 2025 log/receipt stage, 6.128s Update log/receipt stage. BHAV-PERF-01 is separately authorized; no speed improvement is claimed yet.

## Rollback and documentation

Only the three live trackers and this closeout record are in documentation scope. Preserve the original implementation record and native evidence. Restore only exact changed source/doc paths from the scoped pre-edit backup if separately authorized. Do not delete database files, recovery evidence or receipts.
