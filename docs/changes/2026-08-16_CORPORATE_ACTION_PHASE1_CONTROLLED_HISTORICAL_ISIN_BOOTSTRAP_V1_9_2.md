# Corporate Action Phase 1 — Controlled Historical ISIN Bootstrap V1.9.2

**Date:** 2026-08-16 IST  
**Status:** Source implementation for guarded Preview → explicit Apply workflow  
**First operator gate:** Apply source and run validation only. Do not run live Preview until that validation output is reviewed.

## Purpose

V1.9.2 adds a maintenance-only path for the 283 V1.9.1.1 `BOOTSTRAP_SAFE` Corporate Action imports. The reviewed candidate artifact is fixed to SHA-256:

`ea196dbbfeb344eccab4e9077b101d0eb56827dd508c3092f937d6a0a2a603a7`

Under unchanged state those 283 imports deduplicate to 281 exact-date historical ISIN tuples.

## Production source changes

- `src-tauri-shell/src/database/instrument_mutations.rs`
  - adds `insert_historical_isin_evidence_strict_no_promotion(...)`;
  - does not call `promote_matching_pending_isin_mismatch_imports`;
  - rejects conflicting exact-date history and does not overwrite it.
- `src-tauri-shell/src/database/corporate_action_imports/historical_isin_bootstrap.rs`
  - strict candidate CSV parser;
  - V1.9.1.1 `ca-isin-bootstrap-v1` fingerprint parity;
  - live revalidation and 283→281 tuple planning;
  - zero-write Preview models/reports;
  - one-transaction Apply orchestration;
  - targeted existing Quick Resolve only for authorized import IDs;
  - deterministic V1.9.2 history and decision provenance;
  - maintenance CLI parsing/reporting.
- `src-tauri-shell/src/database/corporate_action_imports.rs`
  - wires the focused V1.9.2 child module only.
- `src-tauri-shell/src/database.rs`
  - crate-level maintenance entrypoint re-export.
- `src-tauri-shell/src/main.rs`
  - early optional maintenance branch before Tauri startup; normal startup is unchanged without the explicit maintenance flag.

## Mutation boundary

V1.9.2 Apply may intentionally mutate only:

- `instrument_isin_history` — strict exact-date rows for authorized tuples;
- the authorized Corporate Action import rows through existing Quick Resolve;
- `corporate_action_import_decisions` — V1.9.2 provenance + existing Quick Resolve decision.

It must not approve Corporate Actions, modify `corporate_actions`, change factors or price-validation evidence, create approval exceptions, alter instruments/identity history, or modify raw/binary EOD data.

## Preview safety

Preview is the default maintenance mode. The PowerShell wrapper:

1. requires the application to be closed;
2. hashes live DB/WAL/SHM;
3. copies only DB + optional WAL into a private snapshot;
4. never copies live SHM;
5. runs SQLite only against the private snapshot;
6. proves live DB-family hashes remained unchanged;
7. deletes the private snapshot.

## Apply safety

Apply is not implicit. It requires `-Apply` plus the exact READY Preview manifest. Before any live SQLite write connection, the wrapper verifies:

- exact approved candidate artifact hash;
- READY PREVIEW manifest;
- candidate hash equality with Preview;
- byte-identical live DB/WAL/SHM state from Preview;
- EOD application still closed;
- complete pre-write DB-family backup and backup hash equality.

Rust then begins one outer SQLite transaction and revalidates every candidate, every candidate fingerprint, the deduplicated tuple plan, and `ca-isin-bootstrap-apply-plan-v1` before mutation. Any unexpected failure rolls back the transaction.

## First-run validation gate

Run the package with `-RunValidation`. This applies the guarded source payload, executes focused V1.9.2 tests plus Corporate Action/EOD/frontend/typecheck/build/Tauri regression gates, and exits before Preview.

Portable build is intentionally not part of this phase.
