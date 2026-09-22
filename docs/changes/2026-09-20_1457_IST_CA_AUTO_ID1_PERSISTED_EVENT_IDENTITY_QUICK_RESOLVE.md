# CA AUTO-ID1 — persisted event-identity Quick Resolve integration

## IST timestamp
2026-09-20 14:57:38 IST

## Objective
Allow the existing strict Corporate Action Quick Resolve path to consume an exact persisted V1.14D.1 pre-transition event-identity resolution while preserving explicit Corporate Action approval.

## Previous defect / limitation
`Load & Prepare` could automatically quick-resolve only rows backed by exact event-date historical ISIN evidence. Existing `corporate_action_event_identity_resolutions` rows that had already been produced under `V1.14D.1_RAW_NSE_IDENTITY_EXACT_MATCH` were not consumed by the strict Quick Resolve path, leaving evidence-proven UNRESOLVED rows blocked.

## Files changed
- `src-tauri-shell/src/database/corporate_action_imports.rs`
- `src-tauri-shell/src/database/corporate_action_imports/event_identity_authority.rs`
- `src-tauri-shell/src/database/corporate_action_imports/event_identity_maintenance.rs`
- `src-tauri-shell/src/database/corporate_action_imports/event_identity_resolution.rs`

## Final implementation
- Extracts the exact existing V1.14E/V1.14D.1 resolution fingerprint construction into the shared event-identity authority owner without changing its canonical JSON fields or SHA-256 semantics.
- Reuses that fingerprint from the maintenance path, preserving existing authority behavior.
- Adds a read-only verifier that accepts only persisted rows matching the embedded V1.14E authority, resolution type/authority, source evidence, V1.14D.1 evidence hash, transition fields and recomputed fingerprint.
- Extends the existing strict Quick Resolve proof with one alternative: a verified persisted event-identity resolution whose raw import/date/action and unique active current target match exactly.
- Keeps ordinary exact event-date historical ISIN Quick Resolve unchanged.
- Writes `VERIFIED_EVENT_IDENTITY_RESOLUTION` audit decisions for the new proof path.

## Behaviour preserved
- `PENDING_ISIN_MISMATCH` is not auto-resolved by AUTO-ID1.
- Ordinary Quick Resolve remains available exactly as before.
- No Corporate Action is auto-approved.
- No database schema, Tauri command surface, frontend source, chart adjustment preference, raw price data or operational database path is changed.
- Unsupported/ambiguous/post-transition cases remain blocked.

## Validation commands / results
- Genuine focused RED: AUTO-ID1 tests fail before production change for the missing shared fingerprint/verified-resolution integration.
- Focused AUTO-ID1 GREEN: see evidence logs.
- Existing `quick_resolve_` regression: see evidence logs.
- Existing `recheck_` regression: see evidence logs.
- Existing `v114e_` regression: see evidence logs.
- Full `database::corporate_action_imports::tests::` Rust regression: see evidence logs.
- `cargo check --locked --offline`: see evidence logs.

## Source hashes
{
  "pre": {
    "src-tauri-shell\\src\\database\\corporate_action_imports.rs": "CFA150E9BA387C0E31670AB8D81EA0DFEF57C0AAB1FD603A325DD0064CEE9E43",
    "src-tauri-shell\\src\\database\\corporate_action_imports\\event_identity_authority.rs": "D3A85D4AAAE9FCA0C5B46B49375E22B9A3CF0E2D4F2BEA11C26BF5F3D91909F5",
    "src-tauri-shell\\src\\database\\corporate_action_imports\\event_identity_maintenance.rs": "0246200C10681648AC5F08EF7200A24A36AD4A920473D036F676ACB566A8F206",
    "src-tauri-shell\\src\\database\\corporate_action_imports\\event_identity_resolution.rs": "4F42C2CEF771C197BFD19A655F8967DABCB3B62F984ECF8035E541D8A0A0A215"
  },
  "post": {
    "src-tauri-shell\\src\\database\\corporate_action_imports.rs": {
      "bytes": 500367,
      "sha256": "E2E75699D36F9BCBFB2CBB5C7BD4BA06BB749B98816B4E5C4F64788CDF7DCDCE"
    },
    "src-tauri-shell\\src\\database\\corporate_action_imports\\event_identity_authority.rs": {
      "bytes": 9305,
      "sha256": "882786B73FD52EAA44DAC5335618D9CE1F445B2BF96EC17635056ABC921CB82A"
    },
    "src-tauri-shell\\src\\database\\corporate_action_imports\\event_identity_maintenance.rs": {
      "bytes": 37113,
      "sha256": "4D666DD4D490E6C1818719A5C0C25E01E9EDE0DD4CADCC6B794A41ED13779000"
    },
    "src-tauri-shell\\src\\database\\corporate_action_imports\\event_identity_resolution.rs": {
      "bytes": 23031,
      "sha256": "7174E5312E7BDD94C681166E94FDA456124380852EA757C30991610C2FEDF92C"
    }
  }
}

## Backup / rollback
Pre-change backup: `C:\Users\dharm\Downloads\EOD_CA_AUTO_ID1_PRECHANGE_BACKUP_2026-09-20_145736_IST.zip`
SHA256: `B11E82443275C300A858FA5020C71B949AC17D91B0AEC3F506E964262865C4CC`
Rollback: restore the four source files from that ZIP and remove this change record. No DB rollback is required because this implementation/validation task does not open or mutate a user database.

## Risks / limitations
- Runtime TEST-database acceptance against the characterized nine 360ONE rows remains a separate checkpoint after source validation.
- AUTO-ID1 intentionally does not repair 20MICRONS transition semantics or post-transition stale-ISIN rows.

## Evidence
Final evidence ZIP path/hash is emitted by the AUTO-ID1 controller after archive verification.
