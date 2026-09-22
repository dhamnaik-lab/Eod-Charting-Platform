# Identity Current Authority After I3 — NSE Reviewed-Preview → Apply Safety

Status: CURRENT AUTHORITY / I3 FULLY ACCEPTED
Date: 2026-09-06
Project root: `E:\TA Projects\EOD Charting Platform`

## Purpose

Freeze the accepted Identity authority after I3 and record the NSE reviewed-preview → Apply safety contract that now governs interactive NSE current-universe synchronization.

This document is an authority addendum. It does not change application behavior.

## Closed Identity milestones

- Identity I0 — characterization + authority freeze: CLOSED.
- Identity I1 — Current Chart exchange correction: CLOSED.
- Identity I2 — compact Identity Import UI: MANUALLY ACCEPTED / CLOSED.
- Identity I2-R2 — Official Refresh+Preview transition correction: MANUALLY ACCEPTED / CLOSED.
- Identity I3 — NSE reviewed-preview → Apply authority: AUTOMATED PASS + MANUAL ACCEPTANCE PASS / CLOSED.

## I3 accepted behavior

Interactive NSE Apply is now bound to the exact backend plan reviewed by the operator.

Accepted contract:

1. NSE Preview builds the current synchronization plan in the backend.
2. The backend returns deterministic `planSha256` authority for that exact plan.
3. The frontend binds that authority to the active database path and current NSE source context.
4. `Apply Reviewed Changes` is disabled until a current reviewed NSE authority exists.
5. Interactive NSE Apply sends the reviewed SHA as required `expectedPlanSha256`.
6. The backend rebuilds the current plan and compares SHA-256 before the write transaction.
7. A changed/malformed/stale plan is rejected before mutation and requires a new Preview.
8. Successful or failed NSE Apply consumes the frontend reviewed authority.
9. After successful Apply, another Apply requires another Preview.
10. Historical NSE Identity Import retains its internal synchronization path and is not converted into an interactive reviewed-Apply workflow.

## Manual acceptance observed

Manual runtime acceptance on 2026-09-06 confirmed:

- NSE Official Preview produced a reviewed plan and enabled Apply.
- switching Official → Manual cleared the preview and disabled Apply;
- returning to Official without a new Preview kept Apply disabled;
- a fresh NSE Preview re-established authority and re-enabled Apply;
- NSE/BSE context switching invalidated the NSE reviewed authority;
- a successful NSE Apply completed against the disposable/private test database;
- successful Apply consumed the authority and disabled Apply;
- a subsequent fresh Preview showed a zero-change state and re-enabled Apply from a new authority.

The intentionally difficult stale source/database race is accepted through automated Rust no-write tests rather than deliberate manual corruption.

## Current I3 production authorities

`src\components\DatabaseToolsDialogs.tsx`

SHA-256:

`E406F237E2CCCD5703B73FB6869D6E99C487AE3452F755877AD6E35C4B7A58F2`

`src\types\desktop.ts`

SHA-256:

`E7963F6A8C1E79B7B3F4901679C7F09026D7694E547F509D487D926B93D380B3`

`src-tauri-shell\src\database.rs`

SHA-256:

`4AE58E628B5466884CBC8C8E6002F5E0F70BCCBE48236CFF5FBC201B5EB24310`

`src-tauri-shell\src\database\nse_identity_imports.rs`

SHA-256:

`D54BBBC30DD3E2CD9B6A058A8617F8B1C2FEB069D49BA5571BE7BEF3E9EF73CB`

I3 focused test:

`src\features\corporateActions\__tests__\corporateActionIdentityReviewedApplyAuthority.test.ts`

SHA-256:

`F9FFF6D5086C89AAF8B879B1AA42FEC607C019CAEEE89B1D20E6A933A2B94ADE`

Accepted portable SHA-256:

`BC3964EE38A5DF1152AD082BA70AA77D1AF299407A6CFF2C4CB4AC0D169FADD3`

## Accepted I3 evidence

`E:\TA Projects\EOD Charting Platform Source Audit\IDENTITY_I3_NSE_REVIEWED_APPLY_2026-09-06_022159_IST_evidence.zip`

SHA-256:

`40FBC4660253C11F5F84DB63FEA41BD3B0AE27DDF6F9E7CA2A62CA6CE1A86586`

Accepted automated result included:

- I3 focused TypeScript: PASS;
- I3 Rust reviewed-plan tests: PASS;
- NSE historical current-universe regression: PASS;
- NSE historical failure-boundary regression: PASS;
- I2-R2/I2/I0/I1 regressions: PASS;
- full Corporate Action regression suite: PASS;
- renderer typecheck: PASS;
- renderer build: PASS;
- Cargo check: PASS;
- portable Windows build: PASS.

## NSE-first / BSE-deferred authority remains active

NSE remains the current Corporate Action / Identity functional and data-acceptance authority.

BSE remains a preserved capability with deferred data parity/history/production Apply acceptance because the BSE database baseline is incomplete.

I3 does not promote BSE Apply or require BSE reviewed-plan parity.

## Preservation boundaries

Continue preserving:

- Manual Entry;
- Identity I0/I1/I2/I2-R2/I3 accepted behavior;
- Official Imports R1C-I1;
- BSE UI/workflow/backend capability;
- NSE historical Identity Import semantics;
- Corporate Action recovery authority;
- chart market-price formatting authorities;
- package/build authorities.

## Next candidate task

The next candidate is **Identity I4 — NSE historical Identity preview / transaction safety**.

I4 must be separately inspected, bounded, designed, and approved before implementation. I3 closure does not authorize I4 source changes automatically.
