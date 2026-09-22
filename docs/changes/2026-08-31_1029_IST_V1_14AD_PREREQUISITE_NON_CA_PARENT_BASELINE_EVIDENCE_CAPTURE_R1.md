# V1.14AD Prerequisite Non-CA Parent Baseline Evidence Capture R1

## IST timestamp
2026-08-31 10:29:02.197 IST

## Objective
Capture sufficient read-only Git, source-identity, history, R1 authority, and continuity-document evidence to classify the prerequisite non-CA parent baseline before any corporate-action staging or commit is authorized.

## Previous defect or limitation
The completed parent-baseline/commit-order review rejected a direct corporate-action commit on the current HEAD because 401 non-CA build-relevant paths were reported changed from HEAD. The exact prerequisite parent commit membership has not yet been semantically classified.

## Files changed
- This Markdown report only: docs\changes\2026-08-31_1029_IST_V1_14AD_PREREQUISITE_NON_CA_PARENT_BASELINE_EVIDENCE_CAPTURE_R1.md
- No source/config files were edited by this audit.
- No real Git index entries were changed by this audit.

## Final implementation
- Verified the exact R1 parent-baseline review report exists.
- Verified the exact R1 reports ZIP SHA-256: AB68D3CFCEF1BF8A0A209BB27CD9396CEDDB29E5FE4A8ED98FB116FB8E8AAC3E.
- Verified known R1 prerequisite sentinels remain byte-identical to the accepted R1 source authority.
- Captured Git status, HEAD identity, tracked/untracked path evidence, diff metadata, first-parent history, HEAD tree, and index metadata.
- Captured a SHA-256/path matrix for current changed and untracked files.
- Captured copies of current changed/untracked files while excluding dependency/build-output directories such as node_modules, target, dist, build, and coverage.
- Created a read-only HEAD authority ZIP from Git.
- Expanded and inventoried the exact R1 reports ZIP inside the external evidence package.
- Indexed docs\changes continuity reports and hashes.
- Deliberately did not assign paths to a parent commit automatically; semantic classification requires review of this captured evidence.

## Validation commands
- git rev-parse --is-inside-work-tree
- git rev-parse --show-toplevel
- git rev-parse HEAD
- git diff --cached --name-only --
- git status --porcelain=v1 --untracked-files=all
- git diff --name-status --find-renames HEAD --
- git diff --numstat --find-renames HEAD --
- git diff --raw --no-abbrev HEAD --
- git ls-files
- git ls-files -s
- git ls-tree -r --full-tree HEAD
- git log --first-parent ...
- SHA-256 verification for R1 authority ZIP, known sentinels, changed current files, HEAD snapshot, and continuity documents.

## Actual validation results
- Project root: E:\TA Projects\EOD Charting Platform
- HEAD: f4278bc62649552f119fa6438b688a10dccef25e
- Branch: gemini-release-qa-20260512
- R1 reports ZIP SHA-256: AB68D3CFCEF1BF8A0A209BB27CD9396CEDDB29E5FE4A8ED98FB116FB8E8AAC3E (matched expected authority)
- Real Git index SHA-256 before evidence capture: 3B1C9A68BB53674F5B84CF649F3CD676BF801A6156E97CAB7D2BCFECA624891A
- Changed/untracked path count captured: 9570
- Current snapshot file count: 9482
- HEAD authority snapshot SHA-256: BDD3E83A8CDDDA7880D2112D13D4FFA083629B8A76CD68B8AECDFF734382ECA0
- docs\changes report count indexed: 173
- Continuity-related report references indexed: 152
- Semantic parent-baseline membership: NOT YET CLASSIFIED by design.

## Risks or limitations
- The evidence capture does not itself decide prerequisite commit membership.
- Generated/untracked files excluded by snapshot safety filters remain represented in Git/path evidence but may not be copied into the current snapshot.
- A changed source authority or changed real Git index invalidates this evidence and requires a fresh review.

## Rollback guidance
This audit makes no source/config or Git-index change. If removal is required, delete this report and the corresponding external Source Audit evidence directory. Do not alter source files or Git history as part of rollback.
