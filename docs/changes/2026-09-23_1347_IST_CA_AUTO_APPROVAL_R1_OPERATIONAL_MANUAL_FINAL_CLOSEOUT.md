# CA Auto-Approval R1 — Operational / Manual Final Closeout

**IST timestamp:** 2026-09-23 13:47 IST

## Objective

Record the independently accepted finalized-standard-portable manual TEST-DB acceptance as the final operational/manual closeout for Corporate Action Auto-Approval R1.

## Previous limitation

The FIX6 source/runtime closeout was complete, and the standard Windows portable had been finalized, snapshotted and published, but the finalized portable still had a separately gated manual TEST-DB acceptance marked pending.

That manual gate has now passed and its evidence has been independently audited.

## Files changed

Documentation only; exactly three additive closeout documents are intended:

1. `docs\superpowers\specs\2026-09-23-corporate-action-auto-approval-r1-operational-manual-closed-current-authority.md`
2. `docs\superpowers\specs\2026-09-23-corporate-action-new-chat-handoff-after-auto-approval-operational-manual-closeout.md`
3. `docs\changes\2026-09-23_1347_IST_CA_AUTO_APPROVAL_R1_OPERATIONAL_MANUAL_FINAL_CLOSEOUT.md`

No runtime/source/configuration/database/build/package/Git file is changed.

## Final implementation / authority recorded

- Auto-Approval policy: `AUTO_APPROVAL_SAFE_V1`.
- Scope remains NSE Split + Bonus only.
- STRONG MATCH threshold remains >= 0.95.
- Identity proof remains machine-proven only.
- Existing approval writer remains the mutation owner.
- Existing manual approval remains preserved.
- Dividend / Rights / BSE / compound auto-approval remain deferred.

Accepted standard portable:

- build `20260923.001421`;
- EXE SHA-256 `238A6FFD41052F8E9DA6AF129118CB24EF42909F0B1809B8EB9423943DA74DFC`.

Accepted manual evidence:

- SHA-256 `5B83B332EFD0BF9DBBE50DC23579B836C30C449345098D36AEA29DFDC6C402D8`;
- PRE DB-family backup SHA-256 `CC2CE0FCBD11F334A8A2D20D4EF37382523E09354AB2AE8C908F71ED0289C1AE`.

Six accepted current mappings:

- KSB 12685 -> 451;
- BBOX 16093 -> 414;
- NAVA 22969 -> 335;
- GAYAPROJ 24025 -> 11417;
- SOTL 36026 -> 11419;
- PARSVNATH 42274 -> 11418.

Manual acceptance proved one authorized `Load & Prepare`, confirmed `Auto-Approval Safe V1`, preserved six mappings and six policy audit rows, introduced zero forbidden target decisions, preserved protected semantic tables, preserved the complete binary EOD tree, and preserved source/portable authority.

## Behaviour preserved

- source authority: 561 files;
- protected source: 555 files;
- AUTO-ID1 CLOSED / CURRENT;
- 20MICRONS transition CLOSED / CURRENT;
- `PENDING_ISIN_MISMATCH` preserved;
- manual approval preserved;
- raw-price adjustment-on-read preserved;
- operational D: database excluded;
- no expansion to Dividend/Rights/BSE/compound actions.

## Validation commands / results

No build/test/runtime command is rerun for this documentation-only closeout.

The installer for this documentation closeout is required to verify, read-only:

- accepted manual evidence ZIP exact SHA-256;
- accepted FIX4 finalization evidence exact SHA-256;
- accepted Snapshot V3 exact SHA-256;
- accepted standard portable EXE/build identity;
- 561-file current source hash authority;
- prerequisite FIX6/finalization documentation hashes;
- target closeout documents are conflict-free or already byte-exact.

## Risks / limitations

This closeout does not certify any action type/exchange/exception path outside the accepted R1 boundary. Future Corporate Action automation must be separately designed and accepted.

## Rollback guidance

These documents are additive authority records only. If installation is interrupted before completion, remove only newly created closeout documents after comparing their hashes with the documentation payload. Do not roll back source, database, portable package, Snapshot V3, or Git history for this documentation closeout.

## Current conclusion

**CA Auto-Approval R1 operational/manual authority = CLOSED / CURRENT.**
