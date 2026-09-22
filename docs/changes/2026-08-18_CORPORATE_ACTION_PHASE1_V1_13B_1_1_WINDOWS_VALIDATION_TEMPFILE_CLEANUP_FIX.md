# Corporate Action Phase 1 — V1.13B-1.1 Windows Validation Tempfile Cleanup Fix

Date: 2026-08-18

## Scope

Validation-recovery only. No production Rust/source change and no live database operation.

## Root cause

The V1.13B-1 implementation package contract created a temporary SQLite fixture using
`sqlite3.connect(...)` and retained that connection until `TemporaryDirectory` cleanup.
POSIX permits deletion of the still-open file, but Windows denies deletion with `WinError 32`.

The failure occurred after production-source installation/hash verification and before focused
Rust regressions. It did not open or mutate the production EOD database.

## Fix

The recovery validator uses `contextlib.closing(sqlite3.connect(...))` so the fixture handle is
explicitly closed before the temporary directory is removed. The protected-state subprocess
already closes its own read-only connection.

The recovery wrapper verifies the exact already-applied V1.13B-1 source hashes, reruns the
package contract, then continues with focused V1.13B-1 Rust tests, accepted V1.9.2 regressions,
and `cargo check`.

## Safety

- production source writes: 0
- live database operations: 0
- Corporate Action writes: 0
- Quick Resolves: 0
- Git operations: 0
