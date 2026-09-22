# GitHub Clean Baseline

IST timestamp: 2026-09-22 12:44:23 IST

## Objective

Create a clean GitHub baseline for the current EOD Charting Platform without publishing obsolete local Git history containing database, temporary, build, or evidence artifacts.

## Legacy local authority

Branch: gemini-release-qa-20260512
HEAD: 2103e9ffcaaad28bd903c9cb71310316c68f2ffd

## Clean baseline

Tree: 6ff7b21aa82053afdb58a017bc372c0d8cf691e4
Root commit: 956ff739d69658d8159b0212b322f98b9be11b4c

Source files: 561
Protected source files: 555
Unsafe candidate files: 0

## Excluded local-only material

- tmp/
- New Database/
- outputs/
- test-output/
- TAPRO_REFERENCE_FROM_EOD/
- .antigravitycli/
- databases / WAL / SHM
- binary EOD data
- archives
- executables / DLL / PDB
- environment files
- Python cache

## Behaviour preserved

No production source or runtime behaviour was changed by this Git migration.

AUTO-ID1, 20MICRONS and Corporate Action Auto-Approval R1 source behaviour remain unchanged.

## Validation

A separate temporary Git index was initialized from an empty tree.
The current working tree was staged recursively through git add -A -- .
.gitignore exclusions were applied by Git.
Source authority verified as 561 / 555.
Unsafe candidate count verified as zero.
No file >= 10 MB remained in the clean baseline.

## Rollback

The legacy local branch and history remain available at:

gemini-release-qa-20260512
2103e9ffcaaad28bd903c9cb71310316c68f2ffd

No legacy-history rewrite or deletion was performed.