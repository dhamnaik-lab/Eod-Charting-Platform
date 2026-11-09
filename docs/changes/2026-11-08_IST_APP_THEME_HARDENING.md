# Application themes — deep review and hardening

8 November 2026 (IST). Renderer-only change. Full review: [application themes deep review](../audits/2026-11-08-app-theme-deep-review.html).

Seven themes, one token contract. This change closes the defects found while auditing
token coverage, contrast, chart-palette parity, switching and persistence.

## Behaviour before and after

| Area | Before | After |
|---|---|---|
| Candle palette per theme | Profile defaults `#26a69a`/`#ef5350` (dark-era values) were merged over every theme, so light themes never showed their curated palette. | Legacy default values are treated as “not customised”; each theme renders its own candle palette. Genuine user choices still win. |
| Signal Triggers dialog | Hard-coded navy surfaces and near-white labels (19 literals) in all themes. | Resolves surfaces, borders, inputs and labels from theme tokens. |
| Semantic colours as text | `--accent`, `--green`, `--red` used for text; several themes fell below 4.5:1 (worst 2.82:1). | New `--accent-text`/`--green-text`/`--red-text` tokens; all 63 text call sites migrated. Fills, borders and candle colours are unchanged. |
| Focus ring | Only Eikon Dark Pro declared `--focus-ring`; six themes relied on the accent fallback. | Every theme declares an explicit ring, at least 3:1 against all four panel surfaces. |
| Launch appearance | Light-theme users saw a dark flash while the profile theme loaded. | The applied theme is mirrored to `localStorage` and applied by `public/theme-boot.js` before first paint; the pre-CSS background follows the theme family. |
| Palettes | CSS tokens and `CHART_THEMES` could drift unnoticed. | Token coverage, chart-background parity, chart contrast and boot-script id parity are asserted by tests. |
| Chart theme object | `getChartTheme` returned the shared palette instance when no overrides existed. | Returns a copy. |

## Changed files

- [src/features/app/themeService.ts](../../src/features/app/themeService.ts)
- [src/styles/global.css](../../src/styles/global.css)
- [src/components/SignalSettingsDialog.tsx](../../src/components/SignalSettingsDialog.tsx)
- [src/components/SettingsDialog.tsx](../../src/components/SettingsDialog.tsx) — live theme selection in General (the palette preview strip added here was removed on 8 November; see the [follow-up record](2026-11-08_IST_APP_THEME_PALETTE_SOURCE.md))
- [index.html](../../index.html), [public/theme-boot.js](../../public/theme-boot.js)
- [src/features/app/__tests__/themeSystemAudit.test.ts](../../src/features/app/__tests__/themeSystemAudit.test.ts)
- 30 renderer files: `color: var(--accent|--green|--red)` → text-safe token variants (63 sites, colour only)

## Validation

- `npx vitest run --exclude "tmp/**" src/features/app src/components/__tests__ src/engine/__tests__/ChartTheme.test.ts` — PASS, 26 files, 166 tests (theme suite 42 assertions).
- `npm run typecheck:renderer` — PASS.
- `npx vite build --outDir tmp/theme-audit/dist` — PASS (7.4 s); `./theme-boot.js` rewritten and copied into the bundle.
- Contrast figures are computed from the shipped token values with the WCAG 2.1 relative-luminance formula: 196/196 text-token × panel-surface ratios ≥ 4.5:1.

Pending: native sweep of all seven themes after the user's portable rebuild
(Settings → General, Signal Triggers, Bhavcopy status text, chart legend).

## Deliberately not changed

Fills, borders, chart palettes, theme IDs/labels, the Classic Light Refined chart-palette
parity contract, and Rust/Tauri code. The audit keeps five open recommendations:
`--accent-contrast` for filled buttons, explicit `chartColorsCustomized` state, a single
palette source, theme-aware canvas markers, and a `system`/`prefers-color-scheme` option.

## Rollback

Pre-edit copies: `backups/pre_opencode_changes_20261108_114214_theme_audit`. Reverting the
commit restores the previous tokens and colour call sites; the new `public/theme-boot.js`
is additive and becomes inert once reverted.
