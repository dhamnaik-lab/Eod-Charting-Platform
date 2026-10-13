# CA Dividend Simple Cash Prepared-Scope Evaluator TDD R1

**IST timestamp:** 2026-10-06 1300 IST

## Objective
Implement P2 only: a backend read-only batch evaluator for exact prepared-scope Dividend import IDs.

## Previous limitation
P1 could freeze the current Prepare-cycle scope, but the backend had no read-only batch owner for stale/missing/already-approved/ineligible/eligible dispositioning without mutation.

## RESUME history and formatter correction
The first P2 run passed the accepted baseline 41/41 and stopped before installation because the RED compile probe contained six literal backslash-n byte pairs instead of actual newline bytes. RESUME1 corrected only that RED fixture, then proved the expected E0425 surface, prepared-scope 11/11 and affected 52/52 before stopping at rustfmt because the GREEN candidate had 12 task-owned formatter hunks beyond the accepted 44-hunk legacy debt. RESUME2 applies exactly those 12 formatter-requested task-owned hunks to the exact RESUME1 GREEN bytes. Protected existing functions and approval/decision writer call counts remain byte/count identical, while the final candidate rustfmt debt is required to be exactly the accepted 44 legacy hunks with zero extras.

## Files changed
- MODIFIED `src-tauri-shell/src/database/corporate_action_imports/auto_approval.rs`
  - PRE SHA256 `FB96C923335130906A3D8680C7E97EF1EC75801BF2AA0EE311923BB1DA03B8A8` (84561 bytes)
  - POST SHA256 `F93E8999227BB2ED0D251033192851CA814B7CC6D34C9AF2D4902F7DD9D5BB5F` (104475 bytes)

## Final implementation
Adds internal prepared-scope input/disposition/result types, deterministic scope fingerprinting, exact-ID and expected-database guards, sorted deterministic evaluation, MISSING/STALE_SCOPE/ALREADY_APPROVED/INELIGIBLE/ELIGIBLE/FAILED dispositions, and delegates eligible structural rows to the already accepted `evaluate_simple_cash_dividend_policy_r1`. It performs no approval, canonical-action, decision, status, schema, UI or Tauri command write.

## Behaviour preserved
Existing Dividend policy evaluator, Safe V2 evaluator, Split/Bonus scan basis, mutation batch/write owner, P1 frontend builder, manual flow, classifier/shared basis/Rights, UI/settings/schema and two legacy README overlays remain unchanged.

## Validation commands/results
- 00-controller-selftests: exit=0; log SHA256=5FE8770E9520486AB58042B411840936186CB4659BAF18B4FC324793525DCB0A
- 01-rustc-version: exit=0; log SHA256=BC35C51DC7D2BB4C4F32AEB16F731FE38622803B7ADA97CF0E296B1BA92CDAFD
- 02-cargo-version: exit=0; log SHA256=7B6778B336445CEA138966D146FB89F9A4E0B0833BAC3DBADEE4B3837DAFFBF0
- 03-baseline-auto-approval-tests: exit=0; log SHA256=B0A2554FFBE4C8559E9CDAA7DEAD8A4E845200FBB24F64C0730369640D28892B
- 04-red-missing-prepared-scope-evaluator: exit=101; log SHA256=409461D9C7B265903C190AB04F12F6D9ED72E9CEF07695BAC94A9FBCBCA712FC
- 05-green-prepared-scope-tests: exit=0; log SHA256=621FD8A2AC32876B369F13C386F3EFC5B4B6AB48809BA56AF59058C4627C380D
- 05b-affected-auto-approval-regression: exit=0; log SHA256=41487466ACC44E0D2BBFA2C5DC6D1A718B457FF4609161A8EBDA271EB477BDF5
- 06a-rustfmt-pre: exit=1; log SHA256=BB8F69737961480C9099DA06EE94D328B7473AD72DEAF661323188AB10429454
- 06b-rustfmt-candidate: exit=1; log SHA256=0664A46C18F099DC2D71BB27CF5EFD13EC7CCF3F554BF6FF9559165E2E6420FE
- 07-cargo-check-candidate: exit=0; log SHA256=9159ADDDA74A44BC93F52EBE9C55AECE8C8000C42717051A22EC7CEBDA99186F
- 08-scoped-preedit-backup: exit=0; log SHA256=E719104AC25827332306CDA9F28388E46D478FBE1A0AA7909F62B3EFC0FA4585
- 09-post-install-focused-regression: exit=0; log SHA256=CB3C87CE7203DA194627A15067B063FF6E658109C116E79EB14BED081E24B2B7
- 10-post-install-cargo-check: exit=0; log SHA256=D13481CEBB5F426C3AB5DB24EEEE9F0B553480B64EA81765B1EF6C59CB960F77

Final results: baseline 41/41; expected E0425 RED; prepared-scope 11/11; affected 52/52; rustfmt legacy-debt subset PASS; candidate Cargo check PASS; post-install 52/52; post-install Cargo check PASS. All new Rust tests use in-memory SQLite and temporary directories only.

## Risks / limitations
This is not exposed as a Tauri command and is not wired to Load & Prepare. A future P3 orchestration stage must define serialization/command ownership and may not treat an earlier ELIGIBLE result as durable write authority. Autonomous Dividend writes remain inactive.

## Rollback guidance
Restore only the backed-up PRE `auto_approval.rs` after verifying live bytes still equal the POST SHA above. Preserve all other files and the two legacy README overlays.

## Authority / evidence
- Behavior/source population remains 599 rows.
- Broad live protected population remains 601 rows.
- Builder RESUME3 evidence SHA256: `AA587E0216D8D9637444446FADDE7E1448A916E17CCEE99C827404EE1670EC05`.
- Network gate remains OPEN / UNSATISFIED / DEFERRED.
