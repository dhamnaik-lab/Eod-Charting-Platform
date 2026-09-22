# Final Pre-Handoff Documentation Audit V2

## Timestamp

2026-08-10 12:35 IST (+05:30)

## Scope

Recheck the complete documentation set in the post-reconciliation source snapshot before handoff to the separate indicator-issue chat.

Inspected snapshot:

`Eod Charting Platform Source Code 2026-08-10_123114_IST`

Archive inspection:

- 477 ZIP entries
- 377 files
- 58 Markdown files
- 14 text evidence files

Historical `docs/changes/` records and backup copies remain evidence, not current implementation authority. The maintained current authority remains the eight root documents listed in `REQUIREMENTS.md`, with timestamped change evidence supporting specific claims.

## Findings corrected

### 1. Stale NSE equity-series ingest guidance

Current-facing text still suggested implementing NSE symbol exclusion/filter rules inside Bhavcopy followed by a fresh database rebuild.

Current contract:

- retain supported NSE equity/trade-for-trade/SME series such as `EQ`, `BE`, `BZ`, `SM`, `ST`, and `SZ`;
- persist series metadata;
- perform ordinary series filtering in Symbols/sidebar browsing;
- do not introduce a new equity-series whitelist that drops those rows during Bhavcopy ingestion;
- existing configured government-security exclusions remain a separate non-equity rule.

The old bottom-of-file Project State checklist is retained as append-only history but is explicitly marked historical/superseded.

### 2. Indicator status overstated

`FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md` marked the indicator catalog/settings seam `Complete` even though `HANDOFF.md` records a reproducible intermittent SMA Daily-state/value-scale problem.

The status is now `Partial` until the focused indicator audit closes that runtime defect.

### 3. Documentation status row was stale

The Documentation row still referred to the August 4–5 reconciliation and a missing `.cargo/config.toml` snapshot gap.

Current source contains `.cargo/config.toml`, and the documentation has been reconciled through the accepted August 8–10 Bhavcopy work.

### 4. Documentation validator was stale

`scripts/check-doc-references.ps1` still required removed historical prompt files:

- `FUTURE_PROMPT_README_EOD_CHARTING_PLATFORM.md`
- `CLAUDE_HANDOFF_PROMPT_EOD_CHARTING_PLATFORM.md`

Those files are not part of the maintained canonical set.

The helper is now aligned to the eight maintained root documents. `PROJECT_STATE_EOD_CHARTING_PLATFORM.md` is presence-checked but excluded from current-reference resolution because it is intentionally append-only and retains historical references that may not exist in a clean source snapshot.

### 5. Portable hash caveat

An August 5 DNN Project State section records portable executable SHA-256:

`367743F3776B8056FFD999EA039CE7CF8A1E000AEF48BE4A9E37D0688FADF2DF`

That exact hash is not independently evidenced by the retained DNN change artifact or the inspected source snapshot. It is retained only as a historical recorded value with an explicit caveat: do not use it as current portable build identity without verifying the actual executable/build output.

### 6. Handoff wording

`HANDOFF.md` no longer says "after applying this documentation reconciliation" because that reconciliation is already applied. It directs the next chat to the latest post-reconciliation source snapshot and the intermittent SMA audit.

## Files changed

Documentation:

- `AGENTS.md`
- `REQUIREMENTS.md`
- `HANDOFF.md`
- `README.md`
- `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`
- `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `docs/changes/2026-08-10_1212_IST_BHAVCOPY_FINAL_ACCEPTANCE_AND_DOCUMENTATION_RECONCILIATION.md`
- `docs/changes/2026-08-09_1240_IST_BHAVCOPY_RECOVERABLE_DURABILITY_CONTRACT_V1.md`
- this report

Documentation tooling:

- `scripts/check-doc-references.ps1`

No application runtime behavior is changed.

## Final handoff state

Bhavcopy remains closed/frozen for the current scope.

The next focused issue is the intermittent indicator/SMA Daily-state/value-scale defect in the separate indicator chat.

After applying this audit package, create one more fresh source snapshot and use that new snapshot as the canonical handoff artifact.
