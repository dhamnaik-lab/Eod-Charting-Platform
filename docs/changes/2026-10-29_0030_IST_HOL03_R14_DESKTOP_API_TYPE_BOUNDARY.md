# HOL03 R1.4 — DesktopApi Pick type boundary

- IST: 2026-10-29 00:30:05 +05:30
- Objective: add only the 3 official holiday IPC method keys to the DesktopApi Pick boundary.
- Defect: HOL03 R1.3 TypeScript TS2339/TS2353/TS7006 while Rust and focused Vitest passed.
- File changed by R1.4: src\platform\types.ts
- Before SHA256: 2A60DECF3DE3FD2F2FEDCCE3B8298F71DE2CF9D0E198A03A66576E83DD54D9BA
- After SHA256: 30E659194320536659991BA06FD7B88B649242CC0191CD4099B38DF489FE31E6
- Additional R13 files: see its own HOL03 change record and E:\TA Projects\EOD Charting Platform\tmp\HOL03\evidence\R1_4_Apply_20261029_002827_IST\R13_delegated_console.txt
- Final implementation: one type-selection change, no runtime behavior outside already-pinned HOL03 R1.3.
- Preserved: legacy HOL02 Refresh, manual holidays, Sidebar, data, settings, existing portable EXE.
- Validation: delegated R13 Apply PASS; actual logs in R13 evidence and E:\TA Projects\EOD Charting Platform\tmp\HOL03\evidence\R1_4_Apply_20261029_002827_IST\R13_delegated_console.txt, with six HOL03 Rust, Bhavcopy regressions, 23 focused Vitest, TypeScript typecheck and Vite renderer build required.
- Remaining limitations: native app UI, official first-party HTTP, acceptance, full baseline-aware Rust/Vitest and portable build NOT validated.
- Rollback: close EOD Chart; back up current source; restore R14 file from E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20261029_002827_HOL03_R14_DESKTOP_API_TYPE_BOUNDARY and R13 modifications from the R13 backup recorded in its evidence. Do not rollback production DB from this source-only record.
- Source authority: October 28 16:03 IST snapshot for src/platform/types.ts, pinned by preflight hashes.
