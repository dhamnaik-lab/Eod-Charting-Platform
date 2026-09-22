# Identity ER4-DE — BSE Referer Transport Failure — Non-Blocking Observation

- **IST timestamp:** 2026-09-17 22:21 +05:30
- **Workstream:** EOD Charting Platform
- **Authorized root:** `E:\TA Projects\EOD Charting Platform`
- **Classification:** NON-BLOCKING OBSERVATION / DEFERRED FUTURE TASK
- **Current ER4 disposition:** ER4-DE manual operator checkpoint accepted; NSE restoration completed successfully.

## Objective

Record the BSE referer transport failure observed during the final ER4-DE manual Source Health check without expanding the frozen NSE-candidate ER4 scope or mixing a BSE repair into ER4 closeout.

## Confirmed manual-checkpoint state

The controlled NSE failure/rollback sequence completed successfully on the TEST database.

- `NSE_CURRENT_EQUITY_MASTER` was restored to the valid official URL:
  `https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv`
- Reviewed rollback created a new immutable `ROLLBACK` version rather than rewriting historical versions.
- The resulting rollback authority was version 16 / revision 6.
- Rollback review/post-health evidence showed `ROLLBACK_APPROVED`, `ROLLBACK_HEALTHY`, and `Post-health: ROLLBACK_HEALTHY`.
- No I3/I4 Apply action was executed by rollback.
- No automatic second rollback was observed.
- FIX3 made source-version history and `Review Rollback` reachable in the actual Windows WebView2 UI.

## Non-blocking BSE observation

During the final manual `Check Source Health`, the UI reported:

- total logical sources: **11**
- healthy: **10**
- needs attention: **1**

The remaining failing logical source was:

- source key: `BSE_LIST_SCRIPS_REFERER`
- label: List Scrips referer page
- configured URL: `https://www.bseindia.com/corporates/List_Scrips.html`
- provenance: `PASS`
- transport: `FAIL`
- format: `NOT_EVALUATED`
- population: `NOT_APPLICABLE`
- freshness: `NOT_APPLICABLE`
- drift: `NOT_CLASSIFIABLE`
- UI evidence/reason: official-source request failed while sending the request to the configured BSE referer URL.

At the same final checkpoint, the actual BSE lifecycle data sources remained healthy:

- `BSE_LIST_SCRIPS_ACTIVE` — PASS
- `BSE_LIST_SCRIPS_DELISTED` — PASS
- `BSE_LIST_SCRIPS_SUSPENDED` — PASS

The restored NSE Equity Master also passed transport, format, population and compatible-drift checks after rollback.

## Classification and ER4 impact

This observation is **not an ER4-DE blocker** because:

1. ER4 Design R1 froze candidate automation/promotion scope to eligible NSE candidate sources.
2. BSE automation was explicitly deferred and separately gated.
3. The ER4-E reviewed rollback itself completed successfully and produced healthy post-change evidence for the restored NSE source.
4. The remaining failure is isolated to the BSE referer/landing transport check; the BSE lifecycle CSV sources remained healthy.
5. No evidence from the manual checkpoint establishes that this BSE failure was caused by ER4 source-version, promotion, rollback, persistence, or FIX3 visibility behavior.

Therefore ER4 closeout should preserve this as a separately tracked observation rather than broaden ER4 into an unrelated BSE transport repair.

## Future bounded task

When separately authorized, investigate `BSE_LIST_SCRIPS_REFERER` as its own bounded maintenance issue. The future task should determine, without presuming a root cause, whether the observed transport failure is due to endpoint availability/change, TLS/network behavior, anti-bot/request requirements, redirects, request headers/referer behavior, or another transport-layer condition.

Recommended future-task boundaries:

- inspect the existing BSE referer ownership and health-check path first;
- preserve the currently healthy BSE lifecycle CSV behavior;
- do not introduce BSE candidate automation merely to repair referer health;
- reproduce the referer failure independently before changing code;
- compare browser/manual access with the application's exact request behavior;
- use official BSE endpoints only;
- keep any BSE source-discovery/promotion expansion separately gated from a transport-only correction;
- add focused regression evidence for the confirmed root cause;
- rerun the relevant Source Health and BSE preservation suites after any future correction.

## Behavior preserved

- NSE restoration remains accepted.
- ER4-D/E promotion/rollback semantics remain unchanged.
- Manual source editor remains unchanged.
- Source-version history remains immutable.
- No automatic promotion or rollback is authorized.
- No BSE automation is added.
- No landing-page promotion is added.
- No I3/I4 Apply coupling is added.
- ER5+ remains outside this observation.

## Changes made by this record

Documentation only:

- `docs\changes\2026-09-17_2221_IST_IDENTITY_ER4DE_BSE_REFERER_TRANSPORT_NON_BLOCKING_OBSERVATION.md`

No source, build-system, runtime configuration, database, package dependency, or executable behavior is changed by this record.

## Validation / evidence status

### Manual evidence

- NSE rollback target revalidation: PASS
- reviewed rollback confirmation: PASS
- new immutable rollback version: PASS
- rollback post-health: `ROLLBACK_HEALTHY`
- history preserved: PASS
- WebView2 history/rollback visibility after FIX3: PASS
- final Source Health: 10/11 healthy with only `BSE_LIST_SCRIPS_REFERER` needing attention
- BSE active/delisted/suspended lifecycle sources: PASS

### Automated evidence already accepted in ER4-DE/FIX3 chain

ER4-DE automated RED/GREEN, regression, renderer, portable-build and FIX3 visibility validation remain the governing implementation evidence. This observation does not supersede or modify that authority chain.

## Risks / limitations

- The root cause of the BSE referer transport failure is **not determined** by this record.
- The failure may be transient or environment/request-specific; this record intentionally does not infer a cause.
- No remediation has been implemented or validated.
- A future task must independently reproduce and characterize the failure before changing behavior.

## Rollback guidance

This is a documentation-only observation. If it is later found to be inaccurate, supersede it with a new dated correction record; do not silently rewrite ER4 implementation history.
