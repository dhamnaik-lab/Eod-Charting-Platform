# BHAV-02 — controlled portable rebuild

- IST: 2026-10-28 11:45:34
- Objective: package already validated BHAV-02 R2 source into the supported portable application.
- Previous limitation: installed portable still contained R5 Bhavcopy downloader and NSE exclusions.
- Source files changed: **none by this packaging task**; BHAV-02 R2 source hashes preserved.
- Generated outputs: target/release Tauri executable, dist renderer, build metadata, release/tauri-portable-win/EOD Chart Portable.
- Final implementation: unchanged official npm run tauri:portable:win after complete hash-verified backup and relocation of prior standard portable. Restored portable-data byte-for-byte.
- Behavior preserved: user portable runtime state, launcher, external databases and profile pointers; previous full portable retained in project tmp. No database was opened.
- Validation: npm run tauri:portable:win exit 0; release and portable EXE hashes match; rendered index and assets present; original full tree copied and compared; runtime state restored and compared; source and packager hashes reverified. See evidence ZIP.
- New EXE SHA256: 21D41D49496868D6067B936ECD303433F1A22F3BFAEDFF0FA36680B2BA6C55D8
- Old EXE SHA256: C115A9F4959A28C92DCD405F55625EC455D58BDAEF4DF2C3D1573A28989B1E6E
- Runtime state files: 1, manifest SHA256 4630F490FB218AAE87E91D14151AE9989E2C620120F4FF4B2C206A38AF1ACE16
- Existing original retained: E:\TA Projects\EOD Charting Platform\tmp\BHAV02\retained\portable-original-R1_20261028_114534_IST
- Complete copy backup: E:\TA Projects\EOD Charting Platform\tmp\BHAV02\backups\portable-full-R1_20261028_114534_IST
- Prior release EXE backup: E:\TA Projects\EOD Charting Platform\tmp\BHAV02\backups\release-exe-before-R1_20261028_114534_IST.exe
- Risks: runtime and manual acceptance not performed; previously excluded historical rows not backfilled; inherited 10 Rust and 14 Vitest failures still separately documented; no production database validation.
- Rollback guidance: close the EOD application; rename the new standard portable to project tmp retained/unaccepted only after checking its hashes, then restore the hash-verified original folder from the retained path or copy backup. Restore the previous release EXE separately if reverting the build; do not touch user database.
