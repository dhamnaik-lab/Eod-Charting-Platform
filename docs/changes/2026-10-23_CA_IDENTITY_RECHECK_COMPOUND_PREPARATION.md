# CA identity proof recheck and pending Split/Bonus preparation

Pre-edit backup: `backups/pre_opencode_changes_20261023_152210_ca_identity_proof_recheck`.

## Result

The old suggestion code treated a common nine-character ISIN issuer prefix as exact event-date history. That could produce a machine-resolution decision without the claimed proof. Suggestions now use actual, unambiguous dated history; the strict resolver recomputes proof from storage instead of trusting the suggestion flag. Identity-chain fallback retains the imported ISIN and preserves a mismatch instead of replacing it with the current ISIN.

Load & Validate rechecks earlier machine resolutions. Unsubstantiated pending matches become `UNRESOLVED` with an audit decision and an app-owned evidence message. Ordinary approval independently rechecks these claims. Approved imports and protected manual decisions are preserved. Multiple historical transition events make the affected row unavailable; they no longer abort the whole preparation batch. Storage errors and tampered authority fingerprints still fail closed.

An inactive instrument can be a historical target when exactly one candidate has independent identity proof. This supports exact event-date history and the existing verified pre-transition Split evidence, extended to Split/Bonus events. It does not reactivate instruments, invent ISIN history, or relax Dividend R1's separate eligibility policy.

Explicit, ordinary Split + Bonus announcements now prepare both pending components. They retain the full original purpose and source captures, deduplicate existing components, use the existing combined-factor scan context, and require fresh readiness checks and explicit approval. Ambiguous, unsupported, or source-less announcements remain unavailable. Component preparation is metadata only; it creates no canonical adjustment. The frontend reloads the complete pending queue before matching/scanning so new companions are included.

Normal status labels now describe missing identity evidence, price verification, and percentage-dividend cash/face-value evidence. Manual identity/price exception tools remain under a collapsed Advanced control. Source explanations appear in the status column. Desktop appearance still needs an operator check.

## Files changed

- `src-tauri-shell/src/database/corporate_action_imports.rs`: strict proof, hints, raw-ISIN retention, approval guards, regression coverage.
- `corporate_action_imports/identity_recheck.rs`: pending machine-claim revalidation and tests.
- `corporate_action_imports/split_bonus_preparation.rs`: component preparation and approval completeness guard.
- `corporate_action_imports/classification_refresh.rs` and `historical_isin_transition.rs`: integration, protected provenance, component/audit tests, historical target eligibility.
- `src/features/corporateActions/legacy/corporateActionAnnouncementClassification.ts` and `corporateActionImportOperations.ts`: preparation selection, historical hints, complete component reload.
- `src/features/corporateActions/corporateActionBulkApproval.ts`, `src/components/DatabaseToolsDialogs.tsx`, and two focused frontend test files: status explanations and advanced maintenance placement.

## Validation and copied-data evidence

- PASS: 35 focused Rust tests across identity rechecks, classification/component preparation, historical transitions, strict resolver safeguards, identity chains, persisted authority/fingerprint checks, and Dividend prefix rejection.
- PASS: 56 frontend tests in PendingPreparation, OfficialImportsFix2, AllTypeReadinessSummary, and NormalWorkflowAdapter. Command: `npx vitest run --exclude 'tmp/**'` followed by those four exact test paths.
- PASS: renderer typecheck using `scripts/validate-change.ps1 -Profile renderer`; scoped whitespace checks.
- PASS: `cargo test --manifest-path src-tauri-shell/Cargo.toml classification_refresh_disposable_data_audit -- --ignored --nocapture` with `CA_CLASSIFICATION_AUDIT_ROOT` pointing to the marked final disposable folder below.

Final audit artifacts: `tmp/ca-identity-preparation-20261023-1535-final/classification-results.json` and `preparation-audit.log`. The original database was opened read-only for an online SQLite backup. Initialization precedes temporary audit-table/trigger setup because SQLite `temp_store` configuration clears temporary objects. All seven financial/approval guard triggers were verified present before preparation. Earlier failed runs and logs were retained separately; the final run passed.

The copied snapshot checked **11,502 rows**, created **27 pending components**, and downgraded **5,408 unsubstantiated machine resolutions**. This is a lack-of-current-proof result, not a claim that all those security identities are wrong. Canonical actions, approved mappings, prices, and every original official-source capture remained unchanged. Added companion captures preserve the original payload and capture time.

The debug timed preparation/audit segment was **117.59 seconds**; total test execution was **121.61 seconds**, excluding compilation. This is not full Load & Validate timing or a controlled portable-build speed comparison. Pending metadata counts are not Ready counts.

The copied preparation produced ASHOKA 2013 and AVANTIFEED 2018 component factors `1.5 × 2 = 3`, and BAJFINANCE 2016 factors `2 × 5 = 10`. ASHOKA and AVANTIFEED still lack independently verified historical identity; BAJFINANCE remained pending. Fresh price checks and the full readiness workflow were not executed in this SQL-only audit.

## Remaining acceptance

Rebuild the portable app and check Fetch → Load & Validate, updated evidence messages, readiness counts, and complete elapsed time. Missing/ambiguous official identity history and witness data remain app evidence-collection/reconciliation work; the user should not have to choose an identity. No row is forced Ready to eliminate blockers. BSE HTTP 403 and controlled explicit approval/chart-refresh acceptance remain separate unfinished work.

No active-database writes, raw `.eod` writes, financial approvals, portable build, commits, or pushes were performed in this task. Existing unrelated worktree changes were preserved.
