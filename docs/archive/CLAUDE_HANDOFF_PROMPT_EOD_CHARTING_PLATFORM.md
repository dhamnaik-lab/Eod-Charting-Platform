# External Agent Handoff - EOD Charting Platform

Project root: `E:\TA Projects\EOD Charting Platform`

Work on the existing Tauri desktop application. Do not treat it as a new scaffold and do not assume prior thread context.

## Read first

1. `AGENTS.md`
2. `HANDOFF.md`
3. Only the task-relevant source and report named by the current request

## Non-negotiable repo truth

- Active runtime: Tauri 2 + React + TypeScript + Rust.
- Active backend: `src-tauri-shell`; do not recreate old `src-tauri` or Electron runtime paths.
- Keep renderer-to-desktop access behind `src/platform/*`.
- Preserve local-first behavior, user data, and unrelated dirty-worktree changes.
- Corporate-action imports stay review-first and raw `.eod` history stays immutable unless explicitly changed.

## Working rules

- Keep reads and diffs targeted; cap unknown output at 6,000 bytes/characters.
- Use backup snapshots and removed skills only as historical reference. Do not restore `.codex/skills` without approval.
- Make the smallest viable change and update only docs whose behavior or file-role guidance changed.
- Use `scripts/validate-change.ps1` with the narrowest applicable profile. Do not run packaging or broad builds unless requested.
- Report changed files, deliberate exclusions, risks, and actual PASS/FAIL/incomplete validation results.

The exact current product checkpoint and next step are in `HANDOFF.md`.
