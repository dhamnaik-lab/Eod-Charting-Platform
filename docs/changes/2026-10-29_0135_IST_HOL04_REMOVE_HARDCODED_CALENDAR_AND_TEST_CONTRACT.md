# HOL-04 R1.1: Remove hard-coded calendar and correct HOL03 regression contract
IST: 2026-10-29 01:35:03 +05:30
Objective: Stop 2023–2027 hard-coded holiday seeding and use accepted NSE cash-market snapshot for BSE absent a BSE-specific snapshot.
Previous defect: HOL04 R1 passed 7 focused Rust tests but one HOL03 test still expected legacy BSE fallback and blocked 102-test Bhavcopy suite.
Files modified: src-tauri-shell/src/database/bootstrap.rs; src-tauri-shell/src/bhavcopy/calendar.rs; src-tauri-shell/src/bhavcopy/holiday_sync.rs (one assertion only).
Final implementation: same two production file bytes as HOL04 R1; one obsolete HOL03 expected value Legacy -> NSE official.
Behavior preserved: HOL03 actual production code untouched; explicit BSE official snapshot overrides NSE fallback; existing BUILTIN/USER records retained; special sessions unaffected; source/DB/portable protected.
Validation: HOL04 focused >=7; HOL03 focused >=6; Bhavcopy >=90; Cargo check; focused HOL01/02/03 Vitest; TS typecheck; Vite renderer build; protected SHA256 verification.
Source backup: E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20261029_013315_HOL04_R11_NSE_BSE_TEST_EXPECTATION
Manifest SHA256: E9B4325C99B565501EB0F06814C0D315643B6FBF6E6E3EEA269C620BA6A6E25D
Installed test-only file SHA256: 4EEB7C63DDE46E008CD9F3BD66CBC8D83F08C93D0241F6E74EDFF6DC0C07DAB4
Risk: Unaccepted calendar years use preserved legacy records; new databases need official acceptance before full holiday skip coverage. Native manual test and portable rebuild remain pending.
Rollback: Close app; restore all three source files from backup; recheck pre-change SHA256 values; no database rollback required for source-only change.
