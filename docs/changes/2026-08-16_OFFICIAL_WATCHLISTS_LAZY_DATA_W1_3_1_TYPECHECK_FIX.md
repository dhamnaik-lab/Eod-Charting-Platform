# Official Watchlists Lazy Data W1.3.1 — Typecheck Fix

## Scope

Narrow test-only correction after W1.3 validation reached renderer typecheck.

## Root cause

`parseGeneratedSnapshot()` intentionally returns `Record<string, any>` for generated fixture parsing. In `officialWatchlistDataSplit.test.ts`, `source.groups` is therefore `any`, so three `.map((group) => ...)` callbacks had no contextual parameter type and failed `noImplicitAny` with TS7006.

All 88 W1.3 Vitest regressions had already passed before this compile-time failure.

## Change

- Add local `CatalogGroup` test type.
- Annotate the three catalog-side `.map()` callbacks.
- No production source, generated data, provider, dialog, loader, persistence, database, or bundle architecture behavior changes.

## Validation

Re-run the complete W1.3 validation chain: architecture contract, generator check, Watchlist regressions, renderer typecheck/build, Tauri check, and bundle measurement.
