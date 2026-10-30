# CA Decision Automation R1 — Provisional Implementation Record

**IST checkpoint:** 18 October 2026, 18:48 IST  
**Status:** SOURCE CANDIDATE PREPARED. Windows native validation, portable packaging and user manual acceptance PENDING. Do not classify this change as closed.

## Objective
Within the existing Fetch → Load & Validate → explicitly Approve Ready workflow, automatically resolve only identity decisions backed by the backend’s already established strict historical-ISIN transition proof. Preserve the current UI, raw price storage, manual financial approval boundary and P5 fail-closed state.

## Previous limitation / focused diagnosis
`strictQuickResolveCorporateActionRows` selected only `UNRESOLVED` imports. The existing Rust quick-resolve API and historical transition proof also rejected `PENDING_ISIN_MISMATCH` categorically. Even where verified, single-candidate pre-transition evidence already existed, this prevented automatic identity-only classification during Load. The backend hint put recommended ISIN exceptions ahead of a genuinely strict proof.

## Files changed
- `src-tauri-shell/src/database/corporate_action_imports.rs`: identity proof/gate, hint precedence, narrow unit coverage. No approval handler changes.
- `src-tauri-shell/src/database/corporate_action_imports/historical_isin_transition.rs`: permit `PENDING_ISIN_MISMATCH` to be considered for the existing **strict pre-transition DIVIDEND** proof. All date, approval-linkage, exact tuple and provenance checks remain mandatory.
- `src/features/corporateActions/legacy/corporateActionImportOperations.ts`: include ISIN-review rows in strict hint/re-resolution during Load.
- `src/features/corporateActions/__tests__/corporateActionPendingPreparation.test.ts`: mocked explicit-only Load regression for proven/unproven rows and zero auto-approval.

## Exact behavior changed
A `PENDING_ISIN_MISMATCH` can advance to `PENDING` **only** when the currently executed backend strict Quick Resolve proof passes with exactly one active candidate and a verified exact-date ISIN or previously approved pre-transition same-symbol split proof. Persisted event-identity resolution remains limited to `UNRESOLVED`. Each transition-based identity decision writes a distinct audit decision; no corporate-action approval occurs during Load.

## Behavior preserved
- User must explicitly click Approve Ready, subject to backend rechecks.
- Unproven ISIN exceptions and ambiguous/multi-active identities remain blocked.
- Unmatched/stale price scans and missing raw EOD evidence remain blocked.
- No `.eod` file rewrite, database schema modification, network Fetch, silent approval, or plugin JS activation introduced.
- Current layouts, settings, charts and P5 fail-closed code are untouched.

## Validation and evidence
- Snapshot authority: operator `PASS_EXACT_SNAPSHOT_SOURCE_MATCH`, 633 paths, changed=0, missing=0, new CA files=0; uploaded snapshot SHA-256 `FCF6BDD956A44C032E5E749E4466C66EA865F0C469BE6D8BC5CAB8CC00EE75B8`.
- Source inspection and candidate hashes: file hashes in accompanying package `manifest.json`.
- Container: static patch/ZIP checks performed; **Rust/Cargo and repository dependencies unavailable**, so no native build, native tests, or portable file was produced here.
- Windows runner: pending. The runner will execute focused Vitest, in-memory Rust unit regressions (no physical synthetic DB files), Rust format verification, renderer typecheck/build, Cargo check and isolated portable build, and print actual results.
- Final operator manual smoke test and approval: pending; update this document with the command results and final acceptance decision only after evidence is available.

## Risks / limits
Verified historical transition identity can be applied to prior dividend rows with old official ISIN; only strict existing proof can unlock it. Source-side verification does not prove actual live NSE approval outcomes. Some historical mismatches will appropriately remain manual (insufficient evidence). No validation of live DB contents occurred in this task.

## Rollback
A Windows runner must back up the exact four original source files, verify every pre/post SHA and restore originals on validation failure. To manually roll back an accepted application, restore these originals from its dated Source Audit backup after closing the app. Keep historical CA adjustment approvals and raw EOD/backup evidence untouched.

## Completion criteria still pending
Native test receipts, Windows portable EXE + asset integrity, operator’s **single** manual Fetch → Load & Validate → Approve smoke test with explicit consent, and final documentation update. Do not promote status to complete before all checkpoints pass.

## RESUME3 focused regression-contract correction — 20261019-030103 (IST operator machine)
The former negative test used a verified 2012 pre-transition DIVIDEND mismatch, which this bounded change intentionally permits. RESUME3 changes only that test to a 2017 post-transition stale-ISIN mismatch, retains OTHER-action exclusion, and asserts the manual-review-only error. The original R1 ZIP is unchanged; the exact staged Rust post-hash is recorded below.
## Windows runner evidence — 20261019-030103 (IST operator machine)
PASS_PACKAGE_SHA256=A6F4518036B830435186018208A66754AABF3379942028A4AF9A6465A0295079
PASS_SNAPSHOT_SHA256=FCF6BDD956A44C032E5E749E4466C66EA865F0C469BE6D8BC5CAB8CC00EE75B8
PASS_LIVE_633_FILE_AUTHORITY
PASS_EXACT_4_FILE_PRE_AND_POST_SHA256
PASS_RESUME3_ONE_TEST_CONTRACT_CORRECTION_SHA256=4FFDE5C1183AC4F32027AE3A52EBD52848EFC43F853AF9A1261E1E4711304EE8
PRESERVED=Pretransition verified mismatch allowed; posttransition stale mismatch and OTHER action remain blocked; no financial approval.
PASS_SOURCE_BACKUP=E:\TA Projects\EOD Charting Platform Source Audit\CA Decision Automation Backup 20261019-030103
PASS_APPLIED_4_FILES
BASELINE_FORMAT_NOTE=Repository-wide rustfmt conformance is not established; narrow Rust parse and compile gates are enforced.
PASS_RUST_CA_IMPORTS_PARSE
PASS_RUST_CA_HISTORY_PARSE
VITEST_SCOPE=Canonical npm test script excludes tmp/**; six current-source CA test filters only
PASS_TS_CA_FOCUSED_VITEST
PASS_RUST_CA_VERIFIED_MISMATCH
PASS_RUST_CA_UNPROVEN_BLOCK
PASS_RUST_CA_EXISTING_TRANSITION
PASS_RUST_CA_EVENT_IDENTITY_FENCE
PASS_TS_TYPECHECK
PASS_CARGO_CHECK
PASS_VITE_BUILD
PASS_WINDOWS_TAURI_RELEASE_BUILD
PASS_PORTABLE_EXE_SHA256=E0EA5C563079967B2383EC065DD875009932DE0DAB8966279EC11E5EC4D09E3E
PASS_PORTABLE_ZIP_SHA256=4E0F95C840DB7B1FD345F37162268214B12481EE0CAE64DB7F0B059F7C9E3630
Portable=E:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart CA Decision Automation R1 20261019-030103
PortableZip=C:\Users\dharm\Downloads\EOD-Chart-CA-Decision-Automation-R1-Portable-20261019-030103.zip
**Manual acceptance remains PENDING.**
