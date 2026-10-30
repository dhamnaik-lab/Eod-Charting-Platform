# Dividend compatibility-check performance correction

Date: 26 October 2026 IST. Root: `E:\TA Projects\EOD Charting Platform`.

## Native regression and cause

The first incremental implementation failed native performance acceptance.
User screenshots show 4/91 batches at 7m31s, 16/91 at 17m28s, and cancellation
completed at 24/91 after 25m09s. The prior full policy run completed 91/91 in
13m48s. The cancelled run did not publish completed Dividend approval evidence;
the displayed 14 Ready actions did not establish completed Dividend validation.

The compatibility layer repeated broad case-insensitive import/canonical group
queries, source parsing, context resolution and full symbol-file reads for each
event. It then repeated the entire dependency computation before publishing,
including SQLite inputs already protected by the same IMMEDIATE transaction.
Each 100-ID bridge call also repeated the general migration/seed connection path.

## Focused correction

- Build normalized import/canonical date/symbol/ISIN lookup maps once per batch.
  Preserve the original SQLite UPPER/NULL/empty-string/exchange semantics; retrieve
  full evidence rows through their exact IDs. No persistent schema/index changes.
- Hash each distinct dependency group and resolve each identity context once
  within that transaction. Parse the retained rename source once per batch.
- Read each relevant binary symbol file once for initial validation. Validate
  strictly ordered unique dates, then select bounded windows and neighbouring
  bars with binary searches. Missing files remain explicit dependencies.
- Release initial binary buffers before a separate streaming content recheck.
  Re-read each relevant file once and compare every requested window, including
  absent-file arrivals. Recheck due-date buckets too. SQLite inputs need no second
  read because the transaction remains open; no cross-call/session memo is trusted.
- Open the existing manifest-resolved database for diagnostics without rerunning
  migrations/backfills. Active database opening still owns migrations. Missing
  schema/proof cannot create approval authority or silently migrate through this path.

Approval policy, transactional checkpoint ownership, immutable report history,
exact write-stage rechecks, explicit Approve Ready, targeted refresh, search,
Details, diagnostic export limits and live raw-price immutability are preserved.
Non-canonical dependency dates are conservatively uncached and evaluated normally.

## Controlled before/after evidence

Explicit ignored test: `cargo test dividend_incremental_scale_benchmark --manifest-path src-tauri-shell/Cargo.toml -- --ignored --nocapture`.
Fixture: disposable file-backed SQLite; 33,971 imports, 33,871 unrelated canonical
rows, persisted evidence payloads and retained rename source; 100 related events
per batch. The warm measurement closes/reopens the SQLite connection. The same
fixture and command were used before and after the production-code correction.

| Implementation | Cold batch | Reopened/no-change batch | Reused | Full policy evaluations on no-change run |
| --- | ---: | ---: | ---: | ---: |
| Original compatibility layer | 58.982s | 56.875s | 100 | 0 |
| Corrected layer (final code) | 1.209s | 1.038s | 100 | 0 |

The preceding optimized measurement was 1.109s / 0.949s. The final-code rerun
above includes the structural cost-counter test additions; timings are samples.

These are individual local debug-test measurements for this synthetic workload,
not a full native timing projection. Global identity/source content hashes and
two initial key-table reads still occur once per batch. Binary files are still
read fully per relevant symbol to validate ordering; window selection is bounded
and shared. Further changes require measured need, without weakening proof.

## Validation and remaining acceptance

- PASS: 15 focused incremental tests, including original invalidation/rollback
  cases and new exact group-membership, once-per-group, shared file-read,
  changed-content/file-arrival and diagnostic-no-migration checks.
- PASS: prepared-scope/bridge (13), Dividend policy (22) and history (4) Rust tests.
- PASS: seven focused renderer suites (75 tests); bridge connection assertion
  updated while preserving the policy-function checksum assertion.
- PASS: explicit scale benchmark above; all evaluations used disposable data.
- PASS: focused Rust formatting; scoped renderer typecheck and whitespace checks.
- NOT RUN: native corrected workflow/timing, live scans or database mutation,
  financial approval, desktop build, packaging, commit or push. The user rebuilds.

The dependency implementation fingerprint changes in this patch, so old backend
checkpoints conservatively revalidate once; no old saved Ready/report label is
promoted. After a completed seed run, restart/no-change acceptance must show
compatible results reused with zero full policy evaluations. Existing saved P1
history/reopen acceptance remains valid; native incremental performance remains
unaccepted until the user's rebuild is observed. No HEGAM/ICICIGI/HDBFS replay.

Files changed: `corporate_action_imports/dividend_validation_cache.rs`, the bridge
in `corporate_action_imports.rs`, `auto_approval/dividend_incremental_tests.rs`,
the focused renderer bridge test, HANDOFF, the earlier incremental change record
and dependency contract, plus this record. Normal pre-edit backup:
`backups/pre_opencode_changes_20261026_120115_ca_dividend_cache_performance`.
