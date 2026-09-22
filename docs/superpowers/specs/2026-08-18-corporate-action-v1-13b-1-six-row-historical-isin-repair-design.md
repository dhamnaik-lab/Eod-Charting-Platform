# Corporate Action Phase 1 V1.13B-1 Six-Row Historical ISIN Repair Design

**Status:** APPROVED DESIGN — DOCUMENTATION ONLY  
**Date:** 2026-08-18  
**Parent:** V1.13A.2 read-only Preview  
**Implementation state:** NOT IMPLEMENTED  
**Database write authorization:** NOT YET GRANTED  
**Git:** prohibited unless separately requested

## 1. Purpose

V1.13B-1 narrows the originally approved 14-row V1.13 identity-repair population into a homogeneous, evidence-backed six-row historical-ISIN repair tranche. The tranche exists because V1.13A.2 proved that only six of the fourteen SAFE candidates are currently representable as exact `instrument_isin_history` inserts without inventing broader identity semantics.

The eight blocked candidates remain part of the accepted V1.12.1 SAFE population but are explicitly protected from V1.13B-1 writes.

## 2. Controlling authority

The design is bound to:

- V1.12.1 final reports: `tmp\corporate-action-v1-12-1-final_20260818_011520_117\reports`
- V1.13A.2 Preview reports: `tmp\corporate-action-v1-13a-preview_20260818_102638_150\reports`
- V1.13A.2 result: `NOT_READY`
- SAFE population: 14
- READY_INSERT: 6
- blocked: 8
- non-SAFE excluded: 97
- candidate-set fingerprint: `b4f61783db9a84958b3a278a0ff00d2687925463dea63a97bd39e46a28e504cf`
- disposition-set fingerprint: `f9254415fd96434f43a32b686d90519d30cc2b30210e913c57fe016283894f35`
- mutation-set fingerprint: `60b411e1bbc564fcdd28870f0eb4dd3b273df87c13297548fe2621a7834c6fa7`
- six-row authorization-tranche fingerprint: `4289fd6be38777fafac3af253d1e201b976b79cdf8f9cc1c1f8ccef5a0f44ef7`

The full machine-readable authority is installed at `docs/changes/evidence/2026-08-18-corporate-action-v1-13b-1-six-row-authority.json`.

## 3. Authorized six-row tranche

| Import ID | Symbol | Historical ISIN | Effective date | Evidence |
|---:|---|---|---|---|
| 12841 | TITAN | INE280A01010 | 2011-06-23 | V112-EVID-0001 |
| 19888 | SBIN | INE062A01012 | 2014-11-20 | V112-EVID-0003 |
| 23036 | BAJFINANCE | INE296A01016 | 2016-09-08 | V112-EVID-0002 |
| 24025 | GAYAPROJ | INE336H01015 | 2017-02-10 | V112-EVID-0026 |
| 24224 | HINDCOMPOS | INE310C01011 | 2017-05-25 | V112-EVID-0006 |
| 42274 | PARSVNATH | INE561H01018 | 2010-10-18 | V112-EVID-0027 |

All six V1.13A.2 dispositions were `READY_INSERT`. There were zero `READY_ALREADY_SATISFIED` rows.

## 4. Protected eight-row exclusion set

The following candidates are **not writable by V1.13B-1**:

| Import ID | Class | Reason |
|---:|---|---|
| 819 | stale identity association | no narrow history-only mutation exists |
| 19896 | stale identity association | no narrow history-only mutation exists |
| 22969 | stale identity association | no narrow history-only mutation exists |
| 19973 | legal successor/restructure | not proven same-security identity continuity |
| 19977 | legal successor/restructure | not proven same-security identity continuity |
| 41025 | legal successor/restructure | not proven same-security identity continuity |
| 41574 | legal successor/restructure | not proven same-security identity continuity |
| 42863 | incomplete historical tuple | historical symbol absent |

V1.13B-1 must prove these eight rows remain untouched. It must not coerce them into `NAME_CHANGE`, `SYMBOL_CHANGE`, `BOTH`, or inferred historical-symbol writes.

## 5. Write boundary

The only table V1.13B-1 may modify is:

`instrument_isin_history`

The exact semantic operation is an INSERT of the six frozen tuples if, and only if, every live precondition still matches the accepted Preview authority.

The following are explicitly outside scope and must remain unchanged:

- `instrument_identity_history`
- `instruments`
- `corporate_action_imports`
- `corporate_action_import_evidence`
- `corporate_action_import_decisions`
- `corporate_actions`
- raw EOD/price storage
- adjustment/factor state
- Corporate Action approval state

There is no Quick Resolve and no Corporate Action status promotion in V1.13B-1.

## 6. Provenance contract

Each inserted history row must preserve the exact V1.13A.2 mutation-plan fields:

- `source = V1.12.1_EXTERNAL_EVIDENCE`
- `source_ref = V112-EVID-....`
- the exact V1.13A.2 `note`
- the exact exchange, symbol, ISIN, and effective date

The six mutation rows and per-row mutation fingerprints are frozen in the machine-readable authority file.

Changing any of these values produces a different authorization and requires a new Preview/review cycle.

## 7. Preflight and live-state revalidation

V1.13B-1 Apply may proceed only when all of the following pass immediately before the transaction:

1. EOD Charting Platform process is closed.
2. The source sentinels match the reviewed source basis.
3. The V1.12.1 and V1.13A.2 report authorities and their hashes/fingerprints are present and valid.
4. The full 14-row candidate set still reconciles as six authorized + eight protected.
5. The live database family is quiescent.
6. A DB/WAL/SHM backup is created and SHA-256 verified.
7. Every authorized Corporate Action import still matches the Preview identity, date, action type, unresolved status, and destination assumptions used by the V1.13A.2 classifier.
8. Every exact `(exchange, symbol, effective_date)` history slot remains empty, or is an exact V1.13B-1 provenance-bound idempotent match.
9. No protected candidate has been folded into the mutation plan.
10. The reconstructed mutation-set fingerprint remains `60b411e1bbc564fcdd28870f0eb4dd3b273df87c13297548fe2621a7834c6fa7`.

A changed live DB-family hash by itself is not grounds for blindly accepting or rejecting the tranche. The preflight must revalidate semantic authority against the current DB and then freeze a **new Apply-time DB-family hash** into the READY manifest. Any subsequent DB-family change between Preflight and Apply aborts Apply.

## 8. Transaction contract

V1.13B-1 uses one SQLite transaction.

`6 authorized mutations -> BEGIN -> revalidate -> insert six -> COMMIT`

If any candidate, tuple, provenance value, table state, or constraint differs:

`ROLLBACK ALL SIX`

No partial success is accepted.

The writer must not reuse the V1.9.2 Apply path because that path also records decisions and invokes Quick Resolve. V1.13B-1 may reuse only the strict no-promotion historical-ISIN insertion semantics.

## 9. Idempotency

A V1.13B-1 rerun may recognize a row as already applied only when the exact history tuple and V1.13B-1 provenance are present.

A pre-existing matching ISIN row with unrelated/unbound provenance is not silently adopted; it is a conflict requiring review.

The existing V1.9.2 provenance recognition must remain behaviorally unchanged.

## 10. Commit/report states

The operator-facing result states are:

- `ROLLED_BACK` — transaction did not survive.
- `COMMITTED_PENDING_POST_AUDIT` — database commit succeeded, independent proof not yet complete.
- `FULL_SUCCESS` — reserved for V1.13C-1 after independent read-only post-audit.

If report generation fails after SQLite commit, the tool must emit a committed-report-failure state and must not claim rollback or automatically restore the backup.

## 11. Mandatory post-audit boundary

V1.13B-1 is not considered fully successful at commit time.

Before any Corporate Action status work, V1.13C-1 must independently prove:

- exactly six authorized `instrument_isin_history` additions;
- no unexpected update/delete;
- all eight protected candidates untouched;
- all 97 non-SAFE candidates untouched;
- `instrument_identity_history`, `instruments`, Corporate Action tables, and raw EOD state unchanged;
- `PRAGMA quick_check = ok`;
- zero foreign-key violations;
- read-only re-evaluation of the six Corporate Action imports completed.

V1.13C-1 must not promote Corporate Action statuses.

## 12. Recovery

The verified DB-family backup is recovery authority, not an automatic rollback mechanism after commit.

If post-audit finds an anomaly:

1. stop the Corporate Action workflow;
2. preserve all before/after evidence;
3. diagnose the exact delta;
4. authorize restoration separately if restoration is actually required.

## 13. Future blocked-candidate work

The eight protected cases remain separate semantic work:

- stale identity-association investigation: 819, 19896, 22969;
- successor/restructuring identity model: 19973, 19977, 41025, 41574;
- ANDHRAPAP historical-symbol evidence: 42863.

None of these may be solved as a side effect of V1.13B-1.

## 14. Acceptance criteria for implementation readiness

The implementation may be presented for operator approval only after:

- TDD regressions cover exact six-row authorization and eight-row exclusion;
- synthetic SQLite tests prove all-six-or-rollback;
- V1.9.2 strict-insert behavior remains green;
- no writer path can reach Quick Resolve or Corporate Action approval;
- source/package contract scans pass;
- a separate V1.13C-1 post-audit design/tool is available before live Apply is authorized.

