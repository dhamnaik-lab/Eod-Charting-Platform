# Handoff — immediate resume point

## Documentation closure and synchronized main — 6 November 2026 (IST)

- Resume from synchronized main `09d20595bdc2ccbb6f11320fea3caf32c606c940`. The [sync record](docs/changes/2026-11-06_MAIN_SYNCHRONIZATION.md) owns the historical 67-entry baseline and recovery references. Preserve those local workstreams when reviewing or publishing the documentation.
- [UX-13](docs/changes/2026-11-06_UX13_BHAVCOPY_REQUEST_STOP.md) has local portable observations. Exact-merged-tree portable acceptance and independent database integrity remain open. The [UI/UX index](FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md#uiux-audit-findings) lists the other findings and pending native checks.
- This documentation pass reviewed historical logs and used documentation-only validation. See `backups/pre_opencode_changes_20261106_011734_doc-closure` for pre-edit docs and the timestamped documentation closure evidence under `tmp/`. The next workstream awaits user direction.


## First action on the live checkout

**Do not apply these files to an unverified checkout.** Verify that the intended live root contains the authoritative [AGENTS.md](AGENTS.md); compare it and the relevant current source against the [snapshot audit baseline](PROJECT_STATE_EOD_CHARTING_PLATFORM.md#snapshot-authority). This ZIP was captured from a working tree **without Git metadata**, so no commit/revision equivalence was established. If the live tree has changed, reconcile source-backed statements before copying documents.

Copy exactly these eight root Markdown outputs together: [README](README.md), [Requirements](REQUIREMENTS.md), [Architecture](ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md), [Feature status](FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md), [Inventory](FILE_INVENTORY.md), [Project state](PROJECT_STATE_EOD_CHARTING_PLATFORM.md), [Handoff](HANDOFF.md), [Phase tracker](NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md). Preserve `AGENTS.md` unmodified. Do not copy the extracted snapshot or replace application code.

## Blocking/mandatory checks after copy

1. On the live Windows repository, use the existing [documentation validation script](scripts/validate-change.ps1) with `-Profile docs`. It calls [check-doc-references.ps1](scripts/check-doc-references.ps1) and a Git-based whitespace check, so it requires the relevant shell and Git worktree metadata. Run it serially; record the actual output and exit status.
2. Address any source/contract inconsistency **as a separate bounded issue**, starting with the exact worker-cap mismatch in [audit findings](PROJECT_STATE_EOD_CHARTING_PLATFORM.md#unresolved-findings). Do not alter Rust implementation while installing documentation.
3. Obtain explicit user phase confirmations before assigning running/completed/next statuses in the [phase tracker](NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md). Neither this snapshot nor embedded tests supplies release acceptance.

## Navigation for resuming work

- [Architecture](ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md) for runtime data flow and storage; [Inventory](FILE_INVENTORY.md) for exact source entry points.
- [Requirements](REQUIREMENTS.md) for binding behavior; [Feature matrix](FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md) for implementation/test-source coverage and remaining acceptance.
- [Project state](PROJECT_STATE_EOD_CHARTING_PLATFORM.md) for dated findings and checks; [Phase tracker](NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md) for phase status only.

**Current documentation-only task:** source reconstruction prepared from the supplied ZIP. Native Git/PowerShell validation and reconciliation with the live checkout are **pending**, not reported as passed. No feature rollout, phase acceptance, Git operation, runtime database operation or portable build was performed.
