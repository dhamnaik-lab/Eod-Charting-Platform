# Pending Actions Compact Layout R1 RESUME2 — implementation

IST installation timestamp: 2026-09-20 00:37:39 +05:30

## RESUME1 validation-history note

The first Compact Layout R1 Windows validation stopped **before source installation** at the full Vitest gate. Evidence SHA256: `57B84CE11E524FC90C37719A597D8FE0799217A7F525D88FC4CE4812ED48E355`. The report contained 886 tests: 885 passed and exactly one failed. `officialWatchlistDataSplit.test.ts` could not execute `scripts/split-official-watchlist-data.mjs` because the isolated source-only sandbox omitted that build/test support script. RESUME1 leaves the production candidate and focused layout test byte-identical and adds only that pinned support file to the validation sandbox inventory.


## RESUME2 validation-history note

The RESUME1 Windows validation stopped **before source installation** at renderer TypeScript typecheck. Failure evidence SHA256: `971D7E3AF485C8B41ED7B43078E1397F7BC1BC496F41249CF4D9107D77D7F102`. Layout RED/GREEN, Corporate Actions + Identity (248/248), and full Vitest (886/886) had already passed.

The error was limited to declaration order in `DatabaseToolsDialogs.tsx`: `officialPendingGroupReasonStyle` spread `corporateIssueHintTextStyle` before the latter block-scoped constant declaration, causing TS2448/TS2454. RESUME2 moves the dependent style declaration below the shared hint style and adds one declaration-order regression assertion. Style values and Compact Layout behavior are unchanged.

## Objective

Reduce the normal Pending Actions progress/options footprint by rearranging the existing Official Imports Review controls into compact Actions / Filters / Status bands. Preserve FIX2 approval safety and every existing data-path decision.

## Previous limitation

The completed Pending Review state used a separate task-progress card, a large Review controls card, and a second footer status area. On the supplied 1920×1080 reference screenshot, the reviewed navigation-to-list control region was approximately 420 physical image pixels. Group reason summaries also occupied a narrow far-right cell despite unused horizontal space.

## Files changed

Protected source:
- Replaced `src/components/DatabaseToolsDialogs.tsx`.
- Added `src/features/corporateActions/__tests__/corporateActionPendingCompactLayout.test.ts`.

Documentation installed or preserved if already exact:
- `docs/superpowers/specs/2026-09-19-pending-actions-compact-layout-r1-approved-design.md`
- `docs/superpowers/plans/2026-09-19-pending-actions-compact-layout-r1-implementation-plan.md`
- `docs/superpowers/handoffs/pending-actions-compact-layout-r1/SOURCE-MAP.md`
- `docs/superpowers/handoffs/pending-actions-compact-layout-r1/VALIDATION-AND-HANDBACK.md`
- `docs/superpowers/handoffs/pending-actions-compact-layout-r1/DEFERRED-WORK.md`
- `docs/CURRENT_WORK_STATUS.md` prepended; prior content preserved.

## Final implementation

- Pending Review uses exactly three labelled compact presentation bands: Actions, Filters, Status.
- Existing Load & Prepare, Apply Selected, Apply All Ready, Review Queue and Approved entry points and disabled predicates are preserved.
- Existing native Symbol selector, type filters, Find setter and Current shortcut are preserved. Symbol/type/search changes retain their existing selection/confirmation clearing behavior.
- Existing Pending / Filtered / Ready / Selected counts are presented without new eligibility logic.
- The existing `OfficialImportTaskStatus` timer remains local. Compact presentation keeps current message, elapsed time, returned stage counts/unknown total and permitted safe cancellation visible; secondary explanation is under native Details.
- Only active task progress can override the shared status. An ended task cannot mask a newer exception/error/approval status.
- Pending Review no longer renders the separate upper progress card or duplicate lower footer status. Approved, Fetch and Historical Backfill retain their previous noncompact paths.
- Pending group reason text uses a dedicated local wrapping style and a real grid column rather than the prior 55% width restriction.

## Behavior preserved

The following pinned regions remained byte-equivalent before candidate installation: preparation/approved loading, eligibility/grouping, ordinary apply logic, reviewed request/confirmation, and shared filters/search. No Rust, database, schema, IPC, raw EOD, exact-ID recheck, reconciliation, exceptional approval, list-rendering, search algorithm, chart engine or dependency behavior is changed.

FIX2 Other = `OTHER + DEMERGER`, exact reviewed IDs, material fingerprints, generation/database fences, confirmation, non-ready selection safety, preparation cancellation and exception panels are preserved.

## Automated validation

Parent authority: 552 protected paths with live generated-build metadata captured as the sole generated exception.

Candidate authority: 553 protected paths (one replacement + one test addition).

- Genuine parent RED: 3 passed / 9 failed / 12 total (expected compact-layout assertions only, including declaration-order contract).
- Focused layout + preserved parent contracts: 40/40 passed.
- Corporate Actions + Identity regression: 249/249 passed.
- Full Vitest: 887/887 passed.
- Renderer TypeScript typecheck: exit 0.
- Renderer Vite build: exit 0.
- Post-install focused smoke: 40/40 passed.
- Protected source transition: 552 -> 553 (one replacement + one test addition).
- Native/Rust tests not rerun because no native source/contract changed; previous results remain historical evidence only.

Full command arguments, CWDs, timings, exit codes and reports are in the evidence archive.

## Manual status

**PENDING.** Automated validation does not establish WebView2 geometry, keyboard order, theme behavior or the >=50% screen-space target. A fresh portable/manual checkpoint follows independent evidence review.

Normal-state visual target at the supplied reference scale: controls <=200 physical screenshot pixels and >=50% reduction versus the reviewed ~420-pixel reference. Confirmation, error, exception and safety panels may exceed this height and must not be clipped.

## Risks / limitations

- This task intentionally does not improve list virtualization, preparation runtime, search complexity, CPU/GPU/memory behavior, or Rust warning hygiene.
- A source/AST test proves structure and bindings, not actual screen geometry or focus behavior.
- The native Symbol selector remains unchanged and can still be large.
- Runtime performance remediation remains a separate deferred work item.

## Rollback

Verified bounded pre-change backup: `E:\TA Projects\EOD Charting Platform\tmp\CA_PENDING_COMPACT_LAYOUT_R1_RESUME2_2026-09-20_003515_IST_cf05fda0_PRECHANGE_BACKUP.zip`

Backup SHA256: `B25EA261AD3157F82654B6B0EADE0FFFD63E0EAC5DF9E253F7F0E13825228B9D`

Close EOD Chart only when no data-changing operation is running. Restore the pre-R1 dialog and prior `docs/CURRENT_WORK_STATUS.md` from the backup. Remove only the newly added compact-layout test and documentation paths recorded as absent in the restore manifest. Retain this change record and evidence as historical material when possible. Verify the prior 552-path source authority while preserving the captured live generated metadata. Source rollback does not reverse any Corporate Action database approval.

## Evidence

Evidence archive: `E:\TA Projects\EOD Charting Platform\tmp\CA_PENDING_COMPACT_LAYOUT_R1_RESUME2_2026-09-20_003515_IST_cf05fda0_evidence.zip`

The archive SHA256 is printed by the runner after verified readback. No Git, user DB, network retrieval, portable build or source snapshot is performed by the automated installer.

## Actual Windows command evidence

- 01-layout-red: exit 1; 2 seconds. See 01-layout-red.log.
- 02-layout-focused-green: exit 0; 2 seconds. See 02-layout-focused-green.log.
- 03-ca-identity: exit 0; 7 seconds. See 03-ca-identity.log.
- 04-full-vitest: exit 0; 27 seconds. See 04-full-vitest.log.
- 05-renderer-typecheck: exit 0; 31 seconds. See 05-renderer-typecheck.log.
- 06-renderer-build: exit 0; 10 seconds. See 06-renderer-build.log.
- 08-post-install-focused: exit 0; 52 seconds. See 08-post-install-focused.log.
