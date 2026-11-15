# Corporate Actions diagnostic coverage and consistent readiness

14 November 2026, 19:01 IST. Implementation and regression preparation complete; validation **Pending**.

## Scope and evidence

The user supplied three captured reconciliation CSVs: 31 Split/Bonus, 23 Demerger and 495 Rights records. Their review established that 16 BSE Split/Bonus plus all 518 Rights/Demerger records were outside the old evaluator's NSE Split/Bonus scope. They were not evaluated for ordinary readiness. NIRMA and LMW also had READY_FOR_WRITER_RECHECK labels alongside blocking findings. The exports did not authorize approvals or establish fresh raw-price evidence.

This is the first implementation step toward self-service CA resolution: improve the read-only diagnostic report and explain next steps. It does not implement automatic official-term collection, financial repair or a new approval policy.

## Changes

- Diagnostic scope now covers NSE/BSE Split, Bonus, Rights, Dividend and Demerger. Other types/exchanges remain explicitly outside financial diagnostic scope, without assuming that they are informational or economically inapplicable.
- Split/Bonus diagnostics reuse the shared negative admission rules. Glued Bonus Deb1:1 terms now receive the existing debenture-policy reason. Existing conservative subtype checks are retained.
- A blocking finding prevents READY_FOR_WRITER_RECHECK and its corresponding outcome. Identity proof failures are explicit even when stored review status says PENDING. A separate Safe V2 ineligibility remains informational rather than automatically vetoing ordinary manual approval readiness.
- BSE identity diagnostics use a unique exact current BSE symbol/ISIN match. NSE chain suggestions are not reused for BSE. Missing, ambiguous, mismatched or inactive matches identify the need for official mapping/dated identity review. Numeric identifiers are retained. This does not implement historical BSE mapping or synthesize symbols.
- Rights report exactly which positive financial terms are missing. Positive stored ratio/issue price still require provenance, workflow and TERP checks; stale factors or MATCHED scans never certify authority.
- Dividend diagnostics distinguish missing cash from the required verified prepared scope. Demerger diagnostics distinguish absent/trivial factor from a stored factor whose authority this preview cannot certify. These findings do not change the existing financial writers or the Demerger inference mechanism.
- Stored scans are visible for all five types. Rights/Dividend observations are not tested as exact price-factor matches; their raw-price revalidation remains NOT_RUN and their financial workflow checks remain outstanding.
- The panel displays readiness explanations and each blocker's next operation. CSV/TXT exports add Readiness explanation and Next steps before Purpose, retaining the previous columns' positions except Purpose. Session acceptance and export reject contradictory Ready-plus-blocking results.

## Files modified

- `src-tauri-shell/src/database/corporate_action_imports/reconciliation_preflight.rs`
- `src-tauri-shell/src/database/corporate_action_imports/reconciliation_preflight/tests.rs`
- `src/features/corporateActions/reconciliation/CorporateActionReconciliationPanel.tsx`
- `src/features/corporateActions/reconciliation/corporateActionReconciliationPreflight.ts`
- `src/features/corporateActions/reconciliation/corporateActionReconciliationExport.ts`
- `src/features/corporateActions/__tests__/corporateActionReconciliationPanel.test.tsx`
- `src/features/corporateActions/__tests__/corporateActionReconciliationPreflight.test.ts`
- `src/features/corporateActions/__tests__/corporateActionReconciliationExport.test.ts`
- `HANDOFF.md`, `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`, `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`, and this new record.

Additional inspected owners: `corporate_action_imports.rs` (scan loading, identity suggestions and freshness), `split_bonus_terms.rs`, `identity_recheck.rs`, `bse_identity_mapping.rs`, `database.rs`/`eod_data.rs` (instrument shape and exact lookup), platform type exports, package scripts, shared Cargo wrapper and documentation-reference runner. Existing local work was preserved with focused edits; Git status/diff was not inspected under the user restriction.

## Preserved boundaries and limitations

No database schema changes, data writes, approvals, source acquisition, raw EOD reads or database access were performed by the agent. The endpoint retains its read-only connection, explicit IDs, 500-ID limit, transaction snapshot, fingerprinting and stale-session fences. No writer, approval UI, Fetch/Load operation, financial factor calculation or dependency was changed. No backups were created, modified or restored, per the user's restriction. No Git, build, test, packaging or validation commands were executed.

The diagnostic is intentionally conservative and not a duplicate of every final writer check. Complete Rights terms and stored Demerger factors do not become Ready from this snapshot. A BSE current match is not historical identity certification. Parser disagreement may still require evidence review even when an older stored factor/scan exists. The separate Safe V2 evaluator stays NSE Split/Bonus-only; this does not restrict BSE diagnostic coverage. Existing approved links are reported without changing their adjustments.

The new two-column export extension can affect consumers using a fixed Purpose column position; use headers. The RPC/schema name remains the existing V1 contract because its JSON shape is unchanged. Old exports are historical snapshots and must be regenerated after the user's rebuilt application is installed. Native performance and correctness on the supplied population remain unverified.

## Manual validation — all Pending

Run these commands serially in PowerShell 7. Stop on a failed command. They were checked against repository paths/parameters, not executed. The Rust filter may compile/link the Tauri test harness and reuses the shared root target. Do not use --ignored or create a separate target.

```powershell
Set-Location -LiteralPath 'E:\TA Projects\EOD Charting Platform'
.\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Preview -CargoAction test -CargoArguments @('database::corporate_action_imports::reconciliation_preflight::tests::', '--', '--nocapture')
.\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction test -CargoArguments @('database::corporate_action_imports::reconciliation_preflight::tests::', '--', '--nocapture')
& .\node_modules\.bin\vitest.cmd run src/features/corporateActions/__tests__/corporateActionReconciliationPreflight.test.ts src/features/corporateActions/__tests__/corporateActionReconciliationPanel.test.tsx src/features/corporateActions/__tests__/corporateActionReconciliationExport.test.ts
npm.cmd run typecheck:renderer
npm.cmd run build:renderer
pwsh -NoProfile -File .\scripts\check-doc-references.ps1
```

The renderer build regenerates theme tokens and writes dist through existing scripts. No portable/release build is included; the user owns that later step. The general validation runner is not used because it includes Git commands.

Prepared regressions cover BSE Split/Bonus readiness independent of Safe V2; numeric BSE IDs and missing mapping; classification/identity blockers overriding Ready; glued debentures; incomplete and complete Rights terms with stored MATCHED factors; dividend verified scope; absent/trivial/nontrivial Demerger factors; unchanged in-memory database fingerprints; session/export contradiction rejection; and visible/exported next steps. Existing read-only, canonical, ownership, escaping and accounting tests remain in place.

After checks pass and the user rebuilds, capture the same selected scopes again through Reconciliation / Export CSV-TXT. Confirm BSE and financial types show actual diagnostic findings rather than generic NSE-only exclusion, no Ready row has blocking findings, and both formats contain next steps. Preview/export must continue to report zero repairs and approvals. This is native acceptance, still **Pending**, not authorization to approve the rows.

## Rollback and next scope

Reverse only these diagnostic, test and documentation hunks after reviewing current files; preserve unrelated local work. No database rollback is required. Do not restore backups or reintroduce the unsafe Rights factor fallback. Resume with the manual checks above. Guided execution of identity/data/official-term resolution and a dedicated Demerger financial-authority review remain subsequent work; no per-record fix or approval is performed here.
