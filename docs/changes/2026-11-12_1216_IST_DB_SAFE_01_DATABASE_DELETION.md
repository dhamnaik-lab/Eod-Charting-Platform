# DB-SAFE-01 database deletion safety

Completed on 12 November 2026 at 12:16 IST.

## Objective and source authority

The old Delete Databases command accepted a caller-selected folder, removed recent and active registry entries before the filesystem operation, and cleared the cached connection regardless of which database was selected. Snapshot resolution could reopen a partially deleted database if its SQLite file survived.

The active checkout was `E:\TA Projects\EOD Charting Platform`. Local HEAD and GitHub `main` both resolved to `19518fbcf721c27a891098824cca3cabe42f33fb` before editing. The 33 pre-existing changes were preserved. The three project control documents received scoped additions.

## Implementation

- A deletion target must be a verified recent database on a fixed local Windows NTFS volume. The command rejects malformed paths, redirection, protected application directories, the working directory, and paths that contain another registered or nested database. It requires a recognized database layout and a read-only check of EOD-specific SQLite tables and columns. The manifest is parsed strictly when present, including custom safe SQLite basenames. A genuine legacy database can use the default filename without a manifest. Mixed-purpose roots with unrecognized entries require review.
- The Windows adapter pins the volume, ancestors, root and descendants. Child opens use the verified parent handle and reject reparse points. The app opens SQLite for proof without initializing it, repeats ownership checks with write-denying evidence after closing the matching cached connection, and verifies the main file's identity when obtaining the delete handle. File and directory removal use the verified handles. Unsupported volumes and Windows operations fail closed.
- Active-folder, active-file and cached-context lookup carry a shared OS-backed permit through the last use. Detached Bhavcopy work inherits that permit before enqueueing. Lifecycle commands, profile migration and maintenance entry points participate. Deletion takes the exclusive use permit, the existing non-reentrant price-store permit, then the registry lock. Registry transitions take the cache mutex last. Snapshot theme migration releases the registry lock before resolving a database again.
- The safety record lives in the Windows user's Local AppData known folder under `EOD Chart Database Safety\interrupted-deletions.json`. It records the verified root identity and canonical path outside individual profile registries. The app syncs the temporary record and commits it with write-through replacement before removal. The matching active pointer is then cleared and persisted. The recent list is written after verified removal. A pre-removal pointer-write failure aborts and attempts to remove the marker. A failed or uncertain destructive phase retains the marker. Active resolution, direct activation, cached-context access and maintenance access refuse marked roots and surviving descendants.
- Refusal, busy, failure before any confirmed removal, partial removal, and post-removal registry failure have separate feedback. The dialog stops at the first failure and records only successful commands as complete. It retains keyboard handling and typed confirmation. The existing snapshot payload, registry JSON shape, database schema, healthy-profile automatic activation and price-storage behavior are preserved.

## Files changed

- Rust configuration and integration in `src-tauri-shell/Cargo.toml`, `src-tauri-shell/src/main.rs`, `src-tauri-shell/src/app_profile.rs`, and `src-tauri-shell/src/database.rs`. Cargo changes enable features on the existing `windows` crate.
- Registry and coordination in `src-tauri-shell/src/database/connection_registry.rs` and `src-tauri-shell/src/database/price_store_operation_lock.rs`. New files are `src-tauri-shell/src/database/database_use.rs`, `src-tauri-shell/src/database/database_deletion.rs`, `src-tauri-shell/src/database/database_deletion/windows.rs` and `src-tauri-shell/src/database/database_deletion/tests.rs`.
- Permit lifetime changes in `src-tauri-shell/src/bhavcopy/mod.rs`, `src-tauri-shell/src/bhavcopy/ingestion.rs`, `src-tauri-shell/src/bhavcopy/holiday_sync.rs`, `src-tauri-shell/src/database/corporate_action_imports.rs` and `src-tauri-shell/src/nifty_history.rs`.
- Renderer changes in `src/components/DeleteDatabaseDialog.tsx`, `src/features/workspace/databaseDeletionFeedbackService.ts` and `src/features/workspace/__tests__/databaseDeletionFeedbackService.test.ts`.
- This record and the existing `HANDOFF.md`, `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`, and `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`.

## Validation and build evidence

The following final commands ran from the project root. For each Cargo row, the equivalent `-Mode Preview` command passed before `-Mode Run`. The wrapper used `--offline --locked` and the shared project-root target. New destructive tests used genuine isolated SQLite fixtures under `tmp/fixtures/db-safe-01`.

| Command | Exit | Result |
| --- | --- | --- |
| `Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction test -CargoArguments @('database_deletion','--','--nocapture')` | 0 | PASS. 9 harness cases passed, including one Windows symlink capability SKIP within its test. |
| `Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction test -CargoArguments @('connection_registry','--','--nocapture')` | 0 | PASS. 5 passed. |
| `Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction test -CargoArguments @('price_store_operation_lock','--','--nocapture')` | 0 | PASS. 3 passed. |
| `Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction test -CargoArguments @('bhavcopy::','--','--nocapture')` | 0 | PASS. 166 passed, 4 ignored. |
| `Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction test -CargoArguments @('database::quotes::','--','--nocapture')` | 0 | PASS. 25 passed. |
| `Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction test -CargoArguments @('imports::tests::','--','--nocapture')` | 0 | PASS. 225 passed, 1 ignored. The filter includes identity and Corporate Action import regressions. |
| `Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction check` | 0 | PASS. |
| `node node_modules/vitest/vitest.mjs run --config tmp/fixtures/db-safe-01/vitest.config.mts src/features/workspace/__tests__/databaseDeletionFeedbackService.test.ts src/features/app/__tests__/modalFocusNavigation.test.ts` | 0 | PASS. 15 passed across 2 files. |
| `validate-change.ps1 -Profile renderer -Paths <the three renderer files above>` | 0 | PASS. Renderer typecheck and scoped whitespace. |
| `node node_modules/vite/bin/vite.js build --config tmp/fixtures/db-safe-01/vite.config.mts` | 0 | PASS. Production renderer build under `tmp/fixtures/db-safe-01/renderer-dist`. |
| `validate-change.ps1 -Profile docs -Paths <the four documentation files above>` | 0 | PASS. Live references and scoped whitespace. |

The Windows tests passed for real junctions, rejection of an intermediate junction, attempts to replace the root and an intermediate directory while pinned, independent SQLite handles, cross-process exclusion, and permit lifetime through a queued-work handoff. Fault injection covered no confirmed removals, partial loss with SQLite surviving or missing, active-pointer write failure and recent-registry write failure after removal. A fresh process and a stale profile-registry fixture respected persisted markers. The host lacks symlink creation privilege, so real symbolic-link creation was skipped. Native desktop UI flows and physical power-loss recovery were outside this fixture evidence.

An initial Rust build exposed type and visibility errors. Initial registry fixtures then exposed an atomic-replacement sharing conflict with a pinned parent. The final runs above passed after correcting both. The renderer test and build configurations use the existing generated CSS and leave it untouched.

## Backup, hashes and rollback

- Verified backup `backups/pre_opencode_changes_20261112_114115_DB-SAFE-01`. All 17 backed-up source and document files matched their original SHA-256 values before editing. Backup manifest SHA-256 `2E93F5D69D45D01323DC9B69E01A89B956B849743587CEBB8D61094FE151CB29`.
- Logs are under `tmp/fixtures/db-safe-01`. Final Windows deletion log SHA-256 `A4DDE7839DC0DB2958F6B308CC58C65E1C245CB2023F341B64638491F322FFAB`. Final registry log SHA-256 `1D39BE3611617D8022206C94208D370566B25CE54E55211B7CED6AF01CD8DF78`.
- Built `index.html` SHA-256 `5CC2568C35DBB19DCDF78E63968E210D8B14AC79F1BFD5F7A7CF85B79E1C1556`. Unchanged generated theme CSS SHA-256 `ADD367C326122D5D5B5E5C5982A0D5EAF49731C359864569FD4117E84439D070`. Unchanged Tauri build-info SHA-256 `3D30FEEB15332D24395693E47ACE747BA8A148CCF1BA00C36868BABFE4113A77`.
- For an authorized source rollback, compare the affected files with the verified backup and reverse only this change, including its four new Rust files and scoped documentation additions. Preserve subsequent edits and interrupted-deletion markers. An older executable does not enforce these markers. Keep affected databases out of older executables until the surviving data and recovery evidence have been reviewed.

## Remaining acceptance and limits

The guard coordinates this implementation's commands and maintenance entry points on the same Windows host and account. Unrelated operations can temporarily make deletion busy. Marker and handle guarantees do not extend across different user accounts or a copied database on another machine. A retained marker requires operator review. No production database was accessed or modified. No release executable, installer, portable package, commit or PR was produced during the original implementation. The user subsequently confirmed single-database deletion in the rebuilt app. [Desktop closeout](2026-11-12_1702_IST_DB_SAFE_01_DELETION_CONFIRMATION_ACCEPTANCE.md)
