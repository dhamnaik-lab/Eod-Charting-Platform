# DOCSYNC-01 — Current Native Rust Scanner documentation reconciliation

- **IST timestamp:** 2026-11-22 00:53 IST (UTC+05:30)
- **Workstream / authorized Windows root:** EOD Charting Platform, E:\TA Projects\EOD Charting Platform
- **Verified original GitHub source:** `main@09d329813706e3948820cc663507b197b5b07dd5`
- **User-reported local source:** `main@09d329813706e3948820cc663507b197b5b07dd5` from NSR5 PR #134 guarded Run output; 10 dirty worktree entries preserved; staged 0
- **Documentation branch:** `docs/eod-scanner-current-state-20261122`; **DRAFT/NOT MERGED**, pending read-only link/content checks and explicit user merge approval
- **No implementation, configuration, dependency, DB, .eod, build or portable modifications**

## Objective and previous limitation

Update **living** root/plan scanner documents after merged PRs #124/#125, #128/#129, #132 and #134. Existing plans, architecture, matrix and handoffs referred to pre-merge draft PRs, candidate-only core support, or an old GitHub authority; readers could mistakenly conclude Rust source/tests had never passed, four gaps were the only native routes, or TypeScript retirement was already allowed.

Keep the 2026-11-04 ZIP audit, dated change logs, governance rules and other workstreams as historical/unchanged. This is an authority **reconciliation**, not a retrospective rewrite of past results or a new application audit.

## Files updated on the documentation branch

1. `docs/plans/2026-11-21_NATIVE_SCANNER_RETIREMENT_READINESS.md` — living source-confirmed coverage, merged CI, nine broader retirement gates, outstanding native categories and consolidated Windows acceptance.
2. `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md` — correct runtime routing and ownership, core warm-up and native Skipped/reporting, Rust/renderer evidence and HOLD boundaries.
3. `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md` — distinguish historical NS-04 checkpoint from verified current main; document ten native latest-only core rules and four gap latest/history routes.
4. `PROJECT_STATE_EOD_CHARTING_PLATFORM.md` — update **only** current-source pointer, preserving the original ZIP-only snapshot findings and SHA.
5. `FILE_INVENTORY.md` — update relevant scanner source/test/plan navigation.
6. `README.md` — link the living scanner plan; distinguish source authority from older ZIP snapshot.
7. `HANDOFF.md` — prepend current scanner/docs checkpoint **after reconstructing the known preserved local-only chart note**, leaving the rest of GitHub history intact.
8. `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md` — same verified local-note preservation, and concise completed/running/next gates.
9. This DOCSYNC-01 change record (new file).

## Exact handoff preservation evidence

The user-supplied `Eod Charting Platform Source Code 2026-11-21_231811_IST.zip` was opened **only as a candidate for two dirty local root handoff files**; a ZIP name/date is not source authority. Their extracted contents were compared against SHA-256 hashes recorded in the guarded PR #130 preflight and preserved unchanged in the successful PR #132 and #134 fast-forwards:

| Local file | Confirmed user-local SHA-256 | Old GitHub main Git blob from the suffix |
|---|---|---|
| `HANDOFF.md` | `76C743E3FEF5B759F25A4C76BD0E3B85BD2F86E239FFA027E82AA783081CA88B` | `847b11a4860518bb1f8c2d4749424c8bbe9ccf89` |
| `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md` | `B83EC5B36FB2E76DC1CBD9D1448941341934730A7D874D1BBAAD76ADA5E477C4` | `45f0cc286f243d42cfdc2da353fdd80bbfe18c19` |

After removing exactly the first local chart-fix paragraph and following blank line, normalizing CRLF to LF, and computing the actual Git `blob {length}\0{bytes}` SHA-1, **both remainder blobs exactly match GitHub main**. The old local chart note was then retained verbatim before the complete baseline handoff, and a fresh current checkpoint was prepended. No old local handoff notes were intentionally discarded.

**Merge hazard:** These two files remain dirty on the user's Windows machine. A documentation merge **must not be done directly on that dirty worktree** until an exact SHA-guarded local handoff reconciliation is approved; preserve all other ten local entries. GitHub remote publication alone is not proof the Windows handoffs were updated.

## Confirmed source and CI facts referenced

- [PR #125](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/125): native gap history implementation merged. Prior 14-target Exhaustion Gap parity of 128/128 is **one** focused observation.
- [PR #128](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/128) / [#129](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/129): merged ten canonical core predicates/metadata and explicit opt-in **latest-only** native routing. [PR #127](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/127) was closed unmerged as superseded.
- [PR #132 Rust CI](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/44935559512): 115 native, 18 scanner-module, 1,406 full-suite Rust tests passed (26 ignored); [PR #132 Renderer CI](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/44935559542): 2,104 passed / 1 skipped.
- [PR #134 final-head Renderer CI](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/44938860710): 2,108 Vitest passed / 1 skipped, TypeScript typecheck and Vite build PASS.
- Latest local fast-forward SHA-256 preservation is user-provided command output; **not** an independent live Windows file read.

## Behavior preserved and current limitations

- Scanner remains **native OFF by default**, TypeScript default/fallback preserved; no alerts emitted by native, no automatic external plugin execution, only four gaps native latest/history and ten core OHLCV native latest-only.
- Full-history core and unsupported selections remain on TypeScript; 1,000-endpoint generic numeric-history cap remains. Daily-market, remaining chart-patterns, visual/custom signals, formulas and alert/plugin parity remain future gates.
- CA-01 adjusted-native remains HOLD. No raw data or database touched. CHART130 portable chart zoom/scrollbar visual acceptance is separately pending.
- A single consolidated Windows portable and registered-DB/GUI parity acceptance is **NOT RUN** on post-PR #134 source; full TypeScript scanner retirement is **NOT AUTHORIZED**.
- Governance files `AGENTS.md`, `GEMINI.md`, requirements, historical audits and dated old change records are **unchanged** (their original scope remains correct).

## Validation performed / actual result

- GitHub current-branch and merged PR status reads: PASS on pinned `main@09d329813706e3948820cc663507b197b5b07dd5`.
- Exact two local-hand-off SHA-256 checks and Git blob suffix reconstruction: PASS (recorded above; local ZIP content only). No Windows files were written.
- Documentation-only GitHub file updates: source-blob checked and committed on isolated branch; a new PR is still to be created and checked for exact file scope.
- GitHub documentation diff, link existence, PowerShell `scripts/check-doc-references.ps1` and `scripts/validate-change.ps1 -Profile docs`: **PENDING**; do not claim PASS before actual output.
- No Rustfmt, Cargo, Vitest, renderer build or portable app command was run by this documentation refresh, and no fresh source-code changes require them.

## Risks and rollback

- **High-risk integration edge:** GitHub and local handoffs are both changed, while the local versions contain preserved uncommitted chart notes. Use exact SHA-256 guards and verify incoming Git blobs and worktree hashes before any merge. Abort rather than overwrite/clean/reset/stash.
- Historical statements within dated handoff entries remain at their **original date** and may mention pending PRs; the new leading current checkpoint supersedes them without falsifying the historical record.
- Incomplete GitHub link/static checks or later repository changes require review before merge. No direct edits on the user's Windows machine were made; AGENTS-mandated local backup action is pending the Windows integration step.
- Rollback this docs-only branch by closing the draft PR unmerged. After approval/merge, use a reviewed Git revert or exact pinned baseline file restores, retaining the user-local chart notes. No database rollback or binary artefact handling is involved.
