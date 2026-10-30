# AGENTS.md

Project root: `E:\TA Projects\EOD Charting Platform`

## Start

- Confirm the project root before editing.
- For ongoing project work, read only the relevant current section of `HANDOFF.md`. Use task-relevant snippets from `README.md`, `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`, `FILE_INVENTORY.md`, or a report as needed; self-contained tasks do not require historical reading.
- Current files and active code are authoritative. Backup copies and removed skills are reference material only.

## Repo boundaries

- Active runtime: Tauri 2 + React + TypeScript + Rust. Active backend: `src-tauri-shell`.
- Preserve local-first behavior and keep renderer-to-desktop calls behind `src/platform/*`.
- Treat old `src-tauri`, Electron outputs, `dist/`, `release/`, `target/`, `src-tauri-shell/target/`, `EOD DATABASE/`, `backups/`, and linked worktrees as non-source unless explicitly targeted.
- Corporate Actions use the accepted three-action normal workflow: Fetch from Officials → Load & Validate → explicitly Approve Ready. Fetch and Load automatically perform eligible source collection, matching, deduplication, readiness checks and preparation, but NEVER execute financial approval. A deliberate user Approve confirmation is required; preserve backend rechecks, transactional adjustment records, raw `.eod` immutability, chart/cache refresh and the advanced maintenance UI. Legacy automatic Split/Bonus or Dividend write-stage settings must not be enabled or bypassed by default.
- Quotation deletion is quote-only: removing the last quotation must not auto-delete instrument/symbol identity. Provenance-scoped cleanup belongs to Manual Import Recovery, not normal quote deletion.
- Preserve exchange identity fidelity. Do not synthesize BSE trading symbols from company/security names; keep official source identifiers unchanged unless an audited identity mapping explicitly resolves them.
- Preserve broad NSE equity ingestion. Do not add an equity-series whitelist that drops supported equity/trade-for-trade/SME series such as `EQ`, `BE`, `BZ`, `SM`, `ST`, or `SZ`; persist series metadata and keep normal series filtering in the Symbols/sidebar layer. Existing configured government-security exclusions are a separate non-equity rule.
- Bhavcopy durability is evidence-backed: the binary worker cap is 4; only the recovery-journal-governed `APPEND_NEWEST` path may defer `sync_data()`. `REWRITE_TAIL`, `UPDATE_EXISTING`, `INSERT_HISTORICAL`, recovery replay, and Manual Import remain immediately durable unless a separately validated design changes that contract. Successful deferred APPEND_NEWEST sessions are normally checkpointed in the background with the same 4-worker cap; `APPLIED` and interrupted `CHECKPOINTING` states are resumable, while verification failure must retain the conservative recovery fallback.
- Bhavcopy calendar/planning semantics are also evidence-backed: known special trading sessions override weekend/holiday skipping; a network/source miss must not be relabeled as a holiday; automatic `Update` probes the current local date only from 18:00 onward, while manual Date Range remains explicit.
- Drawing-fidelity baseline: the Fibonacci family is accepted and closed at the August 13, 2026 F1E.1 checkpoint. Treat accepted Fibonacci geometry as protected while starting Gann work. In particular, Fib Wedge remains data-space-first; Fib Spiral remains on the restored F1D.1 same-timeframe basis (the F1D.2 absolute-time experiment is rejected); and persisted kind `fibFan` uses the F1E.1 exact projected anchor-to-Fibonacci-target ray construction for zoom stability. Reopen a completed Fibonacci tool only for a new reproducible defect.

## Coding assistant and prompt context

- The charting app does not use AI/OpenAI API; Codex uses account sign-in. Do not add API integration or cache configuration for prompt optimization unless explicitly requested.
- Follow the global prompt-context guidance: avoid copying historical handoffs into each request, and do not infer API billing or cache savings from account sign-in.

## Context limits

- Do not scan the full repo when exact paths are known. Start with 3-5 files.
- Skip generated, dependency, backup, archive, database, and raw-data folders unless the task targets them.
- Cap unknown command output at 6,000 bytes/characters. Use targeted `rg`, headings, `head`/`tail`, or a PowerShell substring cap.
- Do not read large files in full initially. Read at most 6,000 characters, then request targeted sections.

## Change discipline

- Preserve dirty-worktree changes and patch only the requested files.
- Store new Markdown files and other document deliverables, including reports, plans, audits and handoff notes, under `docs/`. Do not use `Output/` or `outputs/` for documents. Keep required project control files in their established locations.
- Create a normal pre-edit backup with `scripts/create-project-backup.ps1 -ShortName <name>` unless the task explicitly forbids backup changes. Never edit a backup or restore from one without approval.
- Do not restore or recreate `.codex/skills` without explicit approval. Remove stale skill references instead of treating them as missing dependencies.
- Make small edits. Update docs only when behavior, architecture, file roles, or operating guidance changed.

## BUILD-01 shared Cargo artifact policy

- For routine EOD `cargo check`, `cargo test`, and `cargo build`, use `scripts/Invoke-EOD-SharedCargo.ps1` from the verified project root. It pins the manifest and shared `target` path; run `-Mode Preview` first, then `-Mode Run` for an approved compilation. Run Cargo commands serially.
- Do not set a temporary `CARGO_TARGET_DIR`, `CARGO_BUILD_TARGET_DIR`, or `CARGO_BUILD_BUILD_DIR`; do not supply `--target-dir` pointing into `tmp`. The shared Cargo artifacts belong only under the project-root `target`; `tmp` holds fixtures, staged evidence, and diagnostics, not copied dependency trees.
- If a genuinely isolated Cargo target is necessary for source/fixture independence, stop and obtain explicit approval, record the exact path and reason, and define its retention and exact-path cleanup before compiling. Do not delete or consolidate evidence automatically.
- Preserve debug/test/release Cargo profiles, toolchain defaults, incremental settings, application data, the existing portable build workflow, and all accepted tests. This policy cannot force reuse across incompatible feature/profile/toolchain/flag combinations or intercept external tools that bypass the wrapper.

## TMP-01 disposable scratch-workspace retention policy

- Keep working build outputs in the shared project-root `target` under BUILD-01. Do not create nested `target` / `cargo-target` directories in `tmp` without a separately approved isolation exception.
- New genuinely disposable test scratch belongs in explicitly marked `tmp/disposable/<tag>_<unique-id>` directories created by `scripts/Invoke-EOD-TmpLifecycle.ps1 -Action Create -Tag <tag>`. Never use this managed prefix for source code, database copies/fixtures, evidence, recovery materials, Cargo targets, portable outputs or backups.
- Use the lifecycle helper's `Preview` to review marked workspaces and their retention eligibility. Cleanup is strictly one exact marked workspace at a time, with `-WorkspaceId`, `-ConfirmExactWorkspace`, closed writer processes, and the default seven-day retention. Do not age-delete unmarked folders or delete the entire `tmp` or `tmp/disposable` tree.
- Task-specific proof, logs needed for regressions, DB fixtures, source snapshots, manual checkpoints and rollback evidence must remain in their separately owned locations, not marked scratch. Fail-closed cleanup is intentional.
- This helper is opt-in for new runners; it does not change legacy test paths or automatically schedule deletion. Any historical `tmp` cleanup requires a separate pinned, reviewed, exact-path authorization.

## Validation

- Use `scripts/validate-change.ps1 -Profile <docs|renderer|tauri|corporate-actions>` when applicable.
- Run checks serially; do not start parallel validation during Rust/Tauri compile/link.
- Report each command as PASS, FAIL, or incomplete. Never infer success from a timeout.
- For Rust backend logic changes, run the smallest focused Rust test for the affected module/function first.
- Filtered Rust tests may still compile/link the Tauri harness. State the exact command and reason before a long run; report compile/link time without assuming a hang.
- Use `cargo check`, `cargo test --no-run`, or `validate-change.ps1 -Profile tauri` only when the affected change needs broader backend/Tauri coverage.
- Do not run full workspace tests or full validation profiles unless explicitly requested, required for release/merge, or directly relevant to the touched area.
- The user rebuilds portable Windows manually. After routine code changes, run focused checks and leave the release Tauri shell EXE, installer, and portable builds/staging to the user. Report when their portable rebuild is needed to use runtime changes.
- Build release executables or packages only when explicitly requested by the user or strictly necessary to investigate a build-specific failure. Explain the diagnostic need before running such a build; routine UI/backend changes do not qualify. Focused Rust test-harness compilation remains allowed for required tests.
- Do not regenerate build metadata or stage portable outputs as routine completion steps.
