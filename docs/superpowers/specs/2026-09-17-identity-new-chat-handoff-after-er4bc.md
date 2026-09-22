# Identity — New-Chat Handoff After ER4-BC Final Acceptance

**Date:** 2026-09-17 IST  
**Workstream:** `E:\TA Projects\EOD Charting Platform`  
**Authority state:** `ER4-BC CLOSED / GREEN / CURRENT; ER4-D/E NOT STARTED`

## Resume authority

Do not resume from the old `001332` snapshot alone. It is the pre-ER4-BC parent.

Current installed source authority is the accepted ER4-BC FIX2 state:

```text
protected source: 546 files exact
ER4-BC automated evidence SHA256:
6BFD18C343E40AA3BD2A66CD02E2097DC57679BA2432B32E078EE226B2F03556

FIX2 version-history SHA256:
3684650ABC04C1D4EB6A0036D1F1E3784F9881588B7994885D0ADDD91BD269A5
```

Read first:

```text
docs\superpowers\specs\2026-09-15-identity-er4-source-candidate-review-version-history-design-r1.md
docs\superpowers\plans\2026-09-15-identity-er4-source-candidate-review-version-history-implementation-plan-r1.md
docs\superpowers\plans\2026-09-15-identity-er4-disciplined-fast-track-amendment-r1.md
docs\superpowers\specs\2026-09-15-identity-er4a-current-authority-after-green.md
docs\superpowers\specs\2026-09-17-identity-er4bc-current-authority-after-green.md
docs\changes\2026-09-16_1454_IST_IDENTITY_ER4BC_DISCIPLINED_FAST_TRACK.md
docs\changes\2026-09-17_0249_IST_IDENTITY_ER4BC_FINAL_ACCEPTANCE_CURRENT_AUTHORITY.md
```

## Phase status

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
ER4-BC CLOSED / CURRENT
ER4-D  NOT STARTED
ER4-E  NOT STARTED
ER4     OPEN
ER5+   NOT AUTHORIZED
```

ER4-DE was approved as a combined disciplined fast-track stage, but remains blocked until a fresh ER4-BC source snapshot is generated separately and independently accepted.

## Accepted ER4-BC implementation summary

ER4-B:

- immutable per-source URL versions;
- nine-source baseline/current pointers;
- source revisions + configuration fingerprint;
- reviewed/versioned manual URL save;
- full compatibility mirror;
- generic-setting bypass closure;
- restart/idempotency/corruption/failure-injection coverage.

ER4-C:

- eligible failed NSE candidate action;
- ER3 discovery/validation reuse;
- durable Keep/Reject decisions;
- stale-fenced zero-write decisions;
- read-only version/review history;
- no promotion.

FIX2 corrected decision stale-fence ordering. Final accepted source hash:

```text
src-tauri-shell\src\database\official_source_version_history.rs
3684650ABC04C1D4EB6A0036D1F1E3784F9881588B7994885D0ADDD91BD269A5
```

## Manual checkpoint result

Manual checkpoint accepted:

```text
9-field Official Source URLs editor       PASS
Source Health                              PASS
failed eligible NSE recovery action        PASS
healthy NSE exclusion                      PASS
BSE exclusion                              PASS
landing-page exclusion                     PASS
version/review history                      PASS
no Approve Replacement action              PASS
Keep Current                               NOT OBSERVABLE; automated coverage PASS
Reject Candidate                           NOT OBSERVABLE; automated coverage PASS
final TEST DB restoration                  PASS
final Source Health                        11/11 healthy
```

The absence of a reviewable live candidate was recorded honestly. No synthetic candidate was injected merely to force manual Keep/Reject buttons.

## Portable validation

```text
release\tauri-portable-win\EOD Chart Portable\EOD Chart.exe
SHA256 AE0134DE562D1FBE1C556B84A7BB8E0FBE299A469A51F72489D247AC96714D55
Bytes 24642560
```

## Database operating convention

```text
ACTUAL
D:\TA Projects\EOD Charting Platform DATABASE\EOD DATABASE\Nse

TEST
E:\TA Projects\EOD Charting Platform\EOD DATABASE\Nse
```

Use TEST for deliberate controlled failures.

## Deferred, separately gated maintenance observations

Do not repair these while resuming ER4-DE unless separately authorized:

1. Recent Databases Remove row does not immediately disappear; restart refreshes it.
2. Candidate-review panel can remain visibly stale after source authority/health changes.
3. Operator reported database-creation workflow issues; not yet audited.

## Immediate next action

**Do not start ER4-DE yet.**

Run the existing snapshot script separately from the real project:

```text
scripts\Create-EOD-Source-Code-Snapshot-v3.ps1
```

Submit the resulting ZIP/report for independent acceptance. Once the new snapshot is accepted, ER4-DE may begin under the already approved fast-track amendment.
