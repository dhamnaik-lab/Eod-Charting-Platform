# EOD CA R3 — Dividend Verification Progress and Completion-State FIX1

**IST timestamp:** 2026-10-20 1311 IST  
**Workstream:** EOD Charting Platform (`E:\TA Projects\EOD Charting Platform`)  
**Baseline authority:** post-R3 AGM source on Windows, originating from `Eod Charting Platform Source Code 2026-10-20_043352_IST.zip` (SHA-256 `F76E428C9B7BE2669734324CA1D0D7D0A9C4D3D27E60877D6603DB5898D5C450`) plus the exact accepted R3 AGM patch (SHA-256 `483992AFF7CF3F500D2EDDD698C815EB893995F6D30B5870A9740E9273E00EDA`).
**Status:** source candidate, native Windows validation/portable build and operational acceptance PENDING.

## Objective and previous defect
`Load & Validate` presented `Operation stage: complete` as soon as queue preparation finished (32,674 of 32,674) while the independent 8,694-row/87-batch Dividend R1 read-only evaluator was still awaiting completion. It also set `endedAt` too early, froze elapsed time, and swallowed an evaluator exception without a visible reason. User screenshots demonstrated only one prior Bonus Ready while buttons remained disabled/Cancel remained visible. These screenshots did **not** prove a dividend-evaluator failure or final Ready count.

## Files modified
- `src/components/DatabaseToolsDialogs.tsx`: display explicit `dividend-verifying`, `dividend-verified`, or `dividend-stopped` phases; keep elapsed time running until evaluation returns; label verification batch progress and current-state errors; retain existing approved Ready gating and cancellation fencing.
- `src/features/corporateActions/legacy/corporateActionDividendPreparedScopeOrchestration.ts`: optional read-only batch-progress callback (initial `0/N`, then one notification per completed current-cycle batch); no change to backend requests, fingerprint/protocol validation, completeness decisions, batch size, or dispositions.
- `src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeOrchestration.test.ts`: current-cycle progress, cancel/stale suppression, UI completion ordering and error visibility regression assertions.
- `docs/changes/2026-10-20_1311_IST_CA_R3_DIVIDEND_VERIFICATION_PROGRESS_FIX1.md`: this new document.

## Behavior preserved
No change to dividend lexical grammar (including accepted R3 AGM form), canonical parse/cash equality, instrument identity, historical-ISIN proof, official witness, previous-close/ex-date prices, same-date exclusions, 100-ID batches, scope fingerprints, explicit confirmation, transactional writes, raw EOD, Split/Bonus/Rights/Demerger/Other, or Plugin P5 fail-closed. No DB, Git, network, D: drive, or other workstreams. Busy-state Ready remains intentionally unpublished until the complete verifier returns.

## Validation performed / required results
- Locally **PASS**: TypeScript AST parse of three modified sources; isolated read-only Node evaluator harness tests: 0/2→1/2→2/2 progress; cancellation suppresses stale completion and later batches; backend throw yields incomplete outcome, not eligible.
- Windows **PENDING**: PowerShell native parse, source hash guards (640 pinned non-generated files, two R3 Rust post-hashes and accepted R3 change doc; five Tauri `src-tauri-shell/gen/` generated files presence-only), focused Vitest regression including `corporateActionDividendPreparedScopeOrchestration.test.ts`, TS renderer typecheck, Windows Tauri release and portable ZIP SHA/CRC check.
- Manual **PENDING**: one operational R3 Load & Validate after portable build, verify real Dividend R1 87/87 result and changed readiness/reasons. Neither the 2,702 lexical estimate nor any Ready increase is established by this fix.

## Risks and rollback
UI-only tracking could miss unusual lifecycle transitions; new tests cover stale/cancel/error branches, but the Windows runtime checkpoint is still required. The guarded runner uses an external audit-root backup and restores byte-identical source on failure. Generated Tauri build metadata is excluded from immutable source pins because prior builds regenerate it. Never approve any financial action during this checkpoint. Rollback: restore only the three modified TS files from the runner's exact-hash backup; remove this new change record; preserve the accepted R3 AGM Rust changes and legacy documents.
