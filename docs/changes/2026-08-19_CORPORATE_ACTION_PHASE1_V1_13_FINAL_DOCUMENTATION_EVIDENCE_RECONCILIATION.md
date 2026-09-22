# Corporate Action Phase 1 — V1.13 Final Documentation & Evidence Reconciliation

Date: 2026-08-19

## Scope

Documentation/evidence only. This closeout records the completed V1.13B-1 six-row historical
ISIN repair and the independent V1.13C-1.2.1 `FULL_SUCCESS` result. It performs no database
operation, no Corporate Action operation, no production source change, and no Git operation.

## Frozen authority chain

- Preflight: `tmp/corporate-action-v1-13b-1-preflight_20260818_144646_557/reports`
- Controlled Apply: `tmp/corporate-action-v1-13b-1-apply_20260818_170635_303/reports`
- Verified pre-write backup: `backups/pre_corporate_action_v1_13b1_apply_20260818_170635_303`
- Independent post-audit: `tmp/corporate-action-v1-13c-1-2-1-post-audit_20260819_003421_289/reports`

The guarded reconciliation wrapper verifies these artifacts and their semantic contracts before
writing documentation.

## Final six-row result

V1.13B-1 committed exactly six `instrument_isin_history` additions:

| Import | Symbol | History row | Historical ISIN | Effective date | Evidence |
|---:|---|---:|---|---|---|
| 42274 | PARSVNATH | 11602 | INE561H01018 | 2010-10-18 | V112-EVID-0027 |
| 19888 | SBIN | 11603 | INE062A01012 | 2014-11-20 | V112-EVID-0003 |
| 24224 | HINDCOMPOS | 11604 | INE310C01011 | 2017-05-25 | V112-EVID-0006 |
| 24025 | GAYAPROJ | 11605 | INE336H01015 | 2017-02-10 | V112-EVID-0026 |
| 23036 | BAJFINANCE | 11606 | INE296A01016 | 2016-09-08 | V112-EVID-0002 |
| 12841 | TITAN | 11607 | INE280A01010 | 2011-06-23 | V112-EVID-0001 |

Apply result: `COMMITTED_PENDING_POST_AUDIT`; database writes: 6; Corporate Action writes: 0;
Quick Resolves: 0; approvals: 0.

## Independent audit closure

V1.13C-1.2.1 established:

- exact original Preflight report authority;
- checkpointed main-only live post-Apply state;
- exact historical Preflight main DB authority;
- exact historical Preflight WAL authority;
- SHM present as transient/non-authoritative WAL-index evidence;
- preserved V1.13C-1 semantic audit engine;
- exactly 6 authorized mutations;
- 0 forbidden-table changes;
- 0 Corporate Action status promotions;
- 8 protected imports unchanged;
- 0 Quick Resolves;
- 0 approvals;
- 0 database writes by the audit;
- live database family unchanged across the audit.

Final state: **FULL_SUCCESS**.

## Protected eight carried forward

The following imports are explicitly outside the completed six-row history-only tranche and
remain unresolved/unapproved:

- 819 VAIBHAVGBL — stale identity-association class; not representable by the narrow history-only mutation.
- 19896 SURANASOL — stale identity-association class; not representable by the narrow history-only mutation.
- 22969 NAVA — stale identity-association class; not representable by the narrow history-only mutation.
- 19973 CORPBANK → UNIONBANK — legal-successor/restructure class; not same-security continuity.
- 19977 TATACOFFEE → TATACONSUM — legal-successor/restructure class.
- 41025 STER → VEDL — legal-successor/restructure class.
- 41574 HDFC → HDFCBANK — legal-successor/restructure class.
- 42863 ANDHRA PAPER / ANDHRAPAP — historical ISIN exists but exact historical-symbol tuple requires additional evidence; no inference was authorized.

The next phase must begin read-only and classify these categories separately.

## Documentation updates

The guarded wrapper upserts one marked V1.13 closeout section into:

- `README.md`
- `HANDOFF.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`
- `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`

`REQUIREMENTS.md`, `AGENTS.md`, runtime source, database files, and historical change records
are preserved.

## Machine-readable evidence

`docs/changes/evidence/2026-08-19-corporate-action-v1-13-final-closeout.json` is generated
from the verified local evidence at apply time. It records the frozen fingerprints, result
counts, mutation-row mapping, relevant artifact SHA-256 hashes, backup authority, and the
documentation files updated by this reconciliation.

## Safety

- Database operations: 0
- Corporate Action operations: 0
- Quick Resolve operations: 0
- Approval operations: 0
- Production source writes: 0
- Git operations: 0
