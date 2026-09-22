# Theme Implementation Plan - 2026-05-24

## Scope

Implement a first-class multi-theme system for the active Tauri 2 EOD Charting Platform app.

Themes in scope:

- Midnight Slate Pro - default
- AMOLED Black
- Classic Light
- Deep Light
- Terminal Pro Dark

The old Claude warm palette remains useful only as the previous baseline reference. It is not the new default theme.

## Active Baseline

- Active frontend: `src/`
- Active desktop shell: `src-tauri-shell/`
- Legacy/disconnected baseline: old `src-tauri`

Do not use legacy `src-tauri` as the migration baseline.

## Implementation Contract

Theme switching must affect the whole active UI, not only the page background.

Covered surfaces:

- Global CSS variables and focus rings
- App shell, tabs, sidebar, toolbar, status bar, and chart dock
- Chart viewport shell, scrollbar controls, axis buttons, overlays, and core chart theme
- Dialogs, settings, picker windows, import/download windows, inputs, selects, buttons, hover/active/focus states
- Typography tokens such as font family, base size, compact UI size, and weights

Chart bullish/bearish semantics must remain stable across themes. Colors can be tuned per theme, but green/up and red/down meanings must not change.

## Architecture Direction

Use a named theme id stored in UI/app settings and reflected on the document root as `data-theme`.

Theme values should be exposed as CSS custom properties for React component styles. Canvas chart rendering should receive matching chart theme tokens instead of using a single static dark chart palette.

Expected theme model:

```text
theme id
  -> shell CSS variables
  -> typography/density variables
  -> chart canvas theme tokens
```

## Validation Targets

- TypeScript renderer typecheck
- Vite renderer build
- Manual visual smoke check of each theme in the active app

## Notes

This is an incremental migration. Hard-coded colors may be converted in practical groups, but the initial implementation should make the main application surfaces and chart experience visibly theme-aware.

## Implementation Progress

- Foundation implemented: named theme ids, persisted Settings selector, document `data-theme`, CSS theme tokens, and canvas chart theme tokens.
- Hardening implemented: main shell, chart controls, tabs, sheet tabs, legends, drawing dock, command palette, toasts, major dialogs, watchlist flows, import/download windows, database tools, layout manager, and error/FAQ surfaces now use theme tokens for app chrome.
- Terminal Pro Dark remains in the selector but was intentionally not color-tuned after user feedback.
- Remaining literal colors should be treated as semantic fallbacks, shadows/text shadows, chart/data defaults, or indicator/default series colors rather than the old app chrome palette.
- Classic Light Polish (2026-08-02): Fixed active tab background hierarchy (`SheetTabs.tsx`) to blend seamlessly with `#ffffff` chart surface; replaced hardcoded dark overlay text shadows with `var(--chart-overlay-text-shadow)` (`ChartCanvas.tsx`); refined chart grid lines (`rgba(203, 213, 225, 0.35)`) and axis text contrast (`themeService.ts`); replaced hardcoded backdrop in `Sidebar.tsx` with `var(--overlay-bg)`.
- Deep Light Theme Addition (2026-08-02): Added brand new fifth theme `deep-light` ("Deep Light Theme") preserving all pre-existing themes (`midnight-slate-pro`, `amoled-black`, `classic-light`, `terminal-pro-dark`) completely untouched. Registered `'deep-light'` in `APP_THEME_IDS`, `APP_THEME_OPTIONS`, and `CHART_THEMES` ([themeService.ts](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/features/app/themeService.ts)) with anti-glare `#f8fafc` canvas, slate-900 typography, emerald/crimson candles, 35% volume opacity, and dual-layer Fluent light shadows in [global.css](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/styles/global.css).
- Date Axis Bar Year Label Theme Fix (2026-08-02): Fixed hardcoded `#ffffff` white literal in [Renderer.ts:L404](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/engine/Renderer.ts#L404) for major year-transition tick labels (`tick.isYear`). Replaced with `resolveHighContrastText(theme.axisBackground)`, ensuring year transition labels (`2024`, `2025`, `2026`) render in dark slate text (`#111827`) on light axis bars while retaining bright text (`#e6edf3`) on dark axis bars across all themes.
- 4 Pro Terminal Themes Addition (2026-08-02): Added 4 institutional trading terminal themes (`bloomberg-pro`, `refinitiv-dark`, `orderflow-dark`, `tos-charcoal`), bringing total themes to 9. Registered in [themeService.ts](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/features/app/themeService.ts) and added full CSS design token blocks in [global.css](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/styles/global.css).
- Bhavcopy Download Button Contrast Fix (2026-08-02): Fixed unreadable text contrast on the primary "Start Download" action button in [BhavcopyDownloadWindow.styles.ts:L372](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/components/BhavcopyDownloadWindow.styles.ts#L372). Replaced `color: 'var(--text)'` with `color: '#ffffff'`, ensuring crisp white readable text over `var(--accent)` filled blue button backgrounds across all themes.
