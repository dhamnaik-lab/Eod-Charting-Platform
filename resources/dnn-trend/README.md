# DNN Trend Resources

This directory contains two independent versioned contracts.

## 1. Precomputed prediction input

- `dnn-trend-predictions-v1.schema.json`
- `sample-precomputed-predictions-v1.json`

The desktop prediction adapter reads these externally generated probability files. The bundled sample is non-production data.

## 2. External research dataset export

- `dnn-research-dataset-v1-manifest.schema.json`

Settings → Plugins → DNN Trend Prediction Adapter → **Export Full Dataset...** creates a new atomic dataset directory under a user-selected parent folder. The application reads the active market database through a separate read-only SQLite connection and does not modify the database.

Each dataset contains:

- `dataset-manifest.json`
- `instruments.csv`
- `daily-bars.csv`
- `corporate-actions.csv`
- `failures.csv`

### Default full-export policy

- Exchanges: NSE and BSE
- Date range: complete active-database range
- Inactive instruments: included
- Identity history: resolved to the current canonical symbol
- Capital-action adjustment: enabled
- Dividend adjustment: disabled
- Rights adjustment: disabled
- Timeframe: completed daily bars only

The exact policy, database identity, database revision, source counts, output counts, and failure count are recorded in `dataset-manifest.json`.

### `instruments.csv`

Columns:

```text
canonicalSymbol,exchange,identitySymbols,bseSecurityCode,isin,name,series,seriesAsOfDate,sector,industry,isActive,lifecycleStatus,firstPriceDate,lastPriceDate,barCount
```

`identitySymbols` is a pipe-delimited audit field containing the symbol identities merged into the canonical series.

### `daily-bars.csv`

Columns:

```text
canonicalSymbol,exchange,sourceSymbol,date,open,high,low,close,prevClose,volume,openInterest
```

`canonicalSymbol` is the current identity used by the research dataset. `sourceSymbol` records the historical symbol from which the selected bar originated.

### `corporate-actions.csv`

Columns:

```text
canonicalSymbol,exchange,effectiveDate,actionType,factor,adjustVolume,ratioNum,ratioDen,oldFaceValue,newFaceValue,cashAmount,source
```

This file remains an explicit audit trail even when adjusted bars are exported.

### `failures.csv`

Columns:

```text
symbol,exchange,stage,message
```

No failed instrument is silently omitted. A dataset with failures is marked `completeWithFailures` in the manifest and should not be treated as clean training input until those rows are reviewed.

## External workspace boundary

Model training, walk-forward validation, feature engineering, and prediction generation should remain outside the desktop source tree, for example:

```text
E:\TA Projects\EOD DNN Research
```

Do not place Python environments, model checkpoints, exported datasets, or training output under `src` or `src-tauri-shell`.

## V1 limitations

- The export has progress reporting but no cancellation control.
- The database revision is a metadata fingerprint, not a cryptographic hash of every SQLite and binary EOD byte.
- CSV is the canonical V1 interchange format. An external research workspace may convert a validated complete export to Parquet without changing the desktop source tree.
- A `completeWithFailures` dataset must be reviewed before training; the desktop exporter does not silently impute or repair failed instruments.
- A process or machine interruption can leave the hidden staging folder in the chosen output parent. No finalized dataset directory is published until the export completes.
