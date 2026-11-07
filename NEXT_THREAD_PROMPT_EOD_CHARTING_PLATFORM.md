# EOD Charting Platform — phase tracker for the next thread

**Rule:** This file is the sole owner of **running, completed and next phase status**. A phase is assigned to one of these sections only when the user explicitly confirms its identity and status. Source code, test names, timestamps, historical chats and this reconstructed documentation are **not** phase completion or priority authority. See [AGENTS.md](AGENTS.md) for working rules and [PROJECT_STATE](PROJECT_STATE_EOD_CHARTING_PLATFORM.md) for the dated source audit.

## Running phases

**Corporate Actions Phase A, A1 (user assigned 8 November 2026):** evidence and fail-closed regression on `feat/ca-identity-gaps-20261108` from main `bc47208`; see [A1 findings](docs/plans/2026-11-08_CA_A1_IDENTITY_FINDINGS.md). AVANTI link absent from current official symbol-change file; GUJ rename verified but existing dated-chain proof cannot route the historical Split; PCBL history begins 2022-01-13. A1 remains open for a reviewed cross-symbol proof extension and missing copied price evidence. No production rule change or app rebuild. Next work stays within A1 until the user changes scope.

Final NSE Tasks 1–2 are implemented on `feat/ca-nse-final-20261108` from updated main `31487aa` (includes `61bb494`): Task 1 diagnosis stays disk-only under the ignored fixture; Task 2 adds the requested meeting/buyback/bond wording, 0.85 cash regression and named CSK share-distribution Deferred reason. Backend/renderer share 74 parity cases with financial-field/mixed-purpose negatives. No unsupported identity/activity override, financial approval or raw-price mutation. Final checks PASS: renderer typecheck; Vitest 567/567; focused Rust 4/4; seven-filter Rust 827 passed, 0 failed, 26 ignored. Both shared-Cargo previews PASS; `--jobs 2`. The bare `AGM Revised` negative remains rejected. See the top CA handoff for backup, exact local report path and missing copied price files.

**Corporate Actions Tasks A/B (7 November 2026):** diagnosis and automated verification are complete; runtime acceptance for NSE wording and Later is pending the portable rebuild. Other running-phase assignments await user confirmation.

## Completed phases

**Task A diagnosis complete:** 131 pending Split/Bonus rows grouped on the supplied read-only copy; evidence is in `tmp/fixtures/ca-diagnosis-20261107/`. Task B implementation/check results are recorded in the top Corporate Actions section of [HANDOFF.md](HANDOFF.md); native acceptance is separate. Other phase sign-off awaits user confirmation.

## Next phases

**Next for final NSE Tasks 1–2:** automated checks passed; user portable rebuild and copy-only native acceptance for the added wording and Deferred reason. Any further identity/activity correction needs supporting source evidence; missing EOD copies are named in the local diagnosis report. Keep tmp untracked and explicit approval/rechecks in place.

**Next for PR #27 interest parity:** after automated checks, user portable rebuild and copy-only native acceptance: Interest Payment and Interest Payment/Buyback close; Interest amounts keep the distribution Deferred reason; AGM and typo-only meetings are informational; AGM/dividend stays financial. Confirm no `tmp/` entries in the committed tree. Earlier Deb/predecessor native acceptance remains applicable.

**Next for the assigned Deb/predecessor Tasks 1–3:** user portable rebuild and copy-only native acceptance after validation. Verify all ignored fixture files remain on disk and the committed tree contains no `tmp/` entries. Do not synthesize missing identity links or approve any action automatically. The earlier copied-history findings below remain separate from this narrowly approved owner exception.

**Next for remaining-NSE Tasks 1–4:** user portable rebuild and copy-only native acceptance; the copied, hash-pinned price windows are now diagnosed. Investigate mixed price levels/shared coverage gaps and obtain independent source provenance before certifying already-adjusted history. Do not infer an official date correction from a missing month. Any price-proof exception needs an evidence-backed proposal and explicit approval; none is implemented. Preserve the qualified predecessor-owner checks and explicit financial approval. The older Tasks A/B native checklist below remains useful.

**Next for the assigned Tasks A/B:** the user rebuilds the portable app and checks Later and reclassification on a copy. Source delivery belongs on `feat/ca-nse-later-group-20261107`. The existing CA window redesign and BSE Phase 2c remain later work; this task does not implement them. Other priorities await user confirmation.

## Verified checkpoints for resuming work

The [accepted UX-13 implementation](docs/changes/2026-11-06_UX13_BHAVCOPY_REQUEST_STOP.md) and [main synchronization](docs/changes/2026-11-06_MAIN_SYNCHRONIZATION.md) are recorded separately from phase assignments. The [UI/UX evidence index](FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md#uiux-audit-findings) tracks outstanding native checks. The next workstream remains pending user direction.

The Corporate Actions Rust test repair (6 November 2026) is recorded in [HANDOFF.md](HANDOFF.md). The targeted Rust run passed with 797 tests, test files only. Audit fix M1 (manual Bonus face value) followed it, and the run passed with 798 tests. M1 needs the user's portable rebuild and a manual check. Run C then fixed L5 (Issues-tab direct Approve), the L1 Demerger parser and the 3 failing UI tests. Its user-run checks passed: 799 Rust tests and 535 UI tests. M2 is held because accepted tests keep normal approval outside the lock. Fix H1 (revoke) from the audit is not yet assigned as a phase. The user then approved a plan to make Split, Bonus and identity rows for current symbols reach Ready after Load & Validate. Phase 1 (read-only diagnosis), Phase 2a (split ISIN price proof, 805 Rust tests passed) and Phase 2b (legacy NSE split/bonus abbreviations and informational notices; 808 Rust and 536 UI tests passed) are recorded in HANDOFF.md. Phases 2c, 3 (Load & Validate groups) and 4 (one Corporate Actions window, with Identity Import inside it) are planned but not yet assigned as phases. Phase 3 (7 November 2026) closes informational notices once with a logged, reversible status `CLOSED_INFORMATIONAL` and leaves them out of the pending queue; checks passed (UI 537, Rust 813). Step 1 (more informational wording) passed (Rust 813) and the runtime check confirmed it (NSE Other Issues 363 -> 280). Tasks A/B now cover that read-only Split/Bonus sort and the Later group, plus the exact dividend wording and meeting spelling. See the top CA handoff for verification and remaining native acceptance; the CA window redesign and BSE Phase 2c follow separately.

## Context for starting a new thread

Workstream: **EOD Charting Platform**. Begin by reading [AGENTS.md](AGENTS.md), then the relevant portion of [HANDOFF.md](HANDOFF.md). Verify source authority and use [FILE_INVENTORY.md](FILE_INVENTORY.md) to locate the bounded issue before inspecting code. Consult the other owner documents only if relevant. Do not infer status from historical documentation; ask for explicit phase confirmation before editing the three phase sections above.
