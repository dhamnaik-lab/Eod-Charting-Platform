# Source Snapshot v3 — Change-Evidence Inclusion

## IST timestamp

2026-08-05 16:40 +05:30

## Objective

Create a third revision of the EOD Charting Platform source-snapshot utility that includes the canonical `docs\changes\` evidence tree in every timestamped source snapshot.

## Previous limitation

`Create-EOD-Source-Code-Snapshot-v2.ps1` included:

- application source;
- required build configuration;
- the eight canonical root Markdown documents.

It deliberately excluded the `docs` tree and all other Markdown files. Consequently, validation reports and chronological change evidence under `docs\changes\` were absent from future source snapshots.

## Files changed

### Created

- `Create-EOD-Source-Code-Snapshot-v3.ps1`
- `2026-08-05_1640_IST_SOURCE_SNAPSHOT_V3_EVIDENCE_INCLUSION.md`

### Modified in the live repository

None. The generated utility and report are external downloadable artifacts until placed in the project.

## Final implementation

Version 3:

- retains the timestamped folder name:
  `Eod Charting Platform Source Code YYYY-MM-DD_HHmmss_IST`;
- retains all v2 source, build-output, dependency, archive, database, cache, executable, and secret exclusions;
- retains the eight required root Markdown files;
- requires `.cargo\config.toml`;
- requires `docs\changes\`;
- copies `docs\changes\` recursively;
- allows Markdown only within `docs\changes\` and for the eight selected root documents;
- excludes the rest of the `docs` tree;
- includes evidence files in the expected-file inventory;
- performs missing-file, unexpected-file, and SHA-256 mismatch verification.

## Validation performed

- Inspected the complete v2 script.
- Generated v3 through deterministic text transformation.
- Confirmed the evidence-directory declaration exists.
- Confirmed evidence-directory existence validation exists.
- Confirmed evidence-specific Markdown handling exists.
- Confirmed Robocopy inclusion of `docs\changes\`.
- Confirmed evidence files participate in expected-file and SHA-256 verification.
- Confirmed timestamped destination naming remains unchanged.
- Confirmed v2 SHA-256 verification logic remains present.

## Actual validation results

All static generation checks passed.

Windows PowerShell execution was not performed because the local `E:` project drive is not accessible in this environment.

## Risks and limitations

- The script stops if `docs\changes\` is absent.
- Any non-evidence Markdown outside the eight root files remains excluded by design.
- A Windows execution test is still required.
- Source files changing during the copy can cause hash mismatches; stop build and development processes before running.

## Rollback guidance

Continue using `Create-EOD-Source-Code-Snapshot-v2.ps1` to create source snapshots without `docs\changes\`.

No repository rollback is required because no live project file was modified here.
