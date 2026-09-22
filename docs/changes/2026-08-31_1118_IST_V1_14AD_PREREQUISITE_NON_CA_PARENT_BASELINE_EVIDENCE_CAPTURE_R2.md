# V1.14AD Prerequisite Non-CA Parent Baseline Evidence Capture R2

## IST timestamp
2026-08-31 11:18:44.701 IST

## Objective
Create a narrow, uploadable, read-only evidence package for prerequisite non-CA parent-baseline classification without copying the repository or unrelated untracked/generated content.

## Previous defect or limitation
The R1 evidence-capture design combined every tracked change with every untracked file and physically copied nearly all existing paths after only a short generated-directory exclusion list. On the actual repository it reported 9,570 changed/untracked paths and copied 9,482 files, producing an approximately repository-sized evidence package. R1 is therefore superseded for content-transfer purposes; its source/index safety result remains historical evidence.

## Files changed
- This Markdown report only: docs\changes\2026-08-31_1118_IST_V1_14AD_PREREQUISITE_NON_CA_PARENT_BASELINE_EVIDENCE_CAPTURE_R2.md
- No source/config files were edited by this audit.
- No real Git index entries were changed by this audit.

## Final implementation
- Preserved exact R1 parent-baseline review authority and sentinel checks.
- Removed the full current-file snapshot model.
- Removed the full HEAD Git archive.
- Captured tracked source/config content as a Git binary/full-index diff plus tracked path/hash/object metadata.
- Listed every untracked path as text metadata, but copied only untracked candidates under src, src-tauri-shell, or a narrow root build/config allowlist.
- Added hard guards: at most 750 copied untracked candidates, at most 33554432 total candidate bytes, and at most 67108864 evidence bytes before compression.
- Copied the exact small R1 reports ZIP without expanding it.
- Indexed docs\changes by name/hash without copying all reports.

## Validation commands
- git rev-parse --is-inside-work-tree
- git rev-parse --show-toplevel
- git rev-parse HEAD
- git diff --cached --name-only --
- git diff --name-status --find-renames HEAD --
- git diff --numstat --find-renames HEAD --
- git diff --raw --no-abbrev HEAD --
- git diff --binary --full-index --find-renames HEAD -- <narrow source/config pathspecs>
- git ls-files
- git ls-files -s
- git ls-files --others --exclude-standard
- git ls-tree -r --full-tree HEAD
- git log --first-parent ...
- SHA-256 verification for R1 authority ZIP, R1 sentinels, tracked changed current files, and copied untracked source/config candidates.

## Actual validation results
- Project root: E:\TA Projects\EOD Charting Platform
- HEAD: f4278bc62649552f119fa6438b688a10dccef25e
- Branch: gemini-release-qa-20260512
- R1 reports ZIP SHA-256: AB68D3CFCEF1BF8A0A209BB27CD9396CEDDB29E5FE4A8ED98FB116FB8E8AAC3E (matched expected authority)
- Real Git index SHA-256 before evidence capture: 3B1C9A68BB53674F5B84CF649F3CD676BF801A6156E97CAB7D2BCFECA624891A
- Tracked changed paths: 185
- All untracked paths listed only as metadata: 9386
- Untracked source/config candidates copied: 292
- Untracked source/config candidate bytes: 3787420
- Tracked source/config diff bytes: 2741380
- Semantic parent-baseline membership: NOT YET CLASSIFIED by design.

## Risks or limitations
- Untracked files outside the strict source/config allowlist are not physically copied; their paths remain present in the metadata list and can be requested selectively if later evidence shows they matter.
- The narrow tracked diff intentionally prioritizes src, src-tauri-shell, and root build/config authority. Full tracked path metadata remains available for identifying any additional path that requires targeted follow-up.
- A changed source authority or changed real Git index invalidates this evidence and requires a fresh review.

## Rollback guidance
This audit makes no source/config or Git-index change. If removal is required, delete this R2 report and its corresponding external Source Audit directory. The overscoped R1 external evidence directory may be deleted after R2 completes successfully; retain the historical R1 report in docs\changes unless a later continuity decision explicitly supersedes it.
