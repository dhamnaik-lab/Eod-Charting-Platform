# Official Watchlists Lazy-Data W1.3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all six Official Watchlist constituent universes from the static feature bundle and load only the operator-selected source universe, while preserving source metadata, import/update semantics, live/snapshot fallback behavior, persistence schema, and existing watchlist business rules.

**Architecture:** Keep a tiny generated catalog synchronously available for source/group metadata. Put the four currently co-located snapshot datasets into deterministic generated runtime modules and use the two existing sector-universe datasets as their own lazy payloads. Route all payload access through a cacheable async provider facade; the dialog renders metadata immediately and uses an explicit reducer-driven `idle/loading/ready/error` state with request IDs to reject stale completions.

**Tech Stack:** React 18, TypeScript 5.4+, Vite 5.4, Vitest 4.1, Node.js ESM maintenance scripts, Tauri 2/Rust validation shell, PowerShell 7 apply package.

## Global Constraints

- Basis is the **W1.2 applied state**: `vite.config.mts` is active and the Vite CJS deprecation warning is already removed.
- Preserve the six current source IDs exactly: `nse-sectors`, `nse-indices`, `nse-all-stocks-sectors`, `bse-sectors`, `bse-indices`, `bse-all-stocks-sectors`.
- Preserve all source labels, group IDs/names, source URLs, exchange mappings, watchlist prefixes, constituent identities/order, and constituent counts.
- Preserve existing snapshot-vs-live behavior and existing live-fetch fallback-to-snapshot rules.
- Preserve ISIN-first resolution, symbol/name fallback behavior, duplicate handling, unresolved-member handling, source-linked replacement/update semantics, and existing source signatures.
- Do not add or migrate any database/watchlist persistence schema.
- Do not add persistent constituent caching; cache is session-memory only.
- Do not raise `build.chunkSizeWarningLimit` or hide the Rollup warning.
- Do not optimize `feature-chart-runtime`; that remains W1.4.
- Do not alter Corporate Action code or execute any database operation in the apply package.
- The Windows package must use exact source compatibility hashes and a verified project backup before source mutation.
- The W1.2 measured baseline for `feature-official-watchlists` is **1,179.22 kB minified / 280.18 kB gzip**.
- The success criterion is architectural: all six constituent universes are absent from the static Official Watchlists dependency graph and only the requested source payload is loaded.
- The repository snapshot has no Git metadata. If execution still has no Git metadata, replace each plan “commit” checkpoint with a SHA-256 diff checkpoint and package backup rather than fabricating a Git commit.

---

## File Structure Locked by This Plan

### Create

- `scripts/split-official-watchlist-data.mjs` — deterministic parser/generator for the four datasets currently inside `officialWatchlistData.generated.ts` plus the six-source lightweight catalog.
- `src/features/watchlists/generated/officialWatchlistCatalog.generated.ts` — metadata-only catalog for all six sources; contains no `members` arrays.
- `src/features/watchlists/generated/officialWatchlistNseSectors.generated.ts` — full snapshot payload for `nse-sectors` only.
- `src/features/watchlists/generated/officialWatchlistNseIndices.generated.ts` — full snapshot payload for `nse-indices` only.
- `src/features/watchlists/generated/officialWatchlistBseSectors.generated.ts` — full snapshot payload for `bse-sectors` only.
- `src/features/watchlists/generated/officialWatchlistBseIndices.generated.ts` — full snapshot payload for `bse-indices` only.
- `src/features/watchlists/officialWatchlistLazyLoader.ts` — generic source-loader cache with in-flight deduplication and rejected-promise eviction.
- `src/features/watchlists/officialWatchlistDialogSourceState.ts` — pure request-ID reducer for `idle/loading/ready/error` dialog source-data state.
- `src/features/watchlists/__tests__/officialWatchlistDataSplit.test.ts` — canonical/generated parity and deterministic generation tests.
- `src/features/watchlists/__tests__/officialWatchlistLazyLoader.test.ts` — loader isolation/cache/retry tests.
- `src/features/watchlists/__tests__/officialWatchlistDialogSourceState.test.ts` — loading/error/stale-response reducer tests.
- `src/components/__tests__/OfficialWatchlistImportDialog.sourceContract.test.ts` — dialog wiring contract for loading label, retry control, selection clearing, and import gating without adding a DOM-test dependency.

### Modify

- `src/features/watchlists/officialWatchlistProviders.ts` — metadata-only static facade plus six async payload loaders and runtime catalog/payload validation.
- `src/features/watchlists/__tests__/officialWatchlistProviders.test.ts` — convert static member-array assertions to catalog `memberCount` assertions and add source-link no-load/lazy-path coverage.
- `src/features/watchlists/officialWatchlistImportService.ts` — only if TypeScript requires type narrowing for metadata-vs-payload source types; business flow must remain unchanged.
- `src/features/watchlists/__tests__/officialWatchlistImportService.test.ts` — preserve and extend import/update regression coverage for lazy source loading.
- `src/components/OfficialWatchlistImportDialog.tsx` — metadata-first rendering plus async source payload state, retry, stale-request protection, and import gating.
- `FILE_INVENTORY.md` — register generator, catalog, generated payloads, loader, reducer, and tests.
- `docs/changes/2026-08-16_OFFICIAL_WATCHLISTS_LAZY_DATA_W1_3.md` — record behavior preservation, before/after bundle measurements, emitted source chunks, and validation results.
- `docs/superpowers/plans/2026-08-16-official-watchlists-lazy-data-w1-3-plan.md` — install this plan.

### Explicitly do not modify unless a build proves it necessary

- `vite.config.mts` — the new generated payload modules live under `src/features/watchlists/generated/`, outside the existing `manualChunks()` matcher `/src/features/watchlists/officialWatchlist`; therefore Rollup should preserve them as dynamic chunks without changing W1.2 configuration.
- `package.json` / `package-lock.json` — no new test/UI dependency is required; dialog behavior is tested through the pure reducer and provider/loader contracts.
- database schema, Rust database code, Corporate Action files.

---

### Task 1: Deterministic Split Generator and Metadata-Only Catalog

**Files:**
- Create: `scripts/split-official-watchlist-data.mjs`
- Create: `src/features/watchlists/generated/officialWatchlistCatalog.generated.ts`
- Create: `src/features/watchlists/generated/officialWatchlistNseSectors.generated.ts`
- Create: `src/features/watchlists/generated/officialWatchlistNseIndices.generated.ts`
- Create: `src/features/watchlists/generated/officialWatchlistBseSectors.generated.ts`
- Create: `src/features/watchlists/generated/officialWatchlistBseIndices.generated.ts`
- Test: `src/features/watchlists/__tests__/officialWatchlistDataSplit.test.ts`
- Read-only canonical inputs: `src/features/watchlists/officialWatchlistData.generated.ts`, `src/features/watchlists/nseSectorUniverseWatchlistData.generated.ts`, `src/features/watchlists/bseSectorUniverseWatchlistData.generated.ts`

**Interfaces:**
- Consumes canonical snapshot exports whose object shape is `{ sources: OfficialWatchlistSource[] }`.
- Produces four single-source snapshot modules plus a six-source catalog containing `memberCount` instead of `members`.
- CLI contract:
  - `node scripts/split-official-watchlist-data.mjs` writes committed generated files.
  - `node scripts/split-official-watchlist-data.mjs --check` exits non-zero if committed generated output differs from deterministic regeneration.
  - `node scripts/split-official-watchlist-data.mjs --out-dir <path>` writes the same artifacts to a temporary directory for determinism tests.

- [ ] **Step 1: Write failing parity tests before adding generated runtime files**

Create `officialWatchlistDataSplit.test.ts` with tests that parse the three canonical generated inputs as JSON-shaped object literals and assert the intended split contract. The test must define the exact six expected IDs:

```ts
const EXPECTED_SOURCE_IDS = [
  'nse-sectors',
  'nse-indices',
  'bse-sectors',
  'bse-indices',
  'nse-all-stocks-sectors',
  'bse-all-stocks-sectors',
] as const;

it('has exactly the six supported source identities in canonical input', () => {
  expect(canonicalSources.map((source) => source.id)).toEqual(EXPECTED_SOURCE_IDS);
});

it('requires metadata-only catalog groups to carry memberCount but no members array', async () => {
  const catalogPath = resolve(projectRoot, 'src/features/watchlists/generated/officialWatchlistCatalog.generated.ts');
  expect(existsSync(catalogPath)).toBe(true);
});
```

The second test must initially fail because the generated catalog does not exist.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npx vitest run src/features/watchlists/__tests__/officialWatchlistDataSplit.test.ts
```

Expected: FAIL specifically because the W1.3 generated catalog/runtime artifacts do not exist yet.

- [ ] **Step 3: Implement a safe JSON-shaped snapshot parser in the generator**

Implement an ESM helper that extracts only the object literal from each canonical generated TypeScript file and parses it with `JSON.parse`; do not `eval` source text.

```js
function parseGeneratedSnapshotText(text, filePath) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) {
    throw new Error(`Could not find snapshot object in ${filePath}`);
  }
  return JSON.parse(text.slice(start, end + 1));
}
```

Validate that each parsed source has an `id`, `label`, `watchlistPrefix`, `exchange`, and `groups` array before generation.

- [ ] **Step 4: Implement deterministic split selection**

Select exactly one source for each of the four co-located runtime modules and fail if missing or duplicated:

```js
const splitIds = [
  'nse-sectors',
  'nse-indices',
  'bse-sectors',
  'bse-indices',
];

function requireSingleSource(sources, sourceId) {
  const matches = sources.filter((source) => source.id === sourceId);
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one ${sourceId} source; found ${matches.length}`);
  }
  return matches[0];
}
```

Preserve canonical group/member order; do not sort constituent business data in the generator.

- [ ] **Step 5: Generate four source-specific snapshot modules**

Use stable two-space JSON formatting and a terminal newline. Each module must export one snapshot object whose `sources` array contains exactly one source, for example:

```ts
export const officialWatchlistNseSectorsSourceSnapshot = {
  "sources": [
    // exact canonical nse-sectors source
  ]
} as const;
```

The four output files must be placed under `src/features/watchlists/generated/` so they do not match W1.2's existing `manualChunks()` static feature matcher.

- [ ] **Step 6: Generate the six-source metadata-only catalog**

Construct catalog metadata from all six canonical sources. Replace each group's `members` array with `memberCount`:

```ts
export const officialWatchlistCatalogSnapshot = {
  "sources": [
    {
      "id": "nse-sectors",
      "label": "NSE Sectors",
      "watchlistPrefix": "NSE Sector",
      "exchange": "NSE",
      "groups": [
        {
          "id": "nifty-auto",
          "name": "Nifty Auto",
          "exchange": "NSE",
          "officialSourceUrl": "...",
          "memberCount": 15
        }
      ]
    }
  ]
} as const;
```

Include `refreshMode` when present. Never include a `members` property anywhere in the catalog output.

- [ ] **Step 7: Implement `--check` and `--out-dir` modes**

`--check` must generate all five outputs in memory and compare exact UTF-8 text against committed files. Print each mismatch and exit `1`; print a concise PASS summary and exit `0` when exact.

`--out-dir` must write to the requested directory without touching committed source files.

- [ ] **Step 8: Complete parity assertions**

Update `officialWatchlistDataSplit.test.ts` to compare canonical and generated data source-by-source:

```ts
expect(generatedSource.id).toBe(canonicalSource.id);
expect(generatedSource.groups.map((g) => g.id)).toEqual(canonicalSource.groups.map((g) => g.id));
expect(generatedSource.groups.map((g) => g.name)).toEqual(canonicalSource.groups.map((g) => g.name));
expect(generatedSource.groups.map((g) => g.members)).toEqual(canonicalSource.groups.map((g) => g.members));
```

For catalog groups assert `memberCount === canonicalGroup.members.length` and assert no serialized catalog text contains `"members"`.

- [ ] **Step 9: Add deterministic repeated-generation test**

Generate to two temporary directories and assert identical SHA-256 for all five artifacts:

```ts
expect(hashDirectory(firstOut)).toEqual(hashDirectory(secondOut));
```

Use Node `crypto.createHash('sha256')`; do not depend on external utilities.

- [ ] **Step 10: Run generator and tests GREEN**

Run:

```powershell
node .\scripts\split-official-watchlist-data.mjs
node .\scripts\split-official-watchlist-data.mjs --check
npx vitest run src/features/watchlists/__tests__/officialWatchlistDataSplit.test.ts
```

Expected: generator check PASS; focused Vitest file PASS.

- [ ] **Step 11: Checkpoint**

If Git metadata exists, commit generator + generated outputs + test. Otherwise record SHA-256 for the five generated outputs and generator in the execution log before Task 2.

---

### Task 2: Generic Lazy Loader Cache and Six Dynamic Source Loaders

**Files:**
- Create: `src/features/watchlists/officialWatchlistLazyLoader.ts`
- Create: `src/features/watchlists/__tests__/officialWatchlistLazyLoader.test.ts`
- Modify: `src/features/watchlists/officialWatchlistProviders.ts`
- Test: `src/features/watchlists/__tests__/officialWatchlistProviders.test.ts`

**Interfaces:**
- Produces:

```ts
export type OfficialWatchlistSourceLoader<T> = () => Promise<T>;

export interface OfficialWatchlistSourceLoaderCache<SourceId extends string, Payload> {
  load(sourceId: SourceId): Promise<Payload>;
}

export function createOfficialWatchlistSourceLoaderCache<SourceId extends string, Payload>(
  loaders: Record<SourceId, OfficialWatchlistSourceLoader<Payload>>,
): OfficialWatchlistSourceLoaderCache<SourceId, Payload>;
```

- Provider produces exact public runtime interface:

```ts
export function loadOfficialWatchlistSource(
  sourceId: OfficialWatchlistSourceId,
): Promise<OfficialWatchlistSource>;
```

- Provider's six source IDs remain the current project IDs, including the `-sectors` suffix on the two all-stock source IDs.

- [ ] **Step 1: Write cache tests first**

Create tests with injected loaders and counters:

```ts
it('shares one in-flight promise for concurrent same-source loads', async () => {
  let calls = 0;
  const cache = createOfficialWatchlistSourceLoaderCache({
    a: async () => { calls += 1; return { id: 'a' }; },
  });

  const [left, right] = await Promise.all([cache.load('a'), cache.load('a')]);
  expect(calls).toBe(1);
  expect(left).toBe(right);
});
```

Also test:
- source A load does not invoke source B loader;
- repeated resolved load uses same cached promise/result;
- rejected promise is evicted;
- retry invokes failed source loader a second time.

- [ ] **Step 2: Run cache tests RED**

Run:

```powershell
npx vitest run src/features/watchlists/__tests__/officialWatchlistLazyLoader.test.ts
```

Expected: FAIL because `officialWatchlistLazyLoader.ts` does not exist.

- [ ] **Step 3: Implement minimal promise cache**

Use a `Map<SourceId, Promise<Payload>>`. On failure, delete only if the map still points at the rejected promise:

```ts
const promise = loaders[sourceId]().catch((error) => {
  if (cache.get(sourceId) === promise) {
    cache.delete(sourceId);
  }
  throw error;
});
cache.set(sourceId, promise);
return promise;
```

Do not add persistent cache, TTL, preloading, or background warming.

- [ ] **Step 4: Run cache tests GREEN**

Expected: all loader cache tests PASS.

- [ ] **Step 5: Refactor provider types into metadata and full payload forms**

Introduce metadata interfaces while preserving full group/source types:

```ts
export interface OfficialWatchlistGroupMeta {
  id: string;
  name: string;
  exchange: 'NSE' | 'BSE';
  officialSourceUrl: string;
  memberCount: number;
}

export interface OfficialWatchlistGroup extends OfficialWatchlistGroupMeta {
  members: OfficialWatchlistMember[];
}

export interface OfficialWatchlistSourceMeta {
  id: OfficialWatchlistSourceId;
  label: string;
  watchlistPrefix: string;
  exchange: 'NSE' | 'BSE';
  refreshMode?: 'live' | 'snapshot';
  groups: OfficialWatchlistGroupMeta[];
}

export interface OfficialWatchlistSource
  extends Omit<OfficialWatchlistSourceMeta, 'groups'> {
  groups: OfficialWatchlistGroup[];
}
```

- [ ] **Step 5A: Preserve the existing partial-group filter contract**

Keep `PARTIAL_GROUP_IDS` in `officialWatchlistProviders.ts`. Apply the same filter to catalog metadata and to each loaded payload before runtime metadata validation/normalization so a future non-empty partial-group set cannot make catalog and payload diverge. W1.3 must not delete or bypass this existing guard merely because the set is currently empty.

- [ ] **Step 6: Replace static constituent imports with catalog-only static import**

`officialWatchlistProviders.ts` may statically import only:

```ts
import { officialWatchlistCatalogSnapshot } from './generated/officialWatchlistCatalog.generated';
```

It must not statically import any file containing constituent arrays.

- [ ] **Step 7: Add six dynamic loader functions**

Use literal `import()` expressions so Vite can create deterministic code-split points:

```ts
const sourceLoaders: Record<OfficialWatchlistSourceId, () => Promise<OfficialWatchlistSource>> = {
  'nse-sectors': async () =>
    extractSingleSource((await import('./generated/officialWatchlistNseSectors.generated')).officialWatchlistNseSectorsSourceSnapshot, 'nse-sectors'),
  'nse-indices': async () =>
    extractSingleSource((await import('./generated/officialWatchlistNseIndices.generated')).officialWatchlistNseIndicesSourceSnapshot, 'nse-indices'),
  'nse-all-stocks-sectors': async () =>
    extractSingleSource((await import('./nseSectorUniverseWatchlistData.generated')).nseSectorUniverseWatchlistSourceSnapshot, 'nse-all-stocks-sectors'),
  'bse-sectors': async () =>
    extractSingleSource((await import('./generated/officialWatchlistBseSectors.generated')).officialWatchlistBseSectorsSourceSnapshot, 'bse-sectors'),
  'bse-indices': async () =>
    extractSingleSource((await import('./generated/officialWatchlistBseIndices.generated')).officialWatchlistBseIndicesSourceSnapshot, 'bse-indices'),
  'bse-all-stocks-sectors': async () =>
    extractSingleSource((await import('./bseSectorUniverseWatchlistData.generated')).bseSectorUniverseWatchlistSourceSnapshot, 'bse-all-stocks-sectors'),
};
```

Keep all imports literal; do not construct module paths dynamically from strings.

- [ ] **Step 8: Add payload-vs-catalog validator**

Before caching/returning a source, validate identity and metadata against catalog:

- source id, label, prefix, exchange, refreshMode;
- exact group count and group order;
- group id, name, exchange, URL;
- `group.members.length === groupMeta.memberCount`.

Throw a source-specific error such as:

```ts
throw new Error(`Official watchlist payload mismatch for ${sourceId}: group ${groupMeta.id} expected ${groupMeta.memberCount} members, received ${group.members.length}.`);
```

Do not silently coerce mismatches.

- [ ] **Step 9: Make synchronous provider methods metadata-only**

Implement:

```ts
export function listOfficialWatchlistSources(): OfficialWatchlistSourceMeta[];
export function getOfficialWatchlistSource(sourceId: OfficialWatchlistSourceId): OfficialWatchlistSourceMeta | null;
export function getOfficialWatchlistGroups(sourceId: OfficialWatchlistSourceId): OfficialWatchlistGroupMeta[];
```

These functions must not trigger any dynamic import.

- [ ] **Step 10: Update provider catalog tests**

Change existing constituent-count assertions from `groups.reduce(...members.length)` to `memberCount`, for example:

```ts
const totalMembers = groups.reduce((sum, group) => sum + group.memberCount, 0);
expect(totalMembers).toBeGreaterThanOrEqual(1500);
```

Keep existing exact group IDs, BSE Power/Energy URL distinction, BSE 500 availability, and source-key tests.

- [ ] **Step 11: Add provider lazy-source tests**

Add tests proving:
- `listOfficialWatchlistSources()` returns six sources without awaiting payloads;
- `findOfficialWatchlistGroupBySourceLinkMeta()` works from catalog alone;
- `loadOfficialWatchlistSource('nse-sectors')` returns only `nse-sectors` payload;
- loaded source group member counts match catalog counts.

For source isolation, rely on `officialWatchlistLazyLoader.test.ts` injected-loader tests rather than adding test-only mutation hooks to production provider code.

- [ ] **Step 12: Run focused provider/loader tests**

Run:

```powershell
npx vitest run `
  src/features/watchlists/__tests__/officialWatchlistLazyLoader.test.ts `
  src/features/watchlists/__tests__/officialWatchlistProviders.test.ts
```

Expected: PASS.

- [ ] **Step 13: Checkpoint**

Commit if Git exists; otherwise record source hashes for provider/loader/tests before Task 3.

---

### Task 3: Preserve Import, Live Fetch, Fallback, and Source-Linked Update Semantics

**Files:**
- Modify: `src/features/watchlists/officialWatchlistProviders.ts`
- Modify only if required by type changes: `src/features/watchlists/officialWatchlistImportService.ts`
- Test: `src/features/watchlists/__tests__/officialWatchlistImportService.test.ts`
- Test: `src/features/watchlists/__tests__/officialWatchlistProviders.test.ts`

**Interfaces:**
- `loadOfficialWatchlistGroups(sourceId, groupIds?)` remains async and continues returning full `OfficialWatchlistGroup[]` after snapshot payload loading plus existing live-refresh policy.
- `findOfficialWatchlistGroupBySourceLinkMeta(meta)` remains synchronous and returns catalog metadata resolution only.
- `loadOfficialWatchlistGroupBySourceLinkMeta(meta)` remains async and lazy-loads exactly the resolved source payload before applying existing live/snapshot behavior.

- [ ] **Step 1: Write failing source-link lazy-resolution test**

Add a provider test that resolves a known persisted signature, for example BSE 500, via metadata first and verifies source identity:

```ts
const resolution = findOfficialWatchlistGroupBySourceLinkMeta({
  sourceType: 'official',
  sourceExchange: 'BSE',
  sourceGroupType: 'index',
  sourceKey: 'BSE_500',
});
expect(resolution?.sourceId).toBe('bse-indices');
expect(resolution?.group.id).toBe('bse-500');
```

This path must remain synchronous and catalog-only.

- [ ] **Step 2: Update `loadOfficialWatchlistGroups` to load snapshot payload first**

Replace static `source.groups` member access with:

```ts
const sourceMeta = getOfficialWatchlistSource(sourceId);
if (!sourceMeta) return [];
const snapshotSource = await loadOfficialWatchlistSource(sourceId);
const requestedIds = groupIds?.length ? new Set(groupIds) : null;
const snapshotGroups = snapshotSource.groups.filter(
  (group) => !requestedIds || requestedIds.has(group.id),
);
return Promise.all(
  snapshotGroups.map((group) => loadOfficialWatchlistGroup(sourceId, sourceMeta, group)),
);
```

`loadOfficialWatchlistGroup()` may accept source metadata because it only needs `refreshMode`, exchange/source identity, and the selected snapshot group.

- [ ] **Step 3: Update source-link async load without broad source scanning**

After synchronous catalog lookup:

```ts
const catalogResolution = findOfficialWatchlistGroupBySourceLinkMeta(meta);
if (!catalogResolution) return null;
const snapshotSource = await loadOfficialWatchlistSource(catalogResolution.sourceId);
const snapshotGroup = snapshotSource.groups.find((group) => group.id === catalogResolution.group.id);
if (!snapshotGroup) {
  throw new Error(`Official watchlist payload missing catalog group ${catalogResolution.group.id}.`);
}
```

Then pass only that group through existing live/snapshot logic.

- [ ] **Step 4: Preserve live-fetch fallback code byte-for-byte where practical**

Do not rewrite parsers or fallback policy. Keep:
- `fetchOfficialWatchlistSourceText()`;
- `parseOfficialWatchlistMembers()` and CSV/HTML parsing;
- `sortOfficialWatchlistMembers()` behavior;
- live success logging;
- `fallback-snapshot` logging;
- fallback to normalized snapshot group.

Only change type annotations or source metadata variable names required by the new metadata/full-payload split.

- [ ] **Step 5: Extend import-service tests for lazy provider contract**

Update the existing `makeGroup()` fixture so full groups satisfy the new metadata/full-payload type contract without changing test semantics:

```ts
function makeGroup(
  id: string,
  name: string,
  exchange: 'NSE' | 'BSE',
  members: OfficialWatchlistMember[],
): OfficialWatchlistGroup {
  return {
    id,
    name,
    exchange,
    officialSourceUrl: `https://example.com/${id}`,
    memberCount: members.length,
    members,
  };
}
```

Keep existing provider mocks and ensure tests still cover:
- empty loaded group error;
- source-linked update returns null/error when link cannot resolve;
- live-loaded groups feed existing resolver logic;
- replacement/update paths preserve source metadata.

Add a regression test that `runOfficialWatchlistUpdate()` calls only `loadOfficialWatchlistGroupBySourceLinkMeta()` for the linked watchlist and never enumerates all six payloads.

- [ ] **Step 6: Run all Official Watchlist service/provider regressions**

Run:

```powershell
npx vitest run `
  src/features/watchlists/__tests__/officialWatchlistProviders.test.ts `
  src/features/watchlists/__tests__/officialWatchlistImportService.test.ts `
  src/features/watchlists/__tests__/officialWatchlistResolver.test.ts
```

Expected: PASS with existing business semantics unchanged.

- [ ] **Step 7: Checkpoint**

Commit if available; otherwise record hashes and focused test results.

---

### Task 4: Reducer-Driven Dialog Loading/Error/Stale-Response State

**Files:**
- Create: `src/features/watchlists/officialWatchlistDialogSourceState.ts`
- Create: `src/features/watchlists/__tests__/officialWatchlistDialogSourceState.test.ts`
- Modify: `src/components/OfficialWatchlistImportDialog.tsx`

**Interfaces:**
- Reducer state:

```ts
export type OfficialWatchlistSourceDataState =
  | { status: 'idle'; requestId: number; sourceId: OfficialWatchlistSourceId | null; source: null; error: null }
  | { status: 'loading'; requestId: number; sourceId: OfficialWatchlistSourceId; source: null; error: null }
  | { status: 'ready'; requestId: number; sourceId: OfficialWatchlistSourceId; source: OfficialWatchlistSource; error: null }
  | { status: 'error'; requestId: number; sourceId: OfficialWatchlistSourceId; source: null; error: string };
```

- Actions:

```ts
{ type: 'request'; requestId: number; sourceId: OfficialWatchlistSourceId }
{ type: 'success'; requestId: number; sourceId: OfficialWatchlistSourceId; source: OfficialWatchlistSource }
{ type: 'failure'; requestId: number; sourceId: OfficialWatchlistSourceId; error: string }
{ type: 'reset' }
```

- Reducer must ignore `success`/`failure` actions whose request ID or source ID does not equal the active loading request.

- [ ] **Step 1: Write reducer tests RED**

Test these exact behaviors:

```ts
it('enters loading and clears previous source payload on request', () => { /* assert source: null */ });
it('accepts the current request success', () => { /* ready */ });
it('ignores a stale success from the previously selected source', () => { /* state unchanged */ });
it('enters error for the active request and keeps no stale source payload', () => { /* error */ });
it('allows a later request for the same source after failure', () => { /* loading with new requestId */ });
```

- [ ] **Step 2: Run reducer test RED**

Expected: FAIL because reducer module does not exist.

- [ ] **Step 3: Implement minimal pure reducer**

No hooks, timers, or network work in this module. It is a deterministic state transition layer only.

- [ ] **Step 4: Run reducer tests GREEN**

Expected: PASS.

- [ ] **Step 5: Change dialog static source/group variables to catalog metadata**

Use:

```ts
const sources = useMemo(() => listOfficialWatchlistSources(), []);
const catalogGroups = useMemo(
  () => (activeSource ? getOfficialWatchlistGroups(activeSource.id) : []),
  [activeSource],
);
```

The left pane may render group names and `memberCount` immediately from `catalogGroups` before constituents finish loading.

- [ ] **Step 6: Add request-sequenced async payload loading**

Use `useReducer`, `requestSequenceRef`, and `retryNonce`:

```ts
const [sourceDataState, dispatchSourceData] = useReducer(
  officialWatchlistDialogSourceReducer,
  initialOfficialWatchlistSourceDataState,
);
const requestSequenceRef = useRef(0);
const [retryNonce, setRetryNonce] = useState(0);

useEffect(() => {
  if (!dialogState.open || !activeSource) return;
  const requestId = ++requestSequenceRef.current;
  dispatchSourceData({ type: 'request', requestId, sourceId: activeSource.id });
  void loadOfficialWatchlistSource(activeSource.id).then(
    (source) => dispatchSourceData({ type: 'success', requestId, sourceId: activeSource.id, source }),
    (error) => dispatchSourceData({
      type: 'failure',
      requestId,
      sourceId: activeSource.id,
      error: error instanceof Error ? error.message : 'Could not load watchlist constituents.',
    }),
  );
}, [dialogState.open, activeSource, retryNonce]);
```

The reducer provides stale-response protection; the provider cache provides rejected-promise eviction.

- [ ] **Step 7: Clear selection/preview at source request time**

On source tab change and dialog initialization:
- `selectedGroupIds = new Set()`;
- `previewGroupId = null`;
- clear import error;
- source-data reducer enters `loading` and holds no previous payload.

No previous source's members may remain visible under the new source label.

- [ ] **Step 8: Bind preview members only from the ready payload**

Catalog metadata chooses group rows; full member preview comes from:

```ts
const loadedGroups =
  sourceDataState.status === 'ready' && sourceDataState.sourceId === activeSource.id
    ? sourceDataState.source.groups
    : [];
```

Map preview by group ID. Do not copy member arrays into component-local metadata structures.

- [ ] **Step 9: Implement loading state**

While `sourceDataState.status === 'loading'`:
- show exact text `Loading constituents…` in the preview/content area;
- disable group selection checkboxes and import action;
- keep all source tabs enabled unless an actual import operation is already running;
- continue showing catalog group names/counts.

- [ ] **Step 10: Implement error + Retry state**

On `error`:
- render the error string;
- render a `Retry` button;
- `Retry` increments `retryNonce` after clearing selection/preview;
- source tabs remain usable;
- import remains disabled;
- no stale members render.

- [ ] **Step 11: Preserve import behavior after ready**

`handleImport()` remains the existing `importOfficialWatchlists(activeSource.id, groupIds)` call. Add only the source-ready precondition:

```ts
if (sourceDataState.status !== 'ready') {
  setError('Wait for constituents to finish loading.');
  return;
}
```

The provider/service may hit the same cached source promise; it must not cause a second module load.

- [ ] **Step 12: Add dialog source-contract test using the project’s existing source-contract testing pattern**

Create `src/components/__tests__/OfficialWatchlistImportDialog.sourceContract.test.ts` using `readFileSync`, matching the existing `ChartToolDockTooltips.test.ts` style. Assert the component source contains:

```ts
expect(source).toContain('Loading constituents…');
expect(source).toContain('Retry');
expect(source).toContain('setSelectedGroupIds(new Set())');
expect(source).toContain('setPreviewGroupId(null)');
expect(source).toContain("sourceDataState.status !== 'ready'");
```

Also assert the old synchronous member binding is gone:

```ts
expect(source).not.toContain('groups.find((group) => group.id === previewGroupId)');
```

This test supplements the pure reducer tests without adding React Testing Library/jsdom dependencies.

- [ ] **Step 13: Typecheck focused renderer state**

Run:

```powershell
npm run typecheck:renderer
```

Expected: PASS.

- [ ] **Step 14: Run reducer + provider + service tests**

Run:

```powershell
npx vitest run `
  src/features/watchlists/__tests__/officialWatchlistDialogSourceState.test.ts `
  src/features/watchlists/__tests__/officialWatchlistLazyLoader.test.ts `
  src/features/watchlists/__tests__/officialWatchlistProviders.test.ts `
  src/features/watchlists/__tests__/officialWatchlistImportService.test.ts `
  src/features/watchlists/__tests__/officialWatchlistResolver.test.ts `
  src/components/__tests__/OfficialWatchlistImportDialog.sourceContract.test.ts
```

Expected: PASS.

- [ ] **Step 15: Checkpoint**

Commit if possible; otherwise record hashes and test/typecheck results.

---

### Task 5: Static-Graph Guard and Bundle Architecture Regression Tests

**Files:**
- Modify: `src/features/watchlists/__tests__/officialWatchlistDataSplit.test.ts`
- Modify: `src/features/watchlists/__tests__/officialWatchlistProviders.test.ts`
- Optional package-only validation script: `EOD_Chart_Official_Watchlists_Lazy_Data_W1_3_*/tools/check-w1-3-bundle.mjs`

**Interfaces:**
- Source-graph contract: provider may statically import catalog but constituent payload modules must appear only inside literal `import()` expressions.
- Bundle checker consumes `dist/assets` after a production build and reports minified/gzip sizes using Node `fs` + `zlib.gzipSync`.

- [ ] **Step 1: Add source-graph regression assertion**

Read `officialWatchlistProviders.ts` as text and assert the old static imports are absent:

```ts
expect(providerText).not.toMatch(/^import .*officialWatchlistData\.generated/m);
expect(providerText).not.toMatch(/^import .*nseSectorUniverseWatchlistData\.generated/m);
expect(providerText).not.toMatch(/^import .*bseSectorUniverseWatchlistData\.generated/m);
expect(providerText).toContain("import('./generated/officialWatchlistNseSectors.generated')");
expect(providerText).toContain("import('./nseSectorUniverseWatchlistData.generated')");
```

This is an architecture guard, not a substitute for runtime tests.

- [ ] **Step 2: Add catalog no-members regression assertion**

Read `officialWatchlistCatalog.generated.ts` and assert no `"members"` field exists.

- [ ] **Step 3: Run focused architecture tests**

Expected: PASS.

- [ ] **Step 4: Build renderer and inspect emitted chunks**

Run:

```powershell
npm run build:renderer 2>&1 | Tee-Object -FilePath .\tmp\w1-3-renderer-build.log
```

Expected:
- build succeeds;
- `feature-official-watchlists-*.js` is materially below W1.2's 1,179.22 kB baseline;
- separate dynamic files exist for source-specific generated payloads / all-stock universe payloads.

- [ ] **Step 5: Measure minified and gzip sizes deterministically**

The package bundle checker must scan `dist/assets/*.js`, compute byte size and gzip size, and emit a table sorted descending. It must identify:
- `feature-official-watchlists-*`;
- each dynamic watchlist payload chunk whose filename derives from generated source module names;
- `feature-chart-runtime-*` for information only.

Use:

```js
const minifiedBytes = statSync(file).size;
const gzipBytes = gzipSync(readFileSync(file)).length;
```

Do not treat an individual lazy source payload >500 kB as W1.3 failure if the static graph criterion is met; report it for follow-up.

- [ ] **Step 6: Add threshold-independent acceptance check**

The checker fails if:
- no `feature-official-watchlists-*` chunk exists;
- the feature chunk is not smaller than the W1.2 baseline;
- fewer than six source payload lazy paths can be associated with emitted chunks/static dynamic-import graph;
- the monolithic canonical data module is statically bundled into the feature chunk.

It must not fail merely because Rollup still warns about a >500 kB individual lazy chunk.

- [ ] **Step 7: Record measurements for change documentation**

Capture:

```text
W1.2 baseline feature-official-watchlists: 1,179.22 kB / 280.18 kB gzip
W1.3 feature-official-watchlists: <actual>
W1.3 lazy nse-sectors: <actual>
W1.3 lazy nse-indices: <actual>
W1.3 lazy nse-all-stocks-sectors: <actual>
W1.3 lazy bse-sectors: <actual>
W1.3 lazy bse-indices: <actual>
W1.3 lazy bse-all-stocks-sectors: <actual>
```

Use actual build output; never pre-fill expected numbers.

- [ ] **Step 8: Checkpoint**

Record build log and bundle report hashes/results.

---

### Task 6: Full Regression Validation and Documentation

**Files:**
- Modify: `FILE_INVENTORY.md`
- Create/modify: `docs/changes/2026-08-16_OFFICIAL_WATCHLISTS_LAZY_DATA_W1_3.md`
- Create: `docs/superpowers/plans/2026-08-16-official-watchlists-lazy-data-w1-3-plan.md`

**Interfaces:**
- Change document records actual before/after bundle sizes and explicit behavior-preservation validation.
- No database/report artifact is produced.

- [ ] **Step 1: Update file inventory**

Add entries for:
- split generator;
- catalog;
- four generated split payloads;
- lazy loader;
- dialog source-state reducer;
- four new focused test files, including the component source-contract test.

Keep existing canonical data files listed; they are still maintenance inputs.

- [ ] **Step 2: Write W1.3 change document**

Include:
- problem and W1.2 baseline;
- six source module boundaries;
- session cache and retry semantics;
- persisted source-link mapping preservation;
- source generator/check command;
- exact focused/full test commands;
- actual feature/lazy chunk measurements from Task 5;
- any individual source payload that remains >500 kB;
- explicit statement that `feature-chart-runtime` is deferred to W1.4;
- explicit statement that no database or persistence migration occurred.

- [ ] **Step 3: Run generator check**

```powershell
node .\scripts\split-official-watchlist-data.mjs --check
```

Expected: PASS.

- [ ] **Step 4: Run all watchlist tests**

```powershell
npx vitest run src/features/watchlists/__tests__ src/components/__tests__/OfficialWatchlistImportDialog.sourceContract.test.ts
```

Expected: all watchlist test files PASS.

- [ ] **Step 5: Run renderer typecheck**

```powershell
npm run typecheck:renderer
```

Expected: PASS.

- [ ] **Step 6: Run renderer production build**

```powershell
npm run build:renderer
```

Expected: PASS. Vite CJS Node API deprecation warning remains absent. Chunk-size warning may remain only for one or more genuinely large chunks and is documented rather than suppressed.

- [ ] **Step 7: Run Tauri Rust check**

```powershell
npm run tauri:check
```

Expected: PASS.

- [ ] **Step 8: Run package bundle checker**

Expected: static Official Watchlists feature materially smaller than W1.2 baseline and six lazy payload paths present.

- [ ] **Step 9: Self-review implementation against all 11 design acceptance criteria**

Explicitly verify:
1. static provider/catalog path has no constituent arrays;
2. six lazy paths exist;
3. one selected source loads only one source payload;
4. cache/retry tests pass;
5. source-linked lookup remains metadata-only before exact source load;
6. import/update semantics pass;
7. dialog state/stale response tests pass;
8. typecheck/build/Tauri pass;
9. static feature chunk materially shrank;
10. before/after measurements documented;
11. no database/persistence schema change.

- [ ] **Step 10: Checkpoint**

Commit documentation if Git exists; otherwise include the exact source SHA manifest in the delivery package.

---

### Task 7: Guarded Windows Apply Package

**Files:**
- Create package directory: `EOD_Chart_Official_Watchlists_Lazy_Data_W1_3_<timestamp>_IST/`
- Create wrapper: `Apply-EOD-Official-Watchlists-Lazy-Data-W1-3.ps1`
- Create package contract checker under package `tools/`
- Include exact W1.3 payload and documentation.

**Interfaces:**
- Wrapper parameters:

```powershell
param(
  [Parameter(Mandatory=$true)][string]$ProjectRoot,
  [switch]$RunValidation
)
```

- No database path parameter and no database command exists in the wrapper.

- [ ] **Step 1: Build exact compatibility manifest against W1.2-applied source**

Guard every modified pre-existing file by SHA-256, especially:
- `officialWatchlistProviders.ts`;
- `officialWatchlistImportService.ts` if changed;
- `OfficialWatchlistImportDialog.tsx`;
- existing watchlist tests modified by W1.3;
- `FILE_INVENTORY.md`;
- `scripts/create-project-backup.ps1` only if W1.3 must modify it;
- `vite.config.mts` only if build evidence proves a necessary change (otherwise it must remain untouched).

Abort safely on mismatch; do not overwrite newer user work.

- [ ] **Step 2: Verify backup using PowerShell semantics, not stale `$LASTEXITCODE`**

Invoke `scripts/create-project-backup.ps1` and treat success as:
- no terminating PowerShell error;
- returned backup directory exists;
- `backup-manifest.json` exists.

Do not use `$LASTEXITCODE` to determine success of a `.ps1` call. Use `$LASTEXITCODE` only for native processes such as `node`, `npm`, `npx`, or `cargo`.

- [ ] **Step 3: Apply payload atomically at file level**

Create directories first, copy new/modified files, remove no canonical data file, and verify post-copy SHA-256 against package manifest.

- [ ] **Step 4: Run package source contract**

Verify:
- catalog has no `members` arrays;
- provider has no static constituent imports;
- six literal dynamic imports are present;
- W1.2 `vite.config.mts` remains present;
- no `chunkSizeWarningLimit` increase;
- no DB/Corporate Action paths in package payload/wrapper.

- [ ] **Step 5: Run validation when `-RunValidation` is supplied**

In order:

```powershell
node .\scripts\split-official-watchlist-data.mjs --check
npx vitest run src/features/watchlists/__tests__ src/components/__tests__/OfficialWatchlistImportDialog.sourceContract.test.ts
npm run typecheck:renderer
npm run build:renderer
npm run tauri:check
node <package-tools>\check-w1-3-bundle.mjs .\dist\assets
```

Check native exit codes immediately after each command.

- [ ] **Step 6: Print explicit final gate**

Success output must end with:

```text
W1.3 OFFICIAL WATCHLISTS LAZY-DATA VALIDATION PASS.
Static Official Watchlists feature chunk materially reduced from W1.2 baseline.
Six source-selective lazy payload paths verified.
NO DATABASE OPERATION was run.
```

Also print actual bundle measurements and note any remaining >500 kB lazy payload warning without hiding it.

- [ ] **Step 7: Package integrity verification**

Before delivery:
- verify ZIP SHA-256;
- extract ZIP to a clean temporary directory;
- run package source-contract checker there;
- verify all manifest payload hashes;
- verify wrapper contains no database invocation.

---

## Execution Stop Gates

1. **After Task 1:** stop if generated parity differs from canonical input in any group/member field.
2. **After Task 2:** stop if a source loader preloads another source, failed promise remains cached, or payload metadata mismatches catalog.
3. **After Task 3:** stop if any existing import/update/live-fallback regression changes behavior.
4. **After Task 4:** stop if stale source completion can overwrite active source state or import can execute while loading/error.
5. **After Task 5:** stop if the static feature chunk does not materially shrink or dynamic source modules are collapsed back into the feature chunk.
6. **After Task 6:** stop on any test/typecheck/build/Tauri failure.
7. **Task 7 package:** abort on source-hash mismatch; never force-apply over newer project state.

## Expected Final Operator Validation

After applying the package with `-RunValidation`, manually open the Official Watchlist dialog and perform this focused smoke test:

1. Open dialog; verify six source tabs and group counts appear immediately.
2. Select `BSE Indices`; observe brief `Loading constituents…`, then preview a group such as BSE 500.
3. Switch immediately from a large source to another source while loading; verify no stale previous-source constituents appear under the new source.
4. Switch back to the already loaded source; verify it returns without a second module/network-style delay beyond normal rendering.
5. Import one already-known safe test group and verify existing source-linked watchlist behavior remains unchanged.
6. Restart is **not** required to validate session caching; cache is intentionally per app session.

Do not perform any Corporate Action operation as part of this smoke test.
