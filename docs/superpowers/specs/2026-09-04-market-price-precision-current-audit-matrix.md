# Market-Price Precision — Current Audit Matrix

Status: READ-ONLY ARCHITECTURE AUDIT / CURRENT STATE  
Date: 2026-09-04

## Purpose

This document inventories the current EOD Charting Platform number-formatting and storage-precision behavior relevant to future multi-asset support.

No implementation is authorized by this audit.

## Core finding

The application currently has **multiple independent numeric-formatting policies**. It does not yet have one instrument-aware market-price precision contract.

The current two-decimal chart fix correctly solves the present NSE/BSE index defect, but future asset classes must not rely on hard-coded two decimals or value-magnitude heuristics.

## Current formatter behavior

### Generic `Renderer.formatPrice`

`src/engine/Renderer.ts` exposes:

```ts
formatPrice(
  price: number,
  minimumFractionDigits?: number,
  maximumFractionDigits?: number,
)
```

When explicit digits are not supplied, current resolution is based on numeric magnitude:

| Absolute value | Default fraction digits |
| ---: | ---: |
| >= 10000 | 0 |
| >= 1000 | 1 |
| >= 1 | 2 |
| >= 0.1 | 3 |
| < 0.1 | 4 |

This policy is useful as a generic compact formatter but is **not a valid market-price precision authority**.

It caused the original NIFTY/SENSEX symptom because large values could render without `.00`.

It would also be unsuitable for high-precision Forex. For example, `1.08456` falls in the `>= 1` bucket and would default to two decimals if no explicit precision is passed.

### Explicit two-decimal current chart wiring

The accepted compatibility fix now explicitly requests `2,2` digits for:

- `ChartPriceLegendOverlay` O/H/L/C
- `ChartEngine` current-price tag
- `ChartEngine` previous-close tag
- `ChartEngine` high tag
- `ChartEngine` low tag

This is correct for the current NSE/BSE baseline, but transitional for future multi-asset support.

### Y-axis

`ChartEngine` currently calculates:

```ts
pricePrecision = Math.max(getPrecisionFromStep(priceTicks.step), 2)
```

The price-axis labels therefore use scale-step precision with a minimum of two decimals.

This is why the Y-axis remained correct even when the legend/current-price labels lost decimals.

Future work must define how axis tick precision relates to instrument display precision and tick size.

### Crosshair / drawings / indicators

Many price-like analytical and drawing values continue to call generic `formatPrice(...)` without an instrument contract.

They must be classified before multi-asset precision is considered complete.

Do not blindly force all of them to the same precision because calculated values, indicator values and drawing metrics can have different semantic requirements.

### `OhlcvBar`

`src/components/OhlcvBar.tsx` currently uses `.toFixed(2)` for O/H/L/C.

This is NSE/BSE-compatible but not future-Forex-ready.

### `TileHeader`

`src/components/TileHeader.tsx` currently uses `.toFixed(2)` for displayed close/price values.

This is NSE/BSE-compatible but not future-Forex-ready.

## Instrument metadata gap

`src/types/desktop.ts` defines `InstrumentSummary` with symbol/exchange/name/series/ISIN/lifecycle fields.

It currently has no first-class fields for:

- price display precision
- tick size
- storage scale
- asset class precision convention

`chartStore` already propagates `instrumentMeta: InstrumentSummary | null` to chart tabs.

That existing metadata path is a likely future propagation channel, but the precision contract must be designed deliberately rather than added ad hoc.

## Storage precision

The binary EOD format contains a `price_scale` field in the binary header.

Current core code defines:

```rust
pub const DEFAULT_SCALE: u32 = 10000;
```

Many current ingestion/write paths use `DEFAULT_SCALE`.

Observed NSE and NSE_INDEX file evidence also reports:

```text
priceScale = 10000
```

This means storage precision and display precision are already conceptually separate:

- storage can retain finer fractional resolution
- the current NSE/BSE chart convention displays two decimals

### Critical limitation for future assets

A future feed requiring more than four fractional decimal places cannot be assumed safe merely because the UI can display more digits.

Every ingestion path that multiplies raw values by `DEFAULT_SCALE` must be audited before claiming lossless support for such data.

For example, a five-decimal FX quote may require a scale such as `100000`, subject to the actual chosen storage contract.

Do not change `DEFAULT_SCALE` globally as a shortcut.

## Current surface classification

| Surface | Current policy | Future action |
| --- | --- | --- |
| Main OHLC legend | explicit 2 decimals | migrate to instrument market-price formatter |
| Current price tag | explicit 2 decimals | migrate |
| Previous close tag | explicit 2 decimals | migrate |
| High/Low tags | explicit 2 decimals | migrate |
| Price Y-axis | step precision, min 2 | define instrument-aware axis contract |
| Crosshair market price | generic formatter path | audit/migrate |
| `OhlcvBar` | `.toFixed(2)` | migrate |
| `TileHeader` | `.toFixed(2)` | migrate |
| Drawing price labels | mostly generic formatter | classify then migrate price-valued labels |
| Indicator values | mixed/adaptive | keep separate from market-price policy |
| Percentages | explicit percent formatters | keep separate |
| Volume/quantities | K/L/Cr/integer style | keep separate |
| Market Movers / scanner | mixed 2-decimal/market-specific | audit when multi-asset scope reaches them |
| Quote Editor/import views | current NSE/BSE assumptions | audit with future asset ingestion |
| Compare overlays | mixed generic formatting | audit |
| Corporate Action prices | NSE/BSE workflow | no change from this precision project |

## Non-goals

The future price-precision project must not:

- make every numeric field use the same number of decimals
- infer market precision from price magnitude
- infer display precision directly from binary `price_scale`
- rewrite Corporate Action validation or approval logic
- change percentage/volume semantics
- add Forex ingestion before storage precision is proven
