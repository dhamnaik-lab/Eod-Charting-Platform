# V1.14AD Prerequisite Non-CA Minimal Parent Candidate Validation R1F

## IST timestamp
2026-08-31 14:21:59.117 IST

## Objective
Test whether the four historical cumulative-baseline Rust failures can be resolved by a deliberately minimal prerequisite parent extracted from current validated source, without promoting the 401 unrelated non-CA paths.

## Previous defect or limitation
R1E successfully validated exact HEAD/blob/two-file candidate assembly and created the deterministic disposable dist/index.html Tauri test-support file. Its scope guard then incorrectly required git status --porcelain to report ?? dist/index.html. In this repository the disposable dist path is not reported as an ordinary untracked path (consistent with an ignored path), so the guard threw DISPOSABLE_FRONTEND_SUPPORT_SCOPE_MISMATCH with an empty status list before any targeted Rust test ran. R1F validates the intended safety property directly: the disposable dist directory contains exactly dist/index.html, the file is not tracked, the file is not staged, and Git ignore status is recorded as evidence rather than treated as a failure.
R1D proved exact two-file candidate assembly, fixed patch serialization, and corrected validation-result/cargo-target cleanup behavior. All four targeted Rust commands then failed at the same Tauri compile prerequisite before any test body ran: tauri::generate_context!() reported that build.frontendDist points to ../dist but the disposable exact-HEAD clone has no generated dist directory. R1E adds only a deterministic untracked dist/index.html test-support stub inside the disposable clone for Rust compilation, verifies its exact SHA-256/scope, and removes it in finally before candidate-scope integrity checks. No frontend source or generated production renderer payload is promoted into the prerequisite parent.
R1C passed exact disposable HEAD/blob identity, fixed patch serialization, and exact two-file candidate assembly. It then failed in validation bookkeeping because Invoke-LoggedExternal allowed Cargo output from Tee-Object to enter the PowerShell function success pipeline, so validation variables contained strings plus the intended result object. Under Set-StrictMode, Where-Object failed when a Cargo-output string had no Label property. R1D captures external output before returning a single typed result object and moves cargo-target deletion into finally so this class of failure cannot leave another multi-GB build directory.
The parent-baseline review proved that direct CA-on-HEAD is invalid, but the 401 non-CA changed paths span many independent workstreams. R1 failed before patching because it compared raw Git-blob bytes with archive-extracted files. R1A corrected that by using exact Git commit/blob identity in an independent shared clone, but its embedded patch lacked the required terminal newline. R1B added the terminal newline through Set-Content; on Windows that left a CRLF terminator on the final context line, so git apply could parse the patch but the bootstrap.rs final hunk did not match the LF Git preimage. R1D explicitly serializes the same patch as UTF-8 without BOM and LF-only bytes and validates its SHA-256/numstat before applicability testing.

## Files changed in disposable candidate
- src-tauri-shell/src/bhavcopy.rs
- src-tauri-shell/src/database/bootstrap.rs

The real project source/config was not edited. The real Git index was not changed.

## Final implementation tested
- BSE parser compatibility aliases: SC_GROUP, NO_OF_SHRS, NO_TRADES, TTLNBOFTXSEXCTD, DATE1, TRADE_DATE, TRADE_DT.
- Bhavcopy test fixture creates market_holidays and seeds 2026-06-26 Muharram.
- Bootstrap test fixture creates market_holidays.
- Candidate assembly uses an independent shared detached clone of exact HEAD; no git archive byte-equivalence assumption is used.
- Rust-test compilation support uses one disposable untracked dist/index.html stub only; expected SHA-256: 6C3AAA5068DB780268916D49306572F9DF7482B4955DD39764BFCB4ACF2B21BC. The stub is removed in finally and is excluded from the two-file parent candidate.
- Embedded patch serialization is normalized to LF-only UTF-8 without BOM; any CR byte, missing terminal LF, SHA-256 mismatch, or unexpected numstat fails closed before git apply --check.
- Exact prerequisite HEAD blob OIDs verified: bhavcopy 53973e731c82001268b9120726d46fed58a1c35b; bootstrap aacbd1b4dcc0422375a676af18ca089e0a6dd963.
- The minimal patch is staged only in the disposable clone index so its exact candidate blob identities can be recorded; the real project index is separately hash-guarded.
- No drawing, indicator, plugin, watchlist, DNN, storage-index, quote-editor, or CA source was promoted into this candidate.
- Minimal patch SHA-256: 041EB81E55A29364112555A1CF0A328D3BF9E40DBC7970EE8D3C1BFCCDF8EC34
- Candidate changed path count: 2

## Validation commands and actual results
- cargo-fmt-check: exit 1
- targeted-bhavcopy-tests-test_bse_uses_shared_cash_market_holiday_calendar: exit 0
- targeted-bhavcopy-tests-test_parse_bse_udiff_equity_bhavcopy: exit 0
- targeted-database-bootstrap-tests-test_seed_defaults_does_not_overwrite_existing: exit 0
- targeted-database-bootstrap-tests-test_seed_defaults_sets_hybrid_if_missing: exit 0
- cargo-test-full: exit 0

## Classification
MINIMAL_PREREQUISITE_NON_CA_RUST_PARENT_CANDIDATE_VALIDATED__EXACT_2_FILES__REAL_STAGING_STILL_BLOCKED

## Real-repository preservation
- HEAD: f4278bc62649552f119fa6438b688a10dccef25e
- Real index SHA-256 before: 3B1C9A68BB53674F5B84CF649F3CD676BF801A6156E97CAB7D2BCFECA624891A
- Real index SHA-256 after: 3B1C9A68BB53674F5B84CF649F3CD676BF801A6156E97CAB7D2BCFECA624891A
- Staged path count after: 0

## Risks or limitations
- Passing this candidate validates only the minimal Rust prerequisite hypothesis. It does not authorize real staging or commit.
- cargo fmt --check is recorded but non-gating because the old HEAD may contain pre-existing formatting drift outside the selected behavioral/test-fixture hunks.
- If the full Rust suite passes, the next step is an alternate-index staging preflight for these exact two-file hunks, followed by CA rebase/revalidation on that proposed parent.
- Frontend/package/watchlist hygiene changes remain deliberately outside this minimal parent unless later validation proves they are required.

## Rollback guidance
Delete this Markdown report and the external audit directory if this disposable validation is discarded. No source, index, database, or application rollback is required.
