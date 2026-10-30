# TMP-01 R2 — ISO Timestamp Parser Recovery

- IST: 2026-10-28 15:38:32 +05:30
- Workstream: E:\TA Projects\EOD Charting Platform
- Objective: finish TMP-01 smoke acceptance after R1 timestamp parser failure.
- Previous defect: R1 ConvertFrom-Json auto-converted ISO createdUtc string to DateTime, then exact string parsing failed.
- R1 partial state: AGENTS.md and the helper installed; original AGENTS.md backup confirmed; R1 smoke failed before cleanup; R1 changelog not written.
- Files changed: scripts/Invoke-EOD-TmpLifecycle.ps1 (one parameter added, minimum PowerShell version raised to 7.5); this changelog.
- Final implementation: ConvertFrom-Json -DateKind String retains the literal ISO UTC marker timestamp for existing strict parsing. No changes to cleanup guards or retention policy.
- Behavior preserved: BUILD-01 policy/wrapper, AGENTS.md, marked workspace identity and age rules, databases, evidence, historical tmp, root Cargo cache, Tauri, portable EXE.
- Windows validation: helper parse and fixture; exact R1 leftover marker-only recovery True; new Create/Preview/Cleanup smoke True; parent inventories and protected hashes PASS.
- Builds/typechecks/tests: not executed; this is PowerShell-only parser recovery with a direct smoke test.
- Risks: external scripts bypassing TMP-01 still create untracked temporary workspaces; automatic cleanup remains disabled; future workspaces with protected content must not be deleted.
- Rollback: restore scripts/Invoke-EOD-TmpLifecycle.ps1 from E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20261028_153832_TMP01_R2_TIMESTAMP_PARSER; AGENTS.md remains untouched. The two removed marker-only workspaces contain no data to restore.
- R1 helper SHA256: 6A44BBF9B497DFD9603FE3F8FF349702BF60E63EB4DACAA493823C021C2BE52D
- R2 helper SHA256: 907B3F7E57B75167943F41E862A41CEB4A607DC5F91E66972AE8987CD11D0A0B
- Source snapshot SHA256: 97B174FFB5B74F799D27D0C741D6F986282DA934B618526108A3230BC2B56432
- R1 failure evidence ZIP SHA256: C3B8919D9E832D11F1482C7F27A16BB6C9597342E2A4CA369D42CAA6AB1575E7
