# Identity I4 - NSE Historical Reviewed Preview + Atomic Apply

Status: AUTOMATED PASS / MANUAL I4 CHECK REQUIRED
Generated: 2026-09-06 13:31:21 IST

## Goal

Replace direct NSE historical identity mutation with reviewed Preview/Apply and one atomic historical/master/current-universe transaction.

## Accepted design implemented

- Option C review: Actionable default plus All, Duplicates, Skipped, Errors.
- Option A transaction: historical identity + master + current-universe work commit as one unit.
- Preview runs the exact operation inside a rollback-only transaction.
- Apply rebuilds under BEGIN IMMEDIATE and validates expectedPlanSha256 before commit.
- Direct interactive import_nse_identity_archive route is retired.
- Historical and I3 current-universe reviewed authorities cross-invalidate.

## Validation

- I4 TDD RED: PASS
- I4 focused GREEN: PASS
- I4 historical Rust atomicity/stale tests: PASS
- I4 standalone/nested identity transaction test: PASS
- I3 Rust reviewed-plan regression: PASS
- NSE historical regressions: PASS
- I3/I2-R2/I2/I0/I1 regressions: PASS
- Full Corporate Action regression suite: PASS
- Renderer typecheck: PASS
- Renderer build: PASS
- Cargo check: PASS
- Portable Windows build: PASS

## Hashes

- DatabaseToolsDialogs.tsx: DE1E050C767B9B94CC37C186F3114E3E93F834D9E372092BDF084043508FE82E
- desktop.ts: 01F4525AFA562122315D6CFBA8CF5A3328978A99CEE8AC704DADBCB72AACDEC7
- platform/types.ts: 8877AAB6F78CDC0502CF2B153A05585B2C34A185D898E65ECBB2B41A5908C606
- tauriDesktop.ts: 620A1DDE53EECEFBD55B109ED531B9B54FF084504E6685A0F86185BBF5F0ACEC
- database.rs: C4CDD04147A5891D8D10A083E06B428F83AC44565477B21666BC4FFAED21E47D
- nse_identity_imports.rs: 2E05EF2050179305223A95F10CD0B3B2DE894F9615A78991E2D93F6ADD7542AB
- instrument_mutations.rs: 39A37CEC5360648654FCC1FE3F66105655CDC68E9B907BFF77B68984F29B4C82
- main.rs: A97A3AF97310D0C681111EDC45D320FD9CEF064FFFFB354E746B949005BD54C2
- I4 focused test: 73030E86E1DE048B382663EC47AD7F33A9F26753B722B11AE2B96BEE72AFA3B0
- portable: A13FC694960FCB81FC34654C235EF861EA5226EC1B3FBB61A3AB6845EB97BD49

## Safety boundaries

- Production database access by runner: NO
- Direct web/download command by runner: NO
- Source-control command by runner: NO
- BSE historical acceptance: DEFERRED

## Manual checkpoint

Use a disposable/private test database. Verify Historical Apply is disabled before Preview, Actionable is the default, all five filters only change display, archive-root changes invalidate authority, successful Apply consumes authority, and I3 current-universe Preview/Apply remains intact.
