# V1.14AD Cumulative Corporate Action Baseline Scope Audit

**IST timestamp:** 2026-08-28 17:38:15 +05:30 IST

## Objective

Identify the complete accepted Corporate Action source/test/documentation scope sitting above Git HEAD through V1.14AD, while separating unrelated accumulated working-tree changes and blocking unsafe whole-file staging of shared integration files.

## Previous defect or limitation

The exact PRE-B1 -> POST-B1 V1.14AD source patch reconstructs the accepted current source from its verified pre-B1 baseline but does not apply to Git HEAD. A V1.14AD-only commit is therefore structurally unsafe on this branch; cumulative Corporate Action baseline normalization is required.

## Files inspected

- Complete current Git status in source-audit scope.
- Verified 752-file source snapshot at E:\TA Projects\EOD Charting Platform Source Audit\Eod Charting Platform Source Code 2026-08-28_141317_IST.
- Dedicated backend Corporate Action module tree.
- Dedicated frontend src/features/corporateActions tree.
- Shared Rust/frontend command, schema, type, store, and UI integration paths.
- Corporate Action docs\\changes evidence.
- Final V1.14AD closeout evidence.
- Exact source-separation R1 authority.

## Classification model

- CA_BASELINE_REQUIRED — production/source-data needed by the accepted Corporate Action baseline.
- CA_TEST_REQUIRED — persistent Corporate Action regression tests.
- CA_DOCUMENTATION — Corporate Action change-evidence/documentation; commit grouping remains explicit.
- UNRELATED_OR_AMBIGUOUS — not proven as part of the Corporate Action baseline or requires separate attribution.

A second field, wholeFileStageSafe, prevents a required shared integration file from being mistaken for a safe whole-file Git add target.

## Files created

- 01-ca-baseline-classification.csv
- 02-ca-baseline-required.txt
- 03-ca-test-required.txt
- 04-ca-documentation.txt
- 05-unrelated-or-ambiguous.txt
- 06-whole-file-stage-safe-source-test-allowlist.txt
- 07-patch-separation-required.txt
- 08-unexpected-ca-marker-paths.txt
- 09-ignored-runtime-generated-status.json
- 10-ca-baseline-scope-audit.json
- helper/console/state evidence and this docs\\changes report.

## Files modified

- No production source/config/test file.
- No Git index entry.
- No database.
- No build/package output.

## Validation commands

- Exact SHA-256 verification of current package/source/tests/final closeout/final C2-R3 evidence/source-separation R1 evidence.
- Git index clean guard.
- Deterministic 752-file source snapshot count/byte/tree-hash verification.
- git status --porcelain=v1 -z --untracked-files=all.
- Per-path git diff inspection for Corporate Action markers in tracked shared-integration deltas.
- Current-file content inspection for untracked dedicated/source candidates.
- Per-file current SHA-256 comparison with the verified source snapshot.

## Actual validation results

- Source snapshot tree SHA-256: 194D8A54F54C4366D35397D2F535F076C8B071458B8D262FE3B2977F857581D2 — PASS.
- Accepted source drift count: 0.
- CA_BASELINE_REQUIRED: 24.
- CA_TEST_REQUIRED: 10.
- CA_DOCUMENTATION: 75.
- UNRELATED_OR_AMBIGUOUS: 459.
- Whole-file source/test safe: 25.
- Patch separation required: 9.
- Unexpected CA-marker paths: 23.

## CA_BASELINE_REQUIRED

- `src-tauri-shell/src/database.rs` — patch separation required
- `src-tauri-shell/src/database/corporate_action_imports.rs` — whole-file safe
- `src-tauri-shell/src/database/corporate_action_imports/controlled_identity_repair.rs` — whole-file safe
- `src-tauri-shell/src/database/corporate_action_imports/event_identity_authority.rs` — whole-file safe
- `src-tauri-shell/src/database/corporate_action_imports/event_identity_maintenance.rs` — whole-file safe
- `src-tauri-shell/src/database/corporate_action_imports/event_identity_resolution.rs` — whole-file safe
- `src-tauri-shell/src/database/corporate_action_imports/five_pair_consolidation.rs` — whole-file safe
- `src-tauri-shell/src/database/corporate_action_imports/five_pair_consolidation_apply.rs` — whole-file safe
- `src-tauri-shell/src/database/corporate_action_imports/historical_isin_bootstrap.rs` — whole-file safe
- `src-tauri-shell/src/database/corporate_action_imports/v114e_event_identity_authority.json` — whole-file safe
- `src-tauri-shell/src/database/eod_data.rs` — patch separation required
- `src-tauri-shell/src/database/instrument_mutations.rs` — patch separation required
- `src-tauri-shell/src/main.rs` — patch separation required
- `src/components/CommandPalette.tsx` — patch separation required
- `src/components/DatabaseToolsDialogs.tsx` — patch separation required
- `src/features/corporateActions/corporateActionBulkApproval.ts` — whole-file safe
- `src/features/corporateActions/corporateActionCompoundValidation.ts` — whole-file safe
- `src/features/corporateActions/corporateActionDate.ts` — whole-file safe
- `src/features/corporateActions/corporateActionEventIdentityPresentation.ts` — whole-file safe
- `src/features/corporateActions/corporateActionIdentityRecommendations.ts` — whole-file safe
- `src/features/corporateActions/corporateActionValidation.ts` — whole-file safe
- `src/platform/tauriDesktop.ts` — patch separation required
- `src/platform/types.ts` — patch separation required
- `src/types/desktop.ts` — patch separation required

## CA_TEST_REQUIRED

- `src-tauri-shell/src/database/corporate_action_imports/v114ad_tests.rs` — whole-file safe
- `src-tauri-shell/src/database/corporate_action_imports/v114t_tests.rs` — whole-file safe
- `src-tauri-shell/src/database/corporate_action_imports/v114w_tests.rs` — whole-file safe
- `src-tauri-shell/src/database/corporate_action_imports/v114x_tests.rs` — whole-file safe
- `src-tauri-shell/src/database/corporate_action_imports/v114y_tests.rs` — whole-file safe
- `src/features/corporateActions/__tests__/corporateActionBulkApproval.test.ts` — whole-file safe
- `src/features/corporateActions/__tests__/corporateActionCompoundValidation.test.ts` — whole-file safe
- `src/features/corporateActions/__tests__/corporateActionEventIdentityPresentation.test.ts` — whole-file safe
- `src/features/corporateActions/__tests__/corporateActionIdentityRecommendations.test.ts` — whole-file safe
- `src/features/corporateActions/__tests__/corporateActionValidation.test.ts` — whole-file safe

## CA_DOCUMENTATION

- `docs/changes/2026-08-04_1122_IST_MARKET_MOVERS.patch`
- `docs/changes/2026-08-04_1122_IST_MARKET_MOVERS_IMPLEMENTATION.md`
- `docs/changes/2026-08-04_2357_IST_MANUAL_BACKGROUND_MARKET_SCAN_V1.patch`
- `docs/changes/2026-08-05_2230_IST_DNN_RESEARCH_DATASET_EXPORT_V1.md`
- `docs/changes/2026-08-09_1240_IST_BHAVCOPY_RECOVERABLE_DURABILITY_CONTRACT_V1.md`
- `docs/changes/2026-08-09_1450_IST_MANUAL_IMPORT_RECOVERY_SESSIONS_V1.md`
- `docs/changes/2026-08-10_1336_IST_INDICATOR_CACHE_ISOLATION_AND_INVALIDATION_V1.md`
- `docs/changes/2026-08-14_0046_IST_CORPORATE_ACTION_CA1_SPLIT_BONUS_IMPLEMENTATION_PLAN_V1.md`
- `docs/changes/2026-08-14_0134_IST_CORPORATE_ACTION_SPLIT_BONUS_REVIEW_VALIDATION_V1.md`
- `docs/changes/2026-08-14_0158_IST_CORPORATE_ACTION_PHASE1_RUST_LIFETIME_FIX_V1_1.md`
- `docs/changes/2026-08-14_0243_IST_CORPORATE_ACTION_PHASE1_ISIN_EXCEPTION_TEST_FIX_V1_2.md`
- `docs/changes/2026-08-14_1441_IST_CORPORATE_ACTION_PHASE1_BULK_APPROVAL_UX_FIX_V1_3.md`
- `docs/changes/2026-08-14_1646_IST_CORPORATE_ACTION_PHASE1_APPROVE_ALL_READY_UX_V1_4.md`
- `docs/changes/2026-08-14_1850_IST_CORPORATE_ACTION_PHASE1_REVIEW_IDENTITY_WORKBENCH_UX_V1_5_1.md`
- `docs/changes/2026-08-14_2036_IST_CORPORATE_ACTION_PHASE1_BULK_IDENTITY_RECOMMENDATIONS_V1_6.md`
- `docs/changes/2026-08-15_1158_IST_CORPORATE_ACTION_PHASE1_SAME_DATE_COMPOUND_SPLIT_BONUS_VALIDATION_V1_7.md`
- `docs/changes/2026-08-15_1320_IST_CORPORATE_ACTION_PHASE1_COMPOUND_SCANNER_FIXTURE_COMPATIBILITY_V1_7_1.md`
- `docs/changes/2026-08-15_1323_IST_COMMAND_PALETTE_OVERLAY_AND_KEY_DISMISSAL_FIX.md`
- `docs/changes/2026-08-15_1705_IST_CORPORATE_ACTION_PHASE1_COMPOUND_PRICE_EVIDENCE_UI_V1_7_2.md`
- `docs/changes/2026-08-15_1905_IST_CORPORATE_ACTION_PHASE1_COMPOUND_RESIDUAL_PERCENTAGE_FIX_V1_7_3.md`
- `docs/changes/2026-08-16_CORPORATE_ACTION_PHASE1_CONTROLLED_HISTORICAL_ISIN_BOOTSTRAP_V1_9_2.md`
- `docs/changes/2026-08-16_CORPORATE_ACTION_PHASE1_CONTROLLED_HISTORICAL_ISIN_BOOTSTRAP_V1_9_2_2_RUST_LIFETIME_FIX.md`
- `docs/changes/2026-08-16_CORPORATE_ACTION_PHASE1_CONTROLLED_HISTORICAL_ISIN_BOOTSTRAP_V1_9_2_3_REPORTING_RECOVERY_FIX.md`
- `docs/changes/2026-08-16_OFFICIAL_WATCHLISTS_LAZY_DATA_W1_3.md`
- `docs/changes/2026-08-16_RUST_WARNING_HYGIENE_W1_1.md`
- `docs/changes/2026-08-16_VITE_ESM_CONFIG_W1_2.md`
- `docs/changes/2026-08-17_CANONICAL_DOCUMENTATION_RECONCILIATION.md`
- `docs/changes/2026-08-18_CORPORATE_ACTION_PHASE1_V1_12_1_FINAL_IDENTITY_AUDIT_CLOSEOUT.md`
- `docs/changes/2026-08-18_CORPORATE_ACTION_PHASE1_V1_13B_1_1_WINDOWS_VALIDATION_TEMPFILE_CLEANUP_FIX.md`
- `docs/changes/2026-08-18_CORPORATE_ACTION_PHASE1_V1_13B_1_2_CSV_REPORTING_PROJECTION_FIX.md`
- `docs/changes/2026-08-18_CORPORATE_ACTION_PHASE1_V1_13B_1_3_CANONICAL_MUTATION_ORDER_REGRESSION_FIX.md`
- `docs/changes/2026-08-18_CORPORATE_ACTION_PHASE1_V1_13B_1_SIX_ROW_HISTORICAL_ISIN_REPAIR_IMPLEMENTATION.md`
- `docs/changes/2026-08-18_CORPORATE_ACTION_PHASE1_V1_13B_1_SIX_ROW_SCOPE_REVISION_DESIGN_LOCK.md`
- `docs/changes/2026-08-18_CORPORATE_ACTION_PHASE1_V1_13C_1_1_APPLY_GATE_MARKER_COMPATIBILITY_FIX.md`
- `docs/changes/2026-08-18_CORPORATE_ACTION_PHASE1_V1_13C_1_INDEPENDENT_POST_AUDIT.md`
- `docs/changes/2026-08-19_2327_IST_DNN_RESEARCH_EXPORT_FOLDER_PERSISTENCE.md`
- `docs/changes/2026-08-19_CORPORATE_ACTION_PHASE1_V1_13_FINAL_DOCUMENTATION_EVIDENCE_RECONCILIATION.md`
- `docs/changes/2026-08-19_CORPORATE_ACTION_PHASE1_V1_14E_1_IMPLEMENTATION_PLAN_LOCK.md`
- `docs/changes/2026-08-19_CORPORATE_ACTION_PHASE1_V1_14E_2_FOCUSED_RUSTFMT_VALIDATION_COMPATIBILITY.md`
- `docs/changes/2026-08-19_CORPORATE_ACTION_PHASE1_V1_14E_3_RUST_COMPILE_COMPATIBILITY.md`
- `docs/changes/2026-08-19_CORPORATE_ACTION_PHASE1_V1_14E_HISTORICAL_EVENT_IDENTITY_RESOLUTION_DESIGN_LOCK.md`
- `docs/changes/2026-08-19_CORPORATE_ACTION_PHASE1_V1_14E_SOURCE_IMPLEMENTATION.md`
- `docs/changes/2026-08-21_0045_IST_EOD_BINARY_STATE_INDEX_STORAGE_ARCHITECTURE_V1_4_APPEND_NEWEST_FAST_CLASSIFICATION.md`
- `docs/changes/2026-08-21_0240_IST_QUOTE_EDITOR_EXCHANGE_FILTER_AUDIT_LOGGING.md`
- `docs/changes/2026-08-22_2114_IST_STORAGE_QUOTE_EDITOR_WARNING_CLEANUP_CLOSEOUT.md`
- `docs/changes/2026-08-24_1833_IST_V1_14T_ORDINARY_CORPORATE_ACTION_EQUIVALENT_DEDUPE_HARDENING.md`
- `docs/changes/2026-08-24_2329_IST_BOOTSTRAP_SEED_DEFAULTS_TEST_FIXTURE_REPAIR.md`
- `docs/changes/2026-08-24_CORPORATE_ACTION_V1_14L_TO_V1_14M_1_1_CONTROLLED_REPAIR.md`
- `docs/changes/2026-08-24_CORPORATE_ACTION_V1_14M_2_INDEPENDENT_POST_AUDIT_CLOSURE.md`
- `docs/changes/2026-08-25_0025_IST_V1_14V_EXACT_LIVE_FIVE_PAIR_CONSOLIDATION_PREFLIGHT.md`
- `docs/changes/2026-08-25_0110_IST_V1_14W_FIVE_PAIR_CONSOLIDATION_MAINTENANCE_TDD.md`
- `docs/changes/2026-08-25_0155_IST_V1_14W_FIVE_PAIR_CONSOLIDATION_MAINTENANCE_IMPLEMENTATION.md`
- `docs/changes/2026-08-25_0929_IST_V1_14W_STACK_SAFE_HASH_AND_PRIVATE_COPY_DRY_RUN.md`
- `docs/changes/2026-08-25_1131_IST_V1_14X_CONTROLLED_LIVE_APPLY_TDD.md`
- `docs/changes/2026-08-25_1222_IST_V1_14X_CONTROLLED_LIVE_APPLY_IMPLEMENTATION.md`
- `docs/changes/2026-08-25_1256_IST_V1_14X_CONTROLLED_LIVE_APPLY.md`
- `docs/changes/2026-08-25_1446_IST_V1_14X_PORTABLE_WINDOWS_REBUILD_VALIDATION.md`
- `docs/changes/2026-08-25_1621_IST_V1_7A_PARALLEL_TEST_ISOLATION_FIX.md`
- `docs/changes/2026-08-25_1927_IST_V1_14Y_APPROVED_VALIDATION_HYDRATION_FIX.md`
- `docs/changes/2026-08-26_0015_IST_V1_14Y_APPROVED_VALIDATION_HYDRATION_R5_VALIDATION.md`
- `docs/changes/2026-08-26_0112_IST_V1_14Y_APPROVED_VALIDATION_HYDRATION_R6_COMPLETION.md`
- `docs/changes/2026-08-26_1301_IST_V1_14Y_PORTABLE_AND_MANUAL_SMOKE_CLOSEOUT.md`
- `docs/changes/2026-08-26_1309_IST_VITEST_TMP_TEST_DISCOVERY_HYGIENE.md`
- `docs/changes/2026-08-26_1540_IST_V1_14AB_PRIVATE_VALIDATOR_REPLAY_REPORTING_RECOVERY.md`
- `docs/changes/2026-08-26_1910_IST_V1_14AD_COMPOUND_EQUIVALENT_EVENT_DEDUPE.md`
- `docs/changes/2026-08-27_1145_IST_V1_14AD_PORTABLE_BUILD_AND_MANUAL_SMOKE.md`
- `docs/changes/2026-08-27_1311_IST_V1_14AD_FRESH_PORTABLE_REBUILD.md`
- `docs/changes/2026-08-28_1121_IST_V1_14AD_FINAL_CLOSEOUT.md`
- `docs/changes/2026-08-28_1513_IST_V1_14AD_GIT_ONLY_COMMIT_ATTRIBUTION_PREFLIGHT_R3.md`
- `docs/changes/2026-08-28_1658_IST_V1_14AD_PRE_B1_POST_B1_SOURCE_SEPARATION_AUDIT_R1.md`
- `docs/changes/evidence/2026-08-18-corporate-action-v1-13b-1-six-row-authority.json`
- `docs/changes/evidence/2026-08-18-corporate-action-v1-13c-1-post-audit-ready.json`
- `docs/changes/evidence/2026-08-19-corporate-action-v1-13-final-closeout.json`
- `docs/changes/evidence/2026-08-19-corporate-action-v1-14e-design-authority.json`
- `docs/changes/evidence/2026-08-19-corporate-action-v1-14e-implementation-plan-basis.json`

## Unexpected CA-marker paths

- `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md` — manual attribution required
- `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md` — manual attribution required
- `FILE_INVENTORY.md` — manual attribution required
- `HANDOFF.md` — manual attribution required
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md` — manual attribution required
- `README.md` — manual attribution required
- `REQUIREMENTS.md` — manual attribution required
- `resources/dnn-trend/README.md` — manual attribution required
- `resources/dnn-trend/dnn-research-dataset-v1-manifest.schema.json` — manual attribution required
- `src-tauri-shell/src/database/daily_market_snapshot.rs` — manual attribution required
- `src-tauri-shell/src/database/dnn_research_export.rs` — manual attribution required
- `src-tauri-shell/src/manual_import_recovery.rs` — manual attribution required
- `src/components/SettingsDialog.tsx` — manual attribution required
- `src/features/marketMovers/MarketMoverRow.tsx` — manual attribution required
- `src/features/marketMovers/MarketMoversFullView.tsx` — manual attribution required
- `src/features/marketMovers/MarketMoversPanel.tsx` — manual attribution required
- `src/features/marketMovers/__tests__/marketMoversSnapshotService.test.ts` — manual attribution required
- `src/features/marketMovers/__tests__/marketMoversStore.test.ts` — manual attribution required
- `src/features/marketMovers/marketMoversSnapshotService.ts` — manual attribution required
- `src/features/marketMovers/marketMoversStore.ts` — manual attribution required
- `src/features/marketMovers/marketMoversTypes.ts` — manual attribution required
- `src/plugins/forecast/dnnTrend/__tests__/dnnResearchDatasetExportService.test.ts` — manual attribution required
- `src/plugins/forecast/dnnTrend/dnnResearchDatasetExportService.ts` — manual attribution required

## Classification

**CA_BASELINE_IDENTIFIED__UNEXPECTED_CA_MARKERS_REQUIRE_REVIEW**

CA markers exist outside curated dependency surface.

## Behavior deliberately preserved

- Current working-tree source/test bytes.
- Clean Git index.
- Existing 752-file preservation snapshot.
- Final V1.14AD closed implementation and evidence.
- No build/test/database/package operation.

## Risks or limitations

- CA_BASELINE_REQUIRED does not automatically mean whole-file staging is safe. Shared integration files remain blocked until exact Corporate Action hunks are separated from unrelated changes.
- UNRELATED_OR_AMBIGUOUS paths are excluded from the CA baseline allowlist unless a later focused audit proves a dependency.
- CA_DOCUMENTATION is intentionally separated from production/test scope so documentation commit grouping remains explicit.

## Recommended next step

Audit the unexpected CA-marker paths before any baseline staging or hunk separation.

**git add is intentionally not executed.**

## Rollback guidance

No production rollback is required because this audit changes no source or Git index state. The verified 752-file snapshot remains the source rollback authority.

## Status

**V1_14AD_CA_BASELINE_SCOPE_AUDIT_COMPLETE**
