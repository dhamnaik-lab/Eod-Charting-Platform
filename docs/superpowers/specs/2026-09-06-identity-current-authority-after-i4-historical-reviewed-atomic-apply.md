# Identity Current Authority After I4 — NSE Historical Reviewed Preview + Atomic Apply

**Status:** CURRENT AUTHORITY / I4 ACCEPTED  
**Date:** 2026-09-06 IST  
**Project root:** `E:\TA Projects\EOD Charting Platform`

## Purpose

Freeze the accepted Identity authority after I4.

This document records the active NSE Identity workflow, the I4 historical reviewed Preview → Apply safety contract, the manual-archive fallback boundary, and the NSE-first / BSE-deferred acceptance policy.

This is documentation only. It does not change runtime behavior.

## Closed Identity milestones

- I0 — characterization + authority freeze: CLOSED.
- I1 — Current Chart exchange correction: CLOSED.
- I2 — compact Identity Import UI: CLOSED.
- I2-R2 — Official Refresh+Preview transition correction: CLOSED.
- I3 — NSE current-universe reviewed Preview → Apply authority: CLOSED.
- I4 — NSE historical Identity reviewed Preview + atomic Apply: AUTOMATED PASS + MANUAL ACCEPTANCE PASS / CLOSED.

## Operational source priority

The current operating priority is:

```text
1. Official NSE source workflow
2. Manual NSE archive workflow only as fallback/recovery
```

Manual historical Identity is not the routine primary workflow.

At I4 acceptance time there were no real manual historical archive files available for runtime testing. The Manual UI correctly remained fail-closed without a usable archive. Its mutation/rollback semantics are covered by the I4 Rust safety suite.

## I3 current-universe authority remains active

For NSE Official current-universe synchronization:

```text
Preview Saved Sources / Refresh & Preview
→ backend reviewed plan
→ deterministic plan SHA
→ Apply Reviewed Changes enabled only for the reviewed authority
→ Apply consumes authority
→ another Apply requires another Preview
```

Manual acceptance after I4 confirmed that this I3 lifecycle still works:

- before Preview, Apply was disabled;
- Preview Saved Sources produced `Current 3138/3138`;
- the zero-change preview showed `Activate 0 / Update 0 / Deactivate 0 / Unchanged 3138`;
- Apply became enabled after Preview;
- Apply completed successfully on the disposable/private test database;
- after Apply, the reviewed authority was consumed and Apply became disabled again.

## I4 historical safety contract

When a valid NSE manual historical archive exists, the interactive path is:

```text
Preview Historical Identity
→ complete reviewed historical plan
→ Actionable / All / Duplicates / Skipped / Errors review surface
→ deterministic I4 plan SHA
→ Apply Reviewed Historical Identity
→ rebuild exact plan under one write transaction
→ compare reviewed SHA
→ exact match + applicable plan: COMMIT all
→ mismatch / malformed SHA / failure: ROLLBACK all
```

The atomic unit includes:

- historical symbol changes;
- historical company-name changes;
- combined symbol + name changes;
- NSE security-master effects;
- NSE current-universe synchronization.

No earlier historical/master/current-universe mutation may survive a rejected or failed I4 Apply.

## Manual historical fallback qualification

No production-quality manual archive existed during manual acceptance.

Observed runtime behavior:

```text
Manual source selected
+ no valid archive files
→ Preview Historical Identity disabled
→ Apply Reviewed Historical Identity disabled
→ no accidental write path
```

This is accepted as the correct current fallback behavior.

The following failure/safety paths are accepted from automated Rust evidence rather than manual data corruption:

- Preview leaves zero persistent writes.
- Matching reviewed SHA commits atomically.
- Later historical-row failure rolls back earlier tentative history.
- Security-master failure rolls back tentative history.
- Current-universe failure rolls back history + master work.
- Source change after Preview rejects stale authority with zero persistent Apply changes.
- Relevant database change after Preview rejects stale authority with zero persistent Apply changes.
- Malformed SHA rejects fail-closed.
- Duplicate and skipped rows remain reviewable and do not block an otherwise applicable plan.
- Nested identity mutation remains correct inside the caller-owned I4 transaction.

## I4 automated evidence

Evidence:

`E:\TA Projects\EOD Charting Platform Source Audit\IDENTITY_I4_R1C_NSE_HISTORICAL_ATOMIC_2026-09-06_133121_IST_evidence.zip`

SHA-256:

`534ADE9B382EA20BA7EC479410FC2ECEFBB5C7CDF76BF9640C716FB73F42B00F`

Accepted automated result:

- I4 focused TypeScript: PASS.
- I4 historical Rust safety suite: 9/9 PASS.
- I4 identity transaction nesting test: PASS.
- I3 Rust reviewed-plan regression: PASS.
- NSE historical current-universe regression: PASS.
- NSE historical failure-boundary regression: PASS.
- Identity I3/I2-R2/I2/I0/I1 regressions: PASS.
- full Corporate Action regression suite: PASS.
- renderer typecheck: PASS.
- renderer build: PASS.
- Cargo check: PASS.
- portable Windows build: PASS.

Accepted portable SHA-256:

`A13FC694960FCB81FC34654C235EF861EA5226EC1B3FBB61A3AB6845EB97BD49`

## Current I4 production authorities

`src\components\DatabaseToolsDialogs.tsx`

`DE1E050C767B9B94CC37C186F3114E3E93F834D9E372092BDF084043508FE82E`

`src\types\desktop.ts`

`01F4525AFA562122315D6CFBA8CF5A3328978A99CEE8AC704DADBCB72AACDEC7`

`src\platform\types.ts`

`8877AAB6F78CDC0502CF2B153A05585B2C34A185D898E65ECBB2B41A5908C606`

`src\platform\tauriDesktop.ts`

`620A1DDE53EECEFBD55B109ED531B9B54FF084504E6685A0F86185BBF5F0ACEC`

`src-tauri-shell\src\database.rs`

`C4CDD04147A5891D8D10A083E06B428F83AC44565477B21666BC4FFAED21E47D`

`src-tauri-shell\src\database\nse_identity_imports.rs`

`2E05EF2050179305223A95F10CD0B3B2DE894F9615A78991E2D93F6ADD7542AB`

`src-tauri-shell\src\database\instrument_mutations.rs`

`39A37CEC5360648654FCC1FE3F66105655CDC68E9B907BFF77B68984F29B4C82`

`src-tauri-shell\src\main.rs`

`A97A3AF97310D0C681111EDC45D320FD9CEF064FFFFB354E746B949005BD54C2`

## Current I4 test authorities

`src\features\corporateActions\__tests__\corporateActionIdentityHistoricalReviewedAtomicApply.test.ts`

`73030E86E1DE048B382663EC47AD7F33A9F26753B722B11AE2B96BEE72AFA3B0`

`src\features\corporateActions\__tests__\corporateActionIdentityReviewedApplyAuthority.test.ts`

`D21DED350F2588B3FD09B19BCA810A71B0062B6B92F66BAEE786F695249070A0`

`src\features\corporateActions\__tests__\corporateActionIdentityImportCharacterization.test.ts`

`E3F9EE15216A972B7A9DA597533365F8058747730BD8A7243C9989AD552BD8D1`

`src\features\corporateActions\__tests__\corporateActionIdentityCompactWorkspace.test.ts`

`F98361B70ABA6E7316005268F2E2FD8F6EB413B3E3FEE41670C20F2AEB4646B6`

## I4 design authorities

`docs\superpowers\specs\2026-09-06-identity-i4-nse-historical-reviewed-atomic-apply-design.md`

`8DBDD506936AA96D6D8E98640C27AF2E95A11CD2C4DB37FF95B9A45CC7CFE3C9`

`docs\superpowers\plans\2026-09-06-identity-i4-nse-historical-reviewed-atomic-apply.md`

`C2D009C66F9994EEFF010FB2C1E3D605B1A87D6EACABFDF3B08827F46813BF32`

## NSE-first / BSE-deferred boundary

NSE remains the current functional and data-acceptance authority.

BSE Identity UI/workflow/backend capability remains preserved, but BSE historical data parity and production Apply acceptance remain deferred while the BSE database/history baseline is incomplete.

Large BSE preview counts are not an NSE acceptance gate.

## Preservation boundaries

Continue preserving:

- Manual Entry;
- Official Imports R1C-I1;
- I0/I1/I2/I2-R2/I3/I4 accepted behavior;
- NSE current-universe reviewed authority;
- NSE historical reviewed atomic authority;
- BSE UI/workflow/backend capability;
- Corporate Action recovery authority;
- chart-price authorities;
- package/dependency authorities.

## Future idea — documented separately after I4 closeout

A future workstream will document, but not implement during I4 closeout:

**Identity Evidence Resolver / official-source recovery / external-AI handoff**

That future work is not automatically authorized by this authority document.
