# Corporate Action — New-Chat Handoff After AUTO-ID1 Final Closeout

**Date:** 2026-09-21 IST  
**Active root:** `E:\TA Projects\EOD Charting Platform`

## Read first

Before any further Corporate Action identity work, read:

1. `docs\superpowers\specs\2026-09-21-corporate-action-auto-id1-final-closeout-current-authority.md`
2. `docs\changes\2026-09-20_1457_IST_CA_AUTO_ID1_PERSISTED_EVENT_IDENTITY_QUICK_RESOLVE.md`
3. `docs\changes\2026-09-20_0035_IST_PENDING_ACTIONS_COMPACT_LAYOUT_R1.md`
4. this handoff.

## Current authority state

- Corporate Action protected source: **553 files**.
- AUTO-ID1 post-implementation `src + src-tauri-shell` preservation inventory: **559 exact files**.
- AUTO-ID1: **CLOSED / CURRENT**.
- Explicit Corporate Action approval remains required.
- No AUTO-ID1 production or operational DB work remains pending.

## Accepted AUTO-ID1 evidence

Implementation:

`tmp\CA_AUTO_ID1_2026-09-20_145738_IST_evidence.zip`

SHA-256:

`6C419E3C2627156DD21A4AEA4DCE2D2E2B864C5FC235F9BB3803D8C9CFF20E82`

Runtime TEST-DB functional acceptance:

`tmp\CA_AUTO_ID1_RUNTIME_ACCEPTANCE_2026-09-20_183015_IST_FAILED_evidence.zip`

SHA-256:

`22B87E895F2B39090C9B6477D28831D528AF30648C40A0722E087C53C56E8C79`

The `FAILED` name refers only to post-pass temporary Cargo cleanup. The real runtime test passed 9/9 AUTO-ID1 Quick Resolves and exact rollback.

Cleanup:

`tmp\CA_AUTO_ID1_RUNTIME_CLEANUP_FIX1_2026-09-20_235813_IST_evidence.zip`

SHA-256:

`44959F209DB8066018DEC93A8ADA8AFA7DC5D7564EB499DBE334C204ACC482F8`

## Accepted installed Rust hashes

- `corporate_action_imports.rs`  
  `E2E75699D36F9BCBFB2CBB5C7BD4BA06BB749B98816B4E5C4F64788CDF7DCDCE`
- `event_identity_authority.rs`  
  `882786B73FD52EAA44DAC5335618D9CE1F445B2BF96EC17635056ABC921CB82A`
- `event_identity_maintenance.rs`  
  `4D666DD4D490E6C1818719A5C0C25E01E9EDE0DD4CADCC6B794A41ED13779000`
- `event_identity_resolution.rs`  
  `7174E5312E7BDD94C681166E94FDA456124380852EA757C30991610C2FEDF92C`

## Runtime fact to preserve

The accepted stable-copy TEST-DB exercise proved exactly nine persisted pre-transition `360ONE` dividend rows can use AUTO-ID1. It did **not** approve those Corporate Actions and the transaction was rolled back.

Accepted IDs:

`29958, 30158, 31090, 598, 1366, 2595, 3258, 3750, 5056`

`20MICRONS` and post-transition/noneligible `360ONE` rows remained unchanged.

## Safety boundaries for continuation

Do not silently broaden AUTO-ID1.

Preserve:

- ordinary exact-event-date ISIN Quick Resolve;
- `PENDING_ISIN_MISMATCH` boundary;
- explicit CA approval;
- exactly-one-active-target requirement;
- frontend Official Imports workflow;
- Compact Layout R1 behavior;
- no operational `D:` DB access without explicit authorization;
- routine evidence under project `tmp`;
- Source Audit only for source-code snapshots.

## Remaining separately gated problems

Potential next work is **not AUTO-ID1 continuation**. The main remaining identity questions are:

- historical ISIN validity intervals / transition semantics for `20MICRONS`;
- post-transition stale-ISIN `360ONE` rows lacking qualifying event-resolution evidence;
- the separate unsupported dividend/source-logic case.

Start with a read-only necessity/design review. Do not implement these automatically from this handoff.
