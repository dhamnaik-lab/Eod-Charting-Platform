# Identity ER4-DE Controlled Real-Source Installation

- **IST timestamp:** 2026-09-17 23:49:39 +05:30
- **Workstream:** EOD Charting Platform
- **Root:** `E:\TA Projects\EOD Charting Platform`
- **Objective:** install the already validated ER4-DE + FIX2 + FIX3 candidate into the real source tree and verify exact post-install authority.

## Previous state

The real source remained at the accepted ER4-BC protected-source authority: 546 protected files. ER4-D/E, FIX2 and FIX3 had completed sandbox/portable validation and the manual operator checkpoint, but were not yet installed into the real source tree.

## Files changed

Protected-source delta is recorded in `authority/install-delta.tsv` in the controlled-install evidence. It contains 11 replacements and one new regression-test file, producing 547 protected files after installation.

Documentation installed with this source change:

- `docs\changes\2026-09-17_1743_IST_IDENTITY_ER4DE_FIX2_FRONTEND_PHASE_CONTRACT_ALIGNMENT.md`
- `docs\changes\2026-09-17_1944_IST_IDENTITY_ER4DE_FIX3_HISTORY_ROLLBACK_VISIBILITY.md`
- this controlled-install change record.

The previously installed BSE observation remains separate and non-blocking:

- `docs\changes\2026-09-17_2221_IST_IDENTITY_ER4DE_BSE_REFERER_TRANSPORT_NON_BLOCKING_OBSERVATION.md`

## Final implementation installed

- ER4-D explicit reviewed NSE candidate promotion with fresh candidate revalidation, stale fencing, atomic mutation, compatibility mirror maintenance and post-change ER1 health.
- ER4-E explicit reviewed rollback-as-new-version with target revalidation, immutable history, post-change ER1 health and retry semantics.
- FIX1 stale-promotion fence ordering: current version/revision/URL stale check precedes full review-plan validation inside the write transaction.
- FIX2 accumulated frontend contract alignment; no runtime behavior change.
- FIX3 Identity-panel vertical scrolling so source-version history and rollback controls are reachable in actual WebView2.

## Behaviour preserved

- manual Official Source URLs workflow and nine-field configuration;
- no automatic promotion;
- no automatic rollback;
- no BSE automation;
- no landing-page promotion;
- no I3/I4 Apply coupling;
- no ER5+ behavior;
- BSE referer transport failure remains deferred/non-blocking.

## Validation authority before installation

- ER4-DE FIX1 package SHA256: `AD8D5AAC71086104FCC5B6AC8339DE92AF1E8B0E5193A46972CCD6773540A470`.
- FIX2 package SHA256: `EDB3FD83F01FB540502ACB490D2426D284DCCF1F7D60130E39752C3890ACC1C3`.
- FIX3 package SHA256: `EF18FF2EE6CEBA8EF6A0D76092159A1C5E3EF5E7D48190110E19D847E4F19269`.
- RESUME3 automated evidence SHA256: `BB28502B69F979870BDC74A420B0B9EFEC36D6C59A3BF190120589292C941F9A`.
- FIX3 automated evidence SHA256: `A86050AB562102106009B77423C5999593A0EEAEC3387958C65670AD9C052A0C`.
- BSE observation evidence SHA256: `273F1CAD0515FCC3646B4AE5E2D1DDDC0267AA10504DF9905EE564729A3988DF`.
- Manual checkpoint: accepted; controlled NSE failure detected, history became reachable after FIX3, reviewed rollback created new version 16/revision 6 to `EQUITY_L.csv`, and rollback post-health was `ROLLBACK_HEALTHY`.

## Installation validation commands/results

- PRE protected-source verification: **PASS — 546/546 exact**.
- Candidate staged delta verification: **PASS — 12/12 delta paths exact**.
- POST protected-source verification: **PASS — 547/547 exact**.
- Protected-source POST count: **547**.
- Backup ZIP: `E:\TA Projects\EOD Charting Platform\tmp\IDENTITY_ER4DE_REAL_INSTALL_PRECHANGE_BACKUP_2026-09-17_234939_IST.zip`.
- Backup ZIP SHA256: `4BA80AB76A17D7A529A4C9B0C7E3971E8AB68F0FF6F84191BA798CD07CECE390`.
- Evidence ZIP: `E:\TA Projects\EOD Charting Platform\tmp\IDENTITY_ER4DE_REAL_INSTALL_2026-09-17_234939_IST_evidence.zip`.
- No DB / network / Git / build / test / snapshot action was invoked by this install runner.

## Risks / limitations

- This step installs source but does not perform ER4 final authority closeout and does not create the final source snapshot.
- The BSE `BSE_LIST_SCRIPS_REFERER` transport failure remains a separate future task and is not repaired here.
- No live validated promotion candidate was available during the manual checkpoint; promotion behavior is supported by the automated ER4-D test authority rather than a live manual promotion.

## Rollback guidance

Use the bounded pre-install backup ZIP produced by this runner. Restore the 11 replaced protected files, remove the newly added `identityEr4HistoryVisibility.test.ts`, and remove the two ER4-DE/FIX change records and this install record if a controlled rollback is required before final closeout.

## Completion boundary

ER4 final closeout and the fresh source snapshot remain **NOT STARTED** and require a separate approved step after independent acceptance of this install evidence.

