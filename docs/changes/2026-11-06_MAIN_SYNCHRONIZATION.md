# Git main synchronization — 6 November 2026 (IST)

At 01:07 IST, local main had fast-forwarded from `4cf6c66ce65c6cfe76a97af8e1636dbd16e9519a` to `09d20595bdc2ccbb6f11320fea3caf32c606c940`, the [PR #23](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/23) merge. Local main, origin/main and live GitHub main matched at 0 ahead and 0 behind. The index matched the merged tree. The working tree retained 67 entries with zero staged or unmerged paths.

| Original entries | Byte-preserved | Reviewed reconciliations | Clean against main after sync | Local-only after sync |
|---|---|---|---|---|
| 136 (62 modified, 74 untracked) | 133 | 3 | 69 | 67 (37 modified, 30 untracked) |

The three reconciliations were the feature matrix's UX-13 rows, the CSV parser's equivalent GitHub OHLC helper, and the local IST clock test's viewport-derived visible-bar assertion. All 136 final hashes matched the validated isolated preview. The checkout retained local work across renderer, scanner, market data, identity, tooling, configuration and documentation.

## Evidence and rollback

The original path bytes and SHA-256 values are under `backups/pre_opencode_changes_20261106_010157_EOD_MainSync_Preserve136`. The evidence directory `tmp/EOD_GitSync_Apply_20261106_005358_IST` holds `REPORT.md`, `final-preservation.json`, `status-after.txt` and `original-index.bin`. GitHub merge metadata is in `tmp/EOD_GitSync_20261106_003941_IST/github-pr23.json`.

The isolated preview recorded `npm ci --no-audit --no-fund`, focused `npm run test -- --reporter=verbose` (62 across 11 files), renderer typecheck/build, shared Cargo Bhavcopy (120 passed, four ignored), recovery (16), locking (3), Tauri check and `git fsck --full --no-dangling` before and after, all PASS. Production databases and portable native acceptance were outside that validation.

For any authorized rollback, first compare current HEAD, index and path hashes with the evidence and review intervening changes. The original HEAD, original index and three original reconciled path contents are a paired rollback set. Preserve the remaining local work.
