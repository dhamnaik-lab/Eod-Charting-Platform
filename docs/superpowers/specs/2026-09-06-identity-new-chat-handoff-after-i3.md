# Identity New-Chat Handoff After I3 — NSE Reviewed-Preview → Apply Authority

Status: CURRENT NEW-CHAT HANDOFF
Date: 2026-09-06
Project root: `E:\TA Projects\EOD Charting Platform`

## Start here

The active Corporate Action / Identity product remains the restored existing `CorporateActionDialog` in `src\components\DatabaseToolsDialogs.tsx`.

Do not resume the discarded wholesale reconstruction or separate Maintenance product automatically.

Manual Entry remains accepted and unchanged.

## Closed milestones

- I0 — characterization + authority freeze: CLOSED.
- I1 — Current Chart exchange correction: CLOSED.
- I2 — compact Identity Import UI: CLOSED.
- I2-R2 — Official Refresh+Preview transition correction: CLOSED.
- I3 — NSE reviewed-preview → Apply authority: AUTOMATED PASS + MANUAL ACCEPTANCE PASS / CLOSED.

## Current production authorities

- `src\components\DatabaseToolsDialogs.tsx` — `E406F237E2CCCD5703B73FB6869D6E99C487AE3452F755877AD6E35C4B7A58F2`
- `src\types\desktop.ts` — `E7963F6A8C1E79B7B3F4901679C7F09026D7694E547F509D487D926B93D380B3`
- `src-tauri-shell\src\database.rs` — `4AE58E628B5466884CBC8C8E6002F5E0F70BCCBE48236CFF5FBC201B5EB24310`
- `src-tauri-shell\src\database\nse_identity_imports.rs` — `D54BBBC30DD3E2CD9B6A058A8617F8B1C2FEB069D49BA5571BE7BEF3E9EF73CB`
- I3 focused test — `F9FFF6D5086C89AAF8B879B1AA42FEC607C019CAEEE89B1D20E6A933A2B94ADE`
- accepted portable — `BC3964EE38A5DF1152AD082BA70AA77D1AF299407A6CFF2C4CB4AC0D169FADD3`

I3 evidence:

`E:\TA Projects\EOD Charting Platform Source Audit\IDENTITY_I3_NSE_REVIEWED_APPLY_2026-09-06_022159_IST_evidence.zip`

SHA-256:

`40FBC4660253C11F5F84DB63FEA41BD3B0AE27DDF6F9E7CA2A62CA6CE1A86586`

## I3 safety contract

Interactive NSE current-universe Apply is fail-closed against the reviewed Preview:

```text
Preview NSE
→ backend plan
→ deterministic planSha256
→ frontend reviewed authority bound to database/source context
→ Apply sends expectedPlanSha256
→ backend rebuilds current plan
→ SHA match: existing transaction may apply
→ SHA mismatch: reject before writes and require Preview again
```

Frontend reviewed authority is invalidated by relevant database/source/context transitions and consumed after every NSE Apply outcome.

A successful Apply cannot be repeated without another Preview.

Historical NSE Identity Import keeps its internal current-universe synchronization path.

## Manual I3 acceptance

Runtime testing confirmed the UI lifecycle:

- Preview enables NSE Apply;
- Official → Manual invalidates and disables Apply;
- returning to Official without Preview leaves Apply disabled;
- new Preview re-enables Apply;
- context switching invalidates the reviewed authority;
- successful Apply on the disposable/private test database consumes authority and disables Apply;
- a later fresh Preview creates a new authority.

## Data authority policy

**NSE remains the functional and data-acceptance authority.**

The BSE database remains incomplete for long-history/data-parity acceptance. Preserve BSE capability, but do not make BSE parity or BSE production Apply an acceptance gate for NSE work.

Large BSE preview counts remain non-authoritative while that baseline is incomplete.

## Preserved boundaries

Continue preserving:

- Manual Entry;
- Official Imports R1C-I1;
- Identity I0/I1/I2/I2-R2/I3 tests and behavior;
- BSE UI/workflow/backend capability;
- NSE historical import behavior;
- Corporate Action recovery authority;
- chart-price authorities;
- existing package/build authorities.

## Next candidate

Identity I4 is the next candidate: **NSE historical Identity preview / transaction safety**.

Before I4 source work:

1. verify the live source/hashes rather than assuming this handoff is still newest;
2. state Goal / Scope / Constraints / Project root / files to inspect;
3. inspect current historical NSE import behavior and transaction boundaries read-only;
4. use NSE as acceptance authority;
5. keep BSE historical parity deferred;
6. obtain explicit approval for the resulting bounded design before implementation.
