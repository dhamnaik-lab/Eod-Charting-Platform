# Corporate Action Reconciliation R1-A — Current Authority

**Authority date:** 24 September 2026 (IST)
**Workstream:** EOD Charting Platform
**Authorized root:** `E:\TA Projects\EOD Charting Platform`

## Status

**CA Reconciliation R1-A = CLOSED / CURRENT for source implementation and copy-local read-only acceptance.**

R1-A is diagnostic/reconciliation preflight. It does not execute identity repairs or Corporate Action approvals.

- R1-B deterministic repairs/TDD: **NOT STARTED**
- R1-C controlled TEST-DB apply/portable acceptance: **NOT STARTED**

## Source authority

Fresh Snapshot V3:

- `Eod Charting Platform Source Code 2026-09-24_201002_IST.zip`
- SHA-256: `B4C3E9AB71B79B2E3F9B0A703E43EF68F56B0DC89B655244BBC606634AF03719`
- actual files: **1,393**
- accepted live `src + src-tauri-shell`: **569**
- snapshot source members: **568** because established Snapshot V3 policy omits ordinary `src-tauri-shell/README.md`
- protected source: **563**
- snapshot-eligible source hash mismatches: **0**

Accepted R1-A evidence:

- SHA-256: `E730F28CCD592FA0FB2A4A32118EA1A150B83E35E9188B9B415A3FC02443B2DA`
- implementation change record: `docs/changes/2026-09-24_1856_IST_CA_RECONCILIATION_R1A_FIX4_RESUME2_COPY_LOCAL_ACCEPTANCE.md`

## Accepted R1-A behavior

R1-A adds:

- backend-owned read-only reconciliation preflight;
- per-import diagnostic/disposition output;
- reconciliation panel integration;
- CSV and tab-separated TXT export;
- explicit repair-plan descriptions without repair execution;
- Safe V1/readiness observations without replacing their owners.

R1-A does not:

- execute repairs;
- approve Corporate Actions;
- migrate schema;
- mutate raw `.eod` history;
- claim historical coverage complete merely because the selected cohort is accounted for.

## 112-row result

| Outcome | Rows |
|---|---:|
| `REPAIR_CANDIDATE` | 10 |
| `CLASSIFICATION_REVIEW` | 43 |
| `EVIDENCE_BLOCKED` | 59 |
| **Total** | **112** |

- `databaseComplete=false`
- `coverageCertification=NOT_ASSESSED`
- approval writes: **0**
- executed repairs: **0**

Accepted reconciliation fingerprint:

`6AC14592A0ADB14433D2FA6CBB2059DC29B7ABCA5B76E065A378387EBD260C3C`

## Validation authority

Accepted R1-A validation includes:

- R1-A focused: **39/39 PASS**
- read-only context: **2/2 PASS**
- Auto-Approval regression: **11/11 PASS**
- AUTO-ID1: **6/6 PASS**
- historical-ISIN transition: **10/10 PASS**
- Phase6E: **9/9 PASS**
- Phase6F: **3/3 PASS**
- Quick Resolve safeguards: **2/2 PASS**
- Recheck: **6/6 PASS**
- `cargo check --locked --offline`: **PASS**
- pre-install real-cohort copy-local: **1/1 PASS**
- post-install focused R1-A: **39/39 PASS**
- post-install real-cohort copy-local: **1/1 PASS**

The full Rust suite is not described as all-green. The accepted inherited policy remains exactly **687 passed / 1 documented inherited failure / 2 ignored**.

## Preserved authorities

R1-A preserves:

- manual approval;
- `AUTO_APPROVAL_SAFE_V1`;
- STRONG MATCH `>= 0.95`;
- `PENDING_ISIN_MISMATCH`;
- AUTO-ID1;
- 20MICRONS transition behavior;
- duplicate protection;
- compound auto-approval exclusion;
- raw-price adjustment-on-read.

## R1-B next bounded problem

R1-B starts with date-valid historical-symbol reconciliation only. The first fixtures to reverify are:

| Import | Historical -> current symbol | Existing candidate |
|---:|---|---:|
| 819 | VAIBHAVGEM -> VAIBHAVGBL | 235 |
| 19896 | SURANAVEL -> SURANASOL | 379 |
| 22888 | PILIND -> PILITA | 337 |

These are fixtures for a general evidence-backed rule, not hard-coded exceptions. R1-B source/TDD remains non-live-write and must use existing identity/history/event/canonical owners and the existing authorized resolution/linking writer only after all proofs pass.

## R1-C boundary

R1-C remains separately gated. No live TEST-DB repair/apply or approval authority is granted by this document.

## Git closeout boundary

The accepted pre-R1-A Git publication authority is commit `25b186587f416ba7c3ea556c1ddda433239e8f1d` on `main`.

The R1-A Git closeout may publish only the exact accepted R1-A source/documentation state. Unexpected branch, HEAD, remote-main, staged path, source hash, or documentation-preimage drift must stop the closeout.
