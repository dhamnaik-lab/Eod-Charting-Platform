# Identity New-Chat Handoff After I4

**Status:** CURRENT NEW-CHAT HANDOFF / I4 CLOSED  
**Date:** 2026-09-06 IST  
**Project root:** `E:\TA Projects\EOD Charting Platform`

## Read this first

The active Identity implementation is the existing Corporate Actions / Identity surface in `src\components\DatabaseToolsDialogs.tsx`.

Do not resurrect the discarded wholesale Corporate Action reconstruction route automatically.

Verify the live project hashes before any new source work.

## Current milestone state

- I0: CLOSED.
- I1: CLOSED.
- I2: CLOSED.
- I2-R2: CLOSED.
- I3 current-universe reviewed Preview → Apply: CLOSED / ACTIVE AUTHORITY.
- I4 historical reviewed Preview + atomic Apply: CLOSED / ACTIVE AUTHORITY.

## Source operating policy

```text
Primary routine path:
NSE Official

Fallback/recovery path:
NSE Manual historical archive
```

No real manual historical archive was available during I4 runtime acceptance. The UI remained fail-closed with Preview/Apply disabled when no valid archive existed.

Do not manufacture a production-like manual archive merely to satisfy a manual checklist.

## Current production authorities

- `src\components\DatabaseToolsDialogs.tsx` — `DE1E050C767B9B94CC37C186F3114E3E93F834D9E372092BDF084043508FE82E`
- `src\types\desktop.ts` — `01F4525AFA562122315D6CFBA8CF5A3328978A99CEE8AC704DADBCB72AACDEC7`
- `src\platform\types.ts` — `8877AAB6F78CDC0502CF2B153A05585B2C34A185D898E65ECBB2B41A5908C606`
- `src\platform\tauriDesktop.ts` — `620A1DDE53EECEFBD55B109ED531B9B54FF084504E6685A0F86185BBF5F0ACEC`
- `src-tauri-shell\src\database.rs` — `C4CDD04147A5891D8D10A083E06B428F83AC44565477B21666BC4FFAED21E47D`
- `src-tauri-shell\src\database\nse_identity_imports.rs` — `2E05EF2050179305223A95F10CD0B3B2DE894F9615A78991E2D93F6ADD7542AB`
- `src-tauri-shell\src\database\instrument_mutations.rs` — `39A37CEC5360648654FCC1FE3F66105655CDC68E9B907BFF77B68984F29B4C82`
- `src-tauri-shell\src\main.rs` — `A97A3AF97310D0C681111EDC45D320FD9CEF064FFFFB354E746B949005BD54C2`

## Current test authorities

- I4 historical reviewed/atomic test — `73030E86E1DE048B382663EC47AD7F33A9F26753B722B11AE2B96BEE72AFA3B0`
- I3 reviewed-Apply test — `D21DED350F2588B3FD09B19BCA810A71B0062B6B92F66BAEE786F695249070A0`
- Identity characterization — `E3F9EE15216A972B7A9DA597533365F8058747730BD8A7243C9989AD552BD8D1`
- Identity compact workspace — `F98361B70ABA6E7316005268F2E2FD8F6EB413B3E3FEE41670C20F2AEB4646B6`

## I3 current-universe reviewed authority

```text
Preview
→ plan SHA
→ Apply Reviewed Changes
→ backend rebuild + compare
→ stale/malformed authority rejects
→ successful Apply consumes authority
```

I4 manual acceptance confirmed this lifecycle still works after I4.

## I4 historical reviewed authority

When a valid Manual archive exists:

```text
Preview Historical Identity
→ Actionable default review
→ All / Duplicates / Skipped / Errors filters
→ complete I4 plan SHA
→ Apply Reviewed Historical Identity
→ rebuild under one write transaction
→ exact SHA match: commit all
→ mismatch/failure: rollback all
```

The one atomic transaction contains historical identity, security-master, and current-universe effects.

## I4 evidence authority

`E:\TA Projects\EOD Charting Platform Source Audit\IDENTITY_I4_R1C_NSE_HISTORICAL_ATOMIC_2026-09-06_133121_IST_evidence.zip`

SHA-256:

`534ADE9B382EA20BA7EC479410FC2ECEFBB5C7CDF76BF9640C716FB73F42B00F`

Portable SHA-256:

`A13FC694960FCB81FC34654C235EF861EA5226EC1B3FBB61A3AB6845EB97BD49`

## BSE boundary

BSE capability stays preserved.

BSE historical parity/data acceptance/production Apply are deferred. Do not block NSE work on incomplete BSE historical data.

## Preservation rules for the next chat

Before changing Identity:

1. verify the live source and current authority hashes;
2. state Goal / Scope / Constraints / Project root / files to inspect;
3. inspect the existing implementation before patching;
4. preserve Official NSE as the primary routine source;
5. preserve Manual historical import as fallback/recovery;
6. preserve I3 and I4 reviewed authority lifecycle;
7. preserve one-atomic-transaction I4 semantics;
8. keep BSE historical acceptance deferred unless separately approved;
9. do not broaden a bounded task into a general Identity redesign.

## Next separate documentation task

After this I4 closeout, create a future-only design/handoff for:

**Identity Evidence Resolver / official-source recovery / external-AI handoff**

That document should preserve the future concept without modifying production behavior.
