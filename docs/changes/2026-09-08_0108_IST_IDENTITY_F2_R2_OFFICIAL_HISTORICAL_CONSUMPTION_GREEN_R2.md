# Identity F2-R2 — Official Historical Consumption GREEN R2

Status: GREEN R2 VALIDATED / CANDIDATE INSTALLED
Timestamp: 2026-09-08 01:08:38 IST

Root cause of prior GREEN failure:
- pre-existing cfg(test) create_temp_archive_root collision
- Diagnostic R2: 8/10 runs collided; maximum 7 duplicate paths among 128 calls

Test-only repair:
- process id + SystemTime nanoseconds + AtomicU64 sequence
- permanent concurrent uniqueness regression test
- production F2-R2 behavior unchanged from original GREEN candidate

F2-R2 official managed historical root: INSTALLED
Manual Archive Root preserved: YES
Reviewed Apply source-mode/root/database/SHA binding: YES
Automatic Historical Apply: NO
I4 plan-hash semantics changed: NO
I4 atomicity changed: NO

Temp-root stress: 10/10 PASS
Full NSE Identity default parallel: 3/3 PASS
Cargo check offline: PASS
Renderer TypeScript typecheck: PASS
Project DB command: NO
External network test: NO
Source-control command: NO
