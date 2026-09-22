# Backup Retention Reset Report

Date: 2026-04-04

## Historical Scope Note

- This report describes the backup-retention reset performed on April 4, 2026 only.
- Later work has created additional timestamped backup folders under `backups/`; the compact baseline remains retained, but it is no longer the only backup folder.

## Summary

The old backup set was pruned to reclaim disk space, and one new compact retained baseline was created in the existing timestamped backup style.

## Retained Backup

- `D:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260404_150804_compact_backup_baseline`

## What The Retained Baseline Includes

- active `src/` source
- active `src-tauri-shell/` source, excluding heavy generated output
- `scripts/`
- `resources/`
- current key configs and project docs
- current Tauri/runtime/performance reports

## What It Excludes Intentionally

- `node_modules/`
- `dist/`
- `release/`
- `EOD DATABASE/`
- `test-output/`
- older `backups/`
- deleted runtime trees
- heavy generated folders such as `src-tauri-shell/target/`

## Footprint Change

- before: about `4.76 GB` across `58` backup folders
- after: about `126.8 MB` across `1` retained backup folder

## Cleanup Note

Some older backup folders contained a Windows-invalid `nul` file entry. Those were removed using a verified long-path cleanup path after the retained compact baseline was confirmed.
