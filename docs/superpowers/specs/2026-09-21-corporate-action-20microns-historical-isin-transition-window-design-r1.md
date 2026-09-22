# Corporate Action — 20MICRONS Historical-ISIN Transition-Window Design R1

**Status:** APPROVED / IMPLEMENTATION AUTHORIZED  
**Date:** 2026-09-21 IST  
**Workstream:** `E:\TA Projects\EOD Charting Platform`  
**Parent authority:** `Eod Charting Platform Source Code 2026-09-21_002426_IST.zip`  
**Parent SHA-256:** `66D1C16FC47FDD87C8A0E70269439DEC472E9951142C1ECADDCBD08B778BDBA0`

## Objective

Add one new Quick Resolve proof for a **strictly pre-transition, same-symbol historical ISIN** Corporate Action row. The first characterized target is `20MICRONS`, where official rows before the verified 2013-01-28 split use historical ISIN `INE144J01019` while the active instrument uses current ISIN `INE144J01027`.

## Frozen boundary

This design does **not** reopen AUTO-ID1. It does not reinterpret `instrument_isin_history.effective_date` as an interval start. It does not use `history_date <= event_date`. It adds no schema or migration and grants no Corporate Action approval authority.

The proof is available only when all of the following are true:

- NSE import is `UNRESOLVED`, unapproved, `PARSED`, and `DIVIDEND`;
- exactly one active current suggestion exists;
- raw/import symbol equals the active current symbol (same-symbol only);
- raw/import ISIN differs from the current active ISIN;
- an approved same-symbol `SPLIT` import links to a canonical `corporate_actions` row whose ISIN is the current ISIN;
- candidate event date is **strictly less than** the split transition date;
- exact transition-date `instrument_isin_history` evidence exists for the historical ISIN with no conflicting ISIN at that symbol/date;
- the split import carries `HISTORICAL_ISIN_BOOTSTRAP_V1_9_2` audit evidence binding the exact `historical -> current` tuple;
- the split import also carries `VERIFIED_QUICK_RESOLUTION` audit evidence.

If more than one fully verified transition satisfies the proof, the resolver fails closed as ambiguous.

## Proof precedence

1. `ExactEventDateHistoricalIsin` — unchanged.
2. `VerifiedPersistedEventIdentity` — unchanged AUTO-ID1 authority.
3. `VerifiedHistoricalIsinTransition` — this design.
4. Otherwise manual/blocked.

A stored/tampered AUTO-ID1 resolution error must not be bypassed by the new proof.

## Mutation result

The new proof reuses the existing `apply_import_row_resolution()` path:

- raw official ISIN remains unchanged;
- row becomes `PENDING`;
- no `corporate_actions` approval occurs;
- decision audit type is `VERIFIED_HISTORICAL_ISIN_TRANSITION`;
- the audit reason binds transition import ID, approved corporate-action ID, transition date, historical ISIN, and current ISIN.

## Explicit exclusions

- transition-date row: existing exact-event-date proof owns it;
- post-transition stale historical ISIN rows: remain unresolved/blocked;
- `PENDING_ISIN_MISMATCH`: never bypassed;
- `OTHER`, `SPLIT`, `BONUS`, `RIGHTS`: not eligible for this new transition-window proof;
- symbol changes: not eligible; AUTO-ID1/event-identity rules remain separate;
- BSE: excluded;
- automatic Corporate Action approval: prohibited.

## Characterized real-data expectation

A later separately authorized TEST-DB rollback acceptance should make exactly these pre-transition 20MICRONS imports Quick Resolve eligible:

- `41528` — 2010-08-12 DIVIDEND
- `13307` — 2011-08-04 DIVIDEND
- `14958` — 2012-07-26 DIVIDEND

Transition split `16153` stays unchanged and already approved. Post-transition rows, including `43206` (`PENDING_ISIN_MISMATCH`), must remain unchanged.
