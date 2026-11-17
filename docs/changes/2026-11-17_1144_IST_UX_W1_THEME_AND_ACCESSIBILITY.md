# UX audit W1 | Theme And Accessibility

17 November 2026 at 11:44 IST. Worktree base `3950985f7c47bc60ff87728a60245a3cc62bf55d`.

Backups in candidate `backups/` include pre_opencode_changes_20261117_114028_ux_f60, pre_opencode_changes_20261117_114128_ux_f61_f62, pre_opencode_changes_20261117_114258_ux_f63_f66_f74. The worktree carries an uncommitted diff; review and reverse the corresponding bounded diff for rollback.

## F-60 | Eikon Dark Pro inverts hierarchy — muted text is brighter than dim text (8.56 vs 7.97)

src/features/app/themePalettes.json:345. Restores Eikon foreground order and raises strong border contrast on the panel background while retaining AA foreground contrast across the tested backgrounds.

Changed paths include `src/features/app/themePalettes.json`, `src/styles/theme-tokens.generated.css`, `src/features/app/__tests__/themeSystemAudit.test.ts`.

Focused evidence under `tmp/ux-audit-evidence` has f60-before.log [npm.cmd test -- src/features/app/__tests__/themeSystemAudit.test.ts; Tests  1 failed | 57 passed (58)] | f60-after.log [npm.cmd test -- src/features/app/__tests__/themeSystemAudit.test.ts src/engine/__tests__/axisTagContrast.test.ts; Tests  60 passed (60)].

Disposition is `FIXED_AND_VALIDATED`. Candidate visual acceptance is pending.

## F-61 | Eikon Dark Pro accent + white label = 4.10:1; token says #071019 (4.67:1) but code hardcodes #fff

src/components/IndicatorPickerDialog.tsx:836. Replaced the foreground on picker accents and other audited fills. Eikon already supplied the accent-text token for foreground use.

Changed paths include `src/components/IndicatorPickerDialog.tsx`, `src/features/app/__tests__/themeSystemAudit.test.ts`.

Focused evidence under `tmp/ux-audit-evidence` has f62-before.log [npm.cmd test -- src/features/app/__tests__/themeSystemAudit.test.ts; Tests  5 failed | 60 passed (65)] | f62-after.log [npm.cmd test -- src/features/app/__tests__/themeSystemAudit.test.ts; Tests  65 passed (65)].

Disposition is `FIXED_AND_VALIDATED`. Candidate visual acceptance is pending.

## F-62 | Accent buttons bypass --accent-contrast across ≥ 6 components (1.1–4.1:1)

src/components/BhavcopyDownloadWindow.styles.ts:518. Five remaining audited accent controls now use contrast tokens; Favorites and Shortcuts were already correct.

Changed paths include `src/components/AboutDialog.tsx`, `src/components/BhavcopyDownloadWindow.styles.ts`, `src/components/FAQDialog.tsx`, `src/components/IndicatorPickerDialog.tsx`, `src/components/LayoutManagerDialog.tsx`.

Focused evidence under `tmp/ux-audit-evidence` has f62-before.log [npm.cmd test -- src/features/app/__tests__/themeSystemAudit.test.ts; Tests  5 failed | 60 passed (65)] | f62-after.log [npm.cmd test -- src/features/app/__tests__/themeSystemAudit.test.ts; Tests  65 passed (65)].

Disposition is `FIXED_AND_VALIDATED`. Candidate visual acceptance is pending.

## F-63 | Audit test exists but cannot see components — extend it to TSX + chart painter

src/features/app/__tests__/themeSystemAudit.test.ts:206. Added cited component contrast checks and theme-aware crosshair fill and foreground. App-wide static lint and visual CI matrix are still outstanding.

Changed paths include `src/engine/Crosshair.ts`, `src/engine/__tests__/axisTagContrast.test.ts`, `src/features/app/__tests__/themeSystemAudit.test.ts`.

Focused evidence under `tmp/ux-audit-evidence` has f63-after.log [npm.cmd test -- src/engine/__tests__/axisTagContrast.test.ts src/features/app/__tests__/themeSystemAudit.test.ts; Tests  68 passed (68)].

Disposition is `DEFERRED_WITH_REASON`. Candidate visual acceptance is pending.

## F-66 | Favorite Tools toolbar does not re-clamp on window resize — tools slide off-screen

src/components/FavoriteToolsToolbar.tsx:12. Measured toolbar is clamped on mount, viewport resize and content resize, and stays scrollable if oversized. Existing position storage reused.

Changed paths include `src/components/FavoriteToolsToolbar.tsx`, `src/components/__tests__/FavoriteToolsToolbar.test.ts`.

Focused evidence under `tmp/ux-audit-evidence` has f66-after.log [npm.cmd test -- src/components/__tests__/FavoriteToolsToolbar.test.ts; Tests  3 passed (3)].

Disposition is `FIXED_AND_VALIDATED`. Candidate visual acceptance is pending.

## F-74 | Accessibility systemic gaps: missing labels, no reduced-motion, focus rings inconsistent

src/components/FavoriteToolsToolbar.tsx:133. Added favorite tool names, pressed state and scoped reduced motion. Remaining app-wide control audit, 200% zoom and screen-reader chart semantics still need acceptance.

Changed paths include `src/components/FavoriteToolsToolbar.tsx`, `src/components/ChartToolDock.tsx`, `src/styles/global.css`.

Focused evidence under `tmp/ux-audit-evidence` has f74-after.log [npm.cmd test -- src/components/__tests__/FavoriteToolsToolbar.test.ts src/components/__tests__/ChartPaneControlsOverlay.test.tsx; Tests  8 passed (8)].

Disposition is `DEFERRED_WITH_REASON`. Candidate visual acceptance is pending.
