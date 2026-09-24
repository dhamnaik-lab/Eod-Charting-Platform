# CA Reconciliation R1-A FIX4 RESUME2 — copy-local acceptance and source installation

IST timestamp: 2026-09-24T18:56:41.874038+05:30

## Objective
Complete the already-validated R1-A candidate after FIX4 stopped because the guarded real-cohort Rust test was invoked without `--ignored` and therefore did not execute.

## Previous defect / limitation
FIX4 proved the corrected two Rust contracts, 39/39 focused R1-A tests, owner regressions, cargo check, and the exact inherited V1.14Y RED policy. Phase 14 then reported 0 passed / 1 ignored because the test is deliberately marked ignored and requires a sealed query-copy environment.

## Files changed
Installed the exact retained FIX4 candidate only: 17 source paths total (8 added, 9 modified, 0 removed). No R1-A production byte was redesigned in RESUME2.

### Added source paths
- `src-tauri-shell/src/database/corporate_action_imports/reconciliation_preflight.rs`
- `src-tauri-shell/src/database/corporate_action_imports/reconciliation_preflight/tests.rs`
- `src/features/corporateActions/__tests__/corporateActionReconciliationExport.test.ts`
- `src/features/corporateActions/__tests__/corporateActionReconciliationPanel.test.tsx`
- `src/features/corporateActions/__tests__/corporateActionReconciliationPreflight.test.ts`
- `src/features/corporateActions/reconciliation/CorporateActionReconciliationPanel.tsx`
- `src/features/corporateActions/reconciliation/corporateActionReconciliationExport.ts`
- `src/features/corporateActions/reconciliation/corporateActionReconciliationPreflight.ts`

### Modified source paths
- `src-tauri-shell/src/database.rs`
- `src-tauri-shell/src/database/connection_registry.rs`
- `src-tauri-shell/src/database/corporate_action_imports.rs`
- `src-tauri-shell/src/database/corporate_action_imports/repair_preview.rs`
- `src-tauri-shell/src/main.rs`
- `src/components/DatabaseToolsDialogs.tsx`
- `src/platform/tauriDesktop.ts`
- `src/platform/types.ts`
- `src/types/desktop.ts`

## Final implementation
R1-A adds the backend-owned read-only Reconciliation Preview plus the existing approved frontend diagnostic selection and CSV/TXT export. This RESUME2 only corrected the execution contract for the existing ignored copy-local acceptance test: exact three environment keys plus Cargo `--ignored`.

## Behaviour preserved
Safe V1 remains authoritative; manual approval, PENDING_ISIN_MISMATCH, AUTO-ID1, the 20MICRONS transition proof, compound-auto exclusion, existing approval writers and raw-price adjustment-on-read are unchanged. R1-A performs zero repairs and zero approval writes.

## Validation commands / actual results
Inherited FIX4 evidence (not rerun in RESUME2): corrected tests GREEN, R1-A focused 39/39, context 2/2, Auto-Approval 11/11, AUTO-ID1 6/6, historical transition 10/10, Phase6E 9/9, Phase6F 3/3, Quick Resolve 2/2, Recheck 6/6, cargo check PASS, full Rust 687 PASS / exact one documented inherited RED / 2 ignored.
- 01-copy-local-real-cohort-preinstall: exit=0; 4711.153s; log SHA256=455BFC81ABB61872E55052A45008B8432876762ED4502BDC19A807C52042F110
- 02-post-install-r1a-focused: exit=0; 578.954s; log SHA256=714D553B1E52153EB7C4F2C7AA0D108176376D68BD8DC00C393A2CC95B07F4B0
- 03-post-install-copy-local-real-cohort: exit=0; 3639.532s; log SHA256=715F89BD020F3F0992D052BFDF89C2D458967A0D5751A92BD346753879C4BEA9

Pre-install copy-local fingerprint: `6AC14592A0ADB14433D2FA6CBB2059DC29B7ABCA5B76E065A378387EBD260C3C`
Post-install copy-local fingerprint: `6AC14592A0ADB14433D2FA6CBB2059DC29B7ABCA5B76E065A378387EBD260C3C`
Copy-local logical database fingerprint preserved in both executions.

## Actual source installation
Source inventory: 561 -> 569 exact. Installed paths: 17. Backup covers the 9 modified pre-existing source files; the 8 additions are removable by hash-bound rollback.

## Evidence authorities
FIX1 failure evidence: `1856B5CCBB3BACFCA8667C768F043E3EEE33A34106515ADCD78905083985117A`
FIX4 failure evidence: `E35390330C0A7390A297ABF1E948428C6D3E9094BAF8BE0B705AFE4705E130ED`
Environment-contract evidence: `8D591248118BCB6DC180A91C63F26006FD14A067402BA7BFB4BDA1DFA42D56A1`

## Risks / limitations
This closes only R1-A read-only reconciliation preview/export source and its copy-local 112-row acceptance. Coverage certification remains NOT_ASSESSED and databaseComplete remains false. R1-B repair execution, R1-C live approval/portable acceptance, and standard portable replacement remain separate gated work.

## Rollback guidance
Use the retained RESUME2 source backup and install journal. Restore only task-owned modified files whose current bytes still equal the installed candidate hashes; remove only the eight task-added paths whose hashes still equal the installed candidate. Do not restore the database, reset Git, or delete unrelated tmp/cache content.
