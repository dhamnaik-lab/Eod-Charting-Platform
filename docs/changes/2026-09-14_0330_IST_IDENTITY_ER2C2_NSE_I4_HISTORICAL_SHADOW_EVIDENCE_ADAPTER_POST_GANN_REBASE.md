# ER2-C2 NSE I4 Historical Shadow Evidence Adapter - Post-Gann Rebase

**IST timestamp:** 
2026-09-14 03:30:21
 IST

## Objective
Rebase and revalidate the approved ER2-C2 private post-rollback NSE I4 shadow adapter against the accepted 14-Sep post-Gann 541-file source authority.

## Previous limitation
The earlier R1D implementation passed T0-T15, focused regressions, owner regressions, and offline Cargo check, but closure was blocked because concurrent Gann source edits changed the source tree during postflight.

## Files changed
- src-tauri-shell/src/database/nse_identity_imports.rs

## Final implementation
The previously approved ER2-C2 production candidate was re-applied unchanged. Gann source, ChartCanvas, ChartEngine, plugin registry, vitest configuration, dependency authorities, and Gann documentation were preserved.

## Behaviour preserved
- I4 source loading / plan execution / plan hashing / Apply / rollback authority
- public I4 Preview result
- ER2-B resolver
- BSE Identity
- ER1 Source Health
- Gann plugin source/config/docs
- no real/private database access
- no source-control commands

## Validation commands/results
- Global ER2-C2 RED: PASS (expected failure)
- T0-T15 GREEN: PASS
- Focused ER2-C2 suite (serialized): PASS
- NSE I4 historical regression (serialized): PASS
- ER2-B resolver regression: PASS
- NSE Identity owner regression (serialized): PASS
- BSE Identity regression: PASS
- ER1 Source Health regression: PASS
- cargo check --locked --offline: PASS
- Exact POST source authority: 541 files / 
D7051907CF5C64CA876FA2D7E9C6C2747BAA0BB21F67BBBE592D65E5E5FEC68B
- Gann/config/doc preservation sentinels: PASS

## Authority hashes
- Fresh source snapshot: 
65F496FE903341CED9A0BF7A3CDC63C20F2D72ECCAE31D4E0175B3A59F9825F9
- PRE source ordinal digest: 
D00992A4E5A6E8191711274CF25402B2EC03EA9589C67690396F68D4122F8D7A
- ER2-C2 preimage: 
55F30A01CF305F5F35E926F60DA577DAF55DC185D0CE31E601149AE31C800E63
- ER2-C2 final postimage: 
AFD17E1163D7C6E5EC8C566C473503BD55A7F2B7F6BC82E4813D99825832099E
- POST source ordinal digest: 
D7051907CF5C64CA876FA2D7E9C6C2747BAA0BB21F67BBBE592D65E5E5FEC68B

## Risks / limitations
ER2-C2 remains private/shadow-only. No C3/C4, BSE resolver integration, source recovery, real-data characterization, persistence, UI, or Apply-authority expansion is authorized.

A pre-existing NSE symbol-change byte parser stages validation bytes through a temporary filename derived from SystemTime nanoseconds plus process ID only. The 14-Sep flake diagnostic proved default-parallel ER2-C2 execution can collide on Windows (focused parallel 7/8 PASS) while exact T13 10/10, T13 group 6/6 and focused serial 4/4 all PASS. This helper is outside the bounded ER2-C2 change and was not modified; affected NSE/ER2-C2 validation is serialized for this closure.

## Rollback guidance
Restore src-tauri-shell/src/database/nse_identity_imports.rs to SHA-256 
55F30A01CF305F5F35E926F60DA577DAF55DC185D0CE31E601149AE31C800E63
 and verify the exact 541-file PRE digest 
D00992A4E5A6E8191711274CF25402B2EC03EA9589C67690396F68D4122F8D7A
.
