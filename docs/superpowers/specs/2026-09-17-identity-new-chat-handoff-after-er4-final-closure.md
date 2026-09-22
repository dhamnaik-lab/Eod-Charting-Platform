# Identity — New-Chat Handoff After ER4 Final Closure

**Date:** 2026-09-17 IST  
**Workstream:** `E:\TA Projects\EOD Charting Platform`  
**Authority state:** `ER4-A/B/C/D/E CLOSED / GREEN; ER4 CLOSED / CURRENT; ER5+ NOT AUTHORIZED`

## Read this first

For any future Identity work, read this handoff before relying on older ER4-BC handoffs, intermediate ER4-DE failures, pre-FIX2/FIX3 candidates, or assumptions that ER5 is authorized.

Current installed source authority:

```text
protected source: 547 files exact
controlled-install evidence SHA256:
1185C745FC1FA8B442E420817E23E5E5EDF948B256148F5DBF8B72AB262E086F
```

Current final authority document:

`docs\superpowers\specs\2026-09-17-identity-er4-final-closure-current-authority.md`

The last self-contained source snapshot is still the parent ER4-BC snapshot:

```text
Eod Charting Platform Source Code 2026-09-17_031234_IST.zip
SHA256 A9FD7B2D54C5EB4E6610F4161A3217EE171B8CA5063009E3356966CEC5026A61
```

That ZIP is not the final ER4 source state. A fresh Snapshot V3 must be created and independently accepted after this closeout.

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
ER4-D  CLOSED / GREEN
ER4-E  CLOSED / GREEN
ER4    CLOSED / CURRENT
ER5+   NOT AUTHORIZED
```

## ER4 capability summary

ER4 now provides one governed official-source authority layer:

```text
Source Health
→ eligible NSE candidate discovery/validation
→ deterministic review authority
→ operator Keep / Reject / Approve decision
→ stale-fenced atomic promotion
→ immutable per-source version history
→ post-change ER1 health
→ explicit reviewed rollback as a NEW version
→ post-rollback health / explicit retry
```

Manual Official Source URLs remains supported and versioned as `MANUAL_OVERRIDE`.

No automatic promotion or automatic rollback exists.

## Accepted corrections

### FIX1

Stale promotion checks current version/revision/URL before full review-plan integrity/revalidation, producing the correct zero-write `ER4_STALE_REJECTED` classification for moved authority.

### FIX2

Accumulated frontend contract tests were aligned with final ER4-D/E semantics. Runtime behavior was unchanged.

### FIX3

The Identity panel gained bounded vertical scrolling so source-version history and rollback controls are reachable in the actual Windows WebView2 UI.

## Accepted evidence

```text
ER4-DE RESUME3 automated evidence
BB28502B69F979870BDC74A420B0B9EFEC36D6C59A3BF190120589292C941F9A

FIX3 automated evidence
A86050AB562102106009B77423C5999593A0EEAEC3387958C65670AD9C052A0C

BSE deferred-observation evidence
273F1CAD0515FCC3646B4AE5E2D1DDDC0267AA10504DF9905EE564729A3988DF

Controlled real-source install evidence
1185C745FC1FA8B442E420817E23E5E5EDF948B256148F5DBF8B72AB262E086F
```

## Manual checkpoint result

Manual operator evidence on the TEST database established:

```text
initial Source Health                         11/11 healthy
controlled NSE Equity Master failure          PASS
eligible recovery action                      PASS
official discovery                            PASS; 0 reviewable / 50 rejected
live candidate promotion                      NOT OBSERVABLE; automated coverage PASS
history reachability after FIX3               PASS
rollback target revalidation                  PASS
explicit reviewed rollback                    PASS
new immutable ROLLBACK version                PASS
current rollback authority                    v16 / revision 6
restored URL                                   EQUITY_L.csv
rollback post-health                          ROLLBACK_HEALTHY
I3/I4 Apply coupling                          NONE
second automatic rollback                     NONE
```

## BSE referer observation

The final Source Health view was `10/11` because only `BSE_LIST_SCRIPS_REFERER` had a transport failure. BSE Active/Delisted/Suspended lifecycle sources remained healthy.

This is documented as a **non-blocking deferred future task**:

`docs\changes\2026-09-17_2221_IST_IDENTITY_ER4DE_BSE_REFERER_TRANSPORT_NON_BLOCKING_OBSERVATION.md`

Do not broaden ER4 or add BSE automation to repair it. Future work must first reproduce and characterize the BSE referer failure as its own bounded maintenance issue.

## Protected source authority

The installed ER4 final protected-source count is:

`547 files exact`

Key final files include:

```text
src-tauri-shell\src\database\official_source_version_history.rs
SHA256 EDC6EB4D022D430852BFA6B9DF0AF70C5B8631C1A453AFC902442C7A8915CB40

src\components\DatabaseToolsDialogs.tsx
SHA256 47510BF3154776D257CCC41F7C276C8DDB6F04C8607C4401652EB0DE40D10394

src\features\identityRecovery\__tests__\identityEr4SourceRecovery.test.ts
SHA256 39DB70D56E063DD69DE5E2DA506AB57DD730A43A406AE6608AC5D25F989B6116

src\features\identityRecovery\__tests__\identityEr4HistoryVisibility.test.ts
SHA256 5317ADD73DEFE61913BA984A8994653E149E3236431FD449DB5DA9D1710EDC9E
```

## Database operating convention

```text
ACTUAL
D:\TA Projects\EOD Charting Platform DATABASE\EOD DATABASE\Nse

TEST
E:\TA Projects\EOD Charting Platform\EOD DATABASE\Nse
```

Use TEST for deliberate controlled failures unless explicitly authorized otherwise.

## Separately gated future work

Do not silently mix these into future Identity work:

- BSE referer transport investigation;
- BSE discovery/candidate automation;
- Recent Databases Remove immediate-refresh maintenance;
- stale candidate-review presentation cleanup;
- database-creation workflow issues;
- deferred NSE temp-staging concurrency repair;
- ER5+.

## Immediate next action

Do not implement anything else yet.

Run the existing snapshot script separately:

```powershell
Set-Location "E:\TA Projects\EOD Charting Platform"
& ".\scripts\Create-EOD-Source-Code-Snapshot-v3.ps1"
```

Type `COPY` when prompted and submit the generated ZIP/report for independent acceptance.

Only after that fresh snapshot is independently accepted should a new bounded Identity or maintenance task begin.
