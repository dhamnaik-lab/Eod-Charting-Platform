# V1.14AD PRE-B1 -> POST-B1 Source-Separation Audit R1

**IST timestamp:** 2026-08-28 16:58:45 +05:30 IST

## Objective

Determine whether the exact V1.14AD production source delta can be represented independently from earlier uncommitted Corporate Action phases on the current Git HEAD.

## Previous limitation

The closed current corporate_action_imports.rs is a cumulative working-tree file. The prior Git attribution audit proved that staging the whole file as a V1.14AD-only commit would misattribute earlier Corporate Action work. This audit uses the exact B1 rollback source as the pre-V1.14AD baseline.

The first source-separation audit also exposed a sandbox-only EOL defect: ambient Windows Git core.autocrlf converted the successfully replayed LF source to CRLF. The wrong replay SHA EFCDCB754F6D77838FE1B1B27A4484765B31F63636AEC512758C1ABCA539E957 is exactly the accepted POST-B1 content with every LF converted to CRLF. R1 forces core.autocrlf=false and core.eol=lf only for disposable git apply/check operations.

## Files inspected

- PRE-B1 rollback: E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-14ad-b1-r1-compound-equivalent-event-dedupe_20260826_191051_600\rollback\corporate_action_imports.rs.pre-v114ad-b1
- POST-B1/current source: E:\TA Projects\EOD Charting Platform\src-tauri-shell\src\database\corporate_action_imports.rs
- Git HEAD version of src-tauri-shell/src/database/corporate_action_imports.rs
- V1.14AD persistent tests
- V1.14AD final closeout report
- B1 corrected evidence ZIP
- current Git index and four candidate-path status

## Files created

- 01-pre-b1-to-post-b1.patch
- 02-head-to-pre-b1.patch
- 03-source-separation-audit.json
- helper/evidence files under E:\TA Projects\EOD Charting Platform\tmp\v1-14ad-pre-b1-post-b1-source-separation-audit-r1_20260828_165845_525\reports
- this docs\\changes report
- compact audit reports ZIP

## Files modified

- No production source.
- No package/configuration.
- No persistent test source.
- No Git index entry.
- No database.

## Exact source identities

- Git HEAD source SHA-256: BECD17CC7DAC3A1A89A9E879C2180611A8DF5B98B743AA755FD2B52E240C7DC4
- PRE-B1 rollback SHA-256: 7FF8A707D2AE754324443EA64E6722F9599DF85C4EDBC6466C3B15CB9F168C14
- accepted POST-B1/current SHA-256: 450507EA2E6E195FCA0B654BD359A1E956BC5DBC9F57C81FF08FC215FF5C749B
- HEAD equals PRE-B1: False

## Exact V1.14AD patch

- Patch SHA-256: AB16AC44EE36F5353DB61662B0DDA780901EE5BFF966FE7112A8BDCB2009F4C7
- Added lines: 152
- Removed lines: 17
- Hunks: 3
- git apply --check against verified PRE-B1: exit 0
- PRE-B1 + exact patch reconstructs accepted POST-B1 byte-for-byte: True

## HEAD applicability

- git apply --check against disposable Git-HEAD source: exit 1
- Exact patch applies to HEAD: False
- HEAD + patch equals accepted POST-B1 source: False

## Required pre-existing identity-equivalence helpers

- None.

## Classification

**V114AD_DEPENDS_ON_UNCOMMITTED_PRIOR_PHASES__EXACT_PATCH_DOES_NOT_APPLY_TO_HEAD**

The exact PRE-B1 -> POST-B1 patch reconstructs the accepted source from PRE-B1 but git apply --check rejects the same patch against Git HEAD.

## V1.14AD-only source isolation safe

**False**

This field is intentionally conservative. Runtime compilation/tests were not performed by this audit.

## Validation performed

- Exact SHA-256 lock of PRE-B1 rollback, POST-B1/current source, V1.14AD tests, final closeout, and B1 corrected evidence.
- Git index required clean before audit.
- Byte-oriented exact PRE-B1 -> POST-B1 unified patch generated.
- git apply --check and real apply performed only in disposable TEMP directories.
- Replayed PRE-B1 result SHA-256 compared to accepted POST-B1 SHA-256.
- Exact patch checked/applied against a disposable Git-HEAD source copy.
- Required identity-equivalence helper presence compared across HEAD/PRE-B1/POST-B1.

## Behavior deliberately preserved

- Working-tree source remains unchanged.
- V1.14AD tests remain untracked/unchanged.
- Git index remains unchanged.
- No build/test rerun.
- No database access.
- Existing verified 752-file source snapshot remains the preservation authority.

## Risks / limitations

- A patch that textually applies to HEAD is not sufficient proof of a valid isolated runtime build; this audit deliberately does not compile or test.
- If PRE-B1 differs from HEAD, earlier uncommitted prerequisite history exists even if individual V1.14AD hunks happen to apply.
- No file should be staged as V1.14AD-only unless the resulting history accurately represents its prerequisite state.

## Recommended next step

Prepare a governed cumulative Corporate Action baseline/Git-normalization plan. Do not stage the current cumulative source as a V1.14AD-only commit.

**git add is intentionally not executed.**

## Rollback guidance

No production rollback is required because this audit changes no application source or Git index state. The verified PRE-B1 rollback and existing 752-file source snapshot remain recovery authorities.

## Status

**V1_14AD_SOURCE_SEPARATION_AUDIT_R1_COMPLETE**
