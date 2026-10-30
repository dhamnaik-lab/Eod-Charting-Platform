# Native chart acceptance checkpoint

Date: 24 October 2026.
Pre-edit backup: `backups/pre_opencode_changes_20261024_003914_ca_native_already_processed`.

The user authorized native chart acceptance followed by Already Processed classification, with native acceptance as the first checkpoint.

## Completed

- PASS: `npm run build:renderer`.
- PASS: `npx tauri build --debug --config src-tauri-shell/tauri.conf.json --no-bundle`. Native compile/link finished in approximately 1 minute 44 seconds, with seven warnings. Executable: `target/debug/eod-charting-platform-shell.exe`. No installer or distributable portable package was produced.
- Created `tmp/ca-native-acceptance-20261024/database/market-data.sqlite3` via SQLite online backup with the original source opened in read-only mode. Copied WEIZFOREX, EBIXFOREX and DELPHIFX binary files into this disposable database. The directory manifest identifies it as CA NATIVE ACCEPTANCE COPY.
- Configured a separate runtime/profile under that same tmp directory using the existing EOD_CHART_PORTABLE_ROOT and app-profile-location mechanisms.
- Native accessibility output confirmed the app opened CA NATIVE ACCEPTANCE COPY and showed the database range 2011-06-28 through 2026-10-14. The selected chart was an inherited KOTAKBANK tab with zero bars in the restricted copy; this does not establish DELPHIFX acceptance.

## Blocker and stop point

The Windows automation helper could enumerate the EOD Chart window and initially read its accessibility tree, but screenshot capture failed with `FrameArrived timed out: timed out waiting on channel`. An attempted symbol control click failed with `coordinate input geometry is unavailable`. Restarting the acceptance instance visibly and retrying window selection/activation still produced `window capture timed out: timed out waiting on channel` twice. The Computer Use skill requires stopping UI automation after failed recovery.

Native chart acceptance is INCOMPLETE. The date range in the database footer alone is not chart acceptance. DELPHIFX must still be selected in the rebuilt app, WEIZFOREX-era bars inspected, and the dividend toggle checked against the four recorded factors. Existing focused Rust tests remain the automated evidence from the preceding checkpoint.

Already Processed implementation has not started because the agreed native acceptance checkpoint has not passed. No classification, approval, canonical record or source database changes were made during this attempt. Both launched acceptance processes were stopped; no dev server or watcher was started. The debug executable and disposable copy remain for follow-up. Source database metadata remained 93,368,320 bytes, last modified 23 October 2026 at 17:48:33.
