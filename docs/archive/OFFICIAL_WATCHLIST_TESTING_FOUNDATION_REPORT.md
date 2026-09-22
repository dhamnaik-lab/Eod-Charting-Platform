# Official Watchlist Testing Foundation Report

Date: 2026-04-07

## Summary

Added a Vitest-based unit testing foundation for the two official watchlist feature modules extracted during Store Split Passes 5 and 6. All 54 tests pass. Full validation suite passes. Portable baseline preserved.

---

## What Was Addressed

The Store Split series (Passes 1–6) extracted significant business logic out of `chartStore.ts` into pure and service modules under `src/features/watchlists/`. Those modules had no test coverage. This pass adds a proper unit test foundation before any further splits or UI work proceeds.

---

## Files Backed Up

**Process violation:** AGENTS.md requires a backup before modifying existing files. `package.json` and `package-lock.json` are existing files and were both modified in this pass. A pre-pass backup was required and was not created.

The nearest available snapshot of these files at the end of this pass is `backups/pre_opencode_changes_20260407_123049_last_synced_ui/`, which captured both files immediately before the following pass began.

---

## Files Modified

### `package.json`
- Added `"test": "vitest run"` to the `scripts` block
- `vitest@4.1.2` added to `devDependencies`

### `package-lock.json`
- Updated by `npm install vitest --save-dev` — 37 packages added

### New files created

| File | Role |
| --- | --- |
| `vitest.config.ts` | Vitest configuration — `environment: node`, `@` alias replicating `vite.config.ts` |
| `src/features/watchlists/__tests__/officialWatchlistResolver.test.ts` | 35 pure function tests — zero mocking, zero Tauri coupling |
| `src/features/watchlists/__tests__/officialWatchlistImportService.test.ts` | 19 service tests — mocks for `@/platform`, `watchlistService`, `officialWatchlistProviders`; resolver functions run for real |

---

## Test Coverage

### `officialWatchlistResolver.test.ts` — 35 tests

**`normalizeLookupToken`** (7 tests):
- trim + uppercase of a normal string
- null, undefined, empty string, whitespace-only → null
- mixed-case → uppercase
- already-uppercase passthrough

**`instrumentSymbolKey`** (2 tests):
- NSE:SYMBOL format
- BSE:SYMBOL format

**`instrumentIsinKey`** (2 tests):
- NSE:ISIN format
- BSE:ISIN format

**`buildUniqueWatchlistName`** (6 tests):
- base name returned when set is empty
- base name added (lowercased) to set
- (2) suffix when base already exists
- (3) suffix when (2) also exists
- suffixed name added to set
- set mutation visible to consecutive calls

**`officialWatchlistSourceSignature`** (8 tests):
- null and undefined input → null
- non-official sourceType → null
- missing sourceExchange → null
- missing sourceGroupType → null
- missing sourceKey → null
- valid meta → uppercase canonical signature
- mixed-case input → uppercased output

**`resolveOfficialWatchlistMember`** (10 tests):
- ISIN hit → returns ISIN-matched instrument (ISIN-first invariant)
- symbol-only member → symbol fallback fires
- wrong ISIN + correct symbol → symbol fallback fires
- neither ISIN nor symbol match → null
- empty member → null
- lowercase ISIN normalized correctly
- lowercase symbol normalized correctly
- instrument with null isin resolved by symbol
- cross-exchange non-match (BSE member not in NSE maps → null)

**`buildOfficialWatchlistLookupMaps`** (6 tests):
- bySymbol keyed EXCHANGE:SYMBOL (uppercase)
- lowercase exchange+symbol normalized on build
- byIsin keyed EXCHANGE:ISIN (uppercase)
- null isin skipped in byIsin
- empty catalog returns empty maps without throwing
- multiple instruments populate both maps correctly

---

### `officialWatchlistImportService.test.ts` — 19 tests

**Mocked modules:**
- `@/platform` → `getDesktopApi`
- `@/features/watchlists/watchlistService` → `createWatchlist`, `addInstrumentToWatchlist`, `applyOfficialWatchlistUpdate`
- `@/features/watchlists/officialWatchlistProviders` → `getOfficialWatchlistSource`, `loadOfficialWatchlistGroups`, `loadOfficialWatchlistGroupBySourceLinkMeta`, `buildOfficialWatchlistSourceLinkMeta`

**`officialWatchlistResolver` is NOT mocked** — pure functions run for real inside service tests.

**`runOfficialWatchlistImport`** (7 tests):
- throws when `getDesktopApi` returns null
- throws when `getOfficialWatchlistSource` returns null
- throws when `loadOfficialWatchlistGroups` returns empty array
- happy path: creates watchlist, adds resolved instruments, correct counts and selectWatchlistId
- duplicate prevention: group already linked → skipped, `createWatchlist` not called, selectWatchlistId = skipped id
- unresolved member counting: empty catalog → unresolved entry recorded, importedCount = 0
- ISIN-first resolution through service: ISIN-matched instrument (not symbol-matched) used in `addInstrumentToWatchlist`
- multi-group: selectWatchlistId = first created id

**`runOfficialWatchlistUpdate`** (6 tests):
- throws when `getDesktopApi` returns null
- throws when watchlist has no sourceMeta
- throws when `loadOfficialWatchlistGroupBySourceLinkMeta` returns null
- happy path: correct add/remove/unchanged/unresolvedCount; `applyOfficialWatchlistUpdate` called with correct args
- all-unchanged: 0 adds, 0 removes, 1 unchanged
- unresolved member counting: symbol not in catalog → unresolvedCount = 1

---

## Validation

```
npm run test                →  2 test files, 54 tests passed
npm run typecheck:renderer  →  clean (0 errors)
npm run tauri:check         →  Finished (release)
npm run build:renderer      →  ✓ built in 7.98s  (note: npm run build = typecheck + tauri:check + build:renderer)
npm run tauri:portable:win  →  Built + staged clean
```

Note: `npm run build` was not run as a combined command in this pass; `typecheck:renderer`, `tauri:check`, and `build:renderer` were run individually with equivalent coverage.

Bounded portable folder check:
- `EOD Chart.exe` ✓
- `index.html` ✓
- `assets/` ✓
- `Launch Portable EOD Chart.cmd` ✓

---

## Tauri-Only Runtime Structure

- `vitest.config.ts` has no Tauri imports
- test files have no `@tauri-apps/*` imports
- all Tauri access stays behind `@/platform` seam
- no renderer file outside `src/platform/*` was modified

---

## What Is Not Covered (Intentional Scope)

- `officialWatchlistProviders.ts` — uses live Tauri fetch bridge and large generated data; tested indirectly through mocks in service tests
- `watchlistService.ts` — thin wrappers over `getDesktopApi`; tested indirectly through mocks in service tests
- `chartStore.ts` — Zustand store; integration-level; deferred
- Chart engine — out of scope for this pass

---

## Continuation Prompt

See `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md` for the ready continuation state.
