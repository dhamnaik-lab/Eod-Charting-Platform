# Corporate Actions Phase 1 — V1.12.1 Final Identity Audit Closeout

**Date:** 2026-08-18 IST  
**Scope:** documentation-only closeout of the accepted V1.11 → V1.12 → V1.12.1 identity-residual workflow  
**Fresh source basis:** `Eod Charting Platform Source Code 2026-08-18_015700_IST`  
**Uploaded source ZIP SHA-256:** `E761D587BFE0134EAB6F7940332B97092823AE88AC85845E756B3D5C1036574D`  
**Production/runtime change:** NONE  
**Database operation:** NONE  
**Git operation:** NONE

## 1. Closeout purpose

The canonical project documents still described Corporate Actions as waiting for the post-V1.9.2 read-only current-state audit. That became stale after V1.11/V1.12/V1.12.1 completed. This reconciliation records the accepted current state without changing Rust, React, TypeScript, SQLite, raw EOD, factors, approvals, or identity/history rows.

## 2. V1.11 controlled approval

- authorized approvals: 283/283
- unexpected extra approvals: 0
- approval-link anomalies: 0
- accepted post-manifest SHA-256: `01c1212cad69c642a4a432f4a6753142dab2b6f45590663d167d8bc5a87c7ebb`
- residual identity blockers: 111

## 3. V1.12 Pass 1

Initial exact-111 cohorts:

- `MISSING_EVENT_DATE_EVIDENCE`: 37
- `CONFLICTING_ISIN_HISTORY`: 9
- `COMPANY_IDENTITY_MISMATCH`: 9
- `NO_CANDIDATE`: 56

Accepted Pass-1 properties:

- input/output: 111/111
- external evidence requests: 111
- local result: 111 `EXTERNAL_EVIDENCE_REQUIRED`
- database writes: 0
- identity/history writes: 0
- Quick Resolves: 0
- approvals: 0
- price/factor writes: 0
- residual ID fingerprint: `8a42afa94287f2c80531020d6df80030229f647f86d3419a55ab94d8d5272bef`
- residual business fingerprint: `2e53917f05386379e4fb034f8a2e7a814bd4bca33ec6fa84e44668bb52482b72`

After the live SQLite family changed at the byte level, a fresh Pass-1 rerun reproduced the same 111 population and both fingerprints. Refreshed authority:

`tmp/corporate-action-v1-12-pass1_20260818_004434/reports`

## 4. External evidence research

All 111 requests were researched.

Evidence grades:

- B: 15
- C: 54
- D: 42

Conservative classifier rules remained in force: Grade C/D cannot become SAFE; Grade B is not automatically SAFE; successor/restructuring evidence is not direct historical-ISIN substitution; final classification is offline and rejects unmanifested evidence.

## 5. Windows long-path correction

The original final package failed because Python `Path.resolve()` dereferenced a short mapped-drive alias back to a long physical Windows evidence path. Direct verification proved the evidence bundle itself was valid through a short alias.

V1.12.1 formalized the fix by preserving the short evidence path, creating a temporary evidence drive in the wrapper, and adding two Windows-path regression tests. The complete suite passed 22/22 tests.

This changed path handling only. Evidence bytes, hashes, classification rules, and database state were unchanged.

## 6. Accepted V1.12.1 final result

Accepted reports:

`tmp/corporate-action-v1-12-1-final_20260818_011520_117/reports`

| Final state | Count |
|---|---:|
| `SAFE_OFFICIAL_EXTERNAL_EVIDENCE` | 10 |
| `SAFE_RENAME_OR_RESTRUCTURE` | 4 |
| `MANUAL_COMPANY_IDENTITY_REVIEW` | 49 |
| `CONFLICT_UNRESOLVED` | 5 |
| `NO_EVIDENCE_FOUND` | 42 |
| `DATA_INTEGRITY_ANOMALY` | 1 |
| **Total** | **111** |

- 14 SAFE future-write candidates
- manual/unresolved: **97**
- classification fingerprint: `f840120706f2450e8235beed6db63edf1a1b4b06f984d64f2eb90900a1149543`
- SAFE-candidate fingerprint: `4211d104b21bb44837e15ef57a851380b615d557782fb8b7ebae11091550f58e`
- 111 in / 111 out: PASS
- live DB/WAL/SHM unchanged: PASS
- database writes: 0
- identity/history writes: 0
- Corporate Action approvals: 0
- Quick Resolves: 0
- zero-write contract: PASS

## 7. V1.13 boundary

V1.13 has not been implemented.

The approved boundary so far is:

1. only the exact 14 V1.12.1 SAFE candidates may enter a future controlled repair;
2. the write transaction is limited to historical identity/ISIN evidence;
3. Corporate Action import/status changes are not performed in that same transaction;
4. the remaining 97 rows are out of scope and remain untouched;
5. after any future authorized identity/history write, an independent read-only post-audit/recheck must prove the effects before any Corporate Action status transition is considered.

## 8. Documentation files reconciled

Updated canonical documents:

- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`
- `HANDOFF.md`
- `FILE_INVENTORY.md`
- `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`

New documentation:

- this closeout record
- V1.12.1 documentation reconciliation design
- V1.12.1 documentation reconciliation plan

No production source file is part of this package.
