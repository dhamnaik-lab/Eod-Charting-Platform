# Corporate Action UI/UX Reconstruction — Approved Design Documentation

## IST timestamp

2026-09-02 13:26 IST

## Objective

Freeze the user-approved Corporate Action reconstruction architecture before Task 5A or any further implementation.

## Previous defect or limitation

Task 4 introduced a valid full-page shell but the shell is placeholder-only. Because `RootApp.tsx` routes Corporate Actions to that shell, the old Corporate Action window is no longer visible during normal use even though its implementation remains intact.

The user confirmed that the old Corporate Action options were intentional and must be reconstructed into a more user-friendly architecture rather than discarded.

## Source authorities

OLD behavioral authority:
- `90dd5cf0-8ec0-48c4-a1b1-a17dac2de3fa.zip`
- `Eod Charting Platform Source Code 2026-09-01_203433_IST`
- SHA-256 `ABEC169DD675B3AB319451BB95C152D9A24328F22F105D6495F5EC1157543581`

FRESH current-source authority:
- `b5b0f03a-f754-4d52-9657-3b2197673da6.zip`
- `Eod Charting Platform Source Code 2026-09-02_125004_IST`
- SHA-256 `37437F713C20FD4C6419FFEA5D711C2108A82188678FDB697BB3B2AE79118C8F`

Key continuity:
- `DatabaseToolsDialogs.tsx` is identical OLD/FRESH: `1CEFF93CBBDCDC394BB7E9644864C2CA91B2CE888331E510D545C3A9D3F36816`.
- `uiStore.ts`, `tauriDesktop.ts`, `platform/types.ts`, `types/desktop.ts` are identical OLD/FRESH.
- `RootApp.tsx` changed from `AE36B18D5C225A049799C9226F5800D987466290B65F5CB9467D5CDE91A9AC00` to `03336EA05F89D0D92FCE38DAF189E1E458A866F7568E3FAAE59C8E6A554DE172` for Task 4 host integration.
- Task 2–4 additive Corporate Action artifacts are present in FRESH.

## Approved design recorded

The documentation freezes approved Design Sections 1–5:

1. separate Normal Corporate Actions and Corporate Action Maintenance workspaces;
2. routine `Fetch Data → Load → Review → Approve` flow;
3. complete Maintenance ownership for specialist legacy capabilities;
4. progressive extraction/reuse with OLD behavioral authority and FRESH source-preimage authority;
5. revised Task 5A–8 sequence with Task 7 parity certification before Task 8 retirement.

## Files created by this package

- `docs/superpowers/specs/2026-09-02-corporate-action-ui-ux-reconstruction-architecture.md`
- `docs/superpowers/specs/2026-09-02-corporate-action-capability-preservation-matrix-spec.md`
- `docs/superpowers/plans/2026-09-02-corporate-action-ui-ux-reconstruction-implementation-plan.md`
- `docs/changes/2026-09-02_1326_IST_CORPORATE_ACTION_UI_UX_RECONSTRUCTION_APPROVED_DESIGN.md`

No source, backend, database, package, build-system, or configuration file is included.

## Final implementation rules documented

- every OLD capability gets exactly one disposition;
- allowed dispositions are `NORMAL_WORKFLOW`, `MAINTENANCE`, `AUTOMATIC_APPLICATION_RESPONSIBILITY`;
- unclassified = 0 and lost = 0 are hard gates;
- the legacy Corporate Action presentation cannot be removed before accepted Task 7 parity certification;
- only Task 8 may retire the legacy presentation;
- PowerShell runners for this reconstruction must not use the PowerShell `else` keyword;
- Task 5A remains separately review-gated.

## Validation commands/results in the preparation environment

Performed:
- SHA-256 verification of both supplied snapshot ZIPs;
- OLD/FRESH source comparison for the key Corporate Action host/bridge files;
- required-marker scan of generated Markdown;
- package-manifest generation with per-file SHA-256;
- installer static scan for prohibited PowerShell `else`;
- ZIP integrity readback.

Results:
- OLD archive SHA-256: PASS
- FRESH archive SHA-256: PASS
- legacy-dialog continuity finding: PASS
- generated Markdown marker scan: PASS
- package manifest: PASS
- source implementation modified: NO
- database accessed: NO
- Git staged/committed: NO
- Task 5A executed: NO

No project build, Vitest, typecheck, Rust, Tauri, database, or Git-write command was run for this documentation-only preparation.

## Risks or limitations

This session cannot directly write to `E:\TA Projects\EOD Charting Platform`, so the documentation is delivered as a verified installable package. Project-side installation/postflight remains to be run on the user's workstation.

The known capability list is a verified minimum from the supplied snapshots. Task 5A remains responsible for exhaustive control-by-control discovery.

## Rollback guidance

If installed and intentionally discarded, remove only the four documentation files listed above. No source, backend, database, package, or build rollback is required.

## Next step

STOP for review after installation. Task 5A is **not authorized** by this documentation package.
