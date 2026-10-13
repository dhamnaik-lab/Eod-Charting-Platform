# CA Dividend Simple Cash Prepared-Scope Tauri Bridge TDD R1

**IST timestamp:** 2026-10-06 1721 IST

## Objective
Implement P3A only: a typed read-only Tauri/TypeScript bridge from the desktop API to the closed P2 prepared-scope evaluator.

## Previous limitation
P1 could freeze the frontend prepared scope and P2 could evaluate it internally, but no public read-only Tauri bridge existed between them.

## RESUME formatter corrections
The first P3A run stopped before baseline/RED/GREEN because database.rs had one task-owned formatter hunk; RESUME1 applied that exact hunk. RESUME1 then passed database.rs rustfmt and stopped at corporate_action_imports.rs, where native rustfmt showed PRE=74 hunks and candidate=77 hunks. Exact comparison produced six candidate-only signatures and three PRE-only signatures. One candidate/PRE pair is the same pre-existing ca_ux_fix2 formatting debt after ignoring blank-only +/- lines, so RESUME2 deliberately preserves those unrelated bytes. RESUME2 applies exactly the remaining five task-owned formatter hunks: P3A-added imports, P2-result DTO mapping, and P3A test-module declarations. No bridge semantics, command name, P2 evaluator bytes, Safe V2 mutation owner, or write behavior changed. RESUME2 native rustfmt reported PRE=74 and candidate=71, not the predicted 72. Exact comparison proves 70 exact common hunks, one candidate-only exact hunk paired to the same proven blank-line-only legacy-equivalent ca_ux_fix2 PRE hunk, four PRE-only hunks, and zero task-owned candidate extras. Three unmatched PRE-only hunks are import-list formatter debt subsumed by the task-overlapping P3A import additions/reformatting. RESUME3 corrects only this validation count model; all P3A product candidate bytes remain unchanged. Native RESUME3 proved database.rs, corporate_action_imports.rs and main.rs formatter gates clean, then stopped at the additive Rust bridge test with exactly one task-owned rustfmt hunk. RESUME4 applies only that sole formatter hunk to the additive bridge test; no production command/DTO/bridge bytes change. Native RESUME4 proved all formatter gates, frontend baseline 6/6, Rust lookup baseline 6/6, P2 baseline 52/52, genuine frontend RED, and frontend GREEN 9/9, then stopped compiling the Rust bridge with exactly two E0433 errors because `PriceStoreOperationKind` was referenced by the new read-only command but omitted from the existing `super` import list. RESUME5 adds only that missing enum import; the command body, DTO mapping, Safe V2 command, tests, TypeScript bridge and write boundaries are unchanged. The already-proven RESUME4 baseline/RED/frontend-GREEN evidence is inherited by exact SHA binding; native RESUME5 resumes at the Rust bridge GREEN gate and reruns all affected/compile/build/post-install validations.

## Files changed
- ADD `src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeTauriBridge.test.ts` — C82D3B22518C6FD0DD5C652EEC3A9FCE5631DA1B2A8B13837825DF578C4D0054 (6184 bytes)
- MODIFY `src/platform/tauriDesktop.ts` — FF751364376D28BABB89B544917C937D736F6DAC2D41B1E1F529BAABF5CBCA53 (22655 bytes)
- MODIFY `src/platform/types.ts` — 1B3F20363754B0AE0B5ABC20732B561A414B94D6C0B1EB13BE2874D9DF732D24 (11345 bytes)
- MODIFY `src/types/desktop.ts` — 6D1FFCB370E983271C1CCDAB5D82C4BA92C245C6C9BB6B2860B7A96E6E9E9197 (61461 bytes)
- ADD `src-tauri-shell/src/database/corporate_action_imports/dividend_prepared_scope_bridge_tests.rs` — 9ECE687B0DEA73B35A69D8BCDDC501373750DB0BB440BB9C0A11864CC4032885 (3288 bytes)
- MODIFY `src-tauri-shell/src/database/corporate_action_imports.rs` — 86652021AEDCBDB7F40BFC40D4C470894C09F4A9C71FD6409F17379A5E93D176 (573122 bytes)
- MODIFY `src-tauri-shell/src/database.rs` — 94BE1F023D0D0CEB27A187FEC40297E0C68543250D0CABDB8313E0F443D57EB7 (74385 bytes)
- MODIFY `src-tauri-shell/src/main.rs` — 13B77F157EEBF42A5C31846D71C218C9365C8C8F8D56FD587D3507CA40591AF6 (49328 bytes)

## Final implementation
Adds public camelCase input/evidence/disposition/result DTOs, a dedicated `evaluate_simple_cash_dividend_prepared_scope` command, explicit mapping from P2 internal types, Tauri registration, DesktopBridgeApi/DesktopApi exposure and the exact `evaluateSimpleCashDividendPreparedScope` frontend bridge method. The command validates exact IDs/database binding, acquires the existing CorporateActionAutomatic price-store fence, opens only a read-only database connection and delegates to P2.

## Behaviour preserved
P2 `auto_approval.rs` remains byte-exact; Safe V2 mutation command remains byte-exact; P1 builder/tests, existing Load & Prepare orchestration, DatabaseToolsDialogs/manual workflow, classifier/shared basis/Rights, schema/settings and legacy README overlays remain unchanged. No frontend caller or observability is activated in P3A.

## Validation commands/results
- 00-controller-selftests: exit=0; log SHA256=E4829F63C20409C1546564E6E92099E27E5A94FAD333AF5A0917EFD32CC16898
- 01-rustc-version: exit=0; log SHA256=BC35C51DC7D2BB4C4F32AEB16F731FE38622803B7ADA97CF0E296B1BA92CDAFD
- 02-cargo-version: exit=0; log SHA256=7B6778B336445CEA138966D146FB89F9A4E0B0833BAC3DBADEE4B3837DAFFBF0
- 03-node-version: exit=0; log SHA256=081C9BD778544FFDAF2F6CBCA1D9CD64A973993DFA4C95D7801D230E8E51A67A
- 04-rustfmt-database-pre: exit=1; log SHA256=76E058D8ADEC85CDFEFE9B1E89E527D80DAD7E962EF269431996BA5A5F76C8D5
- 04-rustfmt-database-candidate: exit=1; log SHA256=6E6AFC52E9866B9CC744AFB45E93A765D121E40FF993EC62A6FE714B479333CD
- 04-rustfmt-corporate_action_imports-pre: exit=1; log SHA256=62A76BA17F3D0ABBD59C7BB6DBFC52E6A103B33EDF3253407C80671569F9713E
- 04-rustfmt-corporate_action_imports-candidate: exit=1; log SHA256=FD79408855751DCBC703620CC9632449B583CE35F4AC6461A116A99E58571684
- 04-rustfmt-main-pre: exit=0; log SHA256=01BA4719C80B6FE911B091A7C05124B64EEECE964E09C058EF8F9805DACA546B
- 04-rustfmt-main-candidate: exit=0; log SHA256=01BA4719C80B6FE911B091A7C05124B64EEECE964E09C058EF8F9805DACA546B
- 04d-rustfmt-new-bridge-test: exit=0; log SHA256=01BA4719C80B6FE911B091A7C05124B64EEECE964E09C058EF8F9805DACA546B
- 10-green-rust-bridge: exit=0; log SHA256=D78B17907A08D1593328CB3D781772D1A8791AC8F50ECD07FD03B0215A88DC38
- 11-affected-frontend-regression: exit=0; log SHA256=FBE238B411210AC0B9AC14C2BD5CEEAC17954707B73795A8CE972FBD3A2DF775
- 12-affected-rust-lookup: exit=0; log SHA256=33F1155EB9B5D478563A8804BC88B9D1AC901302AD151EC674CF19081218F17A
- 13-affected-p2-auto-approval: exit=0; log SHA256=B79EDFD633F2854E8936244D2C463986C6E3BBC06349A85B872C644D438A6030
- 14-candidate-typecheck: exit=0; log SHA256=01BA4719C80B6FE911B091A7C05124B64EEECE964E09C058EF8F9805DACA546B
- 15-candidate-cargo-check: exit=0; log SHA256=EE2FC3ABC649424C8EC925F6DF5EF284D7B8465A8330D203F1611EC345529880
- 16-candidate-vite-build: exit=0; log SHA256=D303654123FBB00DC5B538440B133FA3A9C5BB9699CB836E63341727351EF176
- 17-scoped-preedit-backup: exit=0; log SHA256=4E19CA651F417995A301A672E7F78585052647101EB9B3490020BC69437706E6
- 18-post-install-frontend-regression: exit=0; log SHA256=941001E5D9577C1A11729558303CB618D8264DFEB421E8BACB802C720C0AF104
- 19-post-install-rust-bridge: exit=0; log SHA256=1915D5B45B65DD78BD55979AA2D5668B9979DD9763A15F6F353D7E1EE4FFA5D2
- 20-post-install-rust-lookup: exit=0; log SHA256=0AC4E7F3B8B01640BFEBA5A1B5FF4FDF79162C43FE7A6F46CC39E365C7764EB4
- 21-post-install-typecheck: exit=0; log SHA256=01BA4719C80B6FE911B091A7C05124B64EEECE964E09C058EF8F9805DACA546B
- 22-post-install-cargo-check: exit=0; log SHA256=C9D42DCB1C5D9A79CF9FD251DE7089F6E5BC8512FAFCC15CC7859CB6EAD443F7
- 23-post-install-vite-build: exit=0; log SHA256=A9DBF6B17A216E701589811847CB2A05A05B8AE2B41E8166827108D528DB3AFE

Final results: inherited exact RESUME4 evidence — frontend baseline 6/6; Rust lookup baseline 6/6; P2 baseline 52/52; genuine frontend RED; frontend GREEN 9/9. Native RESUME5 — Rust bridge 2/2; frontend affected 15/15; Rust lookup affected 6/6; P2 affected 52/52; candidate typecheck/Cargo check/Vite build PASS; post-install frontend 15/15; post-install Rust bridge 2/2; post-install Rust lookup 6/6; post typecheck/Cargo check/Vite build PASS. Rustfmt preflight introduced zero candidate-only hunks.

## Risks / limitations
The bridge is callable through DesktopApi but has no product caller yet. P3B must implement current-cycle batching/protocol validation. `ELIGIBLE` remains diagnostic only and is not durable write authority. Autonomous Dividend writes remain inactive.

## Rollback guidance
Restore the six modified files from `E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_2026-10-06_1703_IST_CA_DIVIDEND_PREPARED_SCOPE_TAURI_BRIDGE_R1` after confirming live hashes still match this POST. Delete only the two additive P3A test files if their hashes still match this record. Preserve every other source file and both historical README overlays.

## Authority / evidence
- Behavior/source PRE: 599 rows; POST: 601 rows.
- Broad live PRE: 601 rows; POST: 603 rows.
- P2 RESUME2 evidence SHA256: `1627526BB6DE7F8EEE8772C178C69466DC0BD4D132F823D8C1219F7BDB19480F`.
- Orchestration design SHA256: `CCEBF3DD91E23ABA2D86C332C7C780249895386B542D6F43A1B0CB12EE8B75B2`.
- Phase5E4 network gate remains OPEN / UNSATISFIED / DEFERRED.
