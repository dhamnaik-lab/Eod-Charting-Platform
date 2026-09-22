# Synced Crosshair Test Expectation Fix

## IST timestamps

- Source correction performed: 2026-08-05 17:54:05 +05:30
- Full validation completed: approximately 2026-08-05 18:03 +05:30
- Evidence report finalized retrospectively during the next implementation cycle: 2026-08-05 19:10 +05:30

## Objective

Correct stale test expectations for the existing synced-crosshair and symbol-link defaults without changing runtime application behavior.

## Previous defect or limitation

`src/store/uiStore.ts` already defined both defaults as disabled:

- `crosshairSyncEnabled: false`
- `symbolLinkEnabled: false`

However, `src/engine/__tests__/syncedCrosshair.test.ts` expected both initial values to be `true`. The full Vitest run therefore failed in two assertions even though the runtime defaults were unchanged and intentional.

## Files changed

- `src/engine/__tests__/syncedCrosshair.test.ts`

## Backup

The pre-edit test file was preserved at:

```text
docs\changes\backups\2026-08-05_175405_IST_SYNCED_CROSSHAIR_TEST_FIX\syncedCrosshair.test.ts
```

## Final implementation

- Updated both initial-state expectations from `true` to `false`.
- Added `beforeEach` to reset the module-level Zustand store before every test.
- Verified both toggle directions explicitly:
  - false → true
  - true → false
- Preserved the actual UI-store defaults and all runtime behavior.

## Validation commands and actual results

### Focused test

```powershell
npx vitest run src/engine/__tests__/syncedCrosshair.test.ts
```

Result: **PASS**

- Test files: 1 passed
- Tests: 2 passed

### Full test suite

```powershell
npm test
```

Result: **PASS**

- Test files: 33 passed
- Tests: 222 passed

### Integrated build

```powershell
npm run build
```

Result: **PASS**

- Renderer TypeScript typecheck passed.
- Rust/Tauri `cargo check` passed.
- Vite renderer production build passed.

## Behavior deliberately preserved

- Crosshair synchronization remains disabled by default.
- Symbol linking remains disabled by default.
- No chart engine, plugin, scanner, database, workspace, or packaging behavior changed.

## Risks or limitations

- None identified beyond the ordinary risk of test-state coupling. The new `beforeEach` reset reduces that risk.
- Vite emitted its existing CJS API deprecation and large-chunk warnings; these were unrelated to this test correction.

## Rollback guidance

Restore the backup test file from the backup path above. Rollback is not recommended unless the runtime defaults are intentionally redesigned to start enabled; in that case both the store defaults and tests should be changed together.
