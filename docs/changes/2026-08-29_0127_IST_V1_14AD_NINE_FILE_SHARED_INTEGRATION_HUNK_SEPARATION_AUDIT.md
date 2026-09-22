# V1.14AD Nine-File Shared-Integration Hunk-Separation Audit

**IST timestamp:** 2026-08-29 01:27:03 +05:30 IST

## Objective

Separate Corporate Action changes from unrelated accumulated changes inside the exact nine shared integration files identified by the cumulative Corporate Action baseline scope audit.

## Previous limitation

The cumulative Corporate Action baseline contains 25 whole-file-safe source/test paths plus nine required shared integration files. Those nine shared files cannot be staged wholesale because they also contain unrelated application changes.

## Files inspected first

- Exact cumulative CA baseline audit ZIP/state/JSON.
- Exact 07-patch-separation-required.txt authority.
- Verified 14:13 source snapshot copies of all nine shared files.
- Current working-tree copies of all nine shared files.
- Git HEAD versions of all nine shared files via disposable helper operations.

## Files created

- One complete zero-context Git diff per shared file under the audit reports directory.
- 20-ca-required-candidate.patch.
- 21-non-ca-separated.patch.
- 22-mixed-hunks-requires-reconstruction.patch.
- Hunk CSV/JSON, identity evidence, disposable candidate apply result, summary JSON, state file, this report, and a compact reports ZIP.

## Files modified

- No production source/config/test file.
- No Git index entry.
- No database.
- No build/package output.
- This docs\\changes report is the only project documentation artifact created by the audit.

## Hunk classification model

- CA_REQUIRED — changed lines contain a file-specific Corporate Action marker and no known foreign-feature marker.
- NON_CA — changed lines contain no Corporate Action marker.
- MIXED_HUNK_REQUIRES_RECONSTRUCTION — the same Git hunk contains both Corporate Action and known foreign-feature markers.

The classifier is deliberately conservative. Mixed hunks are never silently assigned to Corporate Action.

## Actual validation results

- Files: 9.
- Total hunks: 253.
- CA_REQUIRED hunks: 50.
- NON_CA hunks: 198.
- MIXED hunks: 5.
- Source drift: 0.
- Candidate patch SHA-256: E3A7438A74ABAFD05807086CD7C7419784075DE05B6B60D02D9FC1EB82FC9023.
- Candidate git apply --check exit: 1.
- Candidate disposable apply exit: .

## Per-file result

- `src-tauri-shell/src/database.rs` — CA=2, NON_CA=17, MIXED=1
- `src-tauri-shell/src/database/eod_data.rs` — CA=1, NON_CA=2, MIXED=0
- `src-tauri-shell/src/database/instrument_mutations.rs` — CA=2, NON_CA=0, MIXED=0
- `src-tauri-shell/src/main.rs` — CA=4, NON_CA=7, MIXED=0
- `src/components/CommandPalette.tsx` — CA=0, NON_CA=52, MIXED=1
- `src/components/DatabaseToolsDialogs.tsx` — CA=30, NON_CA=95, MIXED=2
- `src/platform/tauriDesktop.ts` — CA=3, NON_CA=5, MIXED=0
- `src/platform/types.ts` — CA=4, NON_CA=8, MIXED=0
- `src/types/desktop.ts` — CA=4, NON_CA=12, MIXED=1

## Classification

**CA_SHARED_HUNKS_BLOCKED__CANDIDATE_PATCH_DOES_NOT_APPLY_TO_HEAD**

The automatically separated CA_REQUIRED candidate patch does not apply cleanly to a disposable Git-HEAD sandbox.

## Behavior deliberately preserved

- Exact current working-tree bytes of all nine shared files.
- Exact accepted Corporate Action source/test state.
- Clean Git index.
- No build/test/database/package action.
- Candidate patch is applied only in a disposable Git-HEAD sandbox with core.autocrlf=false and core.eol=lf.

## Risks / limitations

- Marker-based hunk classification is an attribution aid, not a substitute for final human review.
- MIXED hunks require explicit reconstruction; the candidate CA-only patch intentionally omits them.
- Even if the candidate patch applies cleanly, runtime compilation/tests are deferred until a complete cumulative baseline patch is assembled.

## Recommended next step

STOP normalization and investigate the blocking classification before any staging.

**git add is intentionally not executed.**

## Rollback guidance

No source rollback is required because this audit makes no production source or Git-index change. The verified 752-file source snapshot remains the recovery authority.

## Status

**V1_14AD_NINE_FILE_SHARED_HUNK_AUDIT_COMPLETE**
