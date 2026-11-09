# A1 design: historical NSE Split/Bonus through a verified rename

Date: 8 November 2026, IST. Status: **user approved; source implementation tested; PR/native acceptance pending**.
Scope: Phase A, A1 only. Base: `bc47208`; evidence and safety regression: `a3998fa`.
See [A1 findings](2026-11-08_CA_A1_IDENTITY_FINDINGS.md) for source hashes and limits.
This is the approved contract. The implementation follows it; exact checks and
remaining copied-price/native acceptance are recorded in the top CA handoff.

Implementation checks on the combined local tree: focused Rust 14/14, renderer
typecheck PASS, Vitest 571/571, seven-filter Rust 841 passed/0 failed/26 ignored.
These do not certify the exact PR tree or the real GUJ event. No live database
or production prices were opened; the four requested copied files remain absent.

## Approved decision

Keep the official import unchanged. Add a separate, persisted, versioned proof
that connects an event-date symbol to one current adjustment owner. For the GUJ
case, the import remains NSE:GUJGASLTD / INE844O01022 / 2019-01-15; a proven
adjustment would belong to NSE:GUJENERGY, with the event ISIN retained separately
from the owner's current INE844O01030. Do not mark GUJGASLTD active or rewrite
source identifiers to make existing same-symbol checks pass.

Use a new Split/Bonus proof module rather than widening the dividend-only
`dated_symbol_chain` contract. Its first version admits one official rename edge
only. Multiple edges, branching, merges, reused symbols, cross-exchange links and
unexplained intermediate ISIN changes remain unsupported. This bounded route must
meet the existing Split/Bonus proofs, thresholds and approval safeguards.

AVANTIFEED remains blocked until an authoritative predecessor link is supplied;
the current official file has none. PCBL's 2018 split remains Needs you: no price
data. No Dividend, Rights, Demerger, BSE mapping, UI redesign or A2 work is included.

## Admission: three independent proofs

| Proof | Required evidence | Fail-closed result |
|---|---|---|
| Rename | Retained official HTTPS NSE symbolchange.csv, verified bytes/hash, parsed edge, effective date after the event, matching audited identity history and one unique current active NSE owner. The import symbol must be the old symbol valid on the event date. The represented old alias must be explicitly inactive; current full-ISIN ownership must be consistent, with no unrelated owner. | Missing/stale/conflicting source, history, activity or ownership leaves identity unresolved. A name or issuer prefix cannot create an edge. |
| Event and ISIN | Existing trusted official event witness bound to source, raw symbol, raw ISIN, ex-date, action and terms. For the split's own ISIN change, preserve the existing ordinary-equity/same-issuer checks and all owner exclusions; the newly verified dated alias is the only additional allowed relationship. No historical full ISIN may be invented from today's master. | A rename cannot explain the 2019 ISIN change. Missing event evidence or another unexplained owner remains blocked. |
| Price | Existing MATCHED scan, unchanged factor/terms/confidence thresholds and a current authoritative previous/ex-date window from copied/raw EOD storage. Bind the selected date-specific alias and exact bars to the proof. Combined Bonus/Split factors require the existing verified component preparation. | Missing sessions, ambiguous aliases, changed/deleted bars, changed factor or non-MATCHED scan blocks readiness and approval. No exception is granted by this route. |

GUJGASLTD → GUJENERGY on 2026-07-01 is verified by the captured source, but the
remaining admission checks and live readiness are not certified by that fact.
The event must precede the rename; rename-day and later old-symbol events do not
borrow this route. Duplicate/conflicting official rows fail closed in version 1.

## Persisted proof and immutable source data

Use `corporate_action_split_bonus_chain_proofs`, an additive table keyed by import ID, with versioned canonical JSON
and a fingerprint. Bind database context, raw event fields, official source
URL/hash/capture and exact edge, event-witness IDs/hashes, dated identity-history
records, old/current activity and ownership, target symbol/exchange/current ISIN,
component terms, scan fingerprint and selected price-window fingerprint.
Capture times are provenance, not authority to infer an otherwise missing fact.

Do not persist Ready as permanent authority. Load & Validate recomputes admission
and stores preparation metadata only; it never executes financial approval.
Imports keep their source symbol, ISIN and `purpose_raw`. The decision log records
the raw tuple, proposed owner, proof fingerprint and reason. No identity-history
row, lifecycle flag or EOD file is created or rewritten by preparation.

## One route used throughout preparation and approval

1. Resolve the verified event/owner context before scanning. A shared internal
   resolver returns the event alias, canonical owner and dated price window.
   Do not pass a silently rewritten import clone through legacy same-symbol checks.
2. Run existing Split/Bonus financial checks against that explicit context. The
   new proof may add the single verified alias relationship, but must not skip
   owner, activity, event-witness, component, factor or price-freshness checks.
   Existing same-symbol and dividend paths retain their current behavior.
3. Expose optional verified-target metadata through `src/platform/*`. Display the
   raw event symbol and resolved owner together. Derive readiness from backend
   proof validity; keep raw-symbol activity truthful. The Later/inactive filter
   may use a verified active target only while all required evidence is valid.
   Missing metadata preserves the current blocked behavior.
4. On the deliberate user Approve click, acquire the existing price-store lock
   and transaction. Only this new route acquires a permit; ordinary manual
   approval keeps its prior lock scope. Recheck permit ownership inside the
   transaction to reject a route prepared after the preliminary permit read.
   Recompute the complete proof and authoritative price window
   before duplicate linking or financial writes. Check this new decision type
   before exact-ISIN shortcuts in `identity_recheck`, so shortcuts cannot bypass
   source, route or target changes. Invalid proof returns to unresolved/readiness
   failure without altering financial records or import source data.
5. Pass an explicit verified target into the existing transactional adjustment
   writer. Record the corporate action under GUJENERGY and retain the event ISIN
   and import link as provenance. Revalidate any existing-action candidate against
   the proven security, event date, action and full component terms; reject
   ambiguity. Do not deduplicate across aliases from shared ISIN alone.
6. Commit the action, proof/decision audit and approval link atomically. Preserve
   existing rollback, chart/cache refresh and manual approval semantics. Raw EOD
   bytes remain unchanged. Automatic Split/Bonus approval remains disabled.

## Chart and cache behavior

Keep NSE history selection behind the existing `eod_data` identity context.
Historical bars use the symbol valid on each date; the current chart owner is
GUJENERGY. Both aliases must load the same approved adjustment exactly once via
the existing action-ID union, even when both symbol and ISIN queries match.
Apply the factor only before the event date, with the existing volume policy.
Never create adjusted EOD copies or apply the factor once per alias file.

Verify the current history resolver with fixtures before changing chart logic.
If it cannot provide one unambiguous history, keep the row blocked and report the
specific gap; do not add a general history merge in A1. Proof/source changes must
invalidate readiness and scan caches. Approval invalidates chart data for both
aliases using existing refresh paths; tests must establish that coverage.

## Implementation map and required evidence

Implemented module: `corporate_action_imports/split_bonus_symbol_chain.rs`, with
tests and additive schema setup in `database/bootstrap.rs`. Integration lives in
`corporate_action_imports.rs` (post-scan preparation, metadata, duplicate lookup,
approval), `identity_recheck.rs`, the shared split-ISIN predicates and official
event-witness helper, `auto_approval.rs` and `instrument_mutations.rs`.
Scanning, import-window readiness and `price_validation_freshness.rs` use the new
strict event-alias loader for admitted A1 routes. Other rows retain the existing
legacy-first lookup. Component preparation and `eod_data` chart helpers are reused;
no general history merge was added. The new proof additionally
binds the complete selected EOD/SQL records and rejects a wrong binary header.
Renderer/platform types, Later readiness, raw/owner labels and post-scan/approval
queue refresh carry the optional verified target. A derived component may use
its unchanged original capture only when the whole captured purpose proves the
exact prepared component; no source action label is rewritten.

The user must supply hash-checked copied GUJGASLTD/GUJENERGY EOD files to certify
the real GUJ case; AVANTI/AVANTIFEED copies are also still missing for A1 diagnosis.
Use fixtures under `tmp/fixtures/ca-a1-20261108/`, immutable/query-only SQLite and
read-only price inspection. Codex must not open the live database or copy from it.

## Acceptance and rollback

Required tests cover the positive GUJ route and explicit Approve; absent, forged,
changed or duplicate source/witness/history; rename-date boundaries; second active
owner and unrelated ISIN owner; changed/deleted price bars; compound preparation;
repeated Load/Approve and duplicate aliases; transaction rollback; unchanged raw
fields/EOD hashes; correct Ready/Later behavior; and one chart adjustment with
both price and volume checks. Preserve the existing dividend proof regressions.
The current GUJ negative remains valid without complete new proof; add a separate
positive test with all admission evidence, rather than weakening that negative.

After approved implementation, run the smallest focused Rust tests first, then
the phase's serial renderer/Vitest/seven-filter Rust checks through the shared
Cargo wrapper. No separate target or portable/release build. User acceptance
requires their portable rebuild, Load & Validate and screenshots before approval.

Before any financial approval, invalidating the new preparation proof is safe:
the original import remains available and unresolved. After an approval, disabling
the resolver must not remove or duplicate an adjustment. Revoking an approved
adjustment is separate Phase E/H1 work; never delete financial rows as rollback.

The user approved the explicit-target model, single-edge scope, GUJENERGY owner
and unchanged financial checks on 8 November 2026. This authorizes implementation;
it does not supply missing evidence, certify the real event as Ready or authorize
financial approval. Real-event acceptance remains separate from synthetic tests.
