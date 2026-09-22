# RISK_REGISTER

Date: 2026-04-11

## Superseded Historical Note

- Older entries focused on the Electron-to-Tauri migration path.
- The current runtime is Tauri-only; the risks below reflect the live repo state as of April 11, 2026.

| Risk | Why it matters | Likely impact | Mitigation plan | Severity |
| --- | --- | --- | --- | --- |
| `src-tauri-shell/src/database.rs` is still a backend monolith | One file owns registry, connection caching, migrations, stats, symbol reads, quotes, merges, watchlists, settings, and corporate actions | High regression risk during backend changes | Split by responsibility behind the current command surface and add focused temp-DB tests before behavioral refactors | High |
| `src/store/chartStore.ts` is still a frontend orchestration monolith | Startup, DB lifecycle, instrument loading, compare overlays, symbol browser, watchlists, drawings, and workspace behavior still converge in one store module | Hidden coupling and hard-to-isolate regressions | Continue feature extraction by action family while keeping the Zustand surface stable | High |
| `src/components/ChartCanvas.tsx` mixes engine bridge and complex UI chrome | The canvas wrapper now owns engine sync, pane controls, drawing menus, drawing properties, and scrollbar UX | UI regressions and hard-to-review diffs | Split into a thin engine bridge plus focused overlays/components/hooks | High |
| Automated tests are narrow | Current tests cover only official watchlist logic; chart engine, chart store, and Rust DB code have no comparable safety net | Regressions may escape into manual-only validation | Add pure tests for scale/persistence helpers, mocked store tests, and Rust temp-DB tests | High |
| Generated official watchlist snapshot is huge | `src/features/watchlists/officialWatchlistData.generated.ts` dominates feature-folder diff size and review noise | Slower review and harder change isolation | Treat it as generated input with regeneration rules and avoid hand-editing it | Medium |
| Artifact-heavy repo obscures the active code baseline | `src-tauri-shell/target/`, `backups/`, `resources/release/`, `release/`, `dist/`, `analysis/`, `test-output/`, and the live DB folder sit beside source | Developers may edit or judge the wrong baseline; disk bloat slows iteration | Keep docs explicit, ignore disposable outputs in workflows, and avoid treating artifact folders as source-of-truth | Medium |
| Legacy packaging artifacts remain in-repo | `resources/release/win-unpacked/` and related packaging output are retained but disconnected from the active runtime path | Confusion about what is active vs historical packaging | Label them as legacy/disconnected in docs or move them behind an archival convention | Medium |
| Linked worktree can be mistaken for app source | `EOD Charting Platform/nice-merkle/` is a nested git worktree under the repo root | Search/index confusion and accidental edits in the wrong checkout | Document it explicitly and exclude it from active-path analysis/refactors | Medium |
| Live SQLite data lives in the repo tree | `EOD DATABASE/` includes a live SQLite DB plus WAL/SHM files | Accidental coupling between source changes and live local data, noisy repo state | Treat it as runtime data only and validate migrations on dedicated fixtures as well as the live DB | Medium |
| Windows portable assumptions still matter | The supported portable path is launcher-first and still depends on WebView2 availability | Startup failures or misleading portability expectations on clean machines | Keep launcher-first docs, diagnostics, and the staged portable README accurate | Medium |
| Operational docs can drift again | Multiple handoff docs exist at the repo root and are used as session baselines | Future AI or human sessions may start from stale assumptions | Update `README`, `FILE_INVENTORY`, `PROJECT_STATE`, and `RISK_REGISTER` together whenever repo boundaries change | High |
