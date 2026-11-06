# Bhavcopy Download Audit Remediation — Design

Status: **Proposed** (no source change made). Date: 6 November 2026.
Scope: `src-tauri-shell/src/bhavcopy/**` and the renderer result handling for Download Bhavcopy.
Source: read-only audit of main at `e866438`. Nothing here was compiled or run.

## 1. Requirements (derived)

Existing contracts that MUST be preserved ([REQUIREMENTS.md](../../../REQUIREMENTS.md) R-05, R-06, R-06a, R-07):

- Keep broad NSE equity ingestion with no series whitelist.
- Keep the durability contract: only journal-governed `APPEND_NEWEST` may defer `sync_data()`.
- Keep the UX-13 cooperative stop contract and the additive NSE index fallback.
- A failed or unreadable source is never relabeled as a holiday or "no data".
- Automatic Update probes the current local date only from 18:00.

Remediation requirements:

| ID | Requirement | Audit item |
|----|-------------|-----------|
| RM-1 | A corrupt, truncated or non-ZIP body for a ZIP candidate is a hard source error, not "not found". | A2 |
| RM-2 | If post-import refresh (stats invalidation, snapshot, change event) fails after rows were committed, results and row counts are still returned, with a warning. | A3 |
| RM-3 | Staged CSV memory is bounded regardless of date range. Per-response size is capped. | A4 |
| RM-4 | Non-UTF-8 CSV bytes are detected and reported, not silently replaced. | A5 |
| RM-5 | Source URL overrides must be `https` (explicit, documented exception list for none by default). | A6 |
| RM-6 | Single and batch paths share one candidate-scan implementation with one HTML policy. | A10 |
| RM-7 | Errors from clearing a stale `download_log` entry are surfaced. | A8 |
| RM-8 | The worker-cap contract text and code agree, decided on evidence. | A1 |
| RM-9 | The same-day cutoff is evaluated in IST (decision required, see 6). | A7 |
| RM-10 | BSE session warm-up only when BSE jobs exist. | A9 |

## 2. Current behavior (relevant facts)

- `run_bhavcopy_batch` (`mod.rs`) stages every task in worker threads and keeps all `StagedDownload` values (full CSV `String`) in `staged_downloads`. `import_staged_csv_downloads` then parses all of them into `parsed_files` before the journal is prepared.
- `extract_first_csv_from_zip` returns `Ok(None)` on `ZipArchive::new` failure. The callers count `None` as `not_found_count`, so a damaged archive can end as a skip.
- Post-import refresh uses `?` after `spawn_background_bhavcopy_checkpoint`. A failure there discards `combined_results`.
- `stage_single_download` (staged path) and `download_single` (single-date path) duplicate the scan loop. HTML is a hard error in one and "not found" in the other.
- `fetch_candidate_bytes` reads the whole body via `response.bytes()` with no size limit.
- Overrides are only trimmed in `normalize_settings` and `normalize_batch_config`.

## 3. Design

### 3.1 Strict ZIP extraction (RM-1)

Change `extract_first_csv_from_zip` to `AppResult<ZipOutcome>`:

```rust
pub enum ZipOutcome { Csv(Vec<u8>), NoCsvEntry, Invalid(String) }
```

- Invalid archive maps to a hard error string `"Invalid ZIP archive: <reason>"`. The scan records it as `last_hard_error`, so the date is a failed result and is not logged `ok`.
- A valid archive with no `.csv`/`.txt` entry stays `NoCsvEntry` and counts as not found.
- Safety limits stay as they are (128 MB per entry).

### 3.2 Result preservation after import (RM-2)

After rows are committed, the refresh block becomes best effort:

- Wrap `invalidate_cached_db_stats`, `get_app_snapshot_internal` and `emit_database_changed` so each error is logged with `log_runtime_event("WARN", "bhavcopy-refresh-failed", ...)` and appended to progress as a message.
- Return `Ok(combined_results)`. Add an optional `warnings: Vec<String>` to `TrackedBhavcopyBatchResult`. The renderer shows them in the run log as a non-fatal warning, and the result type is updated in `desktop.ts` and `tauriDesktop.ts`.
- Pre-import `?` returns are unchanged.

### 3.3 Bounded staging memory (RM-3, RM-4)

Two parts:

1. **Response cap.** Add `MAX_BHAVCOPY_RESPONSE_BYTES` (proposal: 256 MB, above the ZIP entry cap). `fetch_candidate_bytes` reads with `Content-Length` pre-check and a `take(limit + 1)` read, and fails with a clear message if exceeded.
2. **Chunked import.** Process staged CSV jobs in windows instead of all at once.
   - Group sorted staged jobs into chunks by a byte budget (proposal: 256 MB of CSV text, at least one job).
   - For each chunk: parse, run `guard_additive`, prepare a journal session, import and release the chunk's strings before the next.
   - Each chunk keeps the existing journal, durability and checkpoint behavior unchanged. A chunk is the unit of "admitted import" for Stop: Stop is observed between chunks and never inside one.
   - Staging may still hold CSV text for the whole range. To avoid that, a later phase can spill staged text to files under the database's temp area. That is **out of scope** here and is recorded as follow-up F-1.

Open design risk: the existing code assumes one recovery session per batch (`prepare_bhavcopy_recovery_session`, background checkpoint). Chunking means multiple sessions per run. Task T6 begins with a spike to confirm sessions are independent and the checkpoint spawner copes with several pending sessions. If it does not, the fallback is to keep one session and only add the response cap (3.3.1).

UTF-8 (RM-4): replace `String::from_utf8_lossy` for CSV with `String::from_utf8`. On failure, try Windows-1252 only for sources already known to use it (none known today), otherwise return a hard error `"Source returned non-UTF-8 data"`. A flagged fixture test pins this. If any real source turns out to be non-UTF-8, switch that source to a declared decoder rather than lossy replacement.

### 3.4 Override validation (RM-5)

Add `validate_source_override(template) -> AppResult<()>` in `settings.rs`:

- Must parse as a URL after template placeholders are replaced with sample values.
- Scheme must be `https`.
- Reject credentials in the URL.
- Called from `save_bhavcopy_settings` and `normalize_batch_config`, returning a user-visible error. The dialog (`BhavcopySourceSettingsDialog.tsx`) shows the message inline.
- Existing saved invalid values: `merge_settings_with_defaults` drops them with a logged warning rather than failing the load.

### 3.5 Shared candidate scan (RM-6, RM-7)

Extract one function used by both paths:

```rust
fn scan_candidates(client, task_meta, candidates, stop: Option<&BatchStop>, on_content: impl FnMut(String) -> ScanStep) -> ScanOutcome
```

- Owns the fetch, BSE index JSON normalization, ZIP handling, HTML detection and the skip/failure classification (`candidate_scan_should_skip`).
- HTML policy: HTML instead of data is a **hard error** in both paths. This matches the staged path, which is the one used by batches. The single-date `download_bhavcopy` command therefore becomes stricter. This is an intended behavior change and must be called out in the change note.
- `stage_single_download` passes a callback that returns the staged CSV. `download_single` passes a callback that runs `parse_and_insert` under the write lock.
- `clear_download_log_entry` in `process_download_task` propagates its error instead of `let _ =`.

### 3.6 Minor items (RM-10, RM-9)

- Warm the BSE session only if any task has a BSE exchange (`is_bse_exchange`), and likewise NSE.
- IST cutoff (RM-9): not implemented until decided (section 6). The helper `update_end_trade_date_for(date, hour)` is already pure, so the change would be confined to its caller in `calendar.rs`.

### 3.7 Worker-cap contract (RM-8)

Documentation/decision work, no code unless the decision requires it. The AGENTS.md "cap 4" can mean an upper bound or the runtime count. Current constants: `MAX_BHAVCOPY_BINARY_WORKERS = 2`, `MAX_BHAVCOPY_PREFILTER_WORKERS = 4`, `MAX_BUFFERED_CHECKPOINT_WORKERS = 2`. The decision is made from measured evidence (section 5), then either AGENTS.md/REQUIREMENTS.md R-06 are corrected to state each constant, or the constant is changed behind a separately validated design.

## 4. Compatibility and risk

| Change | Risk | Mitigation |
|--------|------|-----------|
| 3.1 strict ZIP | Some dates previously skipped now fail | Results show a clear message. Rerun is safe because failed dates are not logged `ok`. |
| 3.2 warnings | Result type change | Field is optional/defaulted; old renderer ignores it. |
| 3.3 chunking | Touches the durability path | Spike first, no change to per-session journal code, native acceptance required. |
| 3.4 https only | Users with http mirrors blocked | Clear error. Document in the settings dialog. |
| 3.5 shared scan | Behavior drift on single command | Characterization tests before refactor. |

Protected and unchanged: series handling, durability contract, UX-13 stop semantics, calendar rules, NSE index fallback.

## 5. Test strategy

Tests are listed so they can be added when the work is approved.

- Rust unit: invalid ZIP is a hard error. Valid ZIP without CSV is not found. Oversized response is rejected. Non-UTF-8 CSV is rejected. Override validator accepts https and rejects http, userinfo and garbage. Characterization tests for `scan_candidates` covering 404, 403, HTML, soft mismatch and BSE no-file.
- Rust: refresh failure after import still returns results and a warning (inject failure via a seam).
- Rust: chunk boundaries preserve ordering and totals (rows imported equal the sum across chunks). Stop between chunks cancels remaining chunks only.
- Renderer: warnings render in the run log. Invalid override error shows in the dialog.
- Worker-cap evidence: timed full-history import at 1, 2 and 4 binary workers on a copy of a real database, recording wall time, peak memory and any journal verification failures.
- Existing suites to rerun through `scripts/Invoke-EOD-SharedCargo.ps1` (Preview, then Run): `bhavcopy::`, `bhavcopy_recovery::`, `price_store_operation_lock::`, plus renderer `typecheck` and the Bhavcopy vitest files.

Per AGENTS.md, create a pre-edit backup with `scripts/create-project-backup.ps1 -ShortName <name>` before source edits.

## 6. Open decisions

1. Cap meaning and value for R-06 (3.7). Needs measurements.
2. IST versus local clock for the 18:00 probe (3.6). R-07 currently says "local date"; changing it changes a stated requirement.
3. Chunk byte budget and response cap values (3.3).
4. Whether the stricter HTML policy for the single-date command is acceptable.
5. Whether spill-to-disk staging (F-1) is wanted.

## 7. Out of scope

Series filtering, the recovery journal format, the NSE index fallback logic, and the BSE browser fallback.
