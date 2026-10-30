# HOL-01 portable launcher quoting repair (R2)

- IST timestamp: 2026-10-28 17:19:07 +05:30
- Workstream: E:\TA Projects\EOD Charting Platform
- Objective: unblock the HOL-01 R1 portable manual checkpoint; app itself built successfully.
- Defect: the R1 CMD launcher passed a quoted %~dp0 directory with a trailing backslash, yielding an invalid path argument to the profile initializer on the Windows host.
- Source authority: 2026-10-28_160303_IST snapshot; R1 portable result and build evidence with pinned SHA256.
- Files modified: ONLY release/tauri-portable-win/EOD Chart Portable HOL01_20261028_170645_IST/Launch Portable EOD Chart.cmd.
- Files created: this change record; backup and evidence under tmp/HOL01.
- Implementation: append dot to CMD -PortableRoot "%~dp0." so GetFullPath sees an unambiguous equivalent directory path.
- Preserved: original standard portable, portable-data, profile pointer and initializer, HOL-01 EXE, renderer assets, source and test files, build configuration and DBs.
- Validation: original and candidate hashes, one-byte diff, backup hash, protected pre/post hashes PASS. No rebuild executed. Actual CMD launch and UI not tested by runner.
- Corrected launcher SHA256: D70466A66F5D931E0A08A33285F22935DBEDD846F1A684D3806EC69842E4EA0C
- Original launcher SHA256: FE0E3178CB00B6E4564BAF4E537B61CA7A4EE776356174A3EBAF6F6BA40A607A
- R1 portable result ZIP SHA256: FBBB1BE967B632AD333AF15957AA3CF368B01B85770AEB9DD37D963FA66BD86A
- R1 build evidence ZIP SHA256: E3FE17DA26BB6755E4225360D486BB51EEC218E25060F531F9A3A8F60549D306
- Risk: Windows CMD launch must still be tested. A newly discovered failure needs separate review; do not access production databases.
- Rollback: restore only the launcher from verified backup E:\TA Projects\EOD Charting Platform\tmp\HOL01\backups\launcher-r2-before_20261028_171907_IST\Launch Portable EOD Chart.cmd. No changes to original standard portable or profile.
