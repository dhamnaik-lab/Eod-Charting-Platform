# AGENTS.md

Project root: `E:\TA Projects\EOD Charting Platform`

## Start

- Confirm the project root before editing.
- For ongoing project work, read only the relevant current section of `HANDOFF.md`. Use task-relevant snippets from `README.md`, `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`, `FILE_INVENTORY.md`, or a report as needed; self-contained tasks do not require historical reading.
- Current files and active code are authoritative. Backup copies and removed skills are reference material only.

## Repo boundaries

- Active runtime: Tauri 2 + React + TypeScript + Rust. Active backend: `src-tauri-shell`.
- Preserve local-first behavior and keep renderer-to-desktop calls behind `src/platform/*`.
- Treat `dist/`, `release/`, `target/`, `src-tauri-shell/target/`, `EOD DATABASE/`, `backups/`, and linked worktrees as non-source unless explicitly targeted.
- Corporate Actions use the accepted three-action normal workflow: Fetch from Officials → Load & Validate → explicitly Approve Ready. Fetch and Load automatically perform eligible source collection, matching, deduplication, readiness checks and preparation, but NEVER execute financial approval. A deliberate user Approve confirmation is required; preserve backend rechecks, transactional adjustment records, raw `.eod` immutability, chart/cache refresh and the advanced maintenance UI. Legacy automatic Split/Bonus or Dividend write-stage settings must not be enabled or bypassed by default.
- Quotation deletion is quote-only: removing the last quotation must not auto-delete instrument/symbol identity. Provenance-scoped cleanup belongs to Manual Import Recovery, not normal quote deletion.
- Preserve exchange identity fidelity. Do not synthesize BSE trading symbols from company/security names; keep official source identifiers unchanged unless an audited identity mapping explicitly resolves them.
- Preserve broad NSE equity ingestion. Do not add an equity-series whitelist that drops supported equity/trade-for-trade/SME series such as `EQ`, `BE`, `BZ`, `SM`, `ST`, or `SZ`; persist series metadata and keep normal series filtering in the Symbols/sidebar layer. Existing configured government-security exclusions are a separate non-equity rule.
- Bhavcopy durability is evidence-backed: the binary worker cap is 4; only the recovery-journal-governed `APPEND_NEWEST` path may defer `sync_data()`. `REWRITE_TAIL`, `UPDATE_EXISTING`, `INSERT_HISTORICAL`, recovery replay, and Manual Import remain immediately durable unless a separately validated design changes that contract. Successful deferred APPEND_NEWEST sessions are normally checkpointed in the background with the same 4-worker cap; `APPLIED` and interrupted `CHECKPOINTING` states are resumable, while verification failure must retain the conservative recovery fallback.
- Bhavcopy calendar/planning semantics are also evidence-backed: known special trading sessions override weekend/holiday skipping; a network/source miss must not be relabeled as a holiday; automatic `Update` probes the current local date only from 18:00 onward, while manual Date Range remains explicit.
- Preserve accepted Fibonacci geometry. Keep Fib Wedge data-space-first, Fib Spiral on its same-timeframe basis, and persisted kind `fibFan` on exact projected anchor-to-Fibonacci-target rays for zoom stability. Reopen a completed Fibonacci tool only for a new reproducible defect.

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
- Reserve `docs/` for documents, including reports, plans, audits and handoff notes. Keep established root project control files in place. Put test databases, scratch files and evidence staging under `tmp/`.
- Before editing, back up the files in scope under `backups/` with `scripts/create-project-backup.ps1 -ShortName <name> -Paths <paths>` unless the task explicitly forbids backup changes. Back up newly added scope before editing it. Never edit a backup or restore from one without approval.
- Do not restore or recreate `.codex/skills` without explicit approval. Remove stale skill references instead of treating them as missing dependencies.
- Make small edits. After implementation, update every document affected by the change. When project state changes, record the immediate resume point, affected paths, backup, checks, and remaining acceptance in `HANDOFF.md`. Track running, completed, and next phases in `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`. Keep `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md` focused on the current design.

## BUILD-01 shared Cargo artifact policy

- Reuse the existing build when it can verify the task. Get explicit user approval before creating or staging a new release, installer or portable build, or creating a separate Cargo target. Reuse the root `target` dependency and debug artifacts for focused checks whenever compatible.

- For routine EOD `cargo check`, `cargo test`, and `cargo build`, use `scripts/Invoke-EOD-SharedCargo.ps1` from the verified project root. It pins the manifest and shared `target` path; run `-Mode Preview` first, then `-Mode Run` for an approved compilation. Run Cargo commands serially.
- Do not set a temporary `CARGO_TARGET_DIR`, `CARGO_BUILD_TARGET_DIR`, or `CARGO_BUILD_BUILD_DIR`; do not supply `--target-dir` pointing into `tmp`. The shared Cargo artifacts belong only under the project-root `target`; `tmp` holds fixtures, staged evidence, and diagnostics, not copied dependency trees.
- If a genuinely isolated Cargo target is necessary for source/fixture independence, stop and obtain explicit approval, record the exact path and reason, and define its retention and exact-path cleanup before compiling. Do not delete or consolidate evidence automatically.
- Preserve debug/test/release Cargo profiles, toolchain defaults, incremental settings, application data, the existing portable build workflow, and all accepted tests. This policy cannot force reuse across incompatible feature/profile/toolchain/flag combinations or intercept external tools that bypass the wrapper.

## TMP-01 disposable scratch-workspace retention policy

- Keep retained test databases and their evidence under `tmp/fixtures/<task>/`. For ChatGPT + PowerShell evidence ZIPs, stage under `tmp/` and save the final ZIP in `Join-Path $HOME 'Downloads'`. Include an IST timestamp in its name and record its SHA-256 with `Get-FileHash -Algorithm SHA256`.

- Keep working build outputs in the shared project-root `target` under BUILD-01. Do not create nested `target` / `cargo-target` directories in `tmp` without a separately approved isolation exception.
- New genuinely disposable test scratch belongs in explicitly marked `tmp/disposable/<tag>_<unique-id>` directories created by `scripts/Invoke-EOD-TmpLifecycle.ps1 -Action Create -Tag <tag>`. Never use this managed prefix for source code, database copies/fixtures, evidence, recovery materials, Cargo targets, portable outputs or backups.
- Use the lifecycle helper's `Preview` to review marked workspaces and their retention eligibility. Cleanup is strictly one exact marked workspace at a time, with `-WorkspaceId`, `-ConfirmExactWorkspace`, closed writer processes, and the default seven-day retention. Do not age-delete unmarked folders or delete the entire `tmp` or `tmp/disposable` tree.
- Task-specific proof, logs needed for regressions, DB fixtures, source snapshots, manual checkpoints and rollback evidence must remain in their separately owned locations, not marked scratch. Fail-closed cleanup is intentional.
- This helper is opt-in for new runners; it does not change legacy test paths or automatically schedule deletion. Any historical `tmp` cleanup requires a separate pinned, reviewed, exact-path authorization.

## Validation

- **Mandatory Rustfmt pre-publication gate:** For any changed Rust source, run the canonical `rustfmt --edition 2021 --check <changed-rust-files>` with a real Rust toolchain **before publishing the source commit**. A visually reviewed or hand-formatted file is not a passing formatter check. If the editing environment lacks `rustfmt`, do not publish the source as formatter-verified or ready for Windows acceptance; obtain a formatter check from an authorized Rust-enabled environment before source publication. Record the actual command and result. If a user-provided Windows `rustfmt --check` fails, apply the exact reported diff and revalidate before any other tests. The separate GitHub Renderer CI does not certify Rustfmt.
- Use `scripts/validate-change.ps1 -Profile <docs|renderer|tauri|corporate-actions>` when applicable.
- Run checks serially; do not start parallel validation during Rust/Tauri compile/link.
- Report each command as PASS, FAIL, or incomplete. Never infer success from a timeout.
- For Rust backend logic changes, run the smallest focused Rust test for the affected module/function first.
- Filtered Rust tests may still compile/link the Tauri harness. State the exact command and reason before a long run; report compile/link time without assuming a hang.
- Use `cargo check`, `cargo test --no-run`, or `validate-change.ps1 -Profile tauri` only when the affected change needs broader backend/Tauri coverage.
- Do not run full workspace tests or full validation profiles unless explicitly requested, required for release/merge, or directly relevant to the touched area.
- The user rebuilds portable Windows manually. After routine code changes, run focused checks and leave the release Tauri shell EXE, installer, and portable builds/staging to the user. Report when their portable rebuild is needed to use runtime changes.
- Build release executables or packages only with explicit user approval. Explain the diagnostic need before requesting a build for a build-specific failure. Focused Rust test-harness compilation remains allowed for required tests.
- Do not regenerate build metadata or stage portable outputs as routine completion steps.
