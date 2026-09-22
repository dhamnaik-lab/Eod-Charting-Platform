# Identity New-Chat Handoff After I2/I2-R2 — NSE-First Authority

Status: CURRENT NEW-CHAT HANDOFF
Date: 2026-09-06
Project root: `E:\TA Projects\EOD Charting Platform`

## Start here

The active Corporate Action product remains the restored existing `CorporateActionDialog` in `src\components\DatabaseToolsDialogs.tsx`.

Do not resume the discarded wholesale `Fetch -> Load -> Review -> Approve` reconstruction or the separate Maintenance product automatically.

Manual Entry remains accepted and unchanged.

## Current Identity authority

Production file:

`src\components\DatabaseToolsDialogs.tsx`

SHA-256:

`9F26E22A07BF8CE6454594F564B0E67C9E2D42F884B21498BCA9722B3791C488`

Portable SHA-256:

`02FAD133546A8CB022C1BC68D46503B2FFBB31BE74DA297D67750C689741644D`

I2-R2 automated evidence:

`E:\TA Projects\EOD Charting Platform Source Audit\IDENTITY_IMPORT_I2_R2_2026-09-05_200750_IST_evidence.zip`

SHA-256:

`EDCC7C92452DAFF557F4FE15A45E2BAA9E1526EF8A400652C929B815FD26FF38`

## Closed milestones

- I0: Identity characterization + authority freeze — CLOSED.
- I1: Current Chart exchange correction — CLOSED.
- I2: compact Identity UI — MANUALLY ACCEPTED / CLOSED.
- I2-R2: Official NSE/BSE Refresh+Preview transition + stale-context clear — MANUALLY ACCEPTED / CLOSED.

## Accepted Identity UI behavior

Identity Import is compact and task-oriented:

- Exchange: NSE / BSE
- Source: Official / Manual
- Official: `Refresh & Preview` plus separate `Preview Saved Sources`
- Apply remains explicit as `Apply Reviewed Changes`
- NSE Manual: Archive Root / Browse Folder / historical identity path
- BSE Manual: BSE Master CSV / Browse File
- `Current Chart` follows the appropriate preview/active-chart exchange
- changing Exchange or Source clears stale preview/status context
- one BSE Official `Refresh & Preview` operation downloads and immediately previews the returned managed BSE source file

## Data acceptance policy

**NSE is the current functional and data-acceptance authority for Corporate Action / Identity.**

The BSE database is incomplete and lacks long historical depth comparable to NSE.

Therefore:

- preserve BSE UI/workflow/backend capability;
- do not use BSE data parity as a completion gate for NSE-focused work;
- do not classify large BSE preview counts as defects solely from magnitude;
- defer BSE historical parity;
- defer BSE production Apply acceptance;
- do not perform a BSE reconciliation-count audit until the BSE database baseline is sufficiently complete, unless the user explicitly requests an exploratory diagnostic.

## Important BSE warning

During I2 manual review, BSE Preview produced large Activate/Update/Deactivate counts and zero Unchanged rows. Because the BSE database is incomplete, those counts are **not an accepted correctness signal and not a confirmed defect**.

Do not Apply BSE based only on the current preview.

## Preserved authorities

Continue preserving:

- Manual Entry;
- Official Imports R1C-I1;
- Identity I0/I1/I2/I2-R2 tests and behavior;
- NSE/BSE identity backend source unless a separately approved backend task requires change;
- Corporate Action recovery authority;
- chart market-price formatting fixes;
- existing package/build authorities.

## Next chat

At the beginning of the next Identity/Corporate Action task:

1. verify the live current source and hashes rather than assuming this handoff is still newest;
2. state the bounded goal/scope/constraints;
3. use NSE as acceptance authority unless the user explicitly changes the policy;
4. preserve BSE capability but do not require BSE data parity;
5. do not start BSE Apply or a BSE data-correctness audit implicitly.
