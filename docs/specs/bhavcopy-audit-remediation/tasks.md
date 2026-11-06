# Bhavcopy Download Audit Remediation — Tasks

Design: [design.md](design.md). Run Cargo serially through `scripts/Invoke-EOD-SharedCargo.ps1` (`-Mode Preview`, then `-Mode Run`). Take a pre-edit backup with `scripts/create-project-backup.ps1 -ShortName bhavcopy-audit` before the first source edit. Keep each task a separate small change with its own note under `docs/changes/`.

- [ ] **T0. Decisions and baseline**
  - [ ] Resolve open decisions 1–5 in design section 6 with the owner.
  - [ ] Record baseline results: `bhavcopy::`, `bhavcopy_recovery::`, `price_store_operation_lock::`, renderer typecheck and Bhavcopy vitest files.
  - Requirements: all.

- [ ] **T1. Strict ZIP extraction** (RM-1)
  - [ ] Add `ZipOutcome` and update `extract_first_csv_from_zip` in `parsers/zip.rs`.
  - [ ] Update both scan loops to treat `Invalid` as a hard error.
  - [ ] Tests: invalid bytes, truncated ZIP, ZIP with no CSV, oversized entry.

- [ ] **T2. Characterization tests for the candidate scan** (RM-6 prerequisite)
  - [ ] Pin current outcomes of `stage_single_download` and `download_single` for 404, 403, 429/5xx, HTML, soft mismatch, BSE no-file.
  - [ ] Record the single-vs-staged HTML difference explicitly.

- [ ] **T3. Shared `scan_candidates`** (RM-6, RM-7)
  - [ ] Extract the shared function and migrate both callers.
  - [ ] Apply the HTML hard-error policy to both paths.
  - [ ] Propagate `clear_download_log_entry` errors.
  - [ ] Update T2 tests for the intended change only.
  - Depends on: T1, T2.

- [ ] **T4. Best-effort post-import refresh** (RM-2)
  - [ ] Make stats invalidation, snapshot and change emit non-fatal with `WARN` runtime events.
  - [ ] Add optional `warnings` to `TrackedBhavcopyBatchResult` (Rust, `desktop.ts`, `tauriDesktop.ts`).
  - [ ] Render warnings in `BhavcopyDownloadWindow.tsx`.
  - [ ] Tests: injected refresh failure still returns results and row counts.

- [ ] **T5. Response size cap and strict UTF-8** (RM-3 part 1, RM-4)
  - [ ] Add `MAX_BHAVCOPY_RESPONSE_BYTES`; enforce via `Content-Length` and bounded read in `fetch_candidate_bytes`.
  - [ ] Replace lossy decoding for CSV with strict decoding and a clear error.
  - [ ] Tests: oversized body, non-UTF-8 CSV, valid UTF-8 unaffected.

- [ ] **T6. Chunked CSV import** (RM-3 part 2)
  - [ ] Spike: confirm multiple recovery sessions per run are independent and the background checkpoint handles several pending sessions. Write findings in the change note. **Stop and ask** if the spike fails.
  - [ ] Implement byte-budget chunking in `import_staged_csv_downloads`, one journal session per chunk, strings dropped per chunk.
  - [ ] Stop is checked only between chunks.
  - [ ] Tests: totals equal across chunk sizes, ordering preserved, stop between chunks, durability tests unchanged.
  - [ ] Native acceptance on a copy of a real database (full-history run, peak memory recorded).
  - Depends on: T5.

- [ ] **T7. Override validation** (RM-5)
  - [ ] Add `validate_source_override` and call it in `save_bhavcopy_settings` and `normalize_batch_config`.
  - [ ] Drop invalid stored values with a logged warning on load.
  - [ ] Show the error inline in `BhavcopySourceSettingsDialog.tsx`.
  - [ ] Tests: https accepted; http, userinfo, malformed rejected.

- [ ] **T8. Conditional session warm-up** (RM-10)
  - [ ] Warm NSE and BSE sessions only when tasks for that exchange exist.

- [ ] **T9. Worker-cap reconciliation** (RM-8)
  - [ ] Run the timed 1/2/4 binary-worker comparison on a database copy; record time, peak memory, verification failures.
  - [ ] Update AGENTS.md and REQUIREMENTS.md R-06 to state each constant, or open a separate validated design to change the constant.
  - [ ] Remove the item from PROJECT_STATE "Unresolved findings" once closed.

- [ ] **T10. IST cutoff** (RM-9) — only if approved in T0
  - [ ] Evaluate the 18:00 probe in IST in `calendar.rs`; update R-07 text and tests for non-IST time zones.

- [ ] **T11. Validation and documentation**
  - [ ] Rerun the baseline suites from T0 and compare.
  - [ ] Run `scripts/validate-change.ps1` for the appropriate profile and `scripts/check-doc-references.ps1`.
  - [ ] Add change notes under `docs/changes/` and update ARCHITECTURE, FEATURE_STATUS_MATRIX and REQUIREMENTS only where behavior changed.
  - [ ] Record anything not run as NOT RUN.

## Suggested order

T0 → T1 → T2 → T3 → T4 → T5 → T7 → T8 → T6 → T9 → (T10) → T11.
T6 is last among code changes because it touches the durability path and needs native acceptance.

## Follow-ups (not in this spec)

- F-1: spill staged CSV text to disk so staging memory is bounded too.
- F-2: consider a single place for source URLs and encodings per exchange.
