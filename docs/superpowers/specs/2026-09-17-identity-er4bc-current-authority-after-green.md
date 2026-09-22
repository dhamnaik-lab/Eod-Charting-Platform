# Identity ER4-BC — Final Acceptance / Current Authority

**IST timestamp:** `2026-09-17 02:49:01 +05:30`  
**Workstream:** `E:\TA Projects\EOD Charting Platform`  
**Status:** `ER4-BC CLOSED / GREEN / CURRENT`  
**Full ER4 status:** `OPEN — ER4-D/E NOT STARTED`  
**Parent pre-ER4-BC snapshot:** `Eod Charting Platform Source Code 2026-09-16_001332_IST.zip`  
**Parent snapshot SHA-256:** `08D9D895BD20B5BFB7522F15196046D74B902469EF03B5C19692485F380D3624`  
**Accepted ER4-BC FIX2 automated evidence SHA-256:** `6BFD18C343E40AA3BD2A66CD02E2097DC57679BA2432B32E078EE226B2F03556`  
**Accepted protected source after ER4-BC:** `546 files exact`

## 1. Authority decision

ER4-B and ER4-C are accepted as complete under the approved ER4 disciplined fast-track amendment.

```text
ER4-A  CLOSED / GREEN
ER4-B  CLOSED / GREEN
ER4-C  CLOSED / GREEN
ER4-BC CLOSED / CURRENT
ER4-D  NOT STARTED
ER4-E  NOT STARTED
ER4-DE BLOCKED PENDING FRESH ER4-BC SNAPSHOT ACCEPTANCE
ER4     NOT CLOSED
```

This document does **not** authorize ER4-D/E implementation. The approved fast-track remains gated: a fresh self-contained snapshot of this ER4-BC accepted state must be created separately and independently accepted before ER4-DE may begin.

## 2. Accepted ER4-B capability

ER4-B is accepted with the following production behavior:

- one database-owned immutable per-source URL version ledger;
- nine-source baseline migration with one current pointer/revision per source;
- ledger-authoritative current URL reads after migration;
- complete `officialSourceUrls.v1` compatibility mirror retained;
- reviewed/versioned manual source saves;
- aggregate configuration-fingerprint and per-source revision stale fencing;
- generic `set_setting(officialSourceUrls.v1)` bypass rejected fail-closed;
- no-op manual saves create no version/revision;
- multi-field manual edits commit atomically as one batch;
- baseline/idempotency/corruption/restart/failure-injection behavior covered by automated tests.

The existing visible Official Source URLs workflow remains present: nine fields, Reset Defaults, Apply URLs, success/error surface and stale health clearing.

## 3. Accepted ER4-C capability

ER4-C is accepted with the following production behavior:

- candidate recovery entry point exposed only for eligible failed NSE contracts;
- healthy NSE, BSE and configuration-only landing sources excluded from candidate action;
- ER3-A discovery and ER3-B validation reused rather than duplicated;
- candidate classifications remain non-promoting;
- durable `KEEP_CURRENT` and `REJECT_CANDIDATE` decisions;
- rejection requires a non-empty note;
- decisions create no URL version;
- stale decision attempts return `ER4_STALE_REJECTED` with zero review-event write;
- per-source immutable version/review history is operator-visible;
- no promotion action is implemented in ER4-C.

## 4. FIX2 stale-fence correction

The accepted FIX2 production authority for:

```text
src-tauri-shell\src\database\official_source_version_history.rs
```

is:

```text
SHA256 3684650ABC04C1D4EB6A0036D1F1E3784F9881588B7994885D0ADDD91BD269A5
```

FIX2 preserved the ER4-A review-integrity contract while moving the decision-time current version/revision/URL stale check ahead of full review-plan integrity validation inside the decision transaction. The focused RED proved the former `ER4_REVIEW_PLAN_INVALID` behavior; the corrected GREEN proved `ER4_STALE_REJECTED` and zero-write stale handling.

## 5. Automated acceptance evidence

Accepted automated evidence:

```text
E:\TA Projects\EOD Charting Platform\tmp\
IDENTITY_ER4BC_FASTTRACK_2026-09-16_145403_IST_evidence.zip

SHA256
6BFD18C343E40AA3BD2A66CD02E2097DC57679BA2432B32E078EE226B2F03556
```

Recorded automated results include:

```text
ER4-B focused                         12/12 PASS
ER4-C focused                          9/9 PASS
ER4-A                                 12/12 PASS
ER3-A                                 18/18 PASS
ER3-B B1                               7/7 PASS
ER3-B B2                               5/5 PASS
ER3-B online authorization guard       expected fail-closed PASS
official-source provenance             5/5 PASS
ER1                                   10/10 PASS
NSE delisted discovery/fallback        5/5 + 1/1 PASS
I3                                     5/5 PASS
I4                                     9/9 PASS
ER2-A                                 22/22 PASS
ER2-B                                 45/45 PASS
ER2-C1                                19/19 PASS
ER2-C2                                25/25 PASS
cargo check --locked --offline        PASS
ER4-BC focused Vitest                   9/9 PASS
existing identity Vitest               17/17 PASS
renderer typecheck                    PASS
renderer build                        PASS
protected source POST                 546/546 exact
```

The automated runner did not open a live/user database, did not perform production network acquisition, did not use source control, and did not implement promotion or rollback.

## 6. Portable Windows checkpoint authority

The accepted ER4-BC FIX2 source state was built through the existing Windows portable workflow.

```text
E:\TA Projects\EOD Charting Platform\release\tauri-portable-win\
EOD Chart Portable\EOD Chart.exe

Bytes   24642560
SHA256  AE0134DE562D1FBE1C556B84A7BB8E0FBE299A469A51F72489D247AC96714D55
```

Release renderer/Tauri build and portable packaging completed successfully before manual operator testing.

## 7. Manual operator checkpoint — accepted

The manual checkpoint used a designated test database for controlled source failures. The operational database was not deliberately corrupted for candidate-recovery testing.

Accepted observations:

| Check | Result |
|---|---|
| Official Source URLs has seven NSE + two BSE fields | PASS |
| Reset Defaults present | PASS |
| Apply URLs present and save feedback visible | PASS |
| Source Health normal healthy state | PASS — 11/11 healthy |
| Controlled failed eligible NSE source exposes `Find Official Replacement Candidates` | PASS |
| Healthy NSE sources exclude recovery action | PASS |
| BSE sources exclude recovery action | PASS |
| Configuration-only landing source excludes recovery action | PASS |
| Version/review history visible with baseline/manual revisions and active marker | PASS |
| No `Approve Replacement` / automatic promotion action | PASS |
| `Keep Current URL` manual decision | NOT OBSERVABLE — no live candidate entered review; automated coverage PASS |
| `Reject Candidate` manual decision | NOT OBSERVABLE — no live candidate entered review; automated coverage PASS |
| Test database restored to defaults after controlled tests | PASS |
| Final Source Health after restoration | PASS — 11/11 healthy |

Candidate discovery during the controlled live-data checkpoint failed closed with zero reviewable candidates and a capped rejected-discovery set. No synthetic candidate was injected merely to force Keep/Reject UI actions. This limitation is recorded rather than falsely reported as a manual PASS.

## 8. Behavior preserved

ER4-BC acceptance preserves:

- I3 reviewed Preview → Apply authority;
- I4 reviewed Preview → atomic Apply authority and stale-SHA protections;
- ER1 11-source health semantics;
- ER2 resolver/shadow semantics;
- ER3-A deterministic official-domain discovery;
- ER3-B bounded NSE candidate validation and non-promoting classifications;
- existing download/archive ownership;
- manual source recovery;
- BSE manual configuration only;
- no BSE automated candidate recovery;
- no automated landing-page promotion;
- no automatic promotion;
- no automatic rollback;
- no I3/I4 Apply coupling;
- deferred NSE temp-staging concurrency issue remains untouched;
- ER5+ remains outside scope.

## 9. Deferred observations — not ER4-BC blockers

These observations are recorded for later bounded maintenance and were not repaired during ER4-BC:

1. **Recent Databases Remove UI refresh** — removing an entry can leave the row visible until the window/application is restarted. Expected future behavior: immediate list refresh plus explicit confirmation/status.
2. **Candidate-review stale UI state** — a previously rendered candidate-review panel can remain visible after source authority changes and a later Source Health run. Backend stale fencing protects mutation authority, but future UI maintenance should clear or visibly mark stale review state immediately.
3. **Database creation workflow** — the operator reported separate database-creation issues. This has not been audited in ER4-BC and must be handled as a separate bounded future task.

No root cause is asserted for these deferred observations.

## 10. Operational database convention

Current operator convention for subsequent work:

```text
ACTUAL / operational database
D:\TA Projects\EOD Charting Platform DATABASE\EOD DATABASE\Nse

TEST / controlled-failure database
E:\TA Projects\EOD Charting Platform\EOD DATABASE\Nse
```

Controlled failure simulations must use the TEST database unless the operator explicitly changes this rule.

## 11. Current source-authority rule

The `001332` snapshot remains the **parent snapshot**, not the final ER4-BC source authority. ER4-BC introduced accepted source changes after that snapshot.

Until a fresh post-closeout snapshot is independently accepted, the current authority is the installed ER4-BC FIX2 source state pinned by:

- protected-source count `546`;
- accepted automated evidence SHA above;
- exact accepted ER4-BC production-owner hashes;
- this closeout documentation.

## 12. Next gate

Do only:

```text
run scripts\Create-EOD-Source-Code-Snapshot-v3.ps1 separately
→ submit generated source ZIP/report
→ independently accept fresh ER4-BC snapshot
```

Only after that acceptance may ER4-DE implementation begin under the approved fast-track amendment.
