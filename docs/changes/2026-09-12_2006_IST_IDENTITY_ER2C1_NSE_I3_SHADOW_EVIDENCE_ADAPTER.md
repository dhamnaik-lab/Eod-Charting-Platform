# Identity ER2-C1 - NSE I3 Shadow Evidence Adapter

IST timestamp: 2026-09-12 20:06:17 IST
Status: GREEN / SHADOW-ONLY INTEGRATION
Workstream: EOD Charting Platform
Project root: E:\TA Projects\EOD Charting Platform

## Objective
Integrate the closed ER2-B deterministic resolver into NSE I3 current-universe Preview as private, provenance-correct shadow diagnostics with zero operational authority.

## Previous limitation
ER2-B was closed as a pure evaluator but NSE I3 Preview did not yet construct real resolver inputs or execute it against existing managed-source evidence.

## Files changed
Production source: src-tauri-shell/src/database/nse_identity_imports.rs
No other production source file changed.

## Final implementation
Managed Official NSE current-master provenance is captured once per Preview batch. Eligible I3 Preview rows construct private ER2 inputs from real local/current identities and only proven CURRENT_MASTER, SYMBOL_CHANGE, and NAME_CHANGE evidence. Same-ISIN current peers are included for Rule E. Shadow outcomes are classified privately and discarded before the existing public Preview result is returned.

## Behaviour preserved
Legacy I3 plan creation, reviewed plan SHA, public Preview result, and reviewed Apply remain operational authority. Apply is byte-preserved and does not call ER2-C1. ER2-B resolver, I4, BSE, frontend/Tauri, schema/data, and dependency authorities are unchanged.

## Non-synthesis guarantees
Symbol/name history evidence does not borrow ISIN or series from Current Master. Local instrument_identity_history is not elevated to official evidence. C1 emits no SERIES_CHANGE, ISIN_CHANGE, HISTORICAL_IDENTITY, LISTING, DELISTING, or LIFECYCLE_STATUS evidence.

## Validation results
Global C1 RED before production code: PASS.
Staged C1 GREEN groups: PASS.
Focused C1 suite: 19/19 PASS.
NSE Identity legacy regression: 32/32 PASS.
ER2-B resolver regression: 67/67 PASS.
BSE Identity regression: 5/5 PASS.
ER1 Official Source Health regression: 9/9 PASS.
cargo check --locked --offline: PASS.
Source delta: exactly one production source file.

## Risks / limitations
C1 diagnostics are intentionally invisible and carry zero product authority. Missing official series/ISIN-history evidence remains unresolved rather than synthesized. C1 does not authorize I4, BSE, visible diagnostics, resolver gating, or source recovery.

## Rollback guidance
Restore NSE Identity preimage SHA256 100F27D48F85570EE45C3EA0E3522E60742C5188E474858B0EDE61F19EE2F598 and verify the exact 536-file PRE-C1 source manifest/canonical digest 7D12B723CDEBE5F4866AD3C4C4353525B4B6293125EA58395EA70D975644E793. No DB/frontend/resolver/dependency rollback is required.

## Evidence
The external evidence ZIP is created under E:\TA Projects\EOD Charting Platform Source Audit and records RED/GREEN logs, regressions, source manifests/delta, preservation authorities, fixture-only shadow characterization, and final state.

## Completion boundary
ER2-C1 completion does not authorize ER2-C2, ER2-C3, ER2-C4, or BSE resolver integration.
