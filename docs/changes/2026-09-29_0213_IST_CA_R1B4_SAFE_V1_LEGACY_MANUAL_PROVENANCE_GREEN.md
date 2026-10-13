# CA R1-B4 Safe V1 legacy/manual provenance GREEN

**IST timestamp:** 2026-09-29 02:13:11 IST

## Objective
Close the original R1-B4 Safe V1 provenance defect only. Legacy/manual exact-current identity must fail closed when preserved raw event identity conflicts and no qualifying machine-verifiable event-time proof exists.

## Previous defect / limitation
The accepted RED proved that an import could qualify through `EXACT_ACTIVE_CURRENT_IDENTITY` even when preserved raw event ISIN evidence conflicted with the stored/current ISIN and no qualifying event-time machine proof existed.

## Files changed
- `src-tauri-shell/src/database/corporate_action_imports/auto_approval.rs`
- this change record

## Final implementation
Installed the exact retained GREEN candidate previously prepared for R1-B4. The tested target is 42673 bytes with SHA256 `30A596B5197A4C0D979C6731E2590FB4862DFABFAB4498F5E0C7CEB5BAF4373E`. The implementation preserves the accepted exact-current/matching-raw and verified Quick Resolve paths while making the conflicting legacy/manual raw-event identity case ineligible with an explicit conflict reason.

## Behaviour preserved
- Auto-Approval Safe V1 policy version unchanged.
- 0.95 confidence threshold unchanged.
- Manual approval unchanged.
- `PENDING_ISIN_MISMATCH` unchanged.
- Quick Resolve/event-resolution/historical-transition proof paths preserved.
- R1-B1/R1-B2/R1-B3A1 behavior preserved.
- No frontend/schema changes.
- No database access/write, CA approval, SONAMLTD rehearsal, Git or network.

## Validation commands / results
One offline `cargo test --no-run` compile was run from the retained P1 workspace with the existing shared target cache. Cargo artifact summary: 393 artifacts, 392 fresh, 1 rebuilt, compiler errors=0, warnings=6.

Directly from the exact emitted test executable (SHA256 `70F2C6EC4190183EE915C813FBBE984D8E54F6A719FAA8041A9244D3EBBC9535`):
- R1-B4: 4/4 PASS.
- Existing Safe V1: 11/11 PASS.
- Quick Resolve: 5/5 PASS.
- AUTO-ID1: 6/6 PASS.
- R1-B3A1: 10/10 PASS.
- R1-B2: 5/5 PASS.
- R1-B1: 10/10 PASS.
- R1-A read-only regression subset: 39/39 PASS.
- Full Rust direct policy: 716 PASS / exact inherited V1.14Y RED only / 3 ignored.
- Post-install direct R1-B4 and Safe V1 smoke: PASS.
- Documentation reference check: PASS.

## Risks / limitations
The exact inherited V1.14Y RED remains unresolved and is not part of R1-B4. No SONAMLTD 3494 writer rehearsal or live approval was performed. Broader Dividend/Rights/Demerger automation remains unimplemented.

## Rollback guidance
Pre-edit backup: `E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260929_021305_CA_R1B4_SAFE_V1_PROVENANCE_GREEN`. Restore only the R1-B4 target from that backup if a separately authorized rollback is required; do not alter databases or raw EOD data.

## Evidence / hashes
- Target SHA256: `30A596B5197A4C0D979C6731E2590FB4862DFABFAB4498F5E0C7CEB5BAF4373E`
- Test executable SHA256: `70F2C6EC4190183EE915C813FBBE984D8E54F6A719FAA8041A9244D3EBBC9535`
- P2 evidence archive: `CA_RESTART_P2_2026-09-28_232201_IST_50adda65_evidence.zip` (final SHA256 is printed by the runner after archive creation).
