# V1.14AD Controlled CA Staging Preflight R1A-R4-R2 — Rescued Postflight

**IST timestamp:** 2026-08-31 01:42:40 IST

## Objective

Complete the missing real-index/live-source postflight without altering the already-proven R1A-R3 staging logic.

## Previous defect or limitation

R1A-R4-R1 sanitized the caller before exact R1A-R3 started. Exact R1A-R3 again completed its 35-path raw alternate-index verification, then threw at its own real-index postflight with exit 129 before control returned to the wrapper. R1A-R4-R1 therefore never reached its post-child sanitation statement.

## Files changed

- Application source/test/build configuration: none.
- Real Git index: none; SHA-256 before and after: `3B1C9A68BB53674F5B84CF649F3CD676BF801A6156E97CAB7D2BCFECA624891A`.
- Database: none.
- Portable/package output: none.
- Documentation: this timestamped report only.
- External temporary evidence: fresh R1A-R3 run plus R1A-R4-R2 wrapper reports.

## Final implementation

R1A-R4-R2 runs the exact R1A-R3 SHA-256 `9886E9ABABFC071A6C5F19D36577FA25F276947AD000D15F32D6D09D84329676` from scratch.

If R1A-R3 throws, R1A-R4-R2 accepts only the exact known `Real Git index is no longer clean after preflight. exit=129` failure. The wrapper's finally boundary immediately removes all five Git-control variables.

It then identifies exactly one newly-created R1A-R3 run, independently validates the emitted authority/hygiene/staged-path/stage-verification artifacts, invokes the child's own `livepost` helper under the sanitized environment, and independently verifies HEAD plus the real index SHA and clean-index state.

## Validation commands and actual results

- exact R1A-R3 operator SHA-256: PASS;
- pre-child sanitized Git root / exact HEAD / clean real index: PASS;
- child fresh run created: PASS;
- child failure signature: exact known exit-129 postflight failure, or child native success if environment behavior changes;
- child exact staged path count: 35;
- child raw alternate-index blob verification: true;
- child fresh-snapshot whole-file exact count: 24;
- child exact one-byte hygiene blob: PASS;
- child 10 special/shared locked hashes: PASS;
- child exact 10-path latest-source remainder: PASS;
- child exact preservation sentinel list: PASS;
- child stage-verification JSON SHA-256: `FC781E100B227EC52C896677A91FF850619985C4E262E52C98B4B714CF1EE5DA`;
- rescued live source/config: 508 files / 12,758,223 bytes / `9832CB8F74F3E404A52253A9CD073EDA63647C7C576AA6B32FF40B9A1FCDF71D`;
- HEAD unchanged: PASS;
- real index SHA unchanged: PASS;
- real index clean and cached path count 0: PASS.

## Actual validation results

Classification:

`V114AD_CA_ALT_INDEX_STAGING_SCOPE_VALIDATED__REAL_INDEX_UNCHANGED__PARENT_BASELINE_REVIEW_REQUIRED`

`readyForRealStaging = false`

`PARENT_BASELINE_REVIEW_REQUIRED`

## Behavior deliberately preserved

- exact 35-path CA staging design;
- raw alternate-index verification authority;
- 24 snapshot whole-file blobs plus one staged-only hygiene blob;
- 10 special/shared locked hashes;
- latest-source Watchlist and bhavcopy/bootstrap preservation sentinels;
- build-relevant source authority;
- real Git index;
- production database;
- portable/package state.

## Risks or limitations

This closes only the alternate-index staging-scope and preservation preflight if all gates above pass. It does not authorize real Git staging, a commit, or packaging.

The next mandatory phase is parent-baseline / commit-order review.

## Rollback guidance

No source, Git-index, database, or package rollback is required. Delete the external `tmp\v1-14ad-ca-staging-preflight-r1a-r4-r2_*` evidence directory if disposable evidence cleanup is later authorized.

## Recommended next step

Independently audit the R1A-R4-R2 reports ZIP. Then update `docs\CURRENT_WORK_STATUS.md` and root handoff/status documents to mark the alternate-index preflight closed and begin `PARENT_BASELINE_REVIEW_REQUIRED`. Do not run real `git add`.