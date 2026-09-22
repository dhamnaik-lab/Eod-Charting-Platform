# Corporate Action V1.14L → V1.14M.1.1 Controlled Repair

Date: 2026-08-24 IST  
Scope: Corporate Action exact-active NSE symbol / historical-ISIN resolver hardening and exact three-row controlled import repair.  
Current status: **`COMMITTED_PENDING_INDEPENDENT_POST_AUDIT`**.

<!-- CA-V1.14M.1.1-AUG24-CANONICAL-DOC-CHECKPOINT -->

## Summary

V1.14L hardened `resolve_nse_candidate` so an exact active NSE source symbol is preserved when an older official event ISIN maps ambiguously only to inactive historical instruments. If any ambiguous ISIN match is active, the resolver still returns `UNRESOLVED`; no active ambiguity is auto-selected.

V1.14K.1 then replayed the real production candidate builder against a private read-only database snapshot. Imports `43286`, `43419`, and `43501` all returned `READY_PRODUCTION_CANDIDATE_UPDATE`, with zero dedupe conflicts.

V1.14M performed a read-only controlled-repair preflight and returned `READY`. V1.14M.1.1 subsequently committed the exact three authorized `corporate_action_imports` updates inside one all-three-or-rollback transaction after a verified DB/WAL/SHM backup.

## Exact committed rows

| Import ID | Previous symbol | Committed symbol | Preserved event ISIN | Review status |
|---:|---|---|---|---|
| 43286 | PDSMFL | PDSL | INE111Q01013 | PENDING_ISIN_MISMATCH |
| 43419 | `<blank>` | ANDHRAPAP | INE435A01028 | PENDING_ISIN_MISMATCH |
| 43501 | AVANTI | AVANTIFEED | INE871C01012 | PENDING_ISIN_MISMATCH |

All three imports remain unapproved.

## Guarded write scope

Only `corporate_action_imports.dedupe_key`, `symbol`, `company_name`, `review_status`, and `message` were authorized. Import `43419` did not require a `company_name` change. The transaction reported exactly three database writes.

Explicitly unchanged/write count zero:

- `corporate_action_import_evidence`;
- `corporate_action_import_decisions`;
- `corporate_action_event_identity_resolutions`;
- `corporate_actions`;
- `instrument_identity_history`;
- `instrument_isin_history`;
- Quick Resolve state;
- approvals;
- factor/price fields and Corporate Action adjustment state.

## Accepted authority and fingerprints

- Production source SHA-256: `2e05315fa4bf7fe78f28e787edd2bd9a1fef23fb06cab66cc79c8ede9a1b5cfb`.
- V1.14M Apply-plan fingerprint: `5981c3ebd141f443af2cf38f69ae3f704c04f97abb039973a45c44635b089f98`.
- Target post-state fingerprint: `829f70a4714b24516282399c1ba880c87c0e733841d589a3745a106592ff532a`.
- Non-target import fingerprint: `ef1450c462e1192664ed7c0adad472cb27e79529a88e4d2a7c81c8fec270258a`.
- Protected-table fingerprint: `252c70ac7231c288320b24916ec640cad1c741c4095bbe32efafcffc69f2bbd4`.
- Internal Apply verification: `quick_check=ok`, foreign-key violations `0`.

## Important status boundary

This record does **not** declare the three-row repair `FULL_SUCCESS`, Complete, or Closed. The controlled transaction is accepted as committed, but the independent post-audit has not yet been run.

The next and only immediate Corporate Action gate is **V1.14M.2 independent exact three-row post-audit, read-only, no database write**. EOD Charting Platform should remain closed until that audit is completed and reviewed.
