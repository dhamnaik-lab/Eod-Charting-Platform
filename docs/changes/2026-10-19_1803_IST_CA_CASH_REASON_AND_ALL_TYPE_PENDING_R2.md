# Corporate Actions R2 — Cash-Reason Diagnostics and All-Type Pending Report

- IST: 2026-10-19 18:03:03 IST
- Workstream: EOD Charting Platform, `E:\TA Projects\EOD Charting Platform`
- Source authority: `Eod Charting Platform Source Code 2026-10-19_175452_IST.zip` SHA-256 `E842455AB9CF9C4FF38AC292A971CD78FEB5AE5995D7CCB24E9957A030946CC4`; 1,619 files; archive CRC PASS.
- Status: IMPLEMENTATION CANDIDATE; native Windows validation and final acceptance PENDING.

## Objective and previous limitation
The current dividend evaluator rejects 6,743 cash-classifier cases under one generic diagnostic, concealing its already available typed rejection subtypes. The UI shows total pending/Ready but not the six-action-type Pending/Ready/Blocked distribution. This bounded correction exposes exact reason categories and status counts without changing financial approval or the permitted classifier grammar.

## Files created or modified
- `src-tauri-shell/src/database/corporate_action_imports/simple_cash_dividend_evidence.rs` — exposes stable typed reason labels; accepted/rejected classification remains byte-identical in the grammar path.
- `src-tauri-shell/src/database/corporate_action_imports/auto_approval.rs` — uses typed classifier rejection label instead of generic cash classifier message; otherwise same fail-closed authority and write path.
- `src-tauri-shell/src/database/corporate_action_imports/simple_cash_dividend_evidence_tests.rs` — verifies classification rejects conditional/mixed/special forms and distinct labels.
- `src/features/corporateActions/legacy/corporateActionAllTypeReadinessSummary.ts` — new deterministic pure pending/Ready/Blocked counts for SPLIT, BONUS, DIVIDEND, RIGHTS, DEMERGER, OTHER; no database queries.
- `src/features/corporateActions/__tests__/corporateActionAllTypeReadinessSummary.test.ts` — new tests for reconciliation, de-duplication and approval exclusion.
- `src/components/DatabaseToolsDialogs.tsx` — adds collapsed all-types report over complete loaded pending queue (not checkbox-filtered rows) and optimizes ready dividend membership via Set.
- This change document, created as a candidate; finalize only after user acceptance.

## Preserved accepted behavior
Fetch, automatic Load & Validate, immutable raw `.eod` data, historical identity proof gates, price evidence and adjustment calculations, safe P5 policy, database architecture, chart/cache refresh, and explicit separate user approval. No approvals triggered during Fetch/Load. No loosening of special, conditional, AGM, compound, unit, negative or unmatched cash-dividend grammar. No new backend financial writes.

## Validation and results
- Uploaded source ZIP SHA-256 & CRC: PASS.
- TypeScript syntax parser on changed TS/TSX: PASS in packaging environment.
- Pure all-type count function Node smoke test: PASS.
- Native Rust focused tests, frontend focused Vitest, TypeScript typecheck, Windows Tauri build and portable hashes: **PENDING**; recorded by guarded runner after real execution.
- Manual operational baseline: 32,674 not approved; 1,703 Ready, including 1,702 dividends, before R2. No claim of additional eligible dividends.

## Risks, limitations, rollback
- Typed diagnostic reasons help identify classifier gaps; they do not themselves make the 6,743 blocked dividends Ready. Expanding cash grammar must await evidence-backed safe format examples and approval; otherwise ungrounded financial risk.
- This report covers all *loaded not-approved* rows; it is not a count of historical approved rows nor a guarantee that blocked rows are all resolvable.
- The runner must back up all modified files under EOD Source Audit, verify exact pre/post hashes, stop on source drift, and restore original bytes if a gate fails. It cannot touch D:, Git, production database, or approve actions.
- Source-generated build metadata `src-tauri-shell/gen/build-info.json` is the existing required `pretauri:build` artifact, not source code or a new persistent source output introduced by R2.
- Record manual acceptance and then finalize this change log. Until then, treat it as a provisional implementation record.
