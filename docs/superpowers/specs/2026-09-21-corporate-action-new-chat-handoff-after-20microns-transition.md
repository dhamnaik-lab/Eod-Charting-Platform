# Corporate Action — New-Chat Handoff After 20MICRONS Historical-ISIN Transition Closure

**Date:** 2026-09-21 IST  
**Workstream:** `E:\TA Projects\EOD Charting Platform`

## Start-state authority

The bounded `20MICRONS` historical-ISIN transition-window capability is:

`CLOSED / CURRENT`

Accepted live source state before the next Snapshot V3:

- source inventory: **560 exact**;
- protected source: **554 exact**;
- main Corporate Action import owner SHA-256: `9968D91EE99ECCF92B853E349734BF24BFA295477C2A28C89D67CAEF7181BE44`;
- historical-ISIN transition module SHA-256: `D45AD89AEAB209D304A929F0112561CA0B82EAAF43CA30232BB5B04A698EC05D`.

Parent snapshot remains:

`Eod Charting Platform Source Code 2026-09-21_002426_IST.zip`

SHA-256:

`66D1C16FC47FDD87C8A0E70269439DEC472E9951142C1ECADDCBD08B778BDBA0`

A new self-contained snapshot must be generated from the real project after final-closeout documentation is installed.

## Accepted implementation evidence

`CA_20MICRONS_TRANSITION_R1_2026-09-21_123151_IST_evidence.zip`

SHA-256:

`56A89FD1965442B39E4722C1A6EA2B96BAD38900C8324F1D7302EDE045E4E54F`

Key validation: transition GREEN 10/10, AUTO-ID1 6/6, Quick Resolve 5/5, Recheck 6/6, V1.9.2 13/13, full CA-import 122/122, Cargo check PASS, post-install focused 10/10.

## Accepted runtime evidence

`CA_20MICRONS_RUNTIME_ACCEPTANCE_2026-09-21_133950_IST_evidence.zip`

SHA-256:

`669E7B9BBA98C234A79ADA1E61032F058CF6D56DA49F225D99916B3BE494EFE9`

Real TEST-DB acceptance proved exactly:

- `41528` / 2010-08-12;
- `13307` / 2011-08-04;
- `14958` / 2012-07-26.

Inside a stable-copy rollback transaction they became `PENDING` with three `VERIFIED_HISTORICAL_ISIN_TRANSITION` decisions and zero approvals. The transaction rolled back exactly.

Transition authority:

- import `16153`;
- date `2013-01-28`;
- historical ISIN `INE144J01019`;
- current ISIN `INE144J01027`.

All eight post-transition dividends, ten `OTHER` / AGM rows, transition SPLIT and relevant evidence remained unchanged. Import `43206` remained `PENDING_ISIN_MISMATCH`.

## Frozen preservation rules

Do not reopen or broaden this capability without explicit approval.

Preserve:

- strictly pre-transition semantics;
- same-symbol proof only;
- DIVIDEND-only new proof;
- no `effective_date <= event_date` interpretation;
- no schema migration;
- no automatic Corporate Action approval;
- raw historical ISIN preservation;
- `PENDING_ISIN_MISMATCH`;
- exact-event-date Quick Resolve;
- AUTO-ID1, which remains `CLOSED / CURRENT`.

## Separate future problems

The following are **not** continuation work of this closed slice:

- post-transition stale old-ISIN `20MICRONS` rows;
- `20MICRONS` `OTHER` / AGM rows;
- remaining `360ONE` cases;
- BSE identity;
- generalized ISIN validity intervals.

Select one bounded problem at a time and begin with a read-only necessity/design review from the newest accepted snapshot.

## Immediate next step

After installing the final-closeout documentation, create a fresh local source snapshot with the existing accepted Snapshot V3 script. Do not promote an archive constructed outside the real project.

Routine task evidence belongs under:

`E:\TA Projects\EOD Charting Platform\tmp`

Source-code snapshot evidence belongs under:

`E:\TA Projects\EOD Charting Platform Source Audit`
