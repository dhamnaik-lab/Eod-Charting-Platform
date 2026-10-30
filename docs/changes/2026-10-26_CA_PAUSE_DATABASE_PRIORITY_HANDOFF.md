# Corporate Actions checkpoint before database work — 26 October 2026

## Priority and scope

The user requested that the database issue take priority and that current docs be
updated so Corporate Actions can resume later. CA implementation is paused. The
database issue's symptoms, affected database and desired behavior have not yet
been supplied; establish those before dependent changes. This checkpoint is
documentation-only, not authorization to repair or migrate production data.

## Confirmed native and persisted results

- User's portable build log reports release build success and verified executable
  SHA-256 `3DE7E5E22A3C353BC5E4E6871D4A4C0EB025503CCDC332036076BFDCB4112F0A`.
- Latest native Load & Validate: 16m28s, 91/91 batches, 9,023 policy evaluations,
  zero saved results reused, 4,274 eligible / 4,749 ineligible, 4,288 total Ready.
  Earlier seed was 18m24s. This is an observed difference, not a controlled native
  benchmark. An unchanged warm repeat remains unmeasured.
- Explicit approval screenshot: 4,274/4,274 Dividends committed, zero blocked or
  already approved; related-event refresh 13,735/13,735; elapsed 16m32s. The footer
  says raw EOD prices were unchanged. No independent before/after raw-file hashes
  or numeric adjusted/unadjusted chart comparison were collected in this run.
- A subsequent direct read-only SQLite audit used `mode=ro` and
  `PRAGMA query_only=ON`. The profile registry's last active path and its
  `database.json` resolved `EOD DATABASE/Nse/market-data.sqlite3`. The folder name
  does not imply NSE-only contents: exchange identities are retained per record.
- Persisted approvals dated 26 October 2026 IST: NSE Dividend 4,274, NSE Split 8,
  NSE Bonus 3, BSE Split 1, BSE Bonus 2. Total **4,288 import actions**, matching
  pre-approval Ready count. Combined economic events can contain multiple actions.
- NSE Dividend timestamps span 17:54:45–18:08:53 IST. Split/Bonus timestamps are
  around 18:09:18–18:09:19 IST, consistent with the user's latest run. Date/time
  agreement is the correlation evidence; no separate run-ID linkage was audited.

| BSE symbol | Type | Ex-date | Import ID | Canonical action ID | Approval time IST |
| --- | --- | --- | --- | --- | --- |
| AASTHA | Bonus | 2026-09-28 | 45591 | 15921 | 2026-10-26 18:09:18 |
| CORDELIA | Split | 2026-08-25 | 44909 | 15922 | 2026-10-26 18:09:18 |
| MCFL | Bonus | 2026-08-24 | 44901 | 15923 | 2026-10-26 18:09:18 |

All three imports link to existing canonical BSE records with matching symbols.
Their earlier 24 October BSE_SECURITY_CODE_RESOLUTION decisions were metadata-only
identity recovery, not financial approvals. Latest stored approval timestamps above
establish the later financial approval. Do not replay these or the NSE approvals.

## Observed UI behavior and unresolved defects

- Table exchange filter is implemented separately from Fetch scope. Native Approved
  screenshots show 994 NSE events versus 997 All-exchange events, adding the three
  BSE records above. Only 1,000 import rows were loaded; these are subset counts,
  not complete approval-history totals. Grouping can reduce event counts.
- During approval, all visible rows appeared as Checking with Ready 0 and a stale
  preparation message; no meaningful live approval progress was visible. Completion
  later arrived. Current code intends targeted refresh, not a full queue rescan;
  the screenshot alone does not prove a full rescan. Root cause remains unresolved.
- Completion footer reported the 4,274 Dividend subtotal, omitting the other 14
  successful actions. Combined results need one persistent summary.
- Long completion text was truncated. Old 16m32s / 13735-of-13735 remained visible
  after navigating to Approved, without a clear Last operation completed label.
- Limited BSE prices plausibly explain some Waiting for EOD Data blockers; many
  BSE Dividends separately require evidence verification. No comprehensive BSE
  blocker count or database-integrity diagnosis was performed. Do not attribute
  all BSE blockers to missing price data.

## Resume CA after the database issue

1. Inspect the current source and this checkpoint; preserve dirty worktree changes.
2. Trace approval progress and readiness invalidation in
   `src/components/DatabaseToolsDialogs.tsx`, the classic workspace/model under
   `src/features/corporateActions/workspace/`, and the referenced approval/refresh
   helpers. Resolve why unrelated rows show Checking before changing semantics.
3. Proposed UI scope: stage (rechecking/applying/refreshing), processed/total,
   elapsed time, last activity, persistent combined outcome, and explicit historical
   operation labels. Proposed colours: amber running, blue completed, red failed;
   combine with text/icons. These improvements are **not implemented** yet.
4. Clarify Approved-history loading limits and provide discoverable paging/counts.
   Use simulated progress and focused UI checks; never test by replaying approvals.
5. Reassess native warm validation performance only under an unchanged build/data
   context. Financial writes invalidate dependencies; a post-approval run is not an
   unchanged warm comparison. Preserve transaction-time approval rechecks.
6. Stage 2A Split/Bonus term safeguards are implemented; dedicated native blocker
   cases remain unverified. Do not interpret successful ordinary actions as proof
   of every rejection rule. Remaining Demerger work and broader CA phases remain
   deferred; preserve their existing evidence and scope boundaries.

## Existing implementation evidence and boundaries

See [table filter/performance](2026-10-26_CA_TABLE_EXCHANGE_AND_DIVIDEND_OVERLAP_PERFORMANCE.md)
and [Stage 2A terms](2026-10-26_CA_STAGE2A_SPLIT_BONUS_TERMS.md). Their focused
automated checks remain historical receipts, not checks rerun for this doc update.
The latest implementation recorded 50 focused Rust tests, 32 renderer tests,
scoped typecheck/formatting and a disposable overlap benchmark as PASS. Synthetic
cold 16.228s to 11.755s and warm 5.484s to 4.864s are not native timing guarantees.

Keep Fetch → Load & Validate → explicit Approve Ready, backend rechecks, raw EOD
immutability, evidence Details, identity fidelity and local-first platform calls.
Saved validation history never grants approval authority. Preserve previous
HEGAM/ICICIGI/HDBFS approvals as well as this batch. No approvals, repairs, runtime
changes, build, commit or push were performed by this documentation task.

Pre-edit backup: `backups/pre_opencode_changes_20261026_182355_ca_pause_database_handoff_docs`.
Validation: `validate-change.ps1 -Profile docs` passed live documentation references
but failed its workspace whitespace step on an existing README Bhavcopy heading
with trailing spaces (line 48 after this update). The same whitespace was verified
in the pre-edit backup and preserved. Backup-relative checks passed for all added
text whitespace and preservation of every pre-existing line across the 11 edited
documents; the new checkpoint also passed its whitespace check. No runtime tests
or build were run.
