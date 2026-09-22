# Bhavcopy BSE Index Candidate Classification V1.1

## Timestamp
2026-08-13 15:55 IST

## Why V1.1 exists
V1 failed closed and changed no project file because its installer assumed a direct
`Err("HTML response instead of CSV")` inside `stage_single_download()`.

The live source inspection showed the real defect: BSE/BSE Index HTML payloads are
already counted as soft candidate mismatches (`not_found_count += 1; continue;`), but
the same soft text is also stored in `last_error`. If another candidate produced a
genuine hard error, a later HTML mismatch could overwrite that hard error and become
the terminal ERROR message.

## V1.1 policy
- Soft candidate mismatch/unavailable outcomes do not become terminal hard errors.
- Genuine fetch/processing errors remain hard errors.
- Terminal SKIP occurs only when there is no hard error and the existing
  unavailable/mismatch conditions are satisfied.
- Staged and direct candidate paths use the same pure terminal classifier.

## Soft outcomes
- no file;
- BSE Index archive API returned no usable rows;
- archive contained no CSV;
- BSE/BSE Index HTML instead of expected CSV.

## Hard outcomes
Genuine transport/fetch/data-processing errors remain ERROR.

## Files changed
- `src-tauri-shell/src/bhavcopy.rs`
- `docs/changes/2026-08-13_1555_IST_BHAVCOPY_BSE_INDEX_CANDIDATE_CLASSIFICATION_V1_1.md`

## Preserved
Provider URLs/order, calendar safety, same-day cutoff, Prefilter Range Scan V1,
binary format/writes, Phase 2C/2D durability, interrupted checkpoint recovery,
Manual Import Recovery, and renderer/UI.

## Validation
1. focused terminal-classification regression;
2. full Bhavcopy Rust suite;
3. `cargo check`.

## Runtime acceptance
Repeat the same current-day Date Range probe. HTML must never itself be the reason for
terminal ERROR. If all candidates are soft/unavailable, BSE Index must end as SKIP.
If a genuine hard candidate error exists, ERROR may remain but must report that real
hard error.

## Documentation status
This additive report is installed immediately. Full canonical Bhavcopy documentation
reconciliation remains required before the final source snapshot.