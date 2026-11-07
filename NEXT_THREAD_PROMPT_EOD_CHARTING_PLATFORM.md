# EOD Charting Platform — phase tracker for the next thread

**Rule:** This file is the sole owner of **running, completed and next phase status**. A phase is assigned to one of these sections only when the user explicitly confirms its identity and status. Source code, test names, timestamps, historical chats and this reconstructed documentation are **not** phase completion or priority authority. See [AGENTS.md](AGENTS.md) for working rules and [PROJECT_STATE](PROJECT_STATE_EOD_CHARTING_PLATFORM.md) for the dated source audit.

## Running phases

Corporate Actions Tasks 1–3 (fixture tracking, Deb/Debs admission/Deferred classification, and user-approved linked inactive predecessor proof) are implemented on `feat/ca-nse-remaining-20261107`. Six ignored diagnosis files are removed from Git tracking and preserved unchanged on disk; the commit tree must contain no `tmp/` entries. Debt/Debit/Debut remain negative. Every other ISIN owner must satisfy same-exchange inactivity and a direct transition dated by the event; MATCHED/current price gates and explicit approval remain unchanged. Typecheck PASS; Vitest PASS 563/563; focused Rust PASS 7/7; requested seven-filter Rust PASS 823, 0 failed, 26 ignored. Both Cargo previews PASS; shared target, `--jobs 2`. Docs/whitespace and CRLF checks PASS. See the top CA handoff for scope, backup and native acceptance.

**Corporate Actions Tasks A/B (7 November 2026):** diagnosis and automated verification are complete; runtime acceptance for NSE wording and Later is pending the portable rebuild. Other running-phase assignments await user confirmation.

## Completed phases

**Task A diagnosis complete:** 131 pending Split/Bonus rows grouped on the supplied read-only copy; evidence is in `tmp/fixtures/ca-diagnosis-20261107/`. Task B implementation/check results are recorded in the top Corporate Actions section of [HANDOFF.md](HANDOFF.md); native acceptance is separate. Other phase sign-off awaits user confirmation.

## Next phases

**Next for the assigned Deb/predecessor Tasks 1–3:** user portable rebuild and copy-only native acceptance after validation. Verify all ignored fixture files remain on disk and the committed tree contains no `tmp/` entries. Do not synthesize missing identity links or approve any action automatically. The earlier copied-history findings below remain separate from this narrowly approved owner exception.

**Next for remaining-NSE Tasks 1–4:** user portable rebuild and copy-only native acceptance; the copied, hash-pinned price windows are now diagnosed. Investigate mixed price levels/shared coverage gaps and obtain independent source provenance before certifying already-adjusted history. Do not infer an official date correction from a missing month. Any price-proof exception needs an evidence-backed proposal and explicit approval; none is implemented. Preserve the qualified predecessor-owner checks and explicit financial approval. The older Tasks A/B native checklist below remains useful.

**Next for the assigned Tasks A/B:** the user rebuilds the portable app and checks Later and reclassification on a copy. Source delivery belongs on `feat/ca-nse-later-group-20261107`. The existing CA window redesign and BSE Phase 2c remain later work; this task does not implement them. Other priorities await user confirmation.

## Verified checkpoints for resuming work

The [accepted UX-13 implementation](docs/changes/2026-11-06_UX13_BHAVCOPY_REQUEST_STOP.md) and [main synchronization](docs/changes/2026-11-06_MAIN_SYNCHRONIZATION.md) are recorded separately from phase assignments. The [UI/UX evidence index](FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md#uiux-audit-findings) tracks outstanding native checks. The next workstream remains pending user direction.

The Corporate Actions Rust test repair (6 November 2026) is recorded in [HANDOFF.md](HANDOFF.md). The targeted Rust run passed with 797 tests, test files only. Audit fix M1 (manual Bonus face value) followed it, and the run passed with 798 tests. M1 needs the user's portable rebuild and a manual check. Run C then fixed L5 (Issues-tab direct Approve), the L1 Demerger parser and the 3 failing UI tests. Its user-run checks passed: 799 Rust tests and 535 UI tests. M2 is held because accepted tests keep normal approval outside the lock. Fix H1 (revoke) from the audit is not yet assigned as a phase. The user then approved a plan to make Split, Bonus and identity rows for current symbols reach Ready after Load & Validate. Phase 1 (read-only diagnosis), Phase 2a (split ISIN price proof, 805 Rust tests passed) and Phase 2b (legacy NSE split/bonus abbreviations and informational notices; 808 Rust and 536 UI tests passed) are recorded in HANDOFF.md. Phases 2c, 3 (Load & Validate groups) and 4 (one Corporate Actions window, with Identity Import inside it) are planned but not yet assigned as phases. Phase 3 (7 November 2026) closes informational notices once with a logged, reversible status `CLOSED_INFORMATIONAL` and leaves them out of the pending queue; checks passed (UI 537, Rust 813). Step 1 (more informational wording) passed (Rust 813) and the runtime check confirmed it (NSE Other Issues 363 -> 280). Tasks A/B now cover that read-only Split/Bonus sort and the Later group, plus the exact dividend wording and meeting spelling. See the top CA handoff for verification and remaining native acceptance; the CA window redesign and BSE Phase 2c follow separately.

## Context for starting a new thread

Workstream: **EOD Charting Platform**. Begin by reading [AGENTS.md](AGENTS.md), then the relevant portion of [HANDOFF.md](HANDOFF.md). Verify source authority and use [FILE_INVENTORY.md](FILE_INVENTORY.md) to locate the bounded issue before inspecting code. Consult the other owner documents only if relevant. Do not infer status from historical documentation; ask for explicit phase confirmation before editing the three phase sections above.
