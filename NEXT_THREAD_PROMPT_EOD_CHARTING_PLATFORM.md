# EOD Charting Platform — phase tracker for the next thread

**Rule:** This file is the sole owner of **running, completed and next phase status**. A phase is assigned to one of these sections only when the user explicitly confirms its identity and status. Source code, test names, timestamps, historical chats and this reconstructed documentation are **not** phase completion or priority authority. See [AGENTS.md](AGENTS.md) for working rules and [PROJECT_STATE](PROJECT_STATE_EOD_CHARTING_PLATFORM.md) for the dated source audit.

## Running phases

**Awaiting user confirmation.** No running-phase identity or verified status was provided as authority with the snapshot request.

## Completed phases

**Awaiting user confirmation.** No completed-phase identity, user acceptance or phase sign-off was supplied as authority with the snapshot request.

## Next phases

**Awaiting user confirmation.** No next-phase priority or authorization was supplied as authority with the snapshot request. Do not convert code gaps or audit findings into a user-approved phase plan.

## Verified checkpoints for resuming work

The [accepted UX-13 implementation](docs/changes/2026-11-06_UX13_BHAVCOPY_REQUEST_STOP.md) and [main synchronization](docs/changes/2026-11-06_MAIN_SYNCHRONIZATION.md) are recorded separately from phase assignments. The [UI/UX evidence index](FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md#uiux-audit-findings) tracks outstanding native checks. The next workstream remains pending user direction.

The Corporate Actions Rust test repair (6 November 2026) is recorded in [HANDOFF.md](HANDOFF.md). The targeted Rust run passed with 797 tests, test files only. Audit fix M1 (manual Bonus face value) followed it, and the run passed with 798 tests. M1 needs the user's portable rebuild and a manual check. Run C then fixed L5 (Issues-tab direct Approve), the L1 Demerger parser and the 3 failing UI tests. Its user-run checks passed: 799 Rust tests and 535 UI tests. M2 is held because accepted tests keep normal approval outside the lock. Fix H1 (revoke) from the audit is not yet assigned as a phase. The user then approved a plan to make Split, Bonus and identity rows for current symbols reach Ready after Load & Validate. Phase 1 (read-only diagnosis), Phase 2a (split ISIN price proof, 805 Rust tests passed) and Phase 2b (legacy NSE split/bonus abbreviations and informational notices; 808 Rust and 536 UI tests passed) are recorded in HANDOFF.md. Phases 2c, 3 (Load & Validate groups) and 4 (one Corporate Actions window, with Identity Import inside it) are planned but not yet assigned as phases. Phase 3 (7 November 2026) closes informational notices once with a logged, reversible status `CLOSED_INFORMATIONAL` and leaves them out of the pending queue; checks passed (UI 537, Rust 813). Step 1 (more informational wording) passed (Rust 813) and the runtime check confirmed it (NSE Other Issues 363 -> 280). Next: step 2, a read-only sort of the blocked Split/Bonus rows; step 3, a Later group; then the CA window redesign; then BSE Phase 2c.

## Context for starting a new thread

Workstream: **EOD Charting Platform**. Begin by reading [AGENTS.md](AGENTS.md), then the relevant portion of [HANDOFF.md](HANDOFF.md). Verify source authority and use [FILE_INVENTORY.md](FILE_INVENTORY.md) to locate the bounded issue before inspecting code. Consult the other owner documents only if relevant. Do not infer status from historical documentation; ask for explicit phase confirmation before editing the three phase sections above.
