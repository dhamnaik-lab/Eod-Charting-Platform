# CA Phase 5A shared price-store operation lock GREEN implementation R1

**IST timestamp:** 2026-09-29 17:05:01 IST

## Objective
Implement only the frozen Phase-5A shared in-process price-store operation lock proven RED by accepted evidence.

## Previous defect / limitation
Bhavcopy, Manual Import, Quote mutation and automatic Corporate Action processing used independent/no shared mutation authority. The accepted Phase-5A RED proved the shared `price_store_operation_lock` seam was absent with exact compiler error E0432.

## Files changed
- `src-tauri-shell/src/database/price_store_operation_lock.rs` (new)
- `src-tauri-shell/src/database.rs`
- `src-tauri-shell/src/bhavcopy.rs`
- `src-tauri-shell/src/imports.rs`
- `src-tauri-shell/src/database/corporate_action_imports.rs`
- this change record

## Final implementation
- one global app-process non-reentrant `try_lock` authority;
- exact busy reason `PRICE_STORE_OPERATION_BUSY`;
- outer acquisition for Bhavcopy single/batch, Manual Import import/undo, Quote upsert/delete variants, and automatic CA only;
- existing subsystem-local locks/recovery remain internal beneath the shared permit;
- ordinary/manual CA approval remains outside the shared lock;
- no wait/retry loop and no schema/frontend changes.

## Behaviour preserved
No Split/Bonus Safe-V2 policy, near-unity `k`, gap `G`, family enablement or Normal Workflow automation was implemented. Dividend/Rights/Demerger automation remains unchanged. No database access/write or CA approval occurred during this implementation runner.

## Validation commands / results
Pre-install one offline Cargo no-run compile: artifacts=393, fresh=392, rebuilt=1, errors=0, warnings=6.

Exact candidate executable SHA256: `2CCDE46BA0A1A2D48EA0900B321C23C7ECB9E2DA19281E75C79959B17B5A77B0`.

Direct candidate validation:
- Phase 5A lock tests: 3/3 PASS.
- Safe V1: 11/11 PASS.
- R1-B4: 4/4 PASS.
- Full Rust: 719 PASS / exact inherited V1.14Y RED only / 3 ignored.

Post-install validation:
- focused Cargo test exit=0;
- `cargo check --locked --offline --jobs 1` exit=0.

## Risks / limitations
This is an in-process coordination boundary only. It does not coordinate external processes and does not itself authorize storage access. Phase 5B/5C remain not started.

## Rollback guidance
Pre-edit backup: `E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260929_163659_CA_PHASE5A_SHARED_PRICE_STORE_LOCK_GREEN`. Restore the four modified pre-existing source files from that backup and remove `src-tauri-shell/src/database/price_store_operation_lock.rs` if a separately authorized rollback is required.

## Relevant hashes
Candidate source records:
```json
{
  "src-tauri-shell/src/bhavcopy.rs": {
    "bytes": 285293,
    "sha256": "863D7B091718E56491EE0A377441EB6FFA5B6A3FEF1E0035A011D2A9A856287D"
  },
  "src-tauri-shell/src/database.rs": {
    "bytes": 72736,
    "sha256": "4B1962983255B791F8192639824B5D0F655509EF13C963D9AE72BBE590B23306"
  },
  "src-tauri-shell/src/database/corporate_action_imports.rs": {
    "bytes": 568951,
    "sha256": "4ABCAE58416AA0B6683AB7C087C894A5412D21120B2DC38F0181F4783C1DE854"
  },
  "src-tauri-shell/src/database/price_store_operation_lock.rs": {
    "bytes": 5328,
    "sha256": "B625074F2722BF47D65D17CDC20BC4ECA5E6CBD53C2A3F32935ED352B2BD78D0"
  },
  "src-tauri-shell/src/imports.rs": {
    "bytes": 80054,
    "sha256": "352D23CA4DF4B545A1A96A95EB10C0EBE10F682976D6F887A331707C32A474FD"
  }
}
```
