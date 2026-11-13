# Native Chart Pattern Scanner Modularization

- **IST timestamp:** 2026-11-13 18:20 IST (implementation session)
- **Workstream:** EOD Charting Platform; authorized local root `E:\\TA Projects\\EOD Charting Platform`
- **GitHub authority:** `main` commit `b830573a8a491c207e9e853bc422ca62f8ebe45f`, chart-pattern blob `69684551e72b75b0dabf2e97dcac5bfaecbbbed1`

## Objective
Move the 54 chart-pattern scanners from the bundled plugin implementation into native application feature modules, organized by pattern family. Preserve existing behavior and retain a controlled GitHub PR for subsequent Codex validation.

## Previous limitation
The 5,120-line `chartPatternScanners.ts` mixed definitions, handlers, geometry, setups and shared utilities. Scanner-window plugin enablement blocked chart-pattern-only scans when the Core EOD Scanner plugin was disabled.

## Files changed
New `src/features/chartPatterns/` modules (definitions, constants, family handlers, setups, geometry, shared, primitives, types, evaluation, worker, worker client, scan service, integration tests), and `src/features/scanner/{types,catalog}.ts`. Updated `src/components/{Toolbar,ScannerWindow}.tsx`, `src/plugins/scanner/{scannerPlugin,scannerRunner,scannerChartPriceBasis,scannerPatternMap}.ts`. Prior chart-pattern modules and scanner types retain compatibility re-export shims. Removed obsolete old-path worker source.

## Final implementation
Native application catalog includes all 54 chart patterns at the original registry position without plugin registration. Plugin catalog retains all unrelated scanner families and external scanner discovery. Chart-pattern-only scan and alert selections bypass Core EOD Scanner plugin enablement; non-native selections still obey the prior gate. Background worker protocol and cancellation are unchanged. Dedicated family handlers, geometry, setup and shared helper modules replace the monolith.

## Behavior preserved
Pattern IDs/order, metadata, completed-bar detection, score/threshold logic, outputs and geometry, historical grouping, worker behavior, overlays, settings and scanner workspaces, and external plugins are intended to remain unchanged. The intended change is enabling native chart-pattern scanning independently of the bundled Core EOD Scanner plugin.

## Validation commands / results
Static source generation verified 54 original unique definitions, 54 handlers, complete coverage and family group counts (6/11/27/10). No local TS, Vitest, Vite, Windows portable or Tauri commands executed here. Required follow-up by Codex: `npm test -- src/plugins/scanner/__tests__/chartPatternScanners.test.ts src/features/chartPatterns/__tests__/nativeIntegration.test.ts`; `npm test`; `npm run typecheck:renderer`; `npm run build:renderer`; relevant Windows portable validation. Inspect GitHub PR CI before merge.

## Risks/limitations
Module boundaries/import paths and worker bundling need real compiler/build verification. Mixed native/non-native selections still require Core EOD Scanner plugin enabled, preserving prior behavior. No live market data or database used. No source-control history rewritten. No local user worktree changed.

## Rollback
Do not merge the PR if validation fails. After merge, revert its isolated change commit; scanner data and settings are not migrated.

## Evidence
GitHub base `b830573a8a491c207e9e853bc422ca62f8ebe45f`, original monolith blob `69684551e72b75b0dabf2e97dcac5bfaecbbbed1`. GitHub commit and CI evidence to be recorded on PR.
