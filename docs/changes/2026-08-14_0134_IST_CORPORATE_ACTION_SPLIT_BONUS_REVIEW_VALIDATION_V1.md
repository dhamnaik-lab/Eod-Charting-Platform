# Corporate Action Split + Bonus Review Validation V1

**IST timestamp:** 2026-08-14 01:34 IST  
**Project:** EOD Charting Platform  
**Source authority:** `Eod Charting Platform Source Code 2026-08-14_001606_IST`  
**Source ZIP SHA-256:** `514168dfe18bc0375cb8dc727c5f3536f06186baeca52d5580b427f3523f2327`

## Objective

Make Split/Bonus review mathematically transparent and safer without changing the existing read-time Corporate Action adjustment model. Official action data remains authoritative; local EOD prices validate the expected discontinuity; genuine ex-date market gaps remain untouched.

## Previous limitation

The Corporate Action UI mixed instrument-resolution state (`UNRESOLVED`) with operator review, while the existing Split/Bonus price scanner was isolated from ordinary approval. A parsed/resolved Split or Bonus could be approved without a current `MATCHED` official price-validation result. The UI also hid the theoretical adjusted price, residual market gap, and confidence that were already derivable from scan evidence, and Corporate Action date defaults used UTC calendar dates during the early IST trading-day boundary.

## Files changed

### Modified

- `src/components/DatabaseToolsDialogs.tsx`
- `src/platform/tauriDesktop.ts`
- `src/platform/types.ts`
- `src/types/desktop.ts`
- `src-tauri-shell/src/database.rs`
- `src-tauri-shell/src/database/corporate_action_imports.rs`
- `src-tauri-shell/src/database/eod_data.rs` — tests only; production adjustment logic unchanged
- `src-tauri-shell/src/main.rs`

### Created

- `src/features/corporateActions/corporateActionValidation.ts`
- `src/features/corporateActions/corporateActionDate.ts`
- `src/features/corporateActions/__tests__/corporateActionValidation.test.ts`
- `docs/changes/2026-08-14_0134_IST_CORPORATE_ACTION_SPLIT_BONUS_REVIEW_VALIDATION_V1.md`

## Final implementation

### 1. Targeted official Split/Bonus validation

`CorporateActionScanInput` now accepts optional `importIds`. Official scans can validate selected import rows instead of rescanning the entire candidate set. IDs are positive, deduplicated, and capped at 500 per request. Blind-anomaly scans reject targeted import IDs and otherwise preserve their previous behavior.

### 2. Ordinary Split/Bonus approval gate

Ordinary Split/Bonus approval now requires the latest completed `official_imports` scan evidence for that import to be current and `MATCHED`. Freshness checks bind the evidence to import ID, symbol, exchange, expected factor, and ex-date price window. This server-side gate also applies when the import would link to an already-existing canonical Corporate Action.

Dividend and Rights approval policy is deliberately unchanged in Phase 1.

### 3. Audited price-validation exception

A new Tauri command, `approve_corporate_action_import_with_price_validation_exception`, permits a reviewed Split/Bonus mismatch or no-price-data case to be approved only with a 10–1000 character reason. The reason is recorded in the existing `corporate_action_import_decisions` table as `PRICE_VALIDATION_EXCEPTION`.

The exception does not bypass unresolved instrument identity or `PENDING_ISIN_MISMATCH`. A currently `MATCHED` Split/Bonus must use ordinary approval instead.

### 4. Identity / validation / approval separation in the UI

Official Imports review now presents distinct user-facing states for:

- instrument identity (`MATCHED`, `MATCH REQUIRED`, `ISIN REVIEW REQUIRED`);
- Split/Bonus price validation (`STRONG MATCH`, `MATCH`, `NEEDS REVIEW`, `NO PRICE DATA`, `NOT VALIDATED`);
- approval (`READY TO APPROVE`, `NEEDS VALIDATION`, `NEEDS REVIEW`, etc.).

Bulk ordinary approval only selects rows that are actually `READY TO APPROVE` under the same frontend model, while the backend gate remains authoritative.

### 5. Transparent factor and price evidence

Split/Bonus review displays:

- human-readable action description;
- share multiplier;
- parsed price multiplier when available (fallback `1 / share factor`);
- previous close;
- theoretical ex-price (`previous close / expected share factor`);
- actual ex-date open;
- residual opening market gap;
- validation confidence.

The detailed Scan Database table now also exposes previous/theoretical price, ex-date open/close, observed factors, residual open/close movement, and confidence.

### 6. Genuine ex-date market gap preserved

Production `apply_corporate_adjustments()` behavior was not changed. Split/Bonus regression tests were added to assert that:

- only pre-effective-date OHLC is adjusted;
- ex-date OHLC remains actual market data;
- +5% and -5% genuine ex-date gaps remain visible;
- pre-event volume/open interest follow the existing share-factor behavior;
- sequential Bonus + Split factors accumulate only for the historical periods to which they apply.

### 7. Corporate Action IST date correction

Corporate Action date defaults now use an explicit IST calendar-date helper. Date arithmetic is performed on validated ISO calendar dates without local/UTC round-tripping. Quote Editor behavior was deliberately left unchanged in this phase.

## Validation performed in the audit container

### Completed

1. **Fresh-source authority verification** — PASS  
   Confirmed source folder: `Eod Charting Platform Source Code 2026-08-14_001606_IST`.

2. **Touched TypeScript/TSX syntax parse using installed TypeScript `transpileModule`** — PASS  
   Parsed successfully:
   - `DatabaseToolsDialogs.tsx`
   - `corporateActionValidation.ts`
   - `corporateActionDate.ts`
   - `corporateActionValidation.test.ts`
   - `desktop.ts`
   - `platform/types.ts`
   - `tauriDesktop.ts`

3. **Standalone IST utility TypeScript compile** — PASS  
   Command:
   `tsc --noEmit --target ES2022 --module ESNext src/features/corporateActions/corporateActionDate.ts`

4. **Scope/diff inspection** — PASS  
   Only the intended source files plus new Corporate Action utility/test/report files differ from the uploaded baseline. Existing mixed CRLF/LF formatting in `DatabaseToolsDialogs.tsx` and `eod_data.rs` was preserved for unchanged lines to avoid unrelated whole-file churn.

### Blocked / not certified in this container

1. **Full renderer typecheck** — NOT CERTIFIED  
   `node_modules` is absent. A full `tsc -p tsconfig.json --noEmit` cannot resolve React/Zustand/JSX dependencies. This is an environment/dependency failure, not a PASS.

2. **Vitest** — NOT RUN  
   Project dependencies are unavailable. `npm ci --ignore-scripts --offline` failed because the npm cache is empty (`ENOTCACHED`, including `zustand`). A prior online install attempt did not complete within the available tool run.

3. **Rust tests / cargo check / rustfmt** — NOT RUN  
   `cargo`, `rustc`, and `rustfmt` are not installed in the audit container.

4. **Renderer build / Tauri check / portable Windows build** — NOT RUN in this container.

5. **Manual real-market Split/Bonus UI acceptance** — NOT RUN; must be performed on the Windows project after applying the package and building.

## Required validation on the project machine

```powershell
Set-Location "E:\TA Projects\EOD Charting Platform"

npx vitest run src/features/corporateActions/__tests__/corporateActionValidation.test.ts
cargo test --manifest-path src-tauri-shell/Cargo.toml corporate_action_imports -- --nocapture
cargo test --manifest-path src-tauri-shell/Cargo.toml eod_data -- --nocapture
npm run typecheck:renderer
npm run build:renderer
npm run tauri:check
```

After these gates pass, build the portable app when ready:

```powershell
npm run tauri:portable:win
```

## Manual acceptance

Use at least one real Split and one real Bonus. Confirm:

- official ratio/factor is correct;
- instrument identity is correct;
- theoretical ex-price is correct;
- actual ex-date open/close remain untouched;
- residual genuine market movement is displayed correctly;
- `MATCH`/`STRONG MATCH` enables ordinary approval;
- mismatch/no-price-data requires an audited exception;
- restart preserves approved state and adjusted chart behavior;
- duplicate approval does not create a second canonical action.

## Risks / limitations

- The implementation adds a mandatory Split/Bonus validation gate; old review habits that approved parsed/resolved Split/Bonus rows directly will now require validation first.
- Persisted scan evidence is enforced by the backend. The review UI holds loaded scan evidence in its current session; after reopening the tool, the operator may need to load or rerun validation before the UI exposes ordinary approval even when valid evidence already exists in SQLite.
- The existing confidence algorithm is deliberately reused; threshold calibration against a larger real-market corpus is deferred.
- Rights, Dividend, Demerger, historical repair-apply, and Corporate Action backend decomposition are intentionally out of scope.

## Rollback guidance

Before applying, back up every overwritten file. To roll back Phase 1, restore the eight modified baseline files and remove the three new `src/features/corporateActions` files plus this change report. No database schema migration is introduced by Phase 1, so rollback does not require database transformation.
