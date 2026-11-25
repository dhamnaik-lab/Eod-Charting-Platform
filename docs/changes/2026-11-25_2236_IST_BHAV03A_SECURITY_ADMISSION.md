# BHAV-03A — NSE settlement and InvIT auxiliary admission

Timestamp: 2026-11-25T22:36:28.553580+05:30 (IST). Workstream `E:\TA Projects\EOD Charting Platform`. Source reference `fdc2ac9dc3c17602ea08c60293c6ff3b88dc9023`.

## Objective / prior defect
December 2025 read-only evidence ZIP SHA-256 `7389C12041F574B7AE497E15663A20D8453B1C1E15565C58063E1EC91B53D2A0`: 52 held rows (40 class conflicts, 12 unknown series) on CAPINVIT, NHIT, IDEA, ONGC, TATASTEEL. 42 regular and 10 auxiliary rows.

## Implementation
T0 is evidence-only, and paired EQ/T0 requires matching present ISIN. Same-key IV/ID+BL with matching present ISIN no longer makes BL a false equity class; paired InvIT exception is restricted to BL. Unmatched BL, mixed security classes, unqualified other series, incompatible rows, historical ISIN-less rules, existing identity guards, replay safety, non-equity separation, and other exchange behavior are preserved. Standalone T0 cannot create a canonical bar. No planner or recovery algorithm changes.

## Changed paths
- `src-tauri-shell/src/bhavcopy/security_admission.rs`
- `src-tauri-shell/src/bhavcopy/security_admission/tests.rs`
- `src-tauri-shell/src/bhavcopy/security_admission/fixtures/bhav03a-december-2025.csv`
- `HANDOFF.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`
- `docs/changes/2026-11-25_2236_IST_BHAV03A_SECURITY_ADMISSION.md`

## Validation
- Rustfmt: PASS []
- bhav03a_: PASS [["4", "0", "0"]]
- bhavcopy::: PASS [["193", "0", "4"]]
- bhavcopy_recovery::: PASS [["19", "0", "0"]]
- database::binary_eod::: PASS [["29", "0", "0"]]

Each count is from Windows test command output (passed, failed, ignored); overlapping test filters are not added together. Actual transcript: `E:\TA Projects\EOD Charting Platform\tmp\BHAV03A-Evidence-20261125-223628-553580\VALIDATION.log`. Fixture 112 evidence rows, including 60 previously admitted rows. New tests require 102 original regular quotations and 10 retained auxiliary records in both stores and input orders; negative identity, standalone T0 and real class-conflict tests. No live DB access, Git publication, release build or portable replacement.

## Risks and rollback
No repair executed; native behavior and source-price parity remain pending. Standalone/unmatched BL retains conservative previous behavior. Existing current metadata is not historical identity proof. Backup `E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20261125_223629_BHAV03A-20261125-223628-553580` contains original changed files. Approved rollback: restore only five backed-up paths and remove only two new paths after validating their hashes; do not reset/clean or alter databases. BHAV-03B/C/D and original EOD DATABASE remain HOLD/pending.

## Final native acceptance — 26 November 2026 IST

- Source candidate `933318a55afec82faa2bfad9eb40d110c9563885`; PR #141 merged at `29b2c5b41dda89debb51970593fdd5a7b4b809d4` (candidate tree unchanged). Windows local synchronization PASS. Rust Compile and Test CI #43 and Renderer CI #226 reported PASS. Windows regression counts above total 241 distinct passes, 4 ignored, zero failures.
- `npm run tauri:portable:win`: PASS (renderer 854 modules, 18 s; Rust release 3m 40s). Standard portable `release/tauri-portable-win/EOD Chart Portable/EOD Chart.exe` SHA-256 `9D4B760F24767933CC341FF4BD57A267182BA351132AE1D828404C5A76BF7860`. Known unused `create_holiday_skip_result` warning unchanged.
- Native scope: New Database only, NSE Equity, 2025-12-01 through 2025-12-31, two workers. Detailed log at 00:47:49–00:48:05 IST: 22 successful sessions, one rejected wrong-date archive (25 December received 24 December), eight weekend skips. 67,977 admitted records processed; 42 inserted, 67,935 unchanged, zero changed, zero binary write errors. 36 auxiliary-market rows excluded across the batch, zero admission-blocked rows. Immediate checkpoint complete. Wrong-date rejection remains correct and historical calendar coverage is a separate issue.
- Read-only before/after verification at 00:53:30 IST: 13,876 files before/after, NSE records 801,943 to 801,985; 42 additions in December only, zero modifications/deletions, no missing/new NSE files, zero other-exchange binary file changes. CAPINVIT 22, NHIT 14, IDEA 3, ONGC 2, TATASTEEL 1 restored. All 102 target rows independently compared to original archived evidence (exact date, OHLC, previous close, volume and open interest at scale 10000); 60 pre-existing target rows preserved. The prior zero-addition comparison is superseded by the successful native run; original baseline retained.
- Evidence: `BHAV03A-Evidence-20261125-223628-553580.zip` SHA-256 `8347C657F6D955460EF03A8D997FF596D2547A727129DFDF8E14031AB9F352D1`; `BHAV03A-Native-Evidence-20261126-005330-762185.zip` SHA-256 `97CE9F6908DBD23C3359293EE5553B81EDA9F9557539E8EC6937D73D5D593B2F`; baseline archive SHA-256 `1092837FF617AF12CDAFC09CD2B42056B0DA1BC896E88D80DCCDF547E6D58323`; native detailed transcript SHA-256 `D4D7363EA935696E8BFE9864D35BD9ED2E824CBF7C226A2C659AD22A0235DB74`. Uploaded native ZIP SHA and CRC verified; all 102 target records matched original coverage ZIP named above. Baseline local to Windows; full baseline bytes not uploaded.
- Verdict: technical acceptance PASS for BHAV-03A bounded scope. Owner approved documentation-only closeout. No further runtime changes, builds or downloads required. Final repository integration and local docs synchronization are separate from native acceptance. Documentation rollback is limited to these four Markdown paths at pinned parent `29b2c5b41dda89debb51970593fdd5a7b4b809d4`; preserve unrelated files and obtain approval before reverting. The prior pre-publication rollback instructions above are historical, not authorization to revert merged code.
- Limits: no independent SQLite or journal inspection in native comparison, no fresh-source full-history parity, no general chart/UI smoke certification. Original EOD DATABASE untouched by this bounded test and remains HOLD; RECOVERY-01B remains HOLD. Next: BHAV-03B only after owner approval. BHAV-03C/D separate.
