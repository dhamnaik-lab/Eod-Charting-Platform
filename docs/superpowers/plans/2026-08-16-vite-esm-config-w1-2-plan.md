# Vite ESM Config W1.2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Vite's deprecated CJS Node API build warning with the smallest ESM-only configuration change.

**Architecture:** Keep the npm package in its existing module mode and opt only the Vite configuration into ESM via the `.mts` extension. Preserve all existing build/manual-chunk behavior; adapt the single CommonJS-only `__dirname` alias calculation to `import.meta.url` and keep the project-backup contract aware of both old and new config filenames.

**Tech Stack:** Vite 5, TypeScript, React, npm, Tauri 2, PowerShell.

## Global Constraints

- Do not add `"type": "module"` to `package.json`.
- Do not modify `vitest.config.ts`.
- Do not alter manual chunk ownership or thresholds in W1.2.
- Do not touch renderer feature code, Rust production code, Corporate Action data, or SQLite.
- Production build output must not contain `The CJS build of Vite's Node API is deprecated`.

---

### Task 1: Convert only the Vite config to ESM

**Files:**
- Rename: `vite.config.ts` -> `vite.config.mts`
- Modify within renamed file: ESM-safe alias path resolution

**Interfaces:**
- Consumes: existing Vite 5 `defineConfig`, React plugin, manual chunk configuration.
- Produces: the same Vite config behavior loaded through the ESM config path.

- [ ] **Step 1:** Assert the current config is `vite.config.ts`, `package.json` has no `type: module`, and the config uses `__dirname`.
- [ ] **Step 2:** Rename the config to `vite.config.mts` and replace `resolve(__dirname, 'src')` with `fileURLToPath(new URL('./src', import.meta.url))`.
- [ ] **Step 3:** Verify no manual-chunk branch, port, base path, output directory, or plugin changed.

### Task 2: Keep backup/inventory contracts correct after the rename

**Files:**
- Modify: `scripts/create-project-backup.ps1`
- Modify: `FILE_INVENTORY.md`
- Create: `docs/changes/2026-08-16_VITE_ESM_CONFIG_W1_2.md`

**Interfaces:**
- Consumes: existing project backup defaults and canonical file inventory.
- Produces: backups that include either historical `.ts` or active `.mts` Vite config and accurate current documentation.

- [ ] **Step 1:** Add `vite.config.mts` to backup defaults while retaining `vite.config.ts` compatibility.
- [ ] **Step 2:** Replace the active inventory row with `vite.config.mts`.
- [ ] **Step 3:** Record the narrow change and explicit exclusions.

### Task 3: Validate the warning is actually gone

**Files:**
- Read only: `package.json`, `vite.config.mts`, build output.

**Interfaces:**
- Consumes: npm scripts `typecheck:renderer`, `build:renderer`, `tauri:check`.
- Produces: evidence that the CJS warning is absent without changing the package module type.

- [ ] **Step 1:** Run `npm run typecheck:renderer`; require exit code 0.
- [ ] **Step 2:** Run `npm run build:renderer`; require exit code 0 and scan captured output for the exact CJS deprecation warning.
- [ ] **Step 3:** Run `npm run tauri:check`; require exit code 0.
- [ ] **Step 4:** Verify `package.json` still has no `type` property equal to `module`, `vite.config.ts` is absent, and `vite.config.mts` is present.
