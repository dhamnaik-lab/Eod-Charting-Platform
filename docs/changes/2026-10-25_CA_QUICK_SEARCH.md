# Corporate Actions quick search — 25 October 2026

Quick search now matches symbol, company, ISIN and BSE code, ignoring case and
surrounding/repeated whitespace. Source URLs, evidence notes, terms and diagnostic
messages no longer produce unrelated identity results (such as `ici` matching
source-locator text).

The classic queue ranks exact symbols first, symbol prefixes second and other
identity substring matches third. The selected column/date ordering applies
within each tier; clearing search restores the normal ordering. Status/type and
per-import approval gates still intersect the results.

Added an accessible × Clear button, Escape-to-clear without closing the parent
window, disabled browser spellcheck/autocomplete, and an explicit No matching
events message. Search updates the loaded queue locally; it does not Fetch, load,
scan, change readiness or approve anything. Existing search selection-clearing
and post-approval search retention remain in place.

Files: `corporateActionQuickSearch.ts`, `corporateActionClassicModel.ts`,
`CorporateActionClassicWorkspace.tsx`, its stylesheet, the shared search predicate
in `DatabaseToolsDialogs.tsx`, and `corporateActionQuickSearch.test.ts`.

PASS: 34 focused tests across quick search, classic presentation, approval reports
and explicit Dividend approval preservation. Includes rendered empty/cleared
results, accessible controls, symbol ranking, blocked-event gating and
post-approval row removal. Initial test runs exposed fixture expectations for the
existing descending ID tie-break and HTML attributes; corrected, final run passed.
PASS: renderer typecheck and scoped whitespace checks.

Pre-edit backup: `backups/pre_opencode_changes_20261025_213343_ca_quick_search`.
No agent build or live data/approval changes were performed during implementation.

The preceding native screenshots accepted targeted approval refresh and HDBFS
search/clear, but still showed `ici` matching unrelated evidence/source text. They
predate this quick-search implementation and must not be cited as its native
acceptance. See [the refresh observations](2026-10-25_CA_POST_APPROVAL_QUEUE_REFRESH.md).

## Subsequent native observations — 25 October 2026, 23:04–23:13 IST

After rebuilding, the user supplied screenshots with these results:

| Check | Observed result |
| --- | --- |
| HDBFS / hdb / hDbFs | Same 2 pending HDBFS events, with existing blockers retained. |
| ici | Matching identity rows only; earlier unrelated source-text matches are gone. ICIL is a valid symbol-prefix match. |
| ICICIGI | 1 pending Ready event, 29 May 2026. |
| ICICI ranking | Exact ICICI events dated 2001/2000 precede newer ICICI-prefixed symbols; date order is retained within the relevance tier. |
| INE005A01011 | Matches the ISIN visible in Details; returns the 2 corresponding historical ICICI events. |
| ZZZ_NO_MATCH_123 | Explicit No matching events message, 0 shown and 0 Ready. |
| Queue/scan stability | Loaded remains 33,971; the completed 91/91 scan and elapsed 9m29s remain unchanged across queries. |
| Esc / × | The user explicitly reports both working; the keypress/click is not demonstrated by still screenshots alone. |

The numeric substring `123` returns BSE code matches and some NSE rows whose
matching ISIN/code fields are not displayed in the table; those hidden matches
were not independently audited. This is not evidence of unrelated-source matching.
Whitespace padding is not visible in the mixed-case screenshot and remains
unconfirmed natively. Exact full BSE-code lookup and measured typing latency also
remain open; automated coverage does not substitute for those native checks.

Details was observed with ISIN, official purpose, source capture/locator and the
percentage-dividend cash/face-value blocker explanation. The user explicitly
confirmed this option was needed; preserve this evidence visibility.

Representative supplied evidence filenames: symbol/ranking/ISIN follow-up
`codex-clipboard-06e30675-3bf2-445f-b333-6b5d9cbfc63b.png`,
`codex-clipboard-5c712e59-af22-4da9-8bdb-60e96ffad792.png`,
`codex-clipboard-e5b2c8eb-8cc5-4e02-b650-a7af1026eedf.png`,
`codex-clipboard-362bd73f-5cf0-4c37-ac0d-4361c0d7372f.png`;
empty-result screenshot `codex-clipboard-4963ce4b-84f3-4d05-bd58-b1afff87e490.png`.
These are user-supplied temporary attachments, not durable repository test receipts.
