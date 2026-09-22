# Corporate Action AUTO-ID1 — Final Closeout / Current Authority

**Authority date:** 2026-09-21 IST  
**Workstream:** `E:\TA Projects\EOD Charting Platform`  
**Status:** `CA AUTO-ID1 CLOSED / CURRENT`

## 1. Objective

AUTO-ID1 closes the bounded gap where qualifying persisted `corporate_action_event_identity_resolutions` evidence already proved an event-time identity transition, but the established strict Corporate Action Quick Resolve path did not consume that proof.

The accepted implementation connects that persisted evidence to the existing Quick Resolve path without creating a second resolver, without bypassing existing identity safeguards, and without approving a Corporate Action.

## 2. Accepted implementation authority

Implementation evidence:

`E:\TA Projects\EOD Charting Platform\tmp\CA_AUTO_ID1_2026-09-20_145738_IST_evidence.zip`

SHA-256:

`6C419E3C2627156DD21A4AEA4DCE2D2E2B864C5FC235F9BB3803D8C9CFF20E82`

Accepted installed Rust owners:

- `src-tauri-shell\src\database\corporate_action_imports.rs`  
  `E2E75699D36F9BCBFB2CBB5C7BD4BA06BB749B98816B4E5C4F64788CDF7DCDCE`
- `src-tauri-shell\src\database\corporate_action_imports\event_identity_authority.rs`  
  `882786B73FD52EAA44DAC5335618D9CE1F445B2BF96EC17635056ABC921CB82A`
- `src-tauri-shell\src\database\corporate_action_imports\event_identity_maintenance.rs`  
  `4D666DD4D490E6C1818719A5C0C25E01E9EDE0DD4CADCC6B794A41ED13779000`
- `src-tauri-shell\src\database\corporate_action_imports\event_identity_resolution.rs`  
  `7174E5312E7BDD94C681166E94FDA456124380852EA757C30991610C2FEDF92C`

The source implementation completed:

- genuine focused RED → GREEN;
- AUTO-ID1 focused tests `6/6`;
- existing Quick Resolve regression `4/4`;
- existing recheck regression `6/6`;
- V1.14E regression `12/12`;
- full `corporate_action_imports` regression `112/112`;
- `cargo check --locked --offline`;
- tested candidate = installed source;
- exact source delta: four replacements, zero source additions/removals.

The implementation change record remains:

`docs\changes\2026-09-20_1457_IST_CA_AUTO_ID1_PERSISTED_EVENT_IDENTITY_QUICK_RESOLVE.md`

SHA-256:

`CCDCA0012B7F73BF09F017C59147E1ADDEA849F2AF56EDD8A643FE7F9C948890`

## 3. Accepted runtime TEST-DB authority

Functional runtime evidence is preserved in:

`E:\TA Projects\EOD Charting Platform\tmp\CA_AUTO_ID1_RUNTIME_ACCEPTANCE_2026-09-20_183015_IST_FAILED_evidence.zip`

SHA-256:

`22B87E895F2B39090C9B6477D28831D528AF30648C40A0722E087C53C56E8C79`

The filename contains `FAILED` because the controller later failed while removing a temporary Cargo build directory. The actual isolated runtime acceptance test had already passed before that cleanup failure.

Accepted runtime result:

- live TEST database opened through SQLite: **NO**;
- live TEST DB writes/checkpoints/sidecar deletes: **NO**;
- operational `D:` database access: **NO**;
- stable TEST `DB + WAL + SHM` raw copy only;
- SQLite opened only the stable copy;
- copy-local `BEGIN IMMEDIATE` transaction;
- actual installed private Quick Resolve path executed;
- exactly **9** persisted pre-transition `360ONE` rows became `PENDING` inside the transaction;
- exactly **9** `VERIFIED_EVENT_IDENTITY_RESOLUTION` decisions were created inside the transaction;
- all eligible approval links remained null;
- CA approvals performed: **0**;
- post-transition parsed `360ONE` rows remained unchanged;
- all `20MICRONS` rows remained unchanged;
- unsupported/noneligible rows remained unchanged;
- event-resolution rows remained unchanged;
- target `corporate_actions` rows remained unchanged;
- copy-local transaction rolled back;
- selected target state after rollback exactly equalled pre-transaction state;
- live project source before/after runtime acceptance remained byte-identical.

The nine accepted real TEST-DB import IDs are:

`29958, 30158, 31090, 598, 1366, 2595, 3258, 3750, 5056`

All nine event dates are before the verified transition date `2023-01-23`.

## 4. Cleanup authority

Final cleanup evidence:

`E:\TA Projects\EOD Charting Platform\tmp\CA_AUTO_ID1_RUNTIME_CLEANUP_FIX1_2026-09-20_235813_IST_evidence.zip`

SHA-256:

`44959F209DB8066018DEC93A8ADA8AFA7DC5D7564EB499DBE334C204ACC482F8`

The retained runtime workdir contained no DB/WAL/SHM/journal bytes and was fully removed. Cleanup performed no DB access, source change, Cargo/test rerun, Git, network, or application launch.

## 5. Current source authority boundary

The Corporate Action protected-source authority immediately before AUTO-ID1 was the accepted **553-file** state established by Pending Actions Compact Layout R1.

AUTO-ID1 replaced four existing Rust files and added/removed no protected source files. Therefore the protected-source count remains:

`553 protected files`

For stronger documentation-only preservation, this closeout also freezes the accepted AUTO-ID1 post-implementation inventory of:

`559 exact files across src + src-tauri-shell`

with exact path, byte length, and SHA-256 entries in the closeout package authority manifest.

## 6. Frozen behavior

AUTO-ID1 preserves:

- ordinary exact-event-date historical ISIN Quick Resolve;
- `PENDING_ISIN_MISMATCH` manual/exception boundary;
- exactly-one-active-current-target safeguard;
- approved-import immutability;
- existing `apply_import_row_resolution()` mutation ownership;
- explicit Corporate Action approval after preparation;
- frontend preparation/approval owners;
- current chart/raw-price behavior;
- DB schema and public Tauri command surface.

The new persisted-event path accepts only exact, verified V1.14D.1 pre-transition evidence and records:

`VERIFIED_EVENT_IDENTITY_RESOLUTION`

It does not reinterpret a persisted event-resolution row merely because that row exists; the accepted authority/fingerprint evidence is verified.

## 7. Explicit non-goals / still separate

AUTO-ID1 does **not** authorize or solve:

- broader `20MICRONS` historical-ISIN validity-interval semantics;
- post-transition `360ONE` stale-ISIN handling without qualifying persisted event evidence;
- generic `PENDING_ISIN_MISMATCH` automation;
- unsupported/OTHER/AGM action support;
- automatic Corporate Action approval;
- CA approval batching beyond existing explicit controls;
- schema migrations;
- operational `D:` database work.

These are separately gated problems.

## 8. Final state

`CA AUTO-ID1 DESIGN R1 — CLOSED / CURRENT`

No further AUTO-ID1 source, runtime, rollback, or cleanup work is pending.

The next candidate problem, if separately authorized, is a **read-only necessity/design review of remaining historical ISIN / transition semantics**. This closeout does not authorize that implementation.
