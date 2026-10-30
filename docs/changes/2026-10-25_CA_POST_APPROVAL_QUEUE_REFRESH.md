# Corporate Actions post-approval queue refresh — 25 October 2026

## Defect and change

After approving one HEGAM Dividend, the renderer reloaded imports using the active
search and display limit. That replaced the full prepared queue with 29 HEGAM
rows. Clearing search could not restore the other symbols. The approval finalizer
also invalidated all preparation, leaving the remaining events Not validated.

The initial fix retained the full queue but ran full Load & Validate automatically
after approval. Native observation showed this unnecessarily repeated all 91
Dividend batches after a single approval. This follow-up replaces that full scan
with exact-row reconciliation and related-event verification.

The successful confirmation path now keeps the full queue, reads only the approved
selection and its transitive exchange/symbol or full-ISIN peers, and removes only
rows confirmed approved in storage. It reruns price scans for related remaining
Split/Bonus/Rights imports and Dividend R1 only for related remaining Dividends.
Unrelated row objects and verified dispositions are retained. No queue listing,
Fetch, identity repair, or financial writer is called by the refresh helper.

The remaining Dividend scope/fingerprint and outcome are rebuilt locally for the
next generation. Counts combine retained dispositions with freshly evaluated
related dispositions; batch counts describe only the targeted evaluation. Old
confirmation drafts expire. Search remains a presentation filter, and the prior
approval summary remains visible alongside the targeted-refresh result.

Database and generation checks prevent refresh or publication into a changed
context. Failed or uncertain approvals remain invalidated for operator review;
this path does not automatically retry a financial write. Fetch is not invoked.
Backend approval guards and raw price handling are unchanged.

## Verification and limits

- PASS: 88 focused tests across explicit Dividend approval, FIX2 wiring, approval
  reports, pending preparation, Dividend prepared/write orchestration and the
  three-action workflow and eleven targeted-refresh behavioral tests. These cover
  exact scoped reads, unrelated evidence retention, symbol/full-ISIN peers, fresh
  draft generation, removal only after confirmation, bounded normal price scans,
  stale context, incomplete reads, identity-scope changes and policy failures.
  A 9,002-row fixture confirms exactly one related Dividend batch is checked and
  9,000 unrelated rows are retained.
- PASS: renderer profile typecheck and scoped whitespace checks.
- No application build, native approval, live database mutation or price change
  was performed during this fix.

The original full-scan fallback has been removed. Work now scales with the related
identity group; a large group can still require multiple bounded requests. Missing
or inconsistent reconciliation evidence fails closed with Load & Validate required.
Backend transaction rechecks remain mandatory for every subsequent approval.
## User native observation after rebuild

Screenshots supplied on 25 October establish the targeted refresh for two
successive, deliberately selected NSE Dividend approvals:

| Selected action | Commit shown | Related stored events | UI elapsed | Loaded rows after | Ready after |
| --- | --- | --- | --- | --- | --- |
| ICICIGI, 23 October 2026, Rs 7 | 1/1 | 2 | 4 seconds | 33,972 | 4,289 |
| HDBFS, 23 October 2026, Rs 2 | 1/1 | 3 | 2 seconds | 33,971 | 4,288 |

Starting counts were 33,973 loaded and 4,290 Ready. Both approved rows disappear;
unrelated Ready entries remain available, and the second approval succeeds without
a full revalidation cycle. HDBFS search narrows to three events, then two after
approval; clearing it restores the full queue. BSE evidence and NSE missing-source
blockers remain blocked. These are screenshot observations of app-reported commit
and refresh results, not an independent database/hash audit or a runtime benchmark.

The `ici` snapshot still included unrelated rows because the older quick search
also searched evidence/source text. The separate
[quick-search change](2026-10-25_CA_QUICK_SEARCH.md) addresses this; subsequent native
search observations are recorded there. This approval-refresh observation does not
establish Split, bulk-approval or chart adjustment numeric acceptance.

Pre-edit backup: `backups/pre_opencode_changes_20261025_175211_ca_post_approval_queue`.
Follow-up pre-edit backup: `backups/pre_opencode_changes_20261025_192417_ca_targeted_approval_refresh`.

Files: `DatabaseToolsDialogs.tsx`, new `corporateActionPostApprovalRefresh.ts`,
`corporateActionPostApprovalRefresh.test.ts`, and the explicit-approval wiring test.
