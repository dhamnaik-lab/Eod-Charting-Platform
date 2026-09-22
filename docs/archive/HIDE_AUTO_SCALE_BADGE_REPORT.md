# Hide Auto Scale Badge Report

## Scope

This slice hides the orange `A` scale badge shown near the bottom of right-side price/indicator scales.

## Changes

- Updated `src/engine/Renderer.ts`.
  - Removed drawing of the orange `A` axis status badge.
  - Kept the log-scale `L` badge unchanged.
  - Did not change value labels, scale settings, auto-fit behavior, manual scale behavior, or axis drag behavior.

## Backup

- `backups/pre_opencode_changes_20260524_134615_hide-auto-scale-badge`

## Validation

- `npm run typecheck:renderer`: PASS
- `npm run build:renderer`: PASS (Vite emitted the existing CJS API deprecation and large-chunk warnings)
