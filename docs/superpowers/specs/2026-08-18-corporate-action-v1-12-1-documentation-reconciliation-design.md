# Corporate Actions V1.12.1 Canonical Documentation Reconciliation Design

## Purpose

Reconcile canonical project documentation to the accepted V1.12.1 read-only identity-audit closeout using fresh source snapshot `Eod Charting Platform Source Code 2026-08-18_015700_IST` (SHA-256 `E761D587BFE0134EAB6F7940332B97092823AE88AC85845E756B3D5C1036574D`).

## Scope

Documentation only.

Update:

- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`
- `HANDOFF.md`
- `FILE_INVENTORY.md`
- `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`

Create:

- dated V1.12.1 closeout under `docs/changes/`
- this design under `docs/superpowers/specs/`
- implementation plan under `docs/superpowers/plans/`

## Authority

Record exactly:

- V1.11 controlled approvals: 283
- exact residual population: 111
- SAFE candidates: 14
- manual/unresolved: 97
- final states: 10 SAFE official evidence, 4 SAFE rename/restructure, 49 manual review, 5 conflict unresolved, 42 no evidence, 1 anomaly
- residual ID fingerprint: `8a42afa94287f2c80531020d6df80030229f647f86d3419a55ab94d8d5272bef`
- residual business fingerprint: `2e53917f05386379e4fb034f8a2e7a814bd4bca33ec6fa84e44668bb52482b72`
- classification fingerprint: `f840120706f2450e8235beed6db63edf1a1b4b06f984d64f2eb90900a1149543`
- SAFE fingerprint: `4211d104b21bb44837e15ef57a851380b615d557782fb8b7ebae11091550f58e`
- Pass-1 reports: `tmp/corporate-action-v1-12-pass1_20260818_004434/reports`
- final reports: `tmp/corporate-action-v1-12-1-final_20260818_011520_117/reports`
- zero database/identity/approval/Quick Resolve writes

## V1.13 statement boundary

State only what has already been approved: exact 14 SAFE candidates, identity/history evidence only, no Corporate Action status update in the same transaction, 97 untouched, independent read-only post-audit/recheck afterward.

Do not claim V1.13 implementation exists.

## Safety

Fail closed against exact pre-state hashes of the six canonical root documents. Apply documentation payloads only. No runtime source, database, raw EOD, Corporate Action mutation, or Git operation.
