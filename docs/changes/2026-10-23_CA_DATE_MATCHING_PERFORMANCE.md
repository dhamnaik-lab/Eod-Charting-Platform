# CA date default and repeated matching setup — 23 October 2026

Project: `E:\TA Projects\EOD Charting Platform`.

## Report and scope

The user reported that Official Imports defaulted its end date to 22 November while the current India date was 23 October, and supplied matching progress screenshots: 20/4,699 at 3m49s, 60/4,699 at 5m07s, and 145/4,699 at 7m47s. Another screenshot showed a BSE fetch failure, HTTP 403. No live database was inspected or changed by this work.

Backup PASS: `backups/pre_opencode_changes_20261023_020559_ca_matching_speed_today`.

## Changes and evidence

- `src/components/DatabaseToolsDialogs.tsx`: change the default end date from `indiaIsoDate() + 30 days` to today's India date. Keep the 90-day lookback and explicit editable future ranges.
- `src-tauri-shell/src/database/corporate_action_imports.rs`: Quick Resolve now uses the existing initialized active connection. Previously each individual match called `open_connection_for_folder`, which calls `prepare_database_connection` (pragmas, migrations/schema checks, official-source bootstrap, and defaults). A queue of thousands of matches therefore repeated connection preparation thousands of times. The cached connection is initialized on first use and refreshed when the database changes.
- The same per-row transaction and strict identity-proof function remain in use. Matching remains serial, cancellation boundaries remain unchanged, and no financial approval, price mutation, proof shortcut, or asynchronous write concurrency was added.
- `src/features/corporateActions/__tests__/corporateActionLegacyOfficialFetchImprovements.test.ts`: extend the existing fetch contract check for today's end-date default.

This removes a confirmed source of repeated work, not a measured end-to-end speed guarantee. Screenshots alone cannot establish the relative cost of initialization, proof queries, locking, or UI updates. The running portable executable will not acquire these source changes until rebuilt and reopened.

Follow-up: the [disposable connection benchmark](2026-10-23_CA_MATCHING_BENCHMARK.md) measured an 11.4x improvement for the isolated backend path on synthetic data, with identical identity/audit outcomes. Full desktop preparation timing remains unverified.

## Validation

- PASS — `cargo test --manifest-path src-tauri-shell/Cargo.toml quick_resolve --offline -- --quiet`: 6/6 tests; Rust test harness compiled/linked in 36 seconds.
- PASS — bounded Vitest run under `src/features/corporateActions/__tests__`, excluding `tmp/**`: LegacyOfficialFetchImprovements, PendingPreparation, and OfficialImportsFix2; 3 files, 35/35 tests.
- PASS — `scripts/validate-change.ps1 -Profile renderer` restricted to the touched renderer paths: typecheck and whitespace.
- No full build, packaging, live performance benchmark, official network retry, production mutation, or app interaction was performed.

## Remaining desktop verification

After the current operation finishes or is cancelled using the app's existing control, close the old executable and rebuild/reopen for the next test. Verify that the default end date is today, then compare matching-stage elapsed time and completed counts against the reported screenshots. Already completed identity resolutions should be retained; no approval is implied by cancelling preparation.

BSE HTTP 403 remains a separate unresolved fetch issue. Its cause was not established here; no replacement feed, guessed identifier mapping, or access-control workaround was introduced.
