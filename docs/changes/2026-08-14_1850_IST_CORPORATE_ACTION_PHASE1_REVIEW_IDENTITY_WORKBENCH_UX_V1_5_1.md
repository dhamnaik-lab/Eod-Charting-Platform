# Corporate Action Phase 1 — Review Identity Workbench UX V1.5.1

**IST timestamp:** 2026-08-14 18:50 IST  
**Project:** `E:\TA Projects\EOD Charting Platform`  
**Basis:** Corporate Action Phase 1 V1.4 applied state; V1.5 package attempted but failed before source modification

## Objective

Apply the already-reviewed V1.5 Review Identity workbench UX correction using a robust, byte-preserving source patcher after the original V1.5 apply mechanism produced a false guard failure.

## Previous defect / limitation

The original V1.5 package successfully verified that the live `DatabaseToolsDialogs.tsx` contained the exact audited V1.4-compatible Review Identity blocks, then failed at the apply step with:

```text
[PASS] V1.4-compatible Review Identity blocks verified.
Render block changed between compatibility check and apply.
```

No production source was modified. The apply script had already created a backup directory, but the report copy and source write occurred only after the failing patch step.

Root cause: the compatibility check searched the normalized exact block, while the apply step re-derived a larger marker-bounded raw slice and hashed that larger slice. Surrounding newline/whitespace bytes could make the second hash differ even though the exact audited block was unchanged.

## Files changed by V1.5.1

### Modified surgically when applied

- `src\components\DatabaseToolsDialogs.tsx`

### Created

- `docs\changes\2026-08-14_1850_IST_CORPORATE_ACTION_PHASE1_REVIEW_IDENTITY_WORKBENCH_UX_V1_5_1.md`

## Final implementation

The intended V1.5 UI changes are unchanged:

- stable visible Suggested Matches area;
- stable visible Manual Search Results area;
- side-by-side Official Corporate Action vs Current Database Candidate identity details;
- explicit exchange/symbol/ISIN comparison;
- native Source Evidence hover tooltip removed;
- evidence moved to deliberate expandable details;
- clearer identity action labels;
- scrollable resolver body with visible action bar;
- no backend identity logic or safety rule changes.

### V1.5.1 patcher correction

The patcher now:

1. verifies the exact normalized old render/style blocks and their package hashes;
2. maps normalized block offsets back to raw source offsets;
3. replaces only those exact raw ranges;
4. preserves unrelated source bytes, including mixed CRLF/LF line endings;
5. verifies the V1.5 markers after writing;
6. is idempotent if the V1.5 blocks are already present.

## Behavior deliberately preserved

- all Rust identity resolution and candidate ranking;
- ISIN mismatch safeguards and event-date evidence rules;
- mandatory Decision Reason and audit trail;
- Split/Bonus price validation and approval gating;
- V1.4 Approve All Ready and <=100 backend batching;
- Corporate Action adjustment mathematics;
- raw EOD data;
- Rights/Dividend/Demerger behavior;
- repair-preview behavior.

## Packaging validation

Performed before handoff:

- Node syntax check of the corrected patcher: **PASS**;
- mixed CRLF/LF fixture compatibility check: **PASS**;
- mixed CRLF/LF exact-block apply: **PASS**;
- post-apply V1.5 source verification: **PASS**;
- idempotency/already-applied check: **PASS**.

No live-project Vitest/typecheck/build/Tauri result is claimed by the packaging environment.

## Required project validation

```powershell
npx vitest run `
  src/features/corporateActions/__tests__/corporateActionBulkApproval.test.ts `
  src/features/corporateActions/__tests__/corporateActionValidation.test.ts

npm run typecheck:renderer
npm run build:renderer
npm run tauri:check
```

## Manual acceptance after rebuild

Open a known ISIN-review row such as `NSE:TEMBO` and confirm:

1. Suggested Matches is visibly usable and candidates are readable/selectable.
2. Manual Search Results has a stable usable area.
3. Official and database identities are visible side-by-side.
4. Exchange/symbol/ISIN comparison is readable.
5. Source Evidence no longer creates the large native hover tooltip.
6. Evidence details expand deliberately.
7. Decision Reason remains mandatory.
8. Action bar remains visible while resolver content scrolls.
9. No horizontal clipping occurs at normal window size.
10. Opening Review Identity performs no automatic resolution/approval.

## Risks / limitations

- V1.5.1 corrects only the frontend workbench presentation and the apply mechanism.
- It does not change identity ranking or automatically accept historical ISIN drift.
- The workbench remains embedded in the Corporate Actions window.

## Rollback guidance

The apply script creates a fresh timestamped backup under:

`tmp\corporate-action-phase1-v1-5-1-backup_YYYYMMDD_HHMMSS`

To roll back, close the app, restore `src\components\DatabaseToolsDialogs.tsx` from that backup, remove the V1.5.1 report if desired, and rerun renderer typecheck/build.
