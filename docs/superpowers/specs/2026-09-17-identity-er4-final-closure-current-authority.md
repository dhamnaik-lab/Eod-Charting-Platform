# Identity ER4 — Final Closure / Current Authority

**IST timestamp:** `2026-09-17 23:56 +05:30`  
**Workstream:** `E:\TA Projects\EOD Charting Platform`  
**Status:** `ER4-A/B/C/D/E CLOSED / GREEN / ER4 CLOSED / CURRENT`  
**Protected-source authority:** `547 files exact`  
**ER5+:** `NOT AUTHORIZED`

## 1. Authority decision

ER4 is accepted as complete under Design R1 and the approved disciplined fast-track amendment.

```text
I3     CLOSED / ACTIVE
I4     CLOSED / ACTIVE
ER0    RESOLVED / CLOSED
ER1    CLOSED / CURRENT
ER2    CLOSED / CURRENT
ER3    CLOSED / CURRENT
ER4-A  CLOSED / GREEN
ER4-B  CLOSED / GREEN
ER4-C  CLOSED / GREEN
ER4-D  CLOSED / GREEN
ER4-E  CLOSED / GREEN
ER4    CLOSED / CURRENT
ER5+   NOT AUTHORIZED
```

No additional ER4 implementation is authorized by this document. Future maintenance issues and ER5+ remain separately gated.

This closeout is documentation authority only. It changes no protected runtime source, database/schema/data, settings, managed archive, network behavior, build system, dependency, Git/source-control state or executable behavior.

## 2. Current source authority

### Parent self-contained snapshot

The last independently accepted self-contained source snapshot before ER4-D/E installation is:

`Eod Charting Platform Source Code 2026-09-17_031234_IST.zip`

SHA-256:

`A9FD7B2D54C5EB4E6610F4161A3217EE171B8CA5063009E3356966CEC5026A61`

Snapshot files: `1329`

That snapshot contains the accepted ER4-BC state and is the parent baseline, **not** the final ER4 source state.

### Installed ER4 final source authority

The current real project source authority is the controlled installed ER4-DE + FIX2 + FIX3 state:

```text
protected source: 547 files exact
controlled-install evidence SHA256:
1185C745FC1FA8B442E420817E23E5E5EDF948B256148F5DBF8B72AB262E086F
```

The controlled installation proved:

```text
PRE protected source     546/546 exact
candidate delta            12/12 exact
POST protected source    547/547 exact
FINAL protected source   547/547 exact
```

A fresh post-ER4 Snapshot V3 does **not** yet exist. Until it is created and independently accepted, the 547-file installed state plus this closeout/evidence chain is the current authority; the `031234` ZIP remains the parent snapshot only.

## 3. Accepted ER4 capability by stage

### ER4-A — deterministic review authority

Accepted capability includes:

- frozen nine-source ER4 registry and promotability rules;
- deterministic current configuration authority;
- deterministic candidate validation-report hash and review fingerprint;
- ER3-B candidate evidence → ER4 review-plan conversion;
- fail-closed stale-plan contract;
- no mutation in ER4-A itself.

### ER4-B — version ledger and manual compatibility

Accepted capability includes:

- database-owned immutable per-source version ledger;
- nine-source baseline migration;
- one current pointer/revision per source;
- ledger-authoritative URL reads after migration;
- existing `officialSourceUrls.v1` compatibility mirror;
- reviewed/versioned manual source changes as `MANUAL_OVERRIDE`;
- aggregate configuration fingerprint plus per-source revision stale fencing;
- generic setting bypass rejection;
- atomic multi-field manual edits and restart/idempotency/failure-injection coverage.

The existing nine-field Official Source URLs editor remains the manual operator workflow.

### ER4-C — operator candidate review and history

Accepted capability includes:

- recovery action only for eligible failed NSE candidate sources;
- reuse of ER3 discovery/validation rather than duplicate transport/parsers;
- durable `KEEP_CURRENT` and `REJECT_CANDIDATE` review decisions;
- rejection-note requirement;
- stale decisions reject with zero write;
- immutable per-source version/review history;
- no candidate promotion in ER4-C.

### ER4-D — explicit reviewed candidate promotion

Accepted capability includes:

- explicit operator-only candidate promotion;
- fresh ER3-B candidate revalidation;
- candidate SHA/report/fingerprint stale fencing;
- current version/revision/URL stale check inside the mutation transaction;
- atomic new source-version creation/current-pointer change/compatibility mirror update;
- post-change ER1 Source Health linkage;
- no automatic promotion;
- no automatic rollback;
- no I3/I4 Apply coupling.

The approved FIX1 stale-fence correction ensures current authority staleness is classified as `ER4_STALE_REJECTED` before full review-plan integrity/revalidation checks, while retaining zero-write stale behavior.

### ER4-E — reviewed rollback and post-health

Accepted capability includes:

- explicit prior-version rollback review;
- rollback-target revalidation before apply;
- stale-fenced atomic rollback **as a new immutable version**;
- preserved historical versions/review events;
- post-rollback ER1 health linkage and explicit health retry semantics;
- no automatic second rollback;
- full automated/frontend/portable validation and manual operator checkpoint.

## 4. FIX2 / FIX3 bounded corrections

### FIX2 — accumulated frontend phase-contract alignment

FIX2 changed the accumulated ER4 frontend test contract only. It removed stale ER4-B/C global absence assertions that became invalid once approved ER4-D promotion was added. Runtime behavior was unchanged.

Final accepted test authority:

```text
src\features\identityRecovery\__tests__\identityEr4SourceRecovery.test.ts
SHA256 39DB70D56E063DD69DE5E2DA506AB57DD730A43A406AE6608AC5D25F989B6116
```

### FIX3 — history / rollback WebView2 visibility

FIX3 corrected the Identity-panel layout so source-version history and rollback controls are reachable in the actual Windows WebView2 application.

It did not change history loading, rollback eligibility, promotion semantics, URL editing or backend mutation behavior.

Accepted owner/test authority:

```text
src\components\DatabaseToolsDialogs.tsx
SHA256 47510BF3154776D257CCC41F7C276C8DDB6F04C8607C4401652EB0DE40D10394

src\features\identityRecovery\__tests__\identityEr4HistoryVisibility.test.ts
SHA256 5317ADD73DEFE61913BA984A8994653E149E3236431FD449DB5DA9D1710EDC9E
```

## 5. Accepted automated evidence

### ER4-DE automated continuation / final frontend / portable authority

```text
IDENTITY_ER4DE_FIX2_RESUME3_AUTOMATED_2026-09-17_175149_IST_evidence.zip
SHA256 BB28502B69F979870BDC74A420B0B9EFEC36D6C59A3BF190120589292C941F9A
```

Accepted results include:

```text
ER4-D focused backend                 6/6 PASS
ER4-E focused backend                 6/6 PASS
I4 resumed regression                 9/9 PASS
NSE delisted discovery/fallback       PASS
Cargo check                           PASS
accumulated ER4 frontend             15/15 PASS
Source Health frontend                9/9 PASS
Identity characterization frontend   8/8 PASS
renderer typecheck                    PASS
renderer build                        PASS
portable Windows build                PASS
```

The earlier isolated I4 filesystem/TEMP failure was separately diagnosed and was not reproducible under repeated exact/serial/parallel testing. No I4 production change was made for that transient result.

### FIX3 automated evidence

```text
IDENTITY_ER4DE_FIX3_AUTOMATED_2026-09-17_213254_IST_180941aa_evidence.zip
SHA256 A86050AB562102106009B77423C5999593A0EEAEC3387958C65670AD9C052A0C
```

Accepted results include:

```text
FIX3 visibility genuine RED → GREEN          PASS
FIX3 focused GREEN                            6/6 PASS
Identity Recovery regressions               23/23 PASS
Corporate Actions regressions              185/185 PASS
renderer typecheck                           PASS
renderer build                               PASS
portable Windows build                       PASS
candidate protected source                  547/547 exact
```

## 6. Manual operator checkpoint — accepted

The manual checkpoint used the designated TEST database for controlled failures. The operational database was not used for deliberate failure simulation.

Accepted observations:

| Check | Result |
|---|---|
| Nine-field Official Source URLs editor | PASS |
| Initial Source Health | PASS — 11/11 healthy |
| Controlled failed `NSE_CURRENT_EQUITY_MASTER` detection | PASS |
| Eligible NSE recovery action visibility | PASS |
| Healthy NSE / BSE / landing-source exclusion | PASS |
| Official candidate discovery | PASS — 50 discovered candidates rejected, 0 reviewable candidates |
| Invalid candidate fail-closed behavior | PASS |
| Live `Approve Replacement` execution | NOT OBSERVABLE — no live candidate reached promotable classification; automated ER4-D coverage PASS |
| Source-version history reachability after FIX3 | PASS in actual WebView2 |
| Reviewed rollback target revalidation | PASS |
| Explicit rollback confirmation | PASS |
| Rollback as new immutable version | PASS |
| Historical versions preserved | PASS |
| No I3/I4 Apply coupling | PASS |
| No automatic second rollback | PASS |
| Restored NSE Equity Master URL | PASS — `EQUITY_L.csv` |
| Rollback authority | PASS — version 16 / revision 6 |
| Rollback post-health | PASS — `ROLLBACK_HEALTHY` |

No synthetic promotable live candidate was injected merely to force a manual promotion demonstration. That limitation remains recorded honestly and is backed by automated ER4-D GREEN coverage.

## 7. BSE referer observation — deferred / non-blocking

The final manual Source Health check showed:

```text
11 total
10 healthy
1 needs attention
```

The remaining logical failure was `BSE_LIST_SCRIPS_REFERER` at:

`https://www.bseindia.com/corporates/List_Scrips.html`

The BSE Active, Delisted and Suspended lifecycle sources remained healthy. The NSE rollback target was healthy.

This is recorded separately in:

`docs\changes\2026-09-17_2221_IST_IDENTITY_ER4DE_BSE_REFERER_TRANSPORT_NON_BLOCKING_OBSERVATION.md`

It is **not an ER4 blocker** and no root cause is asserted. BSE transport remediation remains a separately authorized future bounded task. ER4 R1 adds no BSE discovery, candidate validation, automated promotion or ER3-B-driven rollback.

## 8. Controlled real-source installation authority

Accepted install evidence:

```text
IDENTITY_ER4DE_REAL_INSTALL_2026-09-17_234939_IST_evidence.zip
SHA256 1185C745FC1FA8B442E420817E23E5E5EDF948B256148F5DBF8B72AB262E086F
```

Accepted source transition:

```text
546 protected files
→ 11 exact replacements + 1 new regression test
→ 547 protected files exact
```

Bounded pre-install backup:

```text
E:\TA Projects\EOD Charting Platform\tmp\IDENTITY_ER4DE_REAL_INSTALL_PRECHANGE_BACKUP_2026-09-17_234939_IST.zip
SHA256 4BA80AB76A17D7A529A4C9B0C7E3971E8AB68F0FF6F84191BA798CD07CECE390
```

Controlled-install change record:

`docs\changes\2026-09-17_2349_IST_IDENTITY_ER4DE_CONTROLLED_REAL_SOURCE_INSTALL.md`

SHA-256:

`20A9DA7A0F8DE0FC1DAE091EB7B3C7F781197B76E76AA0D949AAFD4E1FE6EFE6`

## 9. Exact preservation requirements

Preserve unchanged unless a separate bounded task is approved:

- I3 reviewed Preview → Apply mutation authority;
- I4 reviewed Preview → atomic Apply authority and stale-SHA protections;
- ER1 Source Health semantics/evidence;
- ER2 resolver/shadow behavior;
- ER3 discovery/validation boundaries and official-host controls;
- nine-field manual Official Source URLs workflow;
- ER4 immutable version history and current-pointer/revision ownership;
- explicit operator decisions;
- stale fencing and zero-write stale rejection;
- no automatic promotion;
- no automatic rollback;
- no BSE candidate automation;
- no landing-page promotion;
- no I3/I4 Apply coupling;
- raw downloaded candidate bodies not persisted in ER4 history;
- existing database/bootstrap ownership;
- deferred NSE temp-staging concurrency issue;
- ER5+ remains outside scope.

## 10. Deferred maintenance observations

The following remain separately gated and are not reasons to reopen ER4:

1. `BSE_LIST_SCRIPS_REFERER` transport failure — recorded as non-blocking/deferred; root cause not determined.
2. Recent Databases Remove UI refresh — row may remain visible until restart; future maintenance should refresh immediately and show status.
3. Candidate-review stale UI state — prior review presentation may remain visible after source authority/health changes; backend stale fencing already protects mutation authority.
4. Database creation workflow issues reported by the operator — not audited in ER4.
5. Deferred NSE symbol-change temp-staging concurrency work — remains separately gated.

## 11. Database operating convention

Current operator convention remains:

```text
ACTUAL / operational database
D:\TA Projects\EOD Charting Platform DATABASE\EOD DATABASE\Nse

TEST / controlled-failure database
E:\TA Projects\EOD Charting Platform\EOD DATABASE\Nse
```

Deliberate controlled failure simulations use the TEST database unless the operator explicitly changes this rule.

## 12. Completion boundary and next step

ER4 implementation and acceptance are closed at the installed 547-file authority.

Do **not** start ER5+ or any deferred maintenance task automatically.

The immediate next authority action is only:

```text
run scripts\Create-EOD-Source-Code-Snapshot-v3.ps1 separately
→ submit generated ZIP/report
→ independently accept the fresh post-ER4 snapshot
```

Only the independently accepted fresh Snapshot V3 becomes the next self-contained source authority.
