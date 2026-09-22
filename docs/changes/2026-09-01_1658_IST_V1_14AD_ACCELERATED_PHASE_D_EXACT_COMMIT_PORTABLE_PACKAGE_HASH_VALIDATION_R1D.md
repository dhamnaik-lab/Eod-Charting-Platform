# V1.14AD Accelerated Phase D — Exact-Commit Portable Package + Hash Validation R1D

## IST timestamp
2026-09-01 16:58:35.746
 IST

## Objective
Build and certify the Windows portable package from exact committed Corporate Action HEAD 2103e9ffcaaad28bd903c9cb71310316c68f2ffd / tree 6bc7dd2b393b3baf78ff97539c9eb7b8c8f42c77 in a disposable repository, then promote only the hash-certified portable output to the real release folder without consuming unrelated working-tree drift.

## Previous defect or limitation
The real working tree intentionally contains preserved out-of-scope edits, so building directly from the project root would not prove that the package came from the exact Corporate Action commit. Phase D therefore builds from an external shared clone pinned to the exact commit/tree while retaining the expected branch name for build metadata. R1 placed that clone under the very deep Source Audit path; projected checkout paths reached the Windows 260-character boundary and checkout failed before npm/build. R1A moved the disposable build repository to short E:\EODPD and proved checkout-path safety. R1B then correctly separated live-working versus committed package authority, but incorrectly treated historical raw Git-blob SHA-256 values as if they must equal physical Windows checkout bytes. A read-only forensic probe proved core.autocrlf=true transforms the physical checkout while HEAD blob OID, index blob OID, and filter-aware worktree OID remain exactly identical for both package files. R1C therefore gates package provenance by Git object identity and records physical checkout SHA-256 only as build-input evidence. R1C then blocked because it imported the live uncommitted root .cargo/config.toml topology into the exact-commit clone. A read-only Cargo-target probe proved the exact commit contains no .cargo/config.toml, Cargo metadata defaults to src-tauri-shell\target, and the exact committed prepare-tauri-portable.ps1 consumes src-tauri-shell\target\release\eod-charting-platform-shell.exe. R1D therefore follows the committed shell-local Cargo target topology and treats the live root .cargo/config.toml only as preserved out-of-scope working state.

## Files changed
- Application runtime/source/config: none.
- Git index/history: none.
- Generated release output: release\tauri-portable-win\EOD Chart Portable
- Documentation created: docs\changes\2026-09-01_1658_IST_V1_14AD_ACCELERATED_PHASE_D_EXACT_COMMIT_PORTABLE_PACKAGE_HASH_VALIDATION_R1D.md
- External evidence workspace: E:\TA Projects\EOD Charting Platform Source Audit\V114AD_ACCELERATED_PHASE_D_EXACT_COMMIT_PORTABLE_PACKAGE_HASH_VALIDATION_R1D_20260901_162044_151
- Short disposable build workspace: E:\EODPD\D1D_20260901_162044_151
- Previous portable backup retained when applicable: E:\TA Projects\EOD Charting Platform Source Audit\V114AD_ACCELERATED_PHASE_D_EXACT_COMMIT_PORTABLE_PACKAGE_HASH_VALIDATION_R1D_20260901_162044_151\real-portable-before

## Final implementation
- Phase C authority ZIP SHA-256: 2A6BF2B09F037A0EFFA34C30752593368A6BEDE998FD33BFAAB076864320E17A
- Source commit: 2103e9ffcaaad28bd903c9cb71310316c68f2ffd
- Source tree: 6bc7dd2b393b3baf78ff97539c9eb7b8c8f42c77
- Source branch identity used in disposable build: gemini-release-qa-20260512
- Exact CA commit path count: 35
- Short build repository: E:\EODPD\D1D_20260901_162044_151\r
- Longest tracked relative path: 100 chars / TAPRO_REFERENCE_FROM_EOD/01_EOD_ARCHITECTURE/CURRENT_ARCHITECTURE_STRUCTURE_EOD_CHARTING_PLATFORM.md
- Projected longest checkout path: 135 chars (limit 220)
- Clone-local core.longpaths: true
- Prior failed R1 evidence ZIP SHA-256: AFF0CF33CC134BDED8A5647E4CCA67041824B1397F16156801B8D2AB29A392D0
- Prior failed R1A evidence ZIP SHA-256: 124D10E3434268D514DD11AE587A634BC25024A3C4437BD6E9CD71E20830ABF0
- Prior failed R1B evidence ZIP SHA-256: 4983882AC40CD813650FB8DC46D6F50E81CAE1048605A5C5072EBD932F43C3F9
- Prior failed R1C evidence ZIP SHA-256: 67DF088A2DA01553EE9FCDEA4B718B02EE4B26BC817BCF9EBF4DE16978C2BC3D
- Prior R1 residual cleanup warning: 
- Live working package.json SHA-256 preservation authority: 62CA8FA100A46242C669877064C2332D93C842B16CC95B72045EC02A17F9F9EA
- Live working .cargo/config.toml SHA-256 preservation authority: 8BF0C6CE87F9803A3BD5236432FDDFD2BBB5F340A662D7E3BAC587F2232A0C67
- Exact commit .cargo/config.toml present: False
- Exact committed prepare source EXE path: src-tauri-shell\target\release\eod-charting-platform-shell.exe
- Exact committed Cargo target topology: src-tauri-shell/target
- Exact committed package.json Git blob OID: cb3646c8be1f7a5a9fb572d27693e24025164c1f
- Exact committed package.json raw Git-blob SHA-256 evidence: DE236ECDF94513EE1B34C2C35EEF6D776781699EC5CC5B2C176A0805BFD8863C
- package.json filter-aware worktree OID: cb3646c8be1f7a5a9fb572d27693e24025164c1f
- package.json physical worktree SHA-256 evidence: A09CC1348A3A2E290B7D6FB921593B3B66FC36C5A81F0AFDC36820611FBF91A4
- package.json physical SHA matches forensic observation: True
- Exact committed package-lock.json Git blob OID: a56063dfe9104846b5a27cdf981f6aac4298d10b
- Exact committed package-lock.json raw Git-blob SHA-256 evidence: C13F6C4768BA8DDB768285803124E6DEA3EBCD21F818CA377B2C17F37D19F64E
- package-lock.json filter-aware worktree OID: a56063dfe9104846b5a27cdf981f6aac4298d10b
- package-lock.json physical worktree SHA-256 evidence: 3433F8F65623B0E2FAB68DF0F70A9B7F10F3CBDD59090EB1AD73569C5EE99A75
- package-lock.json physical SHA matches forensic observation: True
- Clone core.autocrlf: true
- Cargo target resolved to: E:\EODPD\D1D_20260901_162044_151\r\src-tauri-shell\target
- Portable package promoted: True
- Portable file count: 22
- Portable total bytes: 24297468
- Release EXE SHA-256: 673230EF6BA0EBE0BC2A49EC78665AD88F4FAA2C802C20AE4846FB4B2B7BA477
- Portable EXE SHA-256: 673230EF6BA0EBE0BC2A49EC78665AD88F4FAA2C802C20AE4846FB4B2B7BA477
- Release EXE length: 22427648
- Portable EXE length: 22427648
- Package manifest SHA-256: 1EE998DFBEBBB2EC916C00FBF7B525BDFD6A91B617D639BEDD8B5303B65212A3

## Validation commands / actual results
- npm ci: exit=0, duration=221.01s, PASS=True
- npm run tauri:portable:win: exit=0, duration=1522.31s, PASS=True
- Release vs portable executable byte identity: PASS
- Clone package vs promoted package manifest identity: PASS
- Disposable build cleanup: PASS
- Real repository/source postflight: PASS
- Guarded live database preservation: PASS

## Behaviour deliberately preserved
No runtime source, committed Git content, working tracked source, or live database content is changed by Phase D. Existing out-of-scope working-tree edits remain byte-identical. The package is not launched automatically.

## Classification
V114AD_ACCELERATED_PHASE_D_EXACT_COMMIT_PORTABLE_PACKAGE_HASH_VALIDATION_PASSED__MANUAL_SMOKE_REQUIRED

## Risks or limitations
- Phase D proves build/package provenance and byte/hash identity; it does not prove interactive runtime behaviour.
- Manual Corporate Action/runtime smoke remains Phase E.
- Any previous portable package is retained externally only when a successful replacement occurred.
- Build warnings that do not cause the production packaging command to fail remain recorded in the build log.

## Rollback guidance
Restore previous portable folder from: E:\TA Projects\EOD Charting Platform Source Audit\V114AD_ACCELERATED_PHASE_D_EXACT_COMMIT_PORTABLE_PACKAGE_HASH_VALIDATION_R1D_20260901_162044_151\real-portable-before

## Recommended next step
If classification is PASS, perform Phase E manual smoke against the promoted portable package and complete V1.14AD closeout evidence.
