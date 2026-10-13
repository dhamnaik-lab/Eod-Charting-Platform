# Legacy Corporate Actions Raw active-path cleanup

IST timestamp: 2026-09-25T10:31:12.957627+05:30

## Objective
Remove the retired project-specific `E:\TA Projects\Corporate Actions Raw` hint/test dependency now that the built-in official NSE identity fetch path is established, while preserving the optional manual archive workflow and all historical provenance.

## Previous limitation
The manual NSE identity UI still advertised the old project path, and one backend unit-test fixture plus one frontend source-structure test still depended on that literal. Source inspection confirmed there was no active Rust runtime fallback/default to that path.

## Files changed
- `src/components/DatabaseToolsDialogs.tsx`
- `src-tauri-shell/src/database/nse_identity_imports.rs` (test fixture string only; production Rust logic unchanged)
- `src/features/corporateActions/__tests__/corporateActionIdentityReviewedApplyAuthority.test.ts`

## Final implementation
The manual NSE archive input now uses the neutral placeholder `Select NSE archive root`. The backend override test uses a neutral fixture path. Two permanent frontend source-contract tests ensure the retired root is absent from the active UI/backend test owner.

## Behavior preserved
The Official inbuilt fetch path, optional Manual source mode, Browse Folder workflow, reviewed preview/apply authority, AUTO_APPROVAL_SAFE_V1, R1-B1, AUTO-ID1, 20MICRONS, CA approval, schema, and raw-price behavior are unchanged. The 184 historical provenance references in `v114e_event_identity_authority.json` and the event-identity presentation provenance fixture are byte-preserved.

## Validation commands/results
- TDD RED focused Vitest: 1 expected failure / 6 passes before the production edit; the UI retired-path assertion was RED, while the backend-fixture absence assertion was already GREEN before the test-fixture hygiene edit.
- Focused GREEN: 7/7 reviewed-apply tests PASS.
- Related identity Vitest files: PASS.
- Full Vitest: PASS.
- Renderer TypeScript typecheck: PASS.
- Renderer Vite build: PASS.
- Focused Rust manual-archive override test: 1/1 PASS.
- `cargo check --locked --offline --jobs 1`: PASS.
- Source authority after install: 569 files; exactly 3 modified paths; 0 added/removed.
- DB/Git/network/app-launch activity: 0/0/0/0.

## Risks / limitations
Manual source mode intentionally remains available; this change removes only the obsolete project-specific hint/test literal. Historical evidence still records the original source path where it is part of accepted provenance.

## Rollback guidance
Restore the three source files from `E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260925_090935_CA_LEGACY_RAW_PATH_CLEANUP`. No database rollback is required.

## Hash evidence
R1-B1 parent evidence SHA-256: `0874E0B3157179D0985D526F83A88CB94AC2BADFEC8D5C5084DA9611089F28AC`.

Post-cleanup source hashes:
- `src-tauri-shell/src/database/nse_identity_imports.rs` — `8E8A35ACE53511490572ABA9332E96CEDDB1FD60E1F835AAD509669BA894E84F`
- `src/components/DatabaseToolsDialogs.tsx` — `7E3600583B2FCE5A5BA4DA5E754F1F6FFAB1ACE385A58DB99D4F2C2AF7F6BE5E`
- `src/features/corporateActions/__tests__/corporateActionIdentityReviewedApplyAuthority.test.ts` — `4C9677B6940FE2DDDC120A0AA4BB56E56279A8C721F1BB3A60B5BE7B34067427`
