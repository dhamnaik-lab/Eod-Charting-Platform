# CA Phase 5E3 RESUME1 — live TEST-DB Split/Bonus setting enablement R1

**IST timestamp:** 2026-10-01 14:37:42 IST

## Objective
Enable only the accepted Split/Bonus automatic-approval family setting in the authorized live TEST DB after Phase 5E2 copy-only acceptance. Do not execute Legacy Prepare or any Corporate Action writer in this step.

## Previous limitation
Phase 5E2 was accepted only as copy-only evidence; the live setting remained OFF. The first Phase 5E3 attempt then stopped safely in PREFLIGHT because its harness incorrectly expected the SQL literal inside `set_setting`; the exact current owner delegates to `write_setting_value`.

## Authorized database authority
- root: `E:\TA Projects\EOD Charting Platform\EOD DATABASE\Nse`;
- excluded root: `D:\TA Projects\EOD Charting Platform DATABASE\EOD DATABASE\Nse`;
- parent Phase 5E2 evidence SHA256: `889968A8475D7069A2C2C166925879FDE0E1641D130138D85630B58C82B050A9`;
- package SHA256: `245F8687CDB3D0EB09FF1BA75F4D4FFEC24B12853F71EB537D6FF08E9E7035C6`.

## Files / state changed
- product source: 0 files;
- RootApp: unchanged;
- Safe V2 backend: unchanged;
- database state: exactly one generic settings key changed using the SQL literal extracted from current hash-pinned `src-tauri-shell/src/database/settings.rs::set_setting -> write_setting_value` route;
- documentation: this change record only.

## Final implementation
`corporate_actions.auto_approval.split_bonus.enabled` changed from raw value `<missing>` to explicit raw value `'true'`.
Pre `updated_at`: `<missing>`.
Post `updated_at`: `'2026-10-01 09:07:21'`.
SQLite-family physical files changed: market-data.sqlite3, market-data.sqlite3-shm, market-data.sqlite3-wal.

## Behaviour preserved
- Legacy Prepare execution: 0;
- Corporate Action writer execution: 0;
- production approvals: 0;
- Corporate Action scans: unchanged;
- all logical database tables except the one target setting row: exact pre/post digest match;
- EOD data files: exact pre/post bytes;
- source authority: 572/572 exact;
- dist authority: 30/30 exact;
- Git: 0;
- network: 0.

## Validation performed
- exact Phase 5E2 parent evidence validated;
- exact pre-enable 7431-file TEST DB/EOD authority matched the accepted parent;
- current `settings.rs` SHA256 `79E7E36DF764C2997C84711B304E81580BE0B5530278ABA9A7A5C675E5596210`, generic `set_setting` delegation, ER4 key guard, and `write_setting_value` UPSERT verified;
- pre setting confirmed exact OFF state (`missing` or raw `false` only);
- exact SQL literal from current `write_setting_value` executed in one `BEGIN IMMEDIATE` transaction;
- post setting re-read as explicit `true`;
- per-table logical digests outside the target setting row exact pre/post;
- Corporate Action approval/decision/scan state exact pre/post;
- EOD and non-SQLite TEST DB files exact pre/post;
- live source/dist exact after enablement.

## Risks / limitations
This step enables the family gate only. It does not execute the first live active-Legacy automatic-approval cycle and therefore does not validate live approval outcomes. That requires a separate bounded Phase 5E4 authorization.

## Rollback guidance
Rollback action: `DELETE_ROW`.
Rollback raw value: `None`.
Rollback prior `updated_at`: `None`.
No rollback was executed in the successful run.

## Next step
Stop after verified setting enablement. Do not run the first live automatic-approval cycle without separate explicit authorization.
