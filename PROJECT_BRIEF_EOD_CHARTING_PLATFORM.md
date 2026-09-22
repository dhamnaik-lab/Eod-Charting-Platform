# EOD Charting Platform - Project Brief

## Project Name
EOD Charting Platform

## Canonical Operational Docs

The current operational source of truth is:

- `CLAUDE_HANDOFF_PROMPT_EOD_CHARTING_PLATFORM.md`
- `CURRENT_ARCHITECTURE_STRUCTURE_EOD_CHARTING_PLATFORM.md`
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`

Historical note:

- `EOD_CHART_CODEX_PROMPT_REVISED.md` is now scaffold-era context only and should not override the current Tauri-only repo state.

## Purpose

EOD Charting Platform is a Windows-first desktop end-of-day charting application for Indian markets (NSE/BSE), built around React, TypeScript, Rust-backed Tauri services, local SQLite storage, and a custom HTML5 Canvas chart engine.

## Core Goals

- Support explicit multi-database lifecycle with recent-database tracking
- Keep SQLite as the local source of truth for symbols, bars, watchlists, and settings
- Support CSV preview/import and NSE bhavcopy download into the active database
- Provide fast search, watchlists, and exchange-aware symbol loading
- Render a chart-first desktop workspace with a native menu bar
- Improve desktop chart usability with predictable navigation, readable panes, and practical drawing tools
- Preserve a clean renderer/runtime seam that survives future optimization work

## High-Level Product Vision

The product should behave like a serious local charting workspace with:

- native desktop behavior through Tauri
- explicit `New/Open/Close Database` flow
- recent-database registry in runtime state
- exchange-aware symbol identity `{ symbol, exchange }`
- custom canvas candlestick rendering
- daily / weekly / monthly / quarterly / yearly aggregation
- watchlists, symbol search, import workflow, and bhavcopy ingestion
- manual import plus source-linked manual update of official NSE/BSE sector and index watchlists
- a native `Watchlist` menu area for management/import workflows
- per-chart-window Sheets and chart-window persistence

## Current Product Direction

- Desktop runtime: Tauri 2 only
- Frontend: Vite 5, React 18, TypeScript 5
- Backend: Rust services under `src-tauri-shell`
- Renderer desktop calls must flow through `src/platform/*`
- `src-tauri-shell` is the only active backend path
- the old `src-tauri` tree was removed on April 4, 2026 because it was not part of the active build/runtime path
- Windows portable Tauri workflow is the primary daily-use baseline
- Installer-first hardening and macOS work remain deferred
- Performance work should focus on backend/query/state efficiency, not on rewriting the chart engine

## Implementation Status

- Active renderer foundation lives in `src/*`
- Active runtime/backend foundation lives in `src-tauri-shell/*`
- Tauri menu, dialogs, database lifecycle, symbol reads, watchlists, layouts, import, bhavcopy, quote editing, merge-symbol flows, and corporate-action writes are all wired through the active Tauri path
- Official watchlist import/update/live-source workflow is complete
- Watchlist management now has a top-level `Watchlist` menu and a larger two-pane official importer
- The chart workspace now has per-chart-window Sheets, a refined header/timeframe area, stable cursor-anchored zoom, improved crosshair/date labels, and clearer pane structure
- Frontend architecture has begun splitting shell UI/layout state out of the mega-store via `src/store/uiStore.ts`, `src/store/workspaceStore.ts`, and thin feature-service seams under `src/features/*`
- Workspace persistence and lightweight snapshot loading now also live behind shared feature modules under `src/features/workspace/` instead of staying embedded entirely inside `src/store/chartStore.ts`
- Official watchlist resolver helpers now live in `src/features/watchlists/officialWatchlistResolver.ts`
- Official watchlist import/update business logic now lives in `src/features/watchlists/officialWatchlistImportService.ts`; `chartStore.ts` is at 1,566 lines after six behavior-preserving extraction passes
- Recent performance passes added:
  - persistent active SQLite connection reuse in Tauri
  - lightweight snapshot loading
  - SQL-first symbol listing/search
  - recent EOD reuse
  - cheaper watchlist-only refresh paths

## Current In-Scope Areas

- database lifecycle and SQLite-backed persistence
- symbol search and watchlist management
- official watchlist import/update/live fetch with fallback
- CSV preview/import
- bhavcopy download/import
- chart loading by `{ symbol, exchange }`
- chart engine, crosshair, zoom, pan, hover readout, panes, and drawing tools
- workspace layouts and per-chart-window Sheets
- in-app sheet create/rename/delete dialogs instead of browser-native prompt/confirm UI
- in-app watchlist create/rename/delete dialogs plus toast-based watchlist error feedback
- in-app layout delete confirmation instead of browser-native confirm UI

## Explicitly Out Of Scope For This Milestone

- live market feeds
- broker APIs
- cloud sync
- multi-user features
- scheduled auto-update of official watchlists
- macOS release hardening
- full installer-first release hardening

## Architectural Direction

- Keep `src/platform/*` as the stable renderer/runtime seam
- Keep Rust/Tauri responsible for desktop/backend services
- Keep chart rendering and interaction in the current TypeScript canvas engine
- Never use bare symbol strings where exchange could matter
- Keep changes incremental and testable
- Do not reintroduce or recreate the removed legacy `src-tauri` tree as an active backend path

## Non-Negotiable Constraints

- Do not bypass `src/platform/*`
- Do not add direct Tauri imports to renderer files outside `src/platform/*`
- Do not reintroduce Electron runtime code
- Do not reintroduce single-database assumptions
- Do not rewrite the chart engine unless a task explicitly requires it
- Keep the app local-first
