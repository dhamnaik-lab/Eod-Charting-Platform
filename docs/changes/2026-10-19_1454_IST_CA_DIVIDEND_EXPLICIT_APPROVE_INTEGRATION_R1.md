# CA Dividend Explicit Approve Integration R1 — Candidate

**IST timestamp:** 2026-10-19 1454 IST  
**Workstream:** EOD Charting Platform — `E:\TA Projects\EOD Charting Platform`  
**Status:** SOURCE CANDIDATE ONLY; native Windows validation and user acceptance PENDING.  
**Source authority:** 2026-10-19 11:30:09 IST source snapshot (SHA256 `6DFF97E3705A00323FE4ACCF7B84520446D4B68C87E3A71CE4B1F7849F307E8B`).

## Objective
Connect the existing simple-cash-dividend prepared-scope policy and Rust write-stage transaction owner to the **existing explicit Approve confirmation**, without performing any financial write from Fetch or Load & Validate.

## Previous limitation
A typed Rust write-stage and independently evaluated dividend prepared scope already existed, but the frontend activation flag was permanently disabled, the normal readiness predicate expected Split/Bonus-style price scans (which do not scan dividends), and the confirmation only called legacy Split/Bonus approval. The dividend policy also used previous-close evidence without a separately required post-ex local EOD bar.

## Files changed
- `src/components/DatabaseToolsDialogs.tsx` — only verified P3C-eligible ordinary Dividends become ready; existing Approve Selected / Approve All Ready selection creates exact batch drafts but **does not dispatch any write**; a separate Confirm apply click dispatches guarded 100-ID Rust batches, checks typed receipts, rejects stale scope/ambiguous response, and refreshes affected chart/database views. Existing Split/Bonus recheck/apply preserved.
- `src/features/corporateActions/legacy/corporateActionDividendWriteStageOrchestration.ts` — narrow activation flag true for explicit-Approve-only path, reuse strict fingerprint/receipt checks.
- `src-tauri-shell/src/database/corporate_action_imports/auto_approval.rs` — preserve previous local close calculation, also require valid on/after-ex local EOD close within seven days and no future ex-date; add in-memory regression test.
- `src-tauri-shell/src/database/corporate_action_imports.rs` — emit same database-changed/cache invalidation event as other accepted auto-approval commands **after successful committed dividend write**.
- `src/features/corporateActions/__tests__/corporateActionDividendWriteStageOrchestration.test.ts` — update old inert activation assertion to explicit-confirmation contract.
- `src/features/corporateActions/__tests__/corporateActionThreeActionCompletionR1.test.ts` — preserve 3-step flow but allow guarded Dividend writer after approval.
- `src/features/corporateActions/__tests__/corporateActionDividendWriteStageTauriBridge.test.ts` — preserve one public typed command; allow only approved active-dialog caller.
- `src/features/corporateActions/__tests__/corporateActionDividendExplicitApprovalR1.test.ts` — new focused explicit-only safety and wiring assertions.
- This change document.

## Behaviour preserved
Current UI design, existing non-Dividend approval paths, official fetch, historical matching, plugin P5, other corporate-action types, raw `.eod` files, adjustment math, schema, and original approval records. Historical and insufficient-evidence dividends still fail closed. No Load-time financial approval.

## Constraints and risks
- Dividend writer response calls post-confirm results `AUTO_APPROVED`; this is a backend disposition **only after the user explicitly confirms**.
- The one transaction boundary is each 1–100 ID batch. A multi-batch Approve All Ready may partially commit if a later batch fails: surface receipt counts and **never auto-retry ambiguous responses**.
- The existing strict Dividend R1 policy is limited to simple NSE cash dividends, exact persisted official receipt, machine identity proof, local previous-close factor, local ex-date EOD window, no same-date excluded peer and no canonical duplicate. Unsupported dividends remain blocked; no inference that the 8,694 PENDING dividends are eligible.
- Source code is prepared and syntax checked here. Cargo, Rustfmt, repository Vitest/typecheck and Windows Tauri release **not runnable in this container**. One guarded Windows runner must record actual outputs before any release can be declared validated.

## Validation commands and results
- October 19 ZIP sha256 and full Zip integrity: PASS (container).
- TypeScript parser (TypeScript global compiler) on changed TS/TSX: PASS (container).
- Static source/manifest scope checks: pending final package verification.
- Windows focused Vitest and Rust tests, TypeScript typecheck, Cargo check, Tauri release + portable integrity: **PENDING**.
- Manual acceptance: **PENDING**; one final test after native PASS.

## Rollback
Close EOD Chart; restore exact pre-apply files from the runner's dated, external `EOD Charting Platform Source Audit` backup using their manifest SHA256; remove newly added test and this document if rollback is requested. Do not manipulate SQLite WAL, EOD prices, approved records, or DB files.

## Next step
Run the single hash-guarded Windows validation/build runner; inspect actual failures before accepting. Once passed, one final portable test measuring verified dividend Ready/Blocked counts and explicit approval receipt (with prior DB backup and deliberate user confirmation only).
