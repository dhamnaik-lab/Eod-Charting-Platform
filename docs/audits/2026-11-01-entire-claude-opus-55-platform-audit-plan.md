# EOD Charting Platform — Entire / Claude Opus 5.5 full-platform audit plan

**Status:** Audit setup only; no audit performed or certification granted.  
**Audit base:** `main` at `7865a7ef1931ee4b410882d81e7b97e773d98d2a` (2026-11-01).  
**Audit branch:** `audit/claude-opus-55-platform`  
**Agent:** Claude Opus 5.5 Full Platform Auditor, manual trigger, read-only.  
**Purpose:** Independently inspect the *existing application* in bounded passes. This document is an audit charter, not a code change and not evidence of any bug.

## Execution and integrity rules

1. Confirm the exact repository, commit SHA, base/head refs and available checkout before reading code. Do not assume that a Trail change review is a full-repository review. The change on this branch is this audit-plan document only.
2. Inspect actual source code beyond this document. The frontend, platform bridge and native backend are candidate starting points, **not** proof of coverage: `src/`, `src/platform/`, `src-tauri-shell/`, `packages/` and relevant tests, configs and build definitions. Discover active versus legacy paths from the repository.
3. Run **one audit phase per paid invocation**. The initial invocation is **Phase 1 only**. Do not present uninspected phases as complete.
4. Read-only. Do not edit sources, create commits, push, merge, deploy, modify application data, or access live market/broker endpoints. Do not read or print secrets. Do not install dependencies or execute test/build commands that write to source or production paths. If safe tests cannot run, record that explicitly.
5. Report evidence with repository-relative file paths, line ranges, reproduction conditions and confidence. Distinguish confirmed defects, likely defects, potential risks and missing evidence. Avoid fabricated findings and duplicates.
6. Budget awareness: stop within the Agent's configured limit, capture an honest inventory of what was actually examined, and identify remaining items for subsequent runs. Manual initiation only; do not automatically retry.
7. No test or check may be marked PASS without execution evidence. An Agent PASS is not full-platform certification. The user reviews findings and independently approves any repair.
8. Before starting any run, verify that Entire allows the Agent to inspect the entire checked-out repository. If only the Trail diff is accessible, report a scope blocker and stop.

## Phased audit plan

| Phase | Subsystem | Main questions and boundaries |
| --- | --- | --- |
| **1 — initial** | Architecture and cross-layer contracts | Identify actual entry points, active vs legacy code, React/TypeScript boundaries, native Tauri commands/events, data ownership, error propagation, duplicated implementations, trust boundaries and incompatible contracts. |
| 2 | Chart engine and analytical correctness | Canvas rendering, indicators, panes, layout, zoom/crosshair, drawing tools, completed-bar behavior, persistence/state isolation and non-repainting guarantees where relevant. |
| 3 | Database and persistence integrity | Binary EOD and SQLite responsibilities, migrations, WAL, filesystem durability, locking, recovery, concurrent requests, writes/rollbacks and data identity. |
| 4 | Market data and corporate actions | Download/import validation, CSV/ZIP handling, exchange/source ambiguity, symbol identity, series handling, retries, recoverability and split/dividend transformations. |
| 5 | Security and dependencies | Input/file-path validation, command boundaries, credentials and logging exposure, deserialization, filesystem permissions, package vulnerabilities and supply-chain assumptions. |
| 6 | Runtime reliability and performance | Async scheduling, lock contention, resource lifetime, cancellation, shutdown, memory use, large datasets, errors and process lifecycle. |
| 7 | Tests, release and synthesis | Verified test coverage, reproducibility, native packaging, build pipeline, platform compatibility, known failures, risk register, severity prioritization and residual coverage gaps. |

## Phase 1 — specific audit instructions

- Inventory the project at this base revision before choosing any hotspots. Confirm whether documented frontend, backend and storage implementations are still active.
- Trace at least two representative cross-layer flows through actual callers and callees (for example: chart data load and market-data download), if accessible. Name exact functions/modules and where ownership or validation changes.
- Inspect error-handling contracts and potential mismatches between UI state, bridge events/commands, Rust results and storage state.
- Identify architectural risks that have evidence in code. Do not infer defects solely from naming or documentation.
- Report file-by-file coverage and the unfinished work. If full Phase 1 coverage is not possible within time budget, return `PARTIAL` rather than claiming complete audit.

## Required report contract (every phase)

1. Phase name, repo, audited SHA, base/head comparison, Agent run ID and wall-clock time where available.
2. Summary stating **COMPLETE / PARTIAL / BLOCKED**, not merely PASS/FAIL.
3. Findings in severity order (Critical, High, Medium, Low), including status (confirmed / potential), confidence, exact code evidence, reproduction conditions and non-destructive recommended correction.
4. Tested commands/results, or `NOT RUN` with the reason.
5. Files inspected (path plus what was verified), critical paths not inspected, and coverage assumptions.
6. Test gaps, architectural or operational hazards, and any risk of false negatives.
7. A deduplicated risk register and the next bounded phase or remaining Phase 1 tasks.
8. A numeric risk score (0–100; lower is better) **only if justified by the inspected evidence**; otherwise `NOT SCORED`.
9. PASS/FAIL verdict for the *examined scope only*, with explicit blockers.

## Acceptance criteria before using audit results

- Audited source is tied to an exact SHA and inspected-file list.
- Every High/Critical finding has an independently checkable code trail.
- Missing dependencies or restricted sandbox execution are called out.
- Reviewer has not changed production code/data or pushed any commit.
- The user validates important defects locally before making repair or merge decisions.
- Full-platform coverage may only be claimed once all seven phases have documented their actual inspected areas and remaining gaps.

## Workflow

1. Link this audit branch to a **new Entire Trail**, using `main` as base and `audit/claude-opus-55-platform` as head.
2. Inspect the resulting Trail diff; it should contain **only this Markdown file**.
3. Manually choose **Claude Opus 5.5 Full Platform Auditor** and run **Phase 1 only**.
4. Evaluate whether the report actually inspected application source, not just the plan/diff. If not, mark the entire audit approach `BLOCKED` and do not repeat paid runs on empty scopes.
5. Review actual credit use and coverage before planning Phase 2; any subsequent audit work needs a suitable documented execution target and phase-specific instructions.

Do not merge this audit-document branch into `main` solely to run Entire. Keep the user's original working folders and Git worktrees unchanged.
