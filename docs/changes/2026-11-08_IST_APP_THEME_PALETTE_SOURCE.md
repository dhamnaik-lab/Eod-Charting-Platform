# Application themes — palette source, accent contrast, system mode

8 November 2026 (IST). Renderer plus one Rust settings field. Follows the
[theme hardening change](2026-11-08_IST_APP_THEME_HARDENING.md) and closes four of its five
open recommendations.

## Behaviour before and after

| Area | Before | After |
|---|---|---|
| Palette source | Theme colours were written twice: CSS blocks in `global.css` and `CHART_THEMES` in `themeService.ts`, and the two had drifted (`--border`/`axisText` differed in five themes). | `src/features/app/themePalettes.json` is the single source. `scripts/generate-theme-tokens.mjs` emits `src/styles/theme-tokens.generated.css`; `themeService` derives ids, labels, chart palettes and the system map from the same file. |
| Filled accent labels | Primary buttons used `#ffffff` on `--accent`: 2.14:1 (AMOLED), 2.36:1 (Charcoal), 3.68:1 (Midnight), 4.10:1 (Eikon). | New `--accent-contrast` token per theme (dark ink or white as appropriate) and five filled-button styles use it. All ratios ≥ 4.5:1. |
| OS appearance | A single stored theme; no way to follow the operating system. | New `System (follow OS)` selector entry. `system` is persisted as the selection, resolved to `midnight-slate-pro` or `classic-light` via `themePalettes.json`, applied by the boot script before first paint, and re-resolved when `prefers-color-scheme` changes. |
| Chart colour customisation | “Customised or not” was inferred from sentinel values (`#26a69a`, `#1e2a3a`, …), so a deliberate pick could be silently ignored. | The profile stores `chartColorsCustomized` (`null` = legacy, `false` = untouched, `true` = user choice). `getChartTheme(id, colors, customized)` ignores stored colours when `false`, honours them when `true`, and keeps the legacy heuristic only for `null`. Editing any chart colour in Settings marks the profile customised. |

`classic-light-refined` still shares the Classic Light chart palette, now expressed once in the
JSON source.

## Changed files

- Palette source and generator: `src/features/app/themePalettes.json`, `scripts/generate-theme-tokens.mjs`, `scripts/vitest-theme-setup.mjs`, `src/styles/theme-tokens.generated.css`, `src/styles/global.css`
- Theme service and settings: `src/features/app/themeService.ts`, `src/features/app/appSettingsService.ts`, `src/types/desktop.ts`, `src-tauri-shell/src/app_profile.rs`
- Startup and UI: `src/main.tsx`, `src/RootApp.tsx`, `src/components/SettingsDialog.tsx`, `public/theme-boot.js`
- Accent labels: `ChartSettingsDialog.tsx`, `IndicatorPickerDialog.tsx`, `RecentDatabasesDialog.tsx`, `BinaryEodParityDialog.tsx`, `SignalSettingsDialog.tsx`
- Tooling and tests: `vite.config.mts` (generator plugin), `vitest.config.ts` (global setup), `package.json` (`themes:generate`), `tsconfig.json` (`resolveJsonModule`), `themeSystemAudit.test.ts`, `themeContrast.test.ts`, `sidebarKeyboardFocus.test.ts`

## Validation

- `npx vitest run --exclude "tmp/**" src/features/app src/components/__tests__ src/engine/__tests__/ChartTheme.test.ts` — PASS, 26 files, 181 tests.
- `npm run typecheck:renderer` — PASS.
- `npx vite build --outDir tmp/theme-batch2/dist` — PASS (11.6 s); generator idempotent; `--accent-contrast` present in the built CSS.
- Shared Cargo `cargo check` via `scripts/Invoke-EOD-SharedCargo.ps1 -Mode Run` — PASS (40.7 s, shared root `target`).

Follow-up (8 November 2026): the experimental palette preview strip under the Theme dropdown was
removed after review. It looked interactive while being decorative, and exposed raw CSS token
names as tooltips. `Settings -> General` now relies on the dropdown alone.

Pending: portable rebuild and the native theme sweep, including switching the OS between light
and dark while `System (follow OS)` is selected.

## Deliberately not changed

- Theme-aware canvas annotation colours (`#f0c34e`, `#20d18b`, `#ff5757`) — the remaining open
  recommendation R-04; `ChartCanvas.tsx`/`Toolbar.tsx` currently hold another agent's uncommitted
  work.
- Residual literal UI colours (14) and their `--warning-text` follow-up.
- No change to fills, borders, candle palettes or theme identity; no automatic theme switching
  without an explicit `System` selection.

## Rollback

Pre-edit copies: `backups/pre_opencode_changes_20261108_143206_theme_batch2`. The generated CSS can
be rebuilt from the JSON at any time (`npm run themes:generate`); reverting the commit restores the
hand-written CSS blocks and the previous settings payload.
