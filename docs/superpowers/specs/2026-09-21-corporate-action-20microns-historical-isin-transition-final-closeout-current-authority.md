# Corporate Action — 20MICRONS Historical-ISIN Transition Final Closeout / Current Authority

**Status:** CLOSED / CURRENT  
**Date:** 2026-09-21 IST  
**Workstream:** `E:\TA Projects\EOD Charting Platform`  
**Bounded capability:** strictly pre-transition same-symbol historical-ISIN Quick Resolve for `NSE:20MICRONS`

## Authority chain

Parent self-contained snapshot:

`Eod Charting Platform Source Code 2026-09-21_002426_IST.zip`

SHA-256:

`66D1C16FC47FDD87C8A0E70269439DEC472E9951142C1ECADDCBD08B778BDBA0`

The live project is intentionally ahead of that parent snapshot by the accepted 20MICRONS transition-window source delta. The current accepted live source authority is:

- `src + src-tauri-shell`: **560 exact files**;
- protected source: **554 exact files**;
- `src-tauri-shell\src\database\corporate_action_imports.rs`: `9968D91EE99ECCF92B853E349734BF24BFA295477C2A28C89D67CAEF7181BE44`;
- `src-tauri-shell\src\database\corporate_action_imports\historical_isin_transition.rs`: `D45AD89AEAB209D304A929F0112561CA0B82EAAF43CA30232BB5B04A698EC05D`.

A fresh Snapshot V3 is required after this documentation closeout before a new source authority is promoted.

## Design boundary frozen

The accepted proof remains the Design R1 boundary:

- NSE only;
- `PARSED`, `UNRESOLVED`, unapproved `DIVIDEND` only;
- exactly one active same-symbol current target;
- historical raw ISIN differs from current ISIN;
- approved same-symbol SPLIT establishes the historical-to-current transition;
- candidate event date is **strictly before** the verified transition date;
- exact transition-date historical-ISIN evidence is required;
- `HISTORICAL_ISIN_BOOTSTRAP_V1_9_2` and `VERIFIED_QUICK_RESOLUTION` provenance is required;
- ambiguous transition evidence fails closed.

The proof order remains:

1. exact event-date historical ISIN;
2. verified persisted AUTO-ID1 event identity;
3. verified historical-ISIN transition window;
4. otherwise manual/blocked.

The implementation must not reinterpret `instrument_isin_history.effective_date` as an interval start and must never use a generic `history_date <= event_date` rule.

## Accepted source implementation evidence

Implementation evidence:

`CA_20MICRONS_TRANSITION_R1_2026-09-21_123151_IST_evidence.zip`

SHA-256:

`56A89FD1965442B39E4722C1A6EA2B96BAD38900C8324F1D7302EDE045E4E54F`

Accepted validation:

- genuine behavioral RED;
- transition focused GREEN: **10/10**;
- AUTO-ID1 regression: **6/6**;
- Quick Resolve regression: **5/5**;
- Recheck regression: **6/6**;
- V1.9.2 regression: **13/13**;
- full `corporate_action_imports::tests::`: **122/122**;
- `cargo check --locked --offline`: **PASS**;
- post-install focused transition suite: **10/10**.

The accepted source delta is exactly one modified Rust owner plus one added private Rust module. No frontend, schema, migration, dependency or public Tauri API change is part of this capability.

## Accepted real TEST-DB runtime evidence

Runtime acceptance evidence:

`CA_20MICRONS_RUNTIME_ACCEPTANCE_2026-09-21_133950_IST_evidence.zip`

SHA-256:

`669E7B9BBA98C234A79ADA1E61032F058CF6D56DA49F225D99916B3BE494EFE9`

The runtime gate used native writer exclusion and a raw stable copy of the accepted TEST DB family. SQLite opened only the stable copy.

Exactly these real imports qualified:

| Import ID | Event date | Action |
|---:|---|---|
| 41528 | 2010-08-12 | DIVIDEND |
| 13307 | 2011-08-04 | DIVIDEND |
| 14958 | 2012-07-26 | DIVIDEND |

Inside a copy-local `BEGIN IMMEDIATE` transaction, all three:

- Quick Resolved successfully;
- became `PENDING`;
- retained raw historical ISIN `INE144J01019`;
- retained null `approved_corporate_action_id`;
- recorded exactly one `VERIFIED_HISTORICAL_ISIN_TRANSITION` decision each;
- caused **zero Corporate Action approvals**.

The verified transition remained:

- transition import `16153`;
- date `2013-01-28`;
- historical ISIN `INE144J01019`;
- current ISIN `INE144J01027`.

Preservation inside the transaction was proven for:

- transition SPLIT `16153`;
- all **8** post-transition `20MICRONS` DIVIDEND rows;
- all **10** `OTHER` / AGM rows;
- known post-transition import `43206`, which remained `PENDING_ISIN_MISMATCH`;
- target corporate actions;
- relevant instrument / ISIN-history / identity-history evidence.

The transaction was then rolled back and the selected logical state was restored exactly. New transition decisions after rollback: **0**. Schema version was unchanged.

Live safety evidence:

- live TEST DB SQLite opens: **0**;
- live DB writes: **0**;
- live checkpoints / sidecar deletes: **0**;
- operational `D:` database access: **0**;
- migrations: **0**;
- source modifications during runtime acceptance: **0**;
- Git: **0**;
- network: **0**;
- app launch: **0**.

## Behavior preserved

This closure does not reopen AUTO-ID1. AUTO-ID1 remains `CLOSED / CURRENT`.

Preserved unchanged:

- ordinary exact-event-date historical-ISIN Quick Resolve;
- persisted AUTO-ID1 event-identity Quick Resolve;
- `PENDING_ISIN_MISMATCH` boundary;
- post-transition stale historical-ISIN rows;
- unsupported `OTHER` / AGM rows;
- explicit Corporate Action approval ownership;
- raw official ISIN provenance;
- frontend preparation/approval ownership;
- chart/raw-price behavior;
- schema and migrations.

## Explicit non-goals / separately gated populations

This closeout does not resolve:

- post-transition `20MICRONS` stale-old-ISIN rows;
- `20MICRONS` `OTHER` / AGM rows;
- any separate `360ONE` population;
- BSE Corporate Action identity behavior;
- any new generalized historical-identity interval model.

Those are separate bounded problems and require separate necessity/design authority.

## Final classification

`CA 20MICRONS HISTORICAL-ISIN TRANSITION-WINDOW R1 — CLOSED / CURRENT`

No implementation, DB, migration, approval or runtime work remains for this bounded capability.

## Next authority action

Install this closeout documentation with source PRE/POST preservation, independently verify the closeout evidence, then run the accepted local:

`scripts\Create-EOD-Source-Code-Snapshot-v3.ps1`

The resulting real-project snapshot may then be reviewed and promoted as the next self-contained source authority.
