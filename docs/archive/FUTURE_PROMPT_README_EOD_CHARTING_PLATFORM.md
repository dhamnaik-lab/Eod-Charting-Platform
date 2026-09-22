# Future Codex Guide - EOD Charting Platform

Use this only as a compact routing guide. `AGENTS.md`, `HANDOFF.md`, the current prompt, and active code take precedence.

## Minimum read

1. `AGENTS.md`
2. `HANDOFF.md`
3. The task-relevant section of `README.md` or `FILE_INVENTORY.md`
4. One relevant report, then the smallest source seam

Do not read the full project-state history, backup trees, archives, generated output, databases, or broad source folders by default.

## Task routing

- Chart/workspace: start with the exact component plus its engine/store/persistence seam only when relevant.
- Corporate actions: `HISTORICAL_CORPORATE_ACTIONS_BACKFILL_PHASE_PLAN.md`, `src-tauri-shell/src/database/corporate_action_imports.rs`, and the affected UI/bridge file.
- Database/import/bhavcopy/watchlists: start with the specific dialog or service and its matching Rust module.
- Runtime/menu/platform: `src-tauri-shell/src/main.rs`, `src/features/app/menuCommandRouter.ts`, and `src/platform/*` as required.

## Contracts worth preserving

- Tauri is the only active runtime; `src-tauri-shell` is the only active backend.
- Renderer desktop access stays behind `src/platform/*`.
- Chart viewport, sheets, panes, drawings, overlays, and workspace persistence are regression-prone; test only the touched contract.
- Watchlist changes must preserve conservative matching and keep result counts aligned with user messages.
- Import changes must verify preview and import behavior. Chart-data changes must consider raw and adjusted modes.
- Corporate-action imports remain review-first, and raw `.eod` history remains immutable unless a task explicitly changes those contracts.
- Rust and TypeScript menu/bridge command names must remain synchronized.

## Validation

Use `scripts/validate-change.ps1` with the narrowest applicable profile. `-Full` is opt-in and still does not package the desktop app. Record timeouts as incomplete.

## Archived guidance

Removed repo skills and old backup instructions may be inspected as historical reference only. They are not dependencies. Do not restore `.codex/skills`, old hooks, or stale prompt routing without explicit approval.

## Future prompt shape

State the project root, exact scope, behavior-change permission, files to inspect first, preservation constraints, expected deliverables, and validation profile. Do not rely on prior thread memory.
