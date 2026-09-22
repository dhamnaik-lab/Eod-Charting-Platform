# Official Watchlists Lazy-Data W1.3 Design

**Date:** 2026-08-16  
**Project:** EOD Charting Platform  
**Phase:** Warning / bundle hygiene W1.3  
**Status:** Approved design — implementation not yet started

## 1. Goal

Reduce the `feature-official-watchlists` production bundle by removing all six constituent universes from the feature's static dependency graph and loading only the source selected by the operator, while preserving all existing Official Watchlist semantics, persistence behavior, source-link refresh behavior, and fallback logic.

This phase is an architecture/performance change only. It must not alter Corporate Action behavior, database contents, watchlist business rules, exchange mapping, identity resolution, or persistence schema.

## 2. Current Problem

The production build currently emits an Official Watchlists feature chunk of approximately 1.18 MB minified. The dominant cause is not the dialog component itself; it is the static provider dependency graph.

`officialWatchlistProviders.ts` currently statically imports generated constituent datasets that together represent roughly 2.5 MB of TypeScript source data:

- `officialWatchlistData.generated.ts` — approximately 1.93 MB; contains four independent datasets:
  - NSE Sectors
  - NSE Indices
  - BSE Sectors
  - BSE Indices
- `nseSectorUniverseWatchlistData.generated.ts` — approximately 0.39 MB
- `bseSectorUniverseWatchlistData.generated.ts` — approximately 0.20 MB

Because these datasets are statically imported into the provider, the lazy-loaded Official Watchlist feature still receives all constituent universes together.

Raising Rollup's `chunkSizeWarningLimit` would only hide the symptom and is explicitly out of scope.

## 3. Selected Architecture

Use a **static lightweight catalog plus six source-selective lazy payloads with session caching**.

The static catalog contains only metadata needed to render the source/group chooser and resolve persisted source-linked watchlists:

- source id
- source label
- exchange
- watchlist prefix
- group id
- group name
- official URL / source-link metadata
- constituent count

The constituent arrays move behind six source-specific asynchronous loaders:

1. NSE Sectors
2. NSE Indices
3. NSE Stocks by Sector
4. BSE Sectors
5. BSE Indices
6. BSE Stocks by Sector

The source modules are loaded using dynamic `import()` only when required.

## 4. Runtime Data Flow

### 4.1 Dialog open

Opening the Official Watchlist dialog must load only the lightweight catalog. All six source tabs and their group metadata must be immediately available without loading constituent arrays.

### 4.2 Source selection

Selecting a source follows this sequence:

```text
source selected
    -> set source-data state to loading
    -> clear previous-source constituent selection/preview state
    -> invoke only that source's loader
    -> normalize/validate loaded groups
    -> cache the source promise/result for the current app session
    -> set source-data state to ready
    -> display constituents
```

The UI shows `Loading constituents…` while a source payload is loading.

### 4.3 Session cache

Each source loader is cached by source id for the current application session.

Requirements:

- repeated selection of an already loaded source must reuse the cached result;
- concurrent requests for the same source must share the same in-flight promise;
- a rejected promise must be removed from the cache so `Retry` performs a real new load;
- no persistent cache schema is introduced.

### 4.4 Stale-response protection

Source loading is asynchronous. A slow result for a previously selected source must never overwrite the currently selected source.

The dialog must compare the completed load against the active source request identity before committing result state.

## 5. Source Module Boundaries

### 5.1 Canonical source file

`officialWatchlistData.generated.ts` remains the canonical generated input for the four currently co-located source datasets.

W1.3 must not hand-maintain duplicate copies of these large arrays.

### 5.2 Deterministic split generator

Add a deterministic maintenance script:

`/scripts/split-official-watchlist-data.mjs`

It reads the canonical generated data and produces source-specific runtime modules:

- `officialWatchlistNseSectors.generated.ts`
- `officialWatchlistNseIndices.generated.ts`
- `officialWatchlistBseSectors.generated.ts`
- `officialWatchlistBseIndices.generated.ts`
- `officialWatchlistCatalog.generated.ts`

The catalog generator also includes source/group metadata for the two already independent sector-universe datasets:

- `nseSectorUniverseWatchlistData.generated.ts`
- `bseSectorUniverseWatchlistData.generated.ts`

The split script must produce stable ordering and deterministic output for identical canonical input.

### 5.3 Existing all-stock universe files

The NSE and BSE all-stock sector-universe generated files already represent separate sources and remain separate lazy payloads. W1.3 does not unnecessarily rewrite their data format.

## 6. Provider Contract

`officialWatchlistProviders.ts` becomes the stable facade for consumers.

It may statically import the lightweight catalog, but it must not statically import any constituent universe.

The provider exposes source/group metadata synchronously and constituent data asynchronously.

Required conceptual interfaces:

```ts
type OfficialWatchlistSourceId =
  | 'nse-sectors'
  | 'nse-indices'
  | 'nse-all-stocks'
  | 'bse-sectors'
  | 'bse-indices'
  | 'bse-all-stocks';

type OfficialWatchlistSourceDataState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error';

function listOfficialWatchlistSources(): OfficialWatchlistSourceMeta[];

function findOfficialWatchlistSourceForGroup(
  sourceExchange: string,
  sourceGroupType: string,
  sourceKey: string,
): OfficialWatchlistSourceMeta | null;

function loadOfficialWatchlistSource(
  sourceId: OfficialWatchlistSourceId,
): Promise<OfficialWatchlistSourcePayload>;
```

Exact type names may follow existing project naming conventions during implementation, but the architectural split and synchronous-vs-asynchronous responsibilities are fixed by this spec.

## 7. Existing Behavior That Must Be Preserved

W1.3 must not change any of the following:

- the six current source IDs;
- source labels;
- group IDs;
- group names;
- constituent identities;
- constituent order unless current code explicitly treats it as unordered;
- constituent counts;
- NSE/BSE exchange mapping;
- source-link signatures;
- generated watchlist names;
- snapshot-vs-live refresh semantics;
- existing live official-source fetch behavior;
- existing live-fetch failure fallback to snapshot data;
- ISIN-first constituent resolution;
- symbol fallback rules;
- duplicate handling;
- unresolved-member handling;
- replacement/update semantics for an existing source-linked watchlist;
- persistence schema.

## 8. Persisted Source-Linked Watchlists

Existing persisted metadata contains fields such as:

- `sourceExchange`
- `sourceGroupType`
- `sourceKey`

but does not persist `sourceId`.

W1.3 must not add a persistence migration solely to support lazy loading.

The static catalog must retain a deterministic mapping from the persisted source-link identity to the corresponding source id.

Source-linked refresh therefore follows:

```text
persisted sourceExchange/sourceGroupType/sourceKey
    -> static catalog lookup
    -> exact sourceId
    -> lazy-load only that source payload
    -> existing refresh/import logic
```

No broad multi-source loading is allowed simply to rediscover the source.

## 9. Snapshot and Live Refresh Semantics

Lazy loading changes how the bundled snapshot baseline is obtained; it does not change the existing source-refresh policy.

Conceptual flow:

```text
load selected snapshot payload lazily
    -> if source refresh mode is snapshot
         use snapshot
       else
         execute existing live official-source fetch
           -> on success use live result
           -> on existing allowed failure path use existing snapshot fallback
```

W1.3 must not introduce a new network fallback policy.

## 10. Dialog State and UX

The Official Watchlist dialog gains explicit source-data state:

- `idle`
- `loading`
- `ready`
- `error`

### Loading state

While loading:

- source tabs remain usable;
- the prior source's constituent selection must be cleared;
- stale prior-source constituent preview must not remain visible;
- import actions requiring constituent data are disabled;
- the content area shows `Loading constituents…`.

### Error state

On source-data import failure:

- no prior-source constituents are shown as if they belonged to the selected source;
- the error is visible to the operator;
- `Retry` is available;
- selecting another source remains possible;
- retry clears the failed cache entry and executes a fresh dynamic import/load path.

## 11. Error Handling

### Generated-module mismatch

If a lazily loaded payload does not match its catalog metadata or source identity, the provider must reject it rather than silently render inconsistent data.

### Loader failure

A loader failure must:

1. clear the failed cache entry;
2. surface an error state to the dialog;
3. avoid changing persisted watchlists;
4. avoid executing an import with incomplete data.

### Stale async completion

A completed request that is no longer the active source must be ignored for UI state purposes. The successfully loaded payload may remain cached for later reuse.

## 12. Build and Bundle Requirements

W1.3 must not solve the problem by increasing the Rollup warning threshold.

The production build must demonstrate:

- the old monolithic Official Watchlists constituent payload is no longer statically bundled with the dialog/provider feature chunk;
- source-specific generated modules are emitted as independent lazy chunks or otherwise remain outside the static Official Watchlists dependency path;
- the `feature-official-watchlists` chunk materially shrinks versus the measured W1.2 baseline of approximately 1,179.22 kB minified / 280.18 kB gzip;
- before/after minified and gzip measurements are recorded in the W1.3 change document.

The success criterion is architectural, not an arbitrary warning threshold:

> All six constituent universes must be removed from the static Official Watchlists feature graph, and only the operator-requested source universe should be loaded.

If an individual source-specific payload remains above 500 kB, W1.3 reports that fact. It does not distort the source boundaries merely to silence Rollup.

## 13. Testing Strategy

### 13.1 Generator parity tests

Verify generated split output against canonical input:

- all six source identities represented;
- exact group IDs;
- exact group names;
- exact exchange mapping;
- exact constituent counts;
- exact constituent identities and ordering;
- deterministic output on repeated generation.

### 13.2 Provider lazy-loader tests

Required tests:

- loading one source invokes only that source loader;
- loading a second source does not preload unrelated sources;
- repeated same-source loads use the cache;
- concurrent same-source calls share one in-flight promise;
- failed load removes cache entry;
- retry invokes the loader again;
- source-linked group lookup returns the exact source without loading constituent data.

### 13.3 Existing import/refresh regression tests

Existing Official Watchlist import behavior must remain green, including:

- snapshot import;
- live refresh path;
- snapshot fallback path;
- source-linked update/replacement;
- unresolved constituents;
- duplicates;
- ISIN/symbol resolution behavior.

### 13.4 Dialog tests

Required UI-state tests:

- loading indication;
- import disabled while loading;
- prior-source rows cleared when source changes;
- error rendering;
- retry behavior;
- source switch remains available after failure;
- stale completion does not overwrite the new active source.

### 13.5 Build validation

Run:

- Official Watchlist focused tests;
- renderer typecheck;
- renderer production build;
- Tauri Rust check;
- bundle-size capture and comparison against W1.2 baseline.

## 14. Rollout and Safety

W1.3 is source/UI/build architecture work only.

It must perform:

- no database migration;
- no database write as part of the patch script;
- no Corporate Action operation;
- no watchlist persistence migration;
- no automatic deletion of existing source-linked watchlists;
- no change to W1.2 Vite ESM configuration other than what is strictly necessary for dynamic imports to build normally.

The Windows apply package must use source compatibility hashes and create a verified project backup before source mutation.

## 15. Documentation

The implementation package must create/update:

- `docs/changes/2026-08-16_OFFICIAL_WATCHLISTS_LAZY_DATA_W1_3.md`
- `docs/superpowers/plans/2026-08-16-official-watchlists-lazy-data-w1-3-plan.md`
- relevant file inventory entries for generated runtime modules and the split generator.

The change document must record bundle measurements before and after W1.3.

## 16. Explicit Non-Goals

W1.3 does not:

- optimize `feature-chart-runtime`;
- change the >500 kB warning threshold;
- migrate generated watchlist data to external JSON/resources;
- redesign the Official Watchlist UI beyond loading/error states needed for lazy data;
- add persistent constituent caching;
- change live source fetch rules;
- change database or watchlist schemas;
- change Corporate Actions;
- alter constituent business data.

`feature-chart-runtime` optimization remains W1.4.

## 17. Acceptance Criteria

W1.3 is accepted only when all of the following are true:

1. Static provider/catalog import path contains no constituent universe arrays.
2. Six source-selective lazy data paths exist.
3. Selecting one source loads only that source payload.
4. Same-session cache and retry semantics are covered by tests.
5. Persisted source-linked refresh resolves its source through static metadata without broad dataset loading.
6. All existing Official Watchlist business semantics remain green.
7. Dialog loading/error/stale-response behavior is covered by tests.
8. Renderer typecheck/build and Tauri check pass.
9. The production bundle shows a material reduction in the static Official Watchlists feature chunk from the W1.2 baseline.
10. Before/after bundle measurements are documented.
11. No database or persistence-schema change is introduced.

