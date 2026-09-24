# Corporate Action New-Chat Handoff — After Reconciliation R1-A

**Date:** 24 September 2026 (IST)
**Repository:** `E:\TA Projects\EOD Charting Platform`

## Read first

Current authority:

`docs/superpowers/specs/2026-09-24-corporate-action-reconciliation-r1a-current-authority.md`

## Current state

- R1-A source implementation: **CLOSED / CURRENT**
- R1-A 112-row copy-local acceptance: **CLOSED / CURRENT**
- live source authority: **569**
- protected source authority: **563**
- R1-A repair writes: **0**
- R1-A approvals: **0**
- R1-B: **NOT STARTED**
- R1-C: **NOT STARTED**

Fresh Snapshot V3:

- `Eod Charting Platform Source Code 2026-09-24_201002_IST.zip`
- SHA-256: `B4C3E9AB71B79B2E3F9B0A703E43EF68F56B0DC89B655244BBC606634AF03719`

Accepted R1-A evidence SHA-256:

`E730F28CCD592FA0FB2A4A32118EA1A150B83E35E9188B9B415A3FC02443B2DA`

## 112-row reconciliation

- `REPAIR_CANDIDATE=10`
- `CLASSIFICATION_REVIEW=43`
- `EVIDENCE_BLOCKED=59`
- total `112`
- `databaseComplete=false`
- `coverageCertification=NOT_ASSESSED`

## Preserve

Do not weaken:

- manual approval;
- `AUTO_APPROVAL_SAFE_V1`;
- STRONG MATCH `>= 0.95`;
- `PENDING_ISIN_MISMATCH`;
- AUTO-ID1;
- 20MICRONS transition authority;
- duplicate protection;
- compound auto-approval exclusion;
- raw-price adjustment-on-read;
- TEST-vs-operational database separation.

## Exact next bounded task — R1-B

Start with date-valid historical-symbol reconciliation fixtures:

- import 819: VAIBHAVGEM -> VAIBHAVGBL, candidate 235;
- import 19896: SURANAVEL -> SURANASOL, candidate 379;
- import 22888: PILIND -> PILITA, candidate 337.

Use them to prove one general rule. Do not add symbol-specific exceptions.

Do not automatically mix in price-data repair, no-active-candidate cases, or unrelated classification work.

## Files to inspect first for R1-B

1. `src-tauri-shell/src/database/corporate_action_imports/reconciliation_preflight.rs`
2. `src-tauri-shell/src/database/corporate_action_imports.rs`
3. `src-tauri-shell/src/database/corporate_action_imports/repair_preview.rs`
4. existing identity-history/event-identity owners
5. existing canonical-action lookup and resolution/linking writer tests
6. `docs/superpowers/specs/2026-09-24-corporate-action-reconciliation-r1a-current-authority.md`
7. `docs/changes/2026-09-24_1856_IST_CA_RECONCILIATION_R1A_FIX4_RESUME2_COPY_LOCAL_ACCEPTANCE.md`

Use the resulting R1-A closeout Git commit/evidence as the publication authority for R1-B.
