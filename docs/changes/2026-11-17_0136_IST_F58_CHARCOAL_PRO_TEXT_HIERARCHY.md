# F-58 — Charcoal Pro text hierarchy

- **IST timestamp:** 2026-11-17 01:36:45 (UTC+05:30)
- **Workstream:** EOD Charting Platform
- **Authorized Windows root:** `E:\TA Projects\EOD Charting Platform`
- **Source authority:** GitHub `main@a7ed6affb81b0aa6339ffea957a28d64ccd8e5a4`
- **Branch:** `fix/f58-charcoal-pro-text-hierarchy-20261117`
- **Finding:** F-58 from 2026-11-15 read-only UX audit

## Objective / previous limitation
Charcoal Pro defined `--text: #abb2bf`, `--text-dim: #a7b1bf`, and `--text-mute: #a5afbd`. Their close luminance made hierarchy indistinguishable (successive contrast ratios about 1.02:1). Only this palette hierarchy is in scope; F-59 axis-tag colors, F-60–F-65, and all other UX findings are separate bounded issues.

## Files changed
- `src/features/app/themePalettes.json`
- `src/styles/theme-tokens.generated.css` (deterministic generator output)
- `src/features/app/__tests__/themeSystemAudit.test.ts`
- `docs/changes/2026-11-17_0136_IST_F58_CHARCOAL_PRO_TEXT_HIERARCHY.md`

## Final implementation
- Set Charcoal Pro `--text` to `#e3eaf4` and `--text-dim` to `#bfcbdc`.
- Keep `--text-mute: #a5afbd` unchanged; it is already sufficiently readable on all four Charcoal panel backgrounds.
- Updated only the two corresponding token declarations in generated CSS using the exact existing generator algorithm (`npm run themes:generate`).
- Add a focused regression test verifying source JSON/CSS equality, 4.5:1 minimum for all three tiers on all four panel backgrounds, correct luminance ordering and at least 1.25:1 contrast separation between adjacent tiers.

## Why the audit's exact suggested colors were not used
The audit proposes `#d3dae6 / #98a3b5 / #6f7a8d`, but the latter two would fail the **existing** theme test requiring 4.5:1 text contrast on every panel background, especially `--bg4: #3b4048`. Keeping the existing muted tier while raising primary and secondary preserves that policy. The 1.25:1 adjacent-tier threshold is a project-specific hierarchy regression guard, not a WCAG standard.

## Behavior preserved
All six other themes, Charcoal Pro muted color, all chart theme colors, candle/volume colors, geometry, app state, theme IDs and storage, data handling, plugin loading, native shell behavior, and database contents remain unchanged. No runtime code, build dependencies, timeout/worker settings, or generated boot script were modified.

## Validation commands / results
- **Source inspection:** GitHub `main@a7ed6affb81b0aa6339ffea957a28d64ccd8e5a4`, theme palettes, deterministic theme generator, generated CSS, theme audit, pre-paint boot script, and package scripts inspected.
- **Deterministic baseline check:** reproducing the current CSS from the current JSON with the unchanged generator algorithm matched the tracked CSS byte-for-byte — **PASS**.
- **Pure color-ratio preflight:** `--text` / `--text-dim` / `--text-mute` on `--bg4` = 8.615:1 / 6.355:1 / 4.703:1; adjacent tier separation 1.356:1 and 1.351:1 — **PASS**.
- **Focused Vitest, full Vitest, renderer typecheck/build, CI, Windows portable and manual visual acceptance:** **NOT RUN at time of initial commit**; PR CI and Windows acceptance remain separate gates. Do not treat a mathematical color check as visual confirmation.

## GitHub CI validation after initial commit (2026-11-17 IST)
- [Renderer CI #43946492112](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/43946492112) on implementation commit `d9757748af5c6d21cd7effe5061bd3666046039a`: **PASS** (all job steps complete and successful).
- Full `npm test` (standard Vitest configuration): **1,862 passed, 1 skipped, 0 failed**, 268 files passed, 1 skipped; 58.18s.
- `src/features/app/__tests__/themeSystemAudit.test.ts`: **57 tests PASS** (includes new F-58 regression test).
- Renderer TypeScript typecheck: **PASS**. Renderer Vite production build: **PASS**, 845 modules transformed, 5.52s.
- These are GitHub Ubuntu CI results. They do not establish Windows portable or operator visual acceptance; the PR remains draft pending separate approval.

## Risks / limitations
The primary/secondary colors become brighter across Charcoal UI surfaces. This may change perceived text density; manual visual review on Charcoal remains necessary. Audit issues F-59–F-65 are deliberately not addressed. Verify any token snapshot consumers and the complete renderer suite before merging.

## Rollback guidance
Revert this bounded commit, or restore `--text:#abb2bf` and `--text-dim:#a7b1bf` only for `tos-charcoal`, regenerate CSS, remove the F-58 regression test, and rerun theme tests. No database migration or native rollback needed.
