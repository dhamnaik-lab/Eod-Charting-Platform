# V1.14AD Nine-File Shared-Integration Hunk-Separation Audit R2

**IST timestamp:** 2026-08-29 11:09:35 +05:30 IST

## Objective

Separate Corporate Action changes from unrelated accumulated changes inside the exact nine shared integration files identified by the cumulative Corporate Action baseline scope audit.

## Previous limitation

The cumulative Corporate Action baseline contains 25 whole-file-safe source/test paths plus nine required shared integration files. Those nine shared files cannot be staged wholesale because they also contain unrelated application changes.

The first nine-file audit generated zero-context patches through Windows text-mode writes, converting LF patch records to CRLF, and invoked git apply without --unidiff-zero. The resulting apply failure was a harness defect, not yet a Corporate Action separation verdict. R1 writes exact LF patch bytes and uses --unidiff-zero for disposable check/apply.

R1 then stopped before hunk analysis because its references to the prior failed NON-R1 evidence ZIP and state file were accidentally versioned with -r1. R2 restores those two original evidence filenames while leaving the R1 LF-byte and --unidiff-zero corrections unchanged.

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
- Candidate patch SHA-256: 49EB77DA6AEFDA0FCCC3A63B410124096328A8B404E88A191EEA7CB2803C4239.
- Candidate git apply --check exit: 0.
- Candidate disposable apply exit: 0.

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

**CA_SHARED_HUNKS_SEPARATED__MIXED_RECONSTRUCTION_REQUIRED**

High-confidence CA and non-CA hunks were separated, but mixed hunks remain and must be reconstructed manually before staging.

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

Review 22-mixed-hunks-requires-reconstruction.patch and reconstruct only the Corporate Action portions of those mixed hunks in a disposable patch-building phase.

**git add is intentionally not executed.**

## Rollback guidance

No source rollback is required because this audit makes no production source or Git-index change. The verified 752-file source snapshot remains the recovery authority.

## Status

**V1_14AD_NINE_FILE_SHARED_HUNK_AUDIT_R2_COMPLETE**
