# Identity I3 — NSE Reviewed-Preview -> Apply Authority

Status: AUTOMATED PASS / MANUAL NSE CHECK REQUIRED
Generated: 2026-09-06 02:21:59 IST

## Goal

Bind interactive NSE Apply to the exact backend plan reviewed by the operator and reject stale plans before any write.

## Production changes

- NSE Preview returns planSha256.
- Interactive NSE Apply requires expectedPlanSha256.
- Backend rebuilds and compares the current plan before opening the existing write transaction.
- Stale or malformed reviewed SHA fails closed before mutation.
- Frontend enables NSE Apply only for a current reviewed authority bound to database/source context.
- NSE reviewed authority is invalidated by database/source/manual-root/refresh/historical-import transitions and after every Apply outcome.
- Historical NSE identity import keeps its internal synchronization path.
- BSE command/backend behavior remains unchanged and BSE data acceptance remains deferred.

## Validation

- I3 TDD RED: PASS
- I3 focused GREEN: PASS
- I3 Rust reviewed-plan tests: PASS
- NSE historical identity regressions: PASS
- I2-R2/I2/I0/I1 regressions: PASS
- Full Corporate Action regression suite: PASS
- Renderer typecheck: PASS
- Renderer build: PASS
- Cargo check: PASS
- Portable Windows build: PASS

## Hashes

- DatabaseToolsDialogs.tsx: E406F237E2CCCD5703B73FB6869D6E99C487AE3452F755877AD6E35C4B7A58F2
- desktop.ts: E7963F6A8C1E79B7B3F4901679C7F09026D7694E547F509D487D926B93D380B3
- database.rs: 4AE58E628B5466884CBC8C8E6002F5E0F70BCCBE48236CFF5FBC201B5EB24310
- nse_identity_imports.rs: D54BBBC30DD3E2CD9B6A058A8617F8B1C2FEB069D49BA5571BE7BEF3E9EF73CB
- focused I3 test: F9FFF6D5086C89AAF8B879B1AA42FEC607C019CAEEE89B1D20E6A933A2B94ADE
- portable: BC3964EE38A5DF1152AD082BA70AA77D1AF299407A6CFF2C4CB4AC0D169FADD3

## Safety boundaries

- Production database access by runner: NO
- Direct web/download command by runner: NO
- Source-control command by runner: NO
- BSE Apply acceptance: DEFERRED

## Manual checkpoint

Preview NSE Official and confirm Apply is disabled before Preview, enabled after Preview, invalidated by a context change, and consumed after Apply. Use a disposable/test database for any manual Apply acceptance.
