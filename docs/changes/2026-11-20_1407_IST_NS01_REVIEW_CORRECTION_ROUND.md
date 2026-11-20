# NS-01 review correction round — panic-free validation, parallel workers, bounded reads, fail-closed authority

- **IST timestamp:** 2026-11-20 14:07 IST (UTC+05:30)
- **Active workstream:** EOD Charting Platform (repository `dhamnaik-lab/Eod-Charting-Platform`)
- **Branch:** `arena/1a89772f-eod-charting-platform`
- **Base (verified accepted `main`):** `717eb6f00af96d8f717929eab2fc2d57cd7e5b6f`
- **PR:** #124 — **still on HOLD**. Not merged.
- **Gate status:** **Rustfmt PASS, Renderer PASS, Cargo PASS** on `1d544f1` (run `44704087375`). Native scanner **99 passed / 0 failed**; full crate **1388 passed / 0 failed / 26 ignored / 1 filtered**.
- **Native default:** **OFF.** Unchanged. No production behaviour changes for a user who never opts in.
- **Dependencies:** none added. No architecture redesign.

## 1. Scope

Four source-confirmed findings raised by independent review of `28fbacd`:

1. `native_scanner/ast.rs` — missing required top-level fields could reach `expect()` and panic.
2. `native_scanner/database_source.rs` — `with_connection()` held the connections `Mutex` across the whole database read, serializing supposedly parallel workers.
3. `database/eod_data.rs` — full history was loaded before the result was truncated.
4. Adjusted-mode CA-01 ambiguity handling and canonical DB identity/revision safeguards needed verification and fail-closed behaviour.

## 2. Finding 1 — panic-free request validation (`native_scanner/ast.rs`)

### Defect

`parse_native_scan_request_v1` read each required container with `root.get("universe").and_then(...)`. When a key was **absent**, `Value::get` returned `None`, no `ValidationIssue` was recorded by that step, and control reached:

```rust
universe: universe.expect("validated universe"),
```

with an **empty** issue list — so the `issues.is_empty()` guard did not fire and the function panicked instead of returning `Err`.

A second silent case: `rules` present but not an array also produced `None` with no issue.

### Correction

- Added `require_key`, which records `missing-field` at the container path when the key is absent. Absence (`missing-field`) is now distinguished from a present value of the wrong type (`not-an-object`, `not-an-array`).
- `rules` now reports `not-an-array` when it is present but not an array.
- Construction destructures the three `Option`s with a `let ... else` and returns structured `ValidationIssue`s, with an `incomplete-request` fallback that can only fire if every other diagnostic was somehow lost. No `expect()`/`unwrap()` guards construction.

### Regression tests added (`ast.rs` tests)

| Test | Covers |
| --- | --- |
| `ns01_validator_reports_missing_top_level_sections_instead_of_panicking` | each of `universe` / `evaluation` / `rules` omitted individually, asserting `missing-field` at the right path |
| `ns01_validator_rejects_a_request_with_every_section_missing` | all three omitted at once |
| `ns01_validator_reports_rules_that_are_not_an_array` | non-array `rules` → `not-an-array` |
| `ns01_validator_reports_non_object_sections` | non-object `universe` / `evaluation` → `not-an-object` |
| `ns01_validator_never_panics_on_malformed_input` | eight malformed payloads (`null`, array, string, number, `{}`, minimal, all-null, bad schema) |

## 3. Finding 2 — connections no longer serialize workers (`native_scanner/database_source.rs`)

### Defect

```rust
let mut guard = self.connections.lock()?;   // registry mutex
...
let connection = guard.get(&thread)?;
f(connection)                               // <-- whole DB read inside the guard
```

The registry `Mutex` was held across the entire `read_scan_bars_for_folder` call, so 1–4 configured workers executed their database reads strictly one at a time.

### Correction

`connections` is now `Mutex<HashMap<ThreadId, Arc<Mutex<Connection>>>>`. `connection_for_current_thread()` takes the registry lock only long enough to look up or create the calling thread's handle and returns an owned `Arc`; the guard is dropped before any I/O. The per-connection `Mutex` is then held for the duration of one `load_bars` call — uncontended in practice because a connection is only ever used by the thread that owns it — and exists purely so `&Connection` cannot alias without an `unsafe` impl.

No `Drop` bookkeeping was added: the map already owns every handle, so dropping the source closes them. Worker threads retain their `Arc` clone for as long as they are reading, which is the required lifecycle.

### Concurrency test design

A timing test on a one-row fixture is inherently flaky. Instead a `#[cfg(test)]`-only probe (`test_probe`) counts concurrent read sections and can inject a fixed delay:

- `p1_08_workers_read_concurrently_without_a_global_connection_lock` — 4 threads barrier-synchronised so all four connections exist before any read; each read section stalls 40 ms; asserts **peak concurrent reads > 1**. With the registry lock spanning the read this can never exceed 1.
- `p1_08_each_worker_owns_a_distinct_connection` — no two threads share an `Arc` (checked by pointer identity).
- `p1_08_a_worker_reuses_its_connection_across_targets` — same thread gets the same handle back.

The probe is compiled out entirely in non-test builds: production carries no counter, no atomics and no delay.

## 4. Finding 3 — genuinely bounded reads (`database/eod_data.rs`, `database/binary_eod.rs`)

### Defect

`read_scan_bars_for_folder` called `load_unified_price_rows` (whole history) and truncated to `window` afterwards. The `from` bound was hardcoded `"1900-01-01"`.

### Correction

- `SCAN_PADDING_BARS = 8` — rows loaded *before* the window (a weekend plus the longest ordinary Indian holiday run, the same window `guard_index_previous_close` treats as adjacent).
- `load_unified_price_rows_bounded()` — per related symbol: binary `.eod` files go through the new `BinaryEodFile::read_range_bounded()`, SQLite/Hybrid through `ORDER BY date DESC LIMIT ?`. It then runs the **same** `validate_index_alias_rows` / `validate_bse_code_rows` / `select_preferred_price_row` / `recompute_prev_close` / `guard_index_previous_close` pipeline as the unbounded loader.
- `BinaryEodFile::read_range_bounded()` — binary-searches the lower bound (same search as `read_range`) *and* the exclusive upper bound, then seeks straight to the newest `limit` records. A 30-year file costs the same handful of reads as a 30-day one; older records are never decoded.

### Why truncation is semantically equivalent — and how it is proven

Consumer by consumer:

- `apply_corporate_adjustments` divides a row by the factors of actions whose `effective_date` is **after** that row. Those factors come from `corporate_action` rows in `context` (read from the database, not the price slice), so an action older than the slice still contributes its factor; it just has no older rows left to rescale. **Adjusted prices are never derived from neighbouring adjusted rows.**
- The dividend presence gate only asks whether *some* loaded row precedes the effective date. A dividend older than the slice is skipped — equivalent, because it had no in-window row to rescale either way.
- `recompute_prev_close` and `guard_index_previous_close` look back exactly one bar, which the padding supplies. The first window row still sees its real predecessor.
- Per-date identity/alias selection does not depend on which older dates are present.

The argument is documented in-function, but the tests do not rely on it — they compare against a full read:

| Test | Asserts |
| --- | --- |
| `p3_bounded_read_matches_the_full_history_read_for_a_raw_window` | 60-bar bounded read is a bar-for-bar suffix of a 280-bar full read, including `prev_close` |
| `p3_bounded_read_preserves_adjusted_semantics` | 40-bar adjusted read equals the full adjusted read, **plus** a guard that the fixture really rescales (see §7) |
| `p3_bounded_read_applies_a_split_newer_than_the_window` | a split effective after the whole history still rescales every window row |
| `p3_bounded_read_ignores_a_split_older_than_the_window` | a split effective before every window row rescales nothing |
| `p3_bounded_binary_read_matches_a_full_read` | binary `.eod` path: 30-bar bounded equals the full-read tail |
| `p3_read_range_bounded_returns_the_newest_n_records` | limits 1/5/49/50/51/10000 always return a strict suffix ≤ limit; date ranges still filter |
| `p3_bounded_read_handles_an_empty_history` | empty history is `Ok(vec![])`, not an error or panic |

## 5. Finding 4 — fail-closed authority (`p4_*` tests)

Verified behaviour and pinned with tests:

| Test | Asserts |
| --- | --- |
| `p4_adjusted_read_fails_closed_without_a_resolvable_identity` | unresolvable identity errors in **both** raw and adjusted mode, even with corporate actions present for that symbol |
| `p4_adjusted_read_fails_closed_on_invalid_dividend_factor` | a dividend whose recorded factor cannot support a projection errors rather than being skipped |
| `p4_adjusted_read_fails_closed_on_a_dividend_without_cash` | a dividend with no cash amount per share errors (the CA-01 ambiguity case) |
| `p4_bounded_adjusted_read_still_fails_closed_on_ambiguity` | the fail-closed channel survives the new bounded path at windows 1, 2, 10 and 500 |
| `p4_raw_read_stays_available_when_adjusted_is_blocked` | CA-01 HOLD blocks only the adjusted claim; raw reads keep working |

Pre-existing CA-01 coverage (`ca01_adjusted_gateway_fails_closed_on_ambiguous_corporate_actions`, `ca01_legacy_mutated_actions_are_never_applied`) still passes unchanged.

## 6. Formatting integrity — accepted modules were not reformatted

`src/database/eod_data.rs` and `src/database/binary_eod.rs` are **already rustfmt-dirty in the accepted base** (480 and 51 differing lines respectively). A naive `rustfmt` run reformatted both files wholesale, which would have buried a ~170-line correction inside a ~670-line diff of accepted database code.

The formatter output was therefore reverted and only the intended edits were re-applied. Verification: the format-diff line count is **unchanged** at 480 and 51 before and after the edits, i.e. the new code contributes **zero** format diffs. The reason is recorded in a comment in `.github/workflows/rustfmt-ci.yml`, and those two files are deliberately **not** enrolled in the rustfmt gate. Pre-existing dirtiness is listed as separate remediation in §9.

## 7. A test caught itself being vacuous

The first push of this round (`76d2362`) failed CI twice, both times for real reasons rather than infrastructure:

- **`44701830704` step 8** — `E0428`: two `p4_*` tests were defined twice (an edit pass appended the item-4 block while a stale partial copy remained). Stale 100-line block removed; no duplicate test names remain.
- **`44703012136` step 9** — `p3_bounded_read_preserves_adjusted_semantics` panicked with *"the fixture did not exercise a real adjustment"*. That guard was deliberate: the 280-day 28-day-month walk ends at 2023-10-28, so a split effective 2023-10-01 left the newest rows unscaled and the bounded-vs-full comparison proved nothing about adjustment. Split moved to 2023-12-01. **Without the guard the test would have passed while silently not testing adjustment.**

An unused `use std::time::{Duration, Instant};` and an unused `temp: &Path` parameter on `seed_long_history` (also flagged by those runs) were removed.

## 8. Evidence

### Hosted CI — `1d544f1` (final)

| Gate | Result | Evidence |
| --- | --- | --- |
| Rustfmt (scanner + native scanner) | **PASS** | run `44704087443` |
| Renderer tests, typecheck, build | **PASS** | run `44704087409` |
| Cargo step 8 `cargo check --tests --locked` | **PASS** | run `44704087375` |
| Cargo step 9 native scanner tests | **PASS** — `99 passed; 0 failed` (1316 filtered) | run `44704087375` |
| Cargo step 10 scanner RSC-01..RSC-06 | **PASS** | run `44704087375` |
| Cargo step 11 full crate | **PASS** — `1388 passed; 0 failed; 26 ignored; 1 filtered out` | run `44704087375` |

Steps 9/10/11 counts are read from the job log, not inferred. The single filtered test is `database::nse_identity_imports::tests::resolves_standard_archive_paths`, skipped by exact name because it asserts Windows separators and cannot pass on Linux; it is byte-identical to the accepted base and remains a Windows acceptance item (§9).

### Local

- `rustfmt --check` via `@scalar/rustfmt` 0.5.0 (WASM) on all 11 `native_scanner` modules: clean.
- `./node_modules/.bin/tsc -p tsconfig.json --noEmit`: exit 0. No TypeScript was changed this round.
- `vitest` `nativeScannerRunNS04` + `nativeScannerParityNS01`: 70 passed.
- No native Rust toolchain in the implementing environment — all Rust results above come from hosted CI.

### Commits (all fast-forward pushes, no force-push)

| Commit | Content |
| --- | --- |
| `76d2362` | the four findings (`ast.rs`, `database_source.rs`, `eod_data.rs`, `binary_eod.rs`, `tests.rs`, rustfmt workflow comment) |
| `d65e40e` | remove duplicated item-4 tests + unused fixture parameter |
| `1d544f1` | correct the adjusted-fixture split date + drop unused import |

## 9. Remaining gaps — not claimed as verified

**Windows-specific (cannot be executed in this environment):**

- `src-tauri-shell/src/database/nse_identity_imports.rs` `resolves_standard_archive_paths` genuinely needs Windows separators. Skipped on Linux by exact name; **must** be run on Windows before acceptance.
- `Invoke-EOD-SharedCargo.ps1` shared-cargo wrapper, `tauri:check`, portable build, installed-app launch.
- Live native UI: the OFF-by-default toggle, running a scan against a real database, cancellation and progress in the real window.
- Disposable-database acceptance and the worker benchmarks (parallel throughput with 1/2/4 workers on realistic data — the new tests prove *overlap*, not throughput).
- The bounded-read change has not been run against a production-scale `.eod`/SQLite database. `read_range_bounded` is proven correct on synthetic files of 50 and 240 records; seek behaviour on multi-decade files is reasoned about, not measured.

**Accepted-base formatting debt (pre-existing, untouched):**

- `database/eod_data.rs` (480 format-diff lines) and `database/binary_eod.rs` (51) were already rustfmt-dirty at `717eb6f`. Reformatting them belongs in a separate formatting-only change, not this correction.

**Still open from the earlier audit (not addressed by this round):**

- Setup permit race (`4635533622`).
- Detector-metadata transport (`4638966385`).
- The `guard_index_previous_close` >7-day adjacency rule remains a heuristic; a genuine >7-day trading halt is indistinguishable from missing data by design.

## 10. Protected files and defaults

- No protected document, generated artifact or `.git/info/attributes` path was created, modified or staged.
- No `.eod` file and no user database was touched; every fixture is a disposable temp directory.
- `native_scanner` remains OFF by default; the TypeScript scanner remains the sole default backend.
- No dependency, `Cargo.toml` or `Cargo.lock` change.
- PR #124 remains **OPEN and on HOLD** — not merged.
