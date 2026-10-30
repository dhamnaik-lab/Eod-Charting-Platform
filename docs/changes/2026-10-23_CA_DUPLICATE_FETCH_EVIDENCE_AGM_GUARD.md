# Duplicate Fetch evidence retention and AGM face-value guard

Pre-edit backup: `backups/pre_opencode_changes_20261023_130944_ca_evidence_agm_guards`.

## Changes

- `src-tauri-shell/src/database/corporate_action_imports.rs`: exact-dedupe matches now retain incoming official evidence instead of returning before evidence collection. New evidence returns `EvidenceAttached`; an already identical witness returns `Duplicate` without inserting another record or performing a database write. Import metadata, approval status, canonical actions and prices remain unchanged.
- The new duplicate-path savepoint makes evidence insertion and note retention atomic. Original evidence IDs, timestamps, raw payloads and notes are preserved. In particular, an existing legacy/backfill warning is not replaced by a new capture note, since that warning can participate in the R1 identity guard. New evidence retains the incoming capture note. Shared evidence handling skips its formerly redundant UPDATE when no replacement note was supplied.
- `corporateActionAnnouncementClassification.ts` and the summary input type now include both `oldFaceValue` and `newFaceValue` in the informational-AGM guard. An AGM record carrying either field remains in review/blocked scope. Exact AGM-only notices with no financial fields remain informational; AGM combined with a financial action is unchanged.
- `corporateActionAllTypeReadinessSummary.test.ts` adds both face-value cases. Focused Rust tests model missing evidence, repeated identical Fetch, distinct new evidence, legacy notes, approved imports and injected failure rollback. SQL triggers prohibit financial writes and import metadata updates during the tested duplicate path.

No approval gate, source-identity mapping, exact-witness policy, adjustment logic or raw EOD handling was relaxed. Existing unrelated worktree changes were preserved. No active-database writes, network Fetch, financial approval or portable build was performed.

## Validation

- PASS: `cargo test --manifest-path src-tauri-shell/Cargo.toml duplicate_fetch_evidence --offline -- --test-threads=1` — 3 tests.
- PASS: `cargo test --manifest-path src-tauri-shell/Cargo.toml historical_store_attaches_evidence_to_equivalent_existing_import --offline -- --test-threads=1` — 1 test.
- PASS: `npx vitest run --exclude 'tmp/**'` scoped to AllTypeReadinessSummary, PendingPreparation and OfficialImportsFix2 — 3 files, 40 tests.
- PASS: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/validate-change.ps1 -Profile renderer -Paths src/features/corporateActions/legacy/corporateActionAnnouncementClassification.ts` — renderer typecheck and scoped whitespace.

## Remaining acceptance

The earlier read-only recheck found 1,472 refreshed parsed/pending dividend rows without the exact required NSE_API witness in the disposable classification copy. That is a missing-prerequisite count, not a full policy rejection breakdown. This fix does not manufacture or backfill evidence from import metadata: real official data must be fetched for the relevant event dates. Identical evidence is reused; genuinely different evidence remains separate, and any resulting ambiguity still fails the unchanged approval checks.

Rebuild the portable app, then verify Fetch and Load & Validate, revised readiness counts, and total timing on the temporary database. Controlled explicit approval/chart refresh and the BSE HTTP 403 issue remain separate unfinished work. No commits or pushes were made.
