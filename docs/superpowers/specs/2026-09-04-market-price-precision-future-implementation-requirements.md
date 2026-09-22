# Market-Price Precision — Future Implementation Requirements

Status: FUTURE IMPLEMENTATION AUTHORITY / NOT YET IMPLEMENTED  
Date: 2026-09-04

## Objective

Make market-price precision **instrument-aware and data-safe** so the EOD Charting Platform can support future asset classes without repeatedly changing decimal formatting throughout the application.

The target architecture must support current NSE/BSE behavior and future instruments such as Forex, futures, commodities and digital assets.

## Primary invariant

**Storage precision and display precision are separate contracts.**

The application must preserve raw source precision first, then display each instrument according to its market convention.

Do not derive one contract automatically from the other.

## Required concepts

A future implementation should establish one central instrument price-format contract.

Conceptual shape:

```ts
interface InstrumentPriceFormat {
  displayPrecision: number;
  tickSize?: number | null;
  storageScale?: number | null;
  source: 'instrument' | 'market-default' | 'legacy-fallback';
}
```

The exact type/name may change during implementation, but these semantics must remain explicit.

### `displayPrecision`

Controls ordinary market-price display, for example:

```text
NSE equity   3412.50
NSE index   24252.00
EURUSD          1.08456
USDJPY        147.325
```

Do not encode rules such as `Forex = 4 decimals`; precision belongs to the instrument/market metadata.

### `tickSize`

Represents the valid market price increment where available.

It must not be guessed from the current price magnitude.

Tick size and display precision are related but not identical concepts.

### `storageScale`

Represents the precision used to encode/decode persisted raw prices.

It must be validated against source precision.

Do not simply map `storageScale = 10000` to `displayPrecision = 4`.

The current NSE/NSE_INDEX files can use `10000` storage scale while the desired display remains two decimals.

## Resolution precedence

A future resolver should use a deterministic hierarchy such as:

1. explicit instrument precision/tick metadata
2. explicit market/exchange/asset-class default
3. current NSE/BSE legacy fallback of two decimals
4. fail closed or visibly flag unsupported precision when correctness cannot be guaranteed

Do not fall back to price magnitude for primary market prices.

The exact fallback policy must be tested before implementation.

## Required data flow

Precision metadata should flow with the selected instrument rather than being recomputed independently by UI components.

Target conceptual path:

```text
Source / instrument master
        |
        v
Raw price + precision metadata
        |
        +--> storage-scale validation
        |
        v
Instrument metadata contract
        |
        v
chartStore / chart tab instrumentMeta
        |
        +--> ChartCanvas
        +--> ChartEngine
        +--> ChartPriceLegendOverlay
        +--> crosshair
        +--> OHLC/header surfaces
        +--> price-valued drawings
        +--> compare overlays
```

A chart component should not need to know whether an instrument is NSE, BSE, EURUSD or another future asset merely to choose decimal places.

## Formatter separation

Do not create one universal numeric formatter.

At minimum maintain separate semantic domains.

### 1. Market price

Use instrument-aware price precision.

Examples:

- O/H/L/C
- last/current price
- previous close
- market high/low
- crosshair price
- price-axis labels
- chart header price
- price-valued drawing anchors

### 2. Calculated / indicator values

Use indicator/calculation-specific precision.

Examples:

- RSI
- MACD
- ATR
- regression slope
- derived ratios

An indicator can require more or fewer decimals than the underlying market price.

### 3. Percent / quantity / volume

Use dedicated semantic formatters.

Examples:

- `+0.84%`
- volume abbreviations
- integer counts
- ratios

These must not inherit instrument price precision automatically.

## Y-axis requirement

The Y-axis must remain legible while never collapsing distinct price levels.

Future design must account for both:

- instrument market precision
- generated tick-step precision

A valid implementation may derive an axis-specific precision from both inputs, but must not silently round adjacent ticks to the same displayed label.

This deserves explicit unit tests.

## Storage and ingestion requirements

Before enabling an asset whose raw source precision exceeds current assumptions:

1. audit every writer that uses `DEFAULT_SCALE`
2. audit CSV/manual import conversion
3. audit bhavcopy/import adapters
4. audit quote editing and mutation paths
5. audit binary append/rewrite/recovery logic
6. audit binary index/state metadata
7. verify read-after-write round trip with the exact raw precision
8. verify migrations or mixed-scale files if supported
9. prove existing NSE/BSE files remain readable and byte-compatible where required

Do not globally change `DEFAULT_SCALE` as a shortcut.

A storage generalization must be separately designed and tested.

## Migration phases

### P0 — Read-only precision inventory

Freeze current authorities and enumerate every market-price display/storage call site.

No production change.

### P1 — Precision metadata contract

Add instrument-level precision metadata and a deterministic resolver.

No broad UI migration yet.

Required tests:

- current NSE/BSE fallback = 2
- explicit 5-decimal instrument
- explicit 3-decimal instrument
- malformed/missing metadata
- invalid tick size
- no value-magnitude dependency

### P2 — Central market-price formatter

Introduce one instrument-aware formatter for market prices.

Preserve generic `Renderer.formatPrice` for non-market/adaptive uses until classified.

### P3 — Primary chart migration

Migrate:

- OHLC legend
- current price
- previous close
- high/low tags
- Y-axis
- crosshair
- `OhlcvBar`
- `TileHeader`

Only after these pass should the current explicit NSE/BSE two-decimal compatibility wiring be removed.

### P4 — Secondary price surfaces

Audit and migrate:

- price-valued drawings
- compare overlays
- tooltips
- scanner/market-mover price cells
- quote editor
- alerts/signals where values represent actual market prices

Do not migrate percentages, quantities or indicator outputs merely because they are numeric.

### P5 — Storage generalization

Only if a future data source requires more precision than the current storage path safely preserves.

Treat this as a separate backend/storage change with independent evidence.

### P6 — Multi-asset acceptance matrix

Minimum future fixtures should include:

| Fixture | Expected display |
| --- | --- |
| ordinary NSE equity | 2 decimals |
| NSE index | 2 decimals |
| BSE index | 2 decimals |
| 5-decimal FX-style instrument | 5 decimals |
| 3-decimal JPY-style FX instrument | 3 decimals |
| low-priced high-precision fixture | precision from metadata |

If actual future provider conventions differ, use provider/instrument metadata as authority rather than hard-coded examples.

## Required tests

### Resolver tests

- explicit precision wins
- instrument metadata wins over defaults
- fallback is deterministic
- invalid precision fails closed
- current price magnitude does not change precision

### Formatter tests

- preserves trailing zeros required by display precision
- preserves significant fractional digits
- handles negatives
- handles grouped high values
- handles very small prices
- does not emit scientific notation unless explicitly designed

### Chart integration tests

Verify all primary price surfaces use the same resolved instrument price format.

### Storage round-trip tests

For any new storage scale:

```text
raw source
-> encode
-> persist
-> read
-> decode
```

must reproduce the source price within the exact declared storage contract.

### Regression tests

Current NSE/BSE acceptance examples must remain valid:

```text
24,252.00
78,263.33
701.70
```

## Implementation blockers

Do not claim future Forex/high-precision asset support complete if any of these remain unresolved:

- instrument metadata has no precision contract
- chart surfaces still independently choose decimals
- crosshair truncates precision
- `OhlcvBar`/`TileHeader` remain hard-coded to two decimals
- storage writer truncates source precision
- manual/import paths use incompatible fixed scale
- adjacent Y-axis ticks render to identical labels
- compare/drawing price labels silently use magnitude formatting

## Relationship to current two-decimal fix

The current accepted two-decimal fix remains the production baseline for NSE/BSE.

It is a compatibility bridge, not technical debt to remove immediately.

Remove or replace it only when the instrument-aware pipeline is proven end-to-end and the current acceptance matrix remains green.

## Scope boundaries

This future project does not authorize:

- adding a Forex provider
- changing database schemas
- changing binary storage scale
- changing Corporate Action behavior
- changing indicator semantics
- changing all numeric fields to one formatter

Each of those requires its own explicit implementation scope.
