# CA Phase 5B Split/Bonus Safe V2 backend R1 FIX1

**IST timestamp:** 2026-09-29 23:01:16 IST

## Objective
Complete the approved Phase-5B Safe V2 backend after the parent run compiled and passed all 14 tests selected by the broad `phase5b_` filter, then stopped only because the harness expected the 9 newly added tests.

## Previous limitation
The parent filter matched 9 new Safe-V2 tests plus 5 pre-existing Phase-5B identity tests. All 14 passed. FIX1 reuses the exact compiled 732-test executable and selects the new Safe-V2 tests with non-overlapping filters; no second pre-install Cargo compile is performed.

## Files changed
- `src-tauri-shell/src/database/corporate_action_imports/auto_approval.rs`
- `src-tauri-shell/src/database/corporate_action_imports/reconciliation_preflight.rs`
- `src-tauri-shell/src/database/corporate_action_imports/reconciliation_preflight/tests.rs`
- `src/types/desktop.ts`
- `src/features/corporateActions/legacy/corporateActionImportOperations.ts`
- `src/features/corporateActions/__tests__/corporateActionPendingPreparation.test.ts`
- `src/features/corporateActions/__tests__/corporateActionOfficialImportsFix2.test.ts`
- `src/features/corporateActions/__tests__/corporateActionReconciliationExport.test.ts`
- `src/components/DatabaseToolsDialogs.tsx`
- `src/features/corporateActions/__tests__/corporateActionOfficialImportsFix2Wiring.test.ts`
- this change record

## Final implementation
- policy audit version `AUTO_APPROVAL_SAFE_V2`;
- near-unity discriminator `k=0.40`;
- ex-side evidence gap `G=7` calendar days;
- same-event/date cross-action exclusions;
- typed `ActionApprovalBasis::SplitBonusScan`;
- reconciliation preflight reads scan ID only from typed Split/Bonus evidence;
- minimal bridge/test literals migrated to Safe V2.

## Behaviour preserved
Existing NSE/PARSED/PENDING, R1-B4 identity/provenance, MATCHED, confidence >=0.95, writer staleness and Phase-5A operation lock remain intact. Normal Workflow/default-OFF family enablement, Dividend, Rights and Demerger automation remain outside Phase 5B.

## Validation
- parent candidate compile reused: exact executable SHA256 `E8FED0E7BEA2E34BBA574181B98994B1DD5366B131C6290FACB52874C9670BA7`;
- new Safe-V2 tests 8/8 + preflight typed-basis test 1/1;
- Safe-V1 regression 11/11; R1-B4 4/4; Phase-5A lock 3/3;
- full Rust 728 PASS / exact inherited V1.14Y RED only / 3 ignored;
- candidate focused frontend Vitest + TypeScript typecheck PASS;
- post-install exact Phase-5B 9/9 direct validation + cargo check + focused frontend/typecheck PASS.

## Backup
`E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260929_224821_CA_PHASE5B_SPLIT_BONUS_SAFE_V2_BACKEND_FIX1`

## Post-install target hashes
```json
{
  "src-tauri-shell/src/database/corporate_action_imports/auto_approval.rs": {
    "bytes": 52071,
    "sha256": "F61DC24344D93B5AC75977AB38F973FBE785D482174FB4DC34B3112AEFF6CF6B"
  },
  "src-tauri-shell/src/database/corporate_action_imports/reconciliation_preflight.rs": {
    "bytes": 50568,
    "sha256": "32167B12337E3198FBFF1647460135C5B71A53FA59A520B2773A8AEA625C58EB"
  },
  "src-tauri-shell/src/database/corporate_action_imports/reconciliation_preflight/tests.rs": {
    "bytes": 27342,
    "sha256": "10BE4358A977BD64BAF59E9EB684F4B1899BF4E04D7EA2539EABE0E0A369DE9C"
  },
  "src/components/DatabaseToolsDialogs.tsx": {
    "bytes": 386346,
    "sha256": "D2C4CC527030E29598A40A60CB7ADEE8608EF2E8EE9445C66A9AF565A94BA8A4"
  },
  "src/features/corporateActions/__tests__/corporateActionOfficialImportsFix2.test.ts": {
    "bytes": 15487,
    "sha256": "3F97A9E9A87D94D80E5E3683B6DB65D55E88F64E79F80F1E2CB70E3E6212A651"
  },
  "src/features/corporateActions/__tests__/corporateActionOfficialImportsFix2Wiring.test.ts": {
    "bytes": 4222,
    "sha256": "D35E5883D37E95A0F8E4BB5F0E55770AB120720332625E8AE804AD4FFFBF4198"
  },
  "src/features/corporateActions/__tests__/corporateActionPendingPreparation.test.ts": {
    "bytes": 9183,
    "sha256": "C6988BCDF2209AB7631027B968FF6ECB7643FC693104309B4327261DC49EE960"
  },
  "src/features/corporateActions/__tests__/corporateActionReconciliationExport.test.ts": {
    "bytes": 6579,
    "sha256": "7154CE535582427FF22F674A638FBD9378C203E6E3D1C7A947BA1F3D12D00B84"
  },
  "src/features/corporateActions/legacy/corporateActionImportOperations.ts": {
    "bytes": 30821,
    "sha256": "EF1E0ACD4023342BB3FD760D79B3D12F76D54AAC488FC413C706074957C774E1"
  },
  "src/types/desktop.ts": {
    "bytes": 59883,
    "sha256": "F9662092BC01F62B0C4B348067F0E18EBFC860D0FCADB82C9E328EBD69C3A0CD"
  }
}
```

## Post-install cargo check
exit=0 timeout=False
