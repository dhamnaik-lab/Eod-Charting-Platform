# AGENTS.md

Project root: `E:\TA Projects\EOD Charting Platform`

## Start

- Confirm the project root before editing.
- After `AGENTS.md`, read `HANDOFF.md` when it exists, then only task-relevant snippets from `README.md`, `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`, `FILE_INVENTORY.md`, and one relevant report.
- Current files and active code are authoritative. Backup copies and removed skills are reference material only.

## Repo boundaries

- Active runtime: Tauri 2 + React + TypeScript + Rust. Active backend: `src-tauri-shell`.
- Preserve local-first behavior and keep renderer-to-desktop calls behind `src/platform/*`.
- Treat old `src-tauri`, Electron outputs, `dist/`, `release/`, `target/`, `src-tauri-shell/target/`, `EOD DATABASE/`, `backups/`, and linked worktrees as non-source unless explicitly targeted.
- Corporate-action imports stay review-first; do not mutate raw `.eod` history or auto-approve rows unless explicitly requested.
- Quotation deletion is quote-only: removing the last quotation must not auto-delete instrument/symbol identity. Provenance-scoped cleanup belongs to Manual Import Recovery, not normal quote deletion.
- Preserve exchange identity fidelity. Do not synthesize BSE trading symbols from company/security names; keep official source identifiers unchanged unless an audited identity mapping explicitly resolves them.
- Preserve broad NSE equity ingestion. Do not add an equity-series whitelist that drops supported equity/trade-for-trade/SME series such as `EQ`, `BE`, `BZ`, `SM`, `ST`, or `SZ`; persist series metadata and keep normal series filtering in the Symbols/sidebar layer. Existing configured government-security exclusions are a separate non-equity rule.
- Bhavcopy durability is evidence-backed: the binary worker cap is 4; only the recovery-journal-governed `APPEND_NEWEST` path may defer `sync_data()`. `REWRITE_TAIL`, `UPDATE_EXISTING`, `INSERT_HISTORICAL`, recovery replay, and Manual Import remain immediately durable unless a separately validated design changes that contract. Successful deferred APPEND_NEWEST sessions are normally checkpointed in the background with the same 4-worker cap; `APPLIED` and interrupted `CHECKPOINTING` states are resumable, while verification failure must retain the conservative recovery fallback.
- Bhavcopy calendar/planning semantics are also evidence-backed: known special trading sessions override weekend/holiday skipping; a network/source miss must not be relabeled as a holiday; automatic `Update` probes the current local date only from 18:00 onward, while manual Date Range remains explicit.
- Drawing-fidelity baseline: the Fibonacci family is accepted and closed at the August 13, 2026 F1E.1 checkpoint. Treat accepted Fibonacci geometry as protected while starting Gann work. In particular, Fib Wedge remains data-space-first; Fib Spiral remains on the restored F1D.1 same-timeframe basis (the F1D.2 absolute-time experiment is rejected); and persisted kind `fibFan` uses the F1E.1 exact projected anchor-to-Fibonacci-target ray construction for zoom stability. Reopen a completed Fibonacci tool only for a new reproducible defect.

## Context limits

- Do not scan the full repo when exact paths are known. Start with 3-5 files.
- Skip generated, dependency, backup, archive, database, and raw-data folders unless the task targets them.
- Cap unknown command output at 6,000 bytes/characters. Use targeted `rg`, headings, `head`/`tail`, or a PowerShell substring cap.
- Do not read large files in full initially. Read at most 6,000 characters, then request targeted sections.

## Change discipline

- Preserve dirty-worktree changes and patch only the requested files.
- Create a normal pre-edit backup with `scripts/create-project-backup.ps1 -ShortName <name>` unless the task explicitly forbids backup changes. Never edit a backup or restore from one without approval.
- Do not restore or recreate `.codex/skills` without explicit approval. Remove stale skill references instead of treating them as missing dependencies.
- Make small edits. Update docs only when behavior, architecture, file roles, or operating guidance changed.

## Validation

- Use `scripts/validate-change.ps1 -Profile <docs|renderer|tauri|corporate-actions>` when applicable.
- Run checks serially. Do not run full builds, packaging, or broad test suites unless explicitly requested.
- Report each command as PASS, FAIL, or incomplete. Never infer success from a timeout.

## Validation Selection

- Do not run full validation by default.
- Default validation must be focused to the current touched seam.
- For Rust backend logic changes, run the smallest focused Rust test for the affected module/function first.
- A filtered `cargo test` may still compile/link the Tauri Rust test harness and appear slow; this is expected and should be reported as compile/link time, not treated as a hung test unless there is clear evidence.
- If Rust compile/link is expected to be long, state the exact command and why it is necessary before waiting.
- Use `cargo check`, `cargo test --no-run`, or `validate-change.ps1 -Profile tauri` only when the affected change needs broader backend/Tauri coverage.
- Do not run full workspace tests, full validation profiles, packaging, installer, or portable builds unless explicitly requested, required for release/merge, or directly relevant to the touched area.
- Do not start parallel validation while a Rust/Tauri compile/link is already running.
