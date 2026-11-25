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
