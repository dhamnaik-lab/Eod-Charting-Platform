# Handoff — immediate resume point

## Corporate Actions: NSE dividend wording and Later group (7 November 2026, IST)

- **Resume point:** Tasks A/B implementation and automated checks are complete on `feat/ca-nse-later-group-20261107`, based on merged PR #25 (`dedde3e`). Native acceptance awaits the user's portable rebuild: `npm run tauri:portable:win`.
- **Diagnosis (copy only):** `tmp/fixtures/ca-diagnosis-20261107/REPORT.md`, `rows.json`, and `query.sql`. The supplied database SHA-256 matches `COPY_SHA256.json`; SQLite URI `mode=ro` and `query_only=ON` were used. All 131 pending Split/Bonus rows were grouped with overlapping evidence retained. Primary NSE counts: inactive 61, non-equity 8, price mismatch 9, ISIN owner 3, no prices 1, other 2. BSE: numeric code 41, price mismatch 1, no prices 2, other 3. The supplied directory had no WAL/SHM sidecars at initial inspection. Stored scans are snapshot evidence, not fresh financial eligibility proof.
- **Paths:** `corporate_action_imports.rs` canonical dividend wording and exact-instrument read metadata; `informational_closure.rs` meeting spelling; `historical_isin_bootstrap.rs` fixture initialization; `database.rs`/`src/types/desktop.ts` optional metadata; renderer `corporateActionLater.ts`, classic model/workspace, type summary, `DatabaseToolsDialogs.tsx`, and focused tests. Existing unrelated work, including lower NSE index HANDOFF sections, stays unstaged.
- **Behavior:** attested glued dividend words and Interim spelling variants are normalized for parser/family detection only; `purpose_raw` is retained. Extra Oridinary General Meeting is informational. Later is a display/readiness category for Dividend/Rights/Demerger, capital reduction, income distribution, non-equity Split/Bonus and exact inactive instruments. It has no stored status, closure or approval write. Later has a classic Status filter and summary column; Issues counts only remaining blockers. Missing instrument metadata and BSE numeric codes alone do not imply Later.
- **Dividend R1:** the automatic Load & Validate pass filters Later rows before building its read-only verification scope. Manual prepared-scope APIs, financial checks and guarded writers remain unchanged. All existing Dividend safety tests passed, retaining this optimization. Explicit approval, raw .eod immutability, backend rechecks and advanced maintenance remain in place.
- **Backup:** `backups/pre_opencode_changes_20261107_140835_ca-nse-later-group` (14 existing files; separate array items, two new paths recorded as absent).
- **Checks:** renderer typecheck PASS; Vitest PASS 561/561 in 72 files, no tmp collection. Both shared-Cargo previews PASS. First focused compilation FAIL (edit-script encoding of an existing rupee literal); corrected retry PASS 6/6 (compile/link 1m 40s). Exact requested Rust filter run PASS: 816 passed, 0 failed, 26 ignored; existing Dividend safety tests unchanged and passing. Docs profile and scoped whitespace PASS. Logs retained beside the diagnosis. No portable/release build or staging.
- **Acceptance:** after the portable rebuild, run Load & Validate on a copy first. Confirm glued dividend rows move to Dividend/Later, the CROWN meeting closes informationally, inactive/non-equity rows appear under Later, Issues excludes Later, the summary reconciles, and automatic Dividend R1 no longer dominates the load. No live database or financial approval was performed here. BSE numeric-code continuity remains Phase 2c work.

## Corporate Actions step 1: more informational wording (7 November 2026, IST)

- **Resume point:** step 1 is done. The user rebuilds, runs Load & Validate, and reports the new "Other" Issues count (expected: 363 drops to about 250). Next is step 2: a read-only sort of the 131 blocked Split/Bonus rows (77 + 54). It needs a fresh database copy under `tmp/fixtures/`. **Runtime change, so a portable rebuild is needed:** `npm run tauri:portable:win`.
- **Change** (`informational_closure.rs` only): meeting spelling variants (`Extra- Ordinary`, `Extra Annual`, `Adjourned`, `Anuual`/`Anual`/`Annul`/`Aanual`, `Meeing`/`Meteing`); revised notes with `[ ]`, `/`, `DT`, `RECORD` and `RD changed to BC`; revised notes after notices (`Nil BC Dates Revised`); `/`-joined purposes only when every part is informational; new notices `Redemption`, `-`, `Election Of Directors`, `EGM-Election Of Directors`, `Buy Back-Tender Offer`, `Updation Of Records`, `Interest Payement`. Still blocked: glued dividends (`Annual General Meetingdividend - Rs ...`, `Interimdividend`), `AGM/ Dividend`, InvIT/REIT distributions, `Capital Reduction`, `Resolution Plan -Suspension`. The renderer wording list is unchanged; matching rows are closed before the queue loads.
- **Backup:** `backups/pre_opencode_changes_20261107_034403_ca-step1-other-wording` (3 files copied).
- **Checks:** the user ran them. Logs are in `tmp/run-step1-checks_20261107_034702/`. Rust preview **PASS**. Rust tests **PASS**: 813 passed, 0 failed, 26 ignored; 4 `informational_closure` tests ok. The block had no memory guard, at the user's request.
- **Runtime result (user, 7 Nov 04:15):** loaded pending rows fell from 15,206 to 15,123 (83 more closed). NSE "Other" Issues fell from 363 to 280. Still left: glued dividends (`Annual General Meetingdividend`, `Interimdividend`, `Specia Ldividend`), `Extra Oridinary General Meeting` (CROWN, a new spelling), `Capital Reduction`, and InvIT/REIT distributions. Load & Validate took 12 min 30 s, mostly the Dividend R1 check on 5,594 rows; its saved results were not reused because the closures changed the database.
- **PR #25 review fix (Codex P2):** `prepareCorporateActionPendingImports` now decides on re-enumeration from the refreshed rows: it reloads when a row became SPLIT/BONUS or is a combined announcement. `hasCombinedSplitBonusAnnouncement` also reads `Spl`/`Splt`/`Bon`. So a companion created from a reclassified `OTHER` row joins matching and validation in the same run. Test: `pr25 reloads the queue when an OTHER row is reclassified...`. Backup: `backups/pre_opencode_changes_20261107_115555_ca-pr25-reenumerate`. Checks (user, `tmp/run-pr25-fix-checks_20261107_121349/`): typecheck **PASS**, vitest **PASS** 538. The first run failed (an OTHER->DIVIDEND change also triggered a reload); it was fixed by limiting the reload to SPLIT/BONUS.
- **PR #25 second review (Codex P2 x2):** `canonical_purpose` keeps the `/-` currency suffix together, so `Bonus 1:1 / Fv Splt Frm Rs 10/- Per Share To Rs 5/- Per Share` gives 2 components. `split_isin_price_proof::evaluate` now also requires `price_validation_freshness::ensure_scan_uses_current_price_window` (a changed or deleted bar removes the proof). The test server in `bse_action_transport_*` sets accepted sockets to blocking (fixes an intermittent Windows `WouldBlock` 10035). Tests: `pr25_split_isin_price_proof_rejects_prices_changed_after_scan` and a new case in `ca_phase2b_legacy_split_bonus_abbreviation_becomes_two_components`. Backup: `backups/pre_opencode_changes_20261107_123856_ca-pr25-review2`. Checks (user, `tmp/run-pr25-review2-checks_20261107_130815/`): Rust **PASS** 814 passed, 0 failed. Run test blocks with `pwsh -File`, because a pasted block keeps going after a `throw`.
- **Next (agreed order):** step 2, a read-only sort of the blocked Split/Bonus rows (needs a fresh DB copy in `tmp/fixtures/ca-diagnosis-20261107/`). Step 3: a Later group for Dividend/Rights/Demerger/delisted/non-equity, glued dividends moved to Dividend, the CROWN spelling, and skipping Later rows in the Dividend check. Then the CA window redesign, then BSE (Phase 2c).

## Corporate Actions Phase 3: informational notices closed once (7 November 2026, IST)

- **Resume point:** Phase 3 is done (backend close step and pending-queue exclusion). Next: the user rebuilds, copies the database, runs Load & Validate, and reports the "Informational notices closed" count (expected about 15,437). After that comes the Phase 2c design (BSE code-to-ticker link). Still open for Phase 4: a Closed list with a Reopen button on screen, and removing the renderer copy of the wording list. **Runtime change, so a portable rebuild is needed:** `npm run tauri:portable:win`.
- **New module** `src-tauri-shell/src/database/corporate_action_imports/informational_closure.rs`: `sync_corporate_action_informational_closures` sets `review_status = 'CLOSED_INFORMATIONAL'` on `OTHER` rows that are not approved, have no ratio/factor/cash/face-value fields, and whose whole purpose matches the informational wording (a Rust port of the renderer regexes). It writes each change to the new table `corporate_action_import_closures` (CLOSE, REOPEN_AUTO, REOPEN_MANUAL; previous status and message). The table is created lazily inside the write transaction. A closed row that no longer qualifies reopens itself and gets its previous status back. `reopen_corporate_action_informational_closure` (no UI yet) reopens one row, and the reopen sticks. `purpose_raw`, prices and `corporate_actions` are never touched.
- **Wiring:** `list_import_rows` with `exclude_approved` now leaves out `CLOSED_INFORMATIONAL` rows as well. `prepareCorporateActionPendingImports` (explicit-approval path only) calls the close step before loading the queue and adds "Informational notices closed: N" to the status message. The commands are registered in `database.rs` and `main.rs`, the API in `src/types/desktop.ts`, `src/platform/types.ts` and `src/platform/tauriDesktop.ts`.
- **Rollback note:** if the code is reverted, closed rows reappear in the pending list with status `CLOSED_INFORMATIONAL`, and the old renderer still labels them Informational. The database copy taken before the first run is the full undo.
- **Tests:** 4 `ca_phase3_*` Rust tests and 1 vitest case in `corporateActionPendingPreparation.test.ts`.
- **Backup:** `backups/pre_opencode_changes_20261107_022348_ca-phase3-informational-closure`. The script copied 0 files (comma-joined `-Paths`), so the copies were rebuilt by reversing each edit; see `RECONSTRUCTED.txt` there. Pass `-Paths` as separate arguments next time.
- **Checks:** the user ran them. Logs are in `tmp/run-3-checks_20261107_023014/`. `typecheck:renderer` **PASS**. Vitest `--dir src src/features/corporateActions` **PASS**: 71 files, 537 tests. Rust preview **PASS**. Rust tests **PASS**: 813 passed, 0 failed, 26 ignored. `git diff --check` **PASS**. The block's memory guard threw at 2.5 GB, but the session continued and the Rust tests passed anyway. The user asked to drop the memory guard from future test blocks.
- **Acceptance:** after the rebuild, copy the database, then run Load & Validate. The status shows about 15,437 closed, and the Informational count in "Pending actions by type" drops to about 0.

## Corporate Actions Phase 2b: legacy NSE abbreviations and informational notices (7 November 2026, IST)

- **Resume point:** Phase 2b is done. Next is Phase 2c: link each BSE numeric security-code symbol (for example `500143`) to its ticker (for example `PHCAP`). Show the user the 2c design before coding it. Non-equity Split/Bonus terms (debentures, preference shares, NCRPS, DVR) stay blocked by `split_bonus_terms::blocker`. They are planned for the Phase 3 "Later" group, not for automatic closing. **Runtime change, so a portable rebuild is needed:** `npm run tauri:portable:win`.
- **Finding:** 33 NSE `OTHER`/`UNSUPPORTED` rows were real splits written in short form, and none were in `corporate_actions`. Examples: `Fv Splt Frm Rs 10 To Re 1` (JSWSTEEL 2017-01-04) and `Fv Spl-Rs10tore1/Bon-1:1` (VEDL 2008-08-08).
- **Parser change** (`corporate_action_imports.rs`): `canonical_purpose` expands only these shapes: `FV` followed by `SPL`/`SPLT` becomes Split, and `BON` with an `a:b` ratio becomes Bonus; `FRM`, `TORS` and `TORE` are expanded only inside those strings. All other text is returned unchanged. `expand_legacy_abbreviations` does the same in normalized text for `detected_corporate_action_families` and `compound_action_primary_type`. That covers approval-time `ensure_components_prepared`, preflight, repair preview and dividend evidence. `parse_corporate_action_purpose` and `split_bonus_preparation::components` parse the canonical text. `purpose_raw` is never rewritten. `Spl Div` and `Bon 1 Dvr : 20` are unaffected.
- **Refresh:** `refresh_classifications` runs a second pass on rows that moved from `OTHER` to SPLIT/BONUS, so combined Split + Bonus components are prepared in the same Load & Validate.
- **Informational** (`corporateActionAnnouncementClassification.ts`): the whole purpose must match AGM/EGM/EOGM (with optional ordinal and "... revised" notes), annual (book) closure, interest payment, e-voting, Nil or share buyback, and carry no financial fields. AGM + dividend and "Buyback Of Bonds" stay blocked.
- **Tests:** 3 `ca_phase2b_*` Rust tests and 1 new vitest case in `corporateActionAllTypeReadinessSummary.test.ts`.
- **Backup:** `backups/pre_opencode_changes_20261107_005832_ca-phase2b-legacy-terms`.
- **Checks:** the user ran them. Logs are in `tmp/run-2b-checks_20261107_010213/`. `typecheck:renderer` **PASS**. Vitest `--dir src src/features/corporateActions` **PASS**: 71 files, 536 tests. Rust preview **PASS**. Rust tests **PASS**: 808 passed, 0 failed, 26 ignored. `git diff --check` **PASS**.
- **Acceptance:** after the rebuild, run Load & Validate. The abbreviated splits appear as Split, or Split + Bonus, and become Ready when identity and price checks pass. Informational rises from 13,504 by roughly 1,700.
- **Runtime result (user, 7 Nov 01:38):** Informational 15,437; Other blocked 363. 17 of the 33 hidden splits had an unchanged ISIN and were approved. 14 had an ISIN that changed on the split day and stayed blocked as `PENDING_ISIN_MISMATCH`.
- **Follow-up fix:** `split_isin_price_proof::evaluate` now accepts `PENDING_ISIN_MISMATCH` as well as `UNRESOLVED`. Every other check is unchanged. Test: `ca_phase2a_split_isin_price_proof_accepts_pending_isin_mismatch_status`. Backup: `backups/pre_opencode_changes_20261107_020113_ca-phase2a-isin-mismatch-status`. The user ran the checks; logs are in `tmp/run-2a-fix-checks_20261107_020245/`. Rust **PASS**: 809 passed, 0 failed. Still blocked by design: CGCL 2016 (the old ISIN is also on MMFSL) and ASHCO 2009 (different issuer). A portable rebuild is needed.

## Corporate Actions Phase 2a: split ISIN price proof (6 November 2026, IST)

- **Resume point:** superseded by Phase 2b above. **Runtime change, so a portable rebuild is needed:** `npm run tauri:portable:win`.
- **Goal (user-approved plan):** after Load & Validate, the Split, Bonus and identity rows for current symbols are all Ready. Dividend, Rights and delisted symbols are deferred. Approval stays an explicit user action.
- **Phase 1 diagnosis:** read-only, on the copy `tmp/fixtures/ca-blocked-diagnosis_20261106_194353/` (its SHA-256 values are in `COPY_SHA256.json`). There were 161 unapproved Split/Bonus rows: 101 on current symbols and 60 on delisted or old symbols.
  - ~42 BSE rows matched a numeric security-code instrument (for example `500143`) whose `.eod` file holds only the older history. Newer history is under the ticker (for example `PHCAP`). The database has 12,816 numeric BSE instruments, and 4,237 of them have a ticker twin with the same `bse_security_code`. This is Phase 2c.
  - 45 NSE rows are a Split, or a same-day Bonus + Split, where the event itself changed the ISIN. 40 of them have a MATCHED local price scan. This is Phase 2a.
  - ~9 rows are non-equity (bonus debentures, preference shares, NCRPS). This is Phase 2b.
- **Rule change (user-approved):** new proof `VERIFIED_SPLIT_ISIN_PRICE_PROOF` in `src-tauri-shell/src/database/corporate_action_imports/split_isin_price_proof.rs`, wired into `strict_quick_resolve_proof`. It needs all of these: the same active symbol; a Split, or a Bonus whose terms include a split; no non-equity terms; the same first 9 ISIN characters with equity code `01`; no other owner of the old ISIN in `instruments` or `instrument_isin_history`; and a current MATCHED Split/Bonus price validation. A shared issuer prefix alone is still rejected (`identity_recheck_rejects_prefix_and_forged_suggestion_flag` is unchanged). `identity_recheck.rs` lists the decision, so the proof is re-verified on every load and before every approval. Auto-approval does not accept it.
- **Known follow-up:** the resolution-hint message for this proof falls through to the generic "exact event-date historical ISIN evidence" wording (`build_resolution_hint_for_import_row`). This is cosmetic.
- **Tests:** 6 new `ca_phase2a_split_isin_price_proof_*` tests.
- **Backup:** `backups/pre_opencode_changes_20261106_200015_ca-phase2a-split-isin-proof`.
- **Checks:** the user ran them. Logs are in `tmp/run-2a-checks_20261106_210734/`. Shared-runner Rust preview **PASS**. Rust tests **PASS**: 805 passed, 0 failed, 26 ignored. `git diff --check` **PASS**.
- **Acceptance:** after the rebuild, run Load & Validate. About 40 NSE Split or Bonus + Split rows (for example TECHM 2015, ASHOKA 2013) should become Ready.

## Corporate Actions Run C: L5, L1 parser, UI tests (6 November 2026, IST)

- **Resume point:** superseded by Phase 2a above. Run D, audit fix H1 (revoke an approval), is still open. **Runtime change, so a portable rebuild is needed:** `npm run tauri:portable:win`.
- **Changes:**
  - L5: the Issues-tab row button is now Quick Resolve or View only. The direct single-row Approve, which skipped the confirmation step, and its unused `approveOfficialImport` handler are removed (`src/components/DatabaseToolsDialogs.tsx`). Normal approval stays in the Review tab with its two-step confirmation.
  - L1, parser only: `parse_corporate_action_purpose` no longer guesses a Demerger factor. New Demerger rows are `NEEDS_REVIEW` with no factor or price factor. Any stated ratio is kept for display (`src-tauri-shell/src/database/corporate_action_imports.rs`). The chart reader in `eod_data.rs` is unchanged, so any existing Demerger rows behave as before.
  - UI tests: `corporateActionPendingCompactLayout.test.ts` normalizes CRLF. `corporateActionIdentityHistoricalReviewedAtomicApply.test.ts` drops its check for `upsert_security_master_rows_in_open_transaction`, which `d7f8c79` removed.
- **Not done, by decision:** M2, because accepted Phase 5A tests keep normal approval outside the price-store lock. A Rights price recheck is the proposed alternative. L6, because the unused auto-approve code is off by default and 9 test files use it. The L1 chart-reader change, because old Demerger rows could change charts.
- **Test:** `ca_l1_demerger_parse_never_guesses_a_price_factor`.
- **Backup:** `backups/pre_opencode_changes_20261106_174915_ca-run-c-l5-l1-uitests`. A failed first attempt left `backups/pre_opencode_changes_20261106_174857_ca-run-c-l5-l1-uitests` with a manifest and 0 files. It was left in place.
- **Checks:** the user ran them. Logs are in `tmp/run-c-checks_20261106_181500/`.
  - `typecheck:renderer` **PASS**.
  - `vitest run --dir src src/features/corporateActions` **PASS**: 71 files, 535 tests.
  - Shared-runner Rust preview **PASS**. Rust tests **PASS**: 799 passed, 0 failed, 26 ignored.
  - `git diff --check` **PASS**.
- **Note:** run vitest with `--dir src`. Without it, vitest also collects old source copies under `tmp/` and runs out of memory.
- **Acceptance:** after the rebuild, open Corporate Actions, then Issues. Rows that are not Unresolved show a disabled View button, not Approve.

## Corporate Actions M1: manual Bonus face value — 6 November 2026 (IST)

- **Resume point:** M1 is fixed. The next step is in the Run C section above. **Runtime change, so a portable rebuild is needed:** `npm run tauri:portable:win`.
- **Defect:** a manual Bonus with face values saved `old/new` as its factor. A ratio of 1:1 with FV 10→1 saved 10, while the dialog showed 2.
- **Fix:**
  - `compute_adjustment_factor` uses face values for SPLIT only and rejects a BONUS that carries face values (`src-tauri-shell/src/database/instrument_mutations.rs`).
  - The Corporate Action dialog shows the FV fields only for Split and sends FV only for Split (`src/components/DatabaseToolsDialogs.tsx`).
  - Official imports are unaffected: their Bonus rows never carry face values.
- **Test:** `ca_m1_bonus_factor_uses_ratio_and_rejects_face_values`.
- **Backup:** `backups/pre_opencode_changes_20261106_165004_ca-m1-bonus-face-value`.
- **Checks:**
  - Targeted shared-runner Rust tests **PASS**: 798 passed, 0 failed, 26 ignored.
  - `typecheck:renderer` **PASS**.
  - Corporate Actions vitest: 532 of 535 pass. The same 3 source-text failures as before remain.
  - `git diff --check` **PASS**.
- **Acceptance:** after the rebuild, check manually. Choose BONUS: the FV fields are hidden, and ratio 1:1 saves factor 2. Choose SPLIT: FV 10→2 saves factor 5.

## Corporate Actions Rust test repair — 6 November 2026 (IST)

- **Result:** the Corporate Actions Rust tests pass on the working tree: 797 passed, 0 failed, 26 ignored.
- **Scope:** only test fixtures and test assertions were changed. Product code is unchanged, so no portable rebuild is needed.
  - Group C (8 tests): the fixtures now hold the local price bars, the scan prices and the `instruments.sector`/`industry` columns that newer approval gates need.
  - Group A (10 tests): source-text and fixture-hash tests now normalize CRLF to LF.
  - Group B (1 test): `v114y` now checks the batched hydration loop in its current location, `corporateActionImportOperations.ts`.
- **Paths:** `corporate_action_imports.rs`, `corporate_action_imports/{auto_approval.rs, auto_approval/write_stage_tests.rs, reconciliation_preflight/tests.rs, simple_cash_dividend_transaction_owner_tests.rs, simple_cash_dividend_write_stage_bridge_tests.rs, v114y_tests.rs}` and `nse_identity_imports.rs`, all under `src-tauri-shell/src/database/`.
- **Backup:** `backups/pre_opencode_changes_20261106_163146_ca-rust-test-fixtures`.
- **Checks:** `Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction test` with filters `corporate_action instrument_mutations eod_data bse_identity nse_identity identity_evidence_resolver price_store_operation_lock`. **PASS**. `git diff --check` **PASS**. Repo-wide `cargo fmt --check` still fails, as it did before this work. Logs and the audit report are in `tmp/audit-evidence/ca-deep-audit-20261106_1420/`.
- **Open:** 3 renderer source-text tests failed (2 CRLF, 1 stale helper name). Run C fixed them. The UX13 duplicate Cargo target is parked at `E:\TA Projects\_UX13_cargo_parking` (see `RESTORE.txt`). Moving it back into `tmp` blocks the shared Cargo runner.

## Documentation closure and synchronized main — 6 November 2026 (IST)

- Resume from synchronized main `09d20595bdc2ccbb6f11320fea3caf32c606c940`. The [sync record](docs/changes/2026-11-06_MAIN_SYNCHRONIZATION.md) owns the historical 67-entry baseline and recovery references. Preserve those local workstreams when reviewing or publishing the documentation.
- [UX-13](docs/changes/2026-11-06_UX13_BHAVCOPY_REQUEST_STOP.md) has local portable observations. Exact-merged-tree portable acceptance and independent database integrity remain open. The [UI/UX index](FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md#uiux-audit-findings) lists the other findings and pending native checks.
- This documentation pass reviewed historical logs and used documentation-only validation. See `backups/pre_opencode_changes_20261106_011734_doc-closure` for pre-edit docs and the timestamped documentation closure evidence under `tmp/`. The next workstream awaits user direction.


## First action on the live checkout

**Do not apply these files to an unverified checkout.** Verify that the intended live root contains the authoritative [AGENTS.md](AGENTS.md); compare it and the relevant current source against the [snapshot audit baseline](PROJECT_STATE_EOD_CHARTING_PLATFORM.md#snapshot-authority). This ZIP was captured from a working tree **without Git metadata**, so no commit/revision equivalence was established. If the live tree has changed, reconcile source-backed statements before copying documents.

Copy exactly these eight root Markdown outputs together: [README](README.md), [Requirements](REQUIREMENTS.md), [Architecture](ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md), [Feature status](FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md), [Inventory](FILE_INVENTORY.md), [Project state](PROJECT_STATE_EOD_CHARTING_PLATFORM.md), [Handoff](HANDOFF.md), [Phase tracker](NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md). Preserve `AGENTS.md` unmodified. Do not copy the extracted snapshot or replace application code.

## Blocking/mandatory checks after copy

1. On the live Windows repository, use the existing [documentation validation script](scripts/validate-change.ps1) with `-Profile docs`. It calls [check-doc-references.ps1](scripts/check-doc-references.ps1) and a Git-based whitespace check, so it requires the relevant shell and Git worktree metadata. Run it serially; record the actual output and exit status.
2. Address any source/contract inconsistency **as a separate bounded issue**, starting with the exact worker-cap mismatch in [audit findings](PROJECT_STATE_EOD_CHARTING_PLATFORM.md#unresolved-findings). Do not alter Rust implementation while installing documentation.
3. Obtain explicit user phase confirmations before assigning running/completed/next statuses in the [phase tracker](NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md). Neither this snapshot nor embedded tests supplies release acceptance.

## Navigation for resuming work

- [Architecture](ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md) for runtime data flow and storage; [Inventory](FILE_INVENTORY.md) for exact source entry points.
- [Requirements](REQUIREMENTS.md) for binding behavior; [Feature matrix](FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md) for implementation/test-source coverage and remaining acceptance.
- [Project state](PROJECT_STATE_EOD_CHARTING_PLATFORM.md) for dated findings and checks; [Phase tracker](NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md) for phase status only.

**Current documentation-only task:** source reconstruction prepared from the supplied ZIP. Native Git/PowerShell validation and reconciliation with the live checkout are **pending**, not reported as passed. No feature rollout, phase acceptance, Git operation, runtime database operation or portable build was performed.
