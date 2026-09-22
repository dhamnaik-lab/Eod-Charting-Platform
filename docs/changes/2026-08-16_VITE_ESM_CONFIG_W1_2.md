# Vite ESM Config W1.2

Date: 2026-08-16

## Goal

Remove the renderer build warning `The CJS build of Vite's Node API is deprecated` without converting the whole npm package to ESM and without changing application runtime behavior.

## Change

- Rename `vite.config.ts` to `vite.config.mts` so Vite loads the config as ESM.
- Replace CommonJS-only `__dirname` use with `fileURLToPath(new URL('./src', import.meta.url))` for the `@` alias.
- Keep `package.json` unchanged; no global `"type": "module"` conversion.
- Keep `vitest.config.ts` unchanged.
- Extend `scripts/create-project-backup.ps1` so future backups include `vite.config.mts` while still tolerating old `vite.config.ts` trees.
- Update the canonical file inventory to name the active Vite config correctly.

## Explicitly out of scope

- Manual chunk changes.
- Official Watchlist chunk-size optimization.
- Chart-runtime chunk optimization.
- Dependency upgrades.
- Database or Corporate Action behavior.

## Validation gate

- renderer typecheck passes;
- renderer production build passes;
- production build output does not contain the Vite CJS Node API deprecation warning;
- Tauri Rust check passes;
- `package.json` remains without `"type": "module"`.
