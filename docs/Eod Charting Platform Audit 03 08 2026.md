# EOD Charting Platform — Source-Code Audit

**Audit date:** 3 August 2026  
**Source reviewed:** `Eod Charting Platform Source Code 03 08 2026.zip`  
**Extracted source root:** `source-audit-20260731-125600`  
**Audit mode:** Read-only static source inspection with attempted build and test execution  

---

## 1. Executive Verdict

The platform has a credible technical foundation:

- React and TypeScript renderer;
- application-owned chart engine;
- typed Tauri bridge;
- Rust backend;
- SQLite database;
- custom binary EOD storage;
- import, corporate-action, scanner, indicator, and persistence systems.

The repository also contains useful domain tests, architecture documentation, scanner tests, corporate-action controls, and validation scripts.

However, the current version is **not yet suitable to be represented as a hardened or fully trusted analytical platform**.

The audit confirmed several release-blocking defects:

1. A Tauri command can recursively delete an arbitrary absolute directory without proving that it is an approved EOD database folder.
2. Custom formulas can request negative `barsBack` values and therefore read future bars.
3. Indicator caching can return stale results after OHLC revisions or upstream-indicator setting changes.
4. The user interface exposes higher-timeframe indicator settings, but production indicator calculation does not apply them.
5. CSV, date, and OHLCV validation is too weak for financial data and permits malformed or impossible records.
6. SQLite and binary EOD writes are not transactionally coordinated.
7. Existing binary EOD files are modified in place, creating corruption risk during interruption, disk failure, or power loss.

### Overall Assessment

| Area | Assessment | Release implication |
|---|---|---|
| Architecture and separation | Good foundation | Retain the typed platform seam and domain boundaries |
| Analytical correctness | High risk | Formula, cache, and timeframe defects can change chart conclusions |
| Data integrity | High risk | Import and dual-storage failures can create silent divergence |
| Desktop security boundary | Critical risk | Arbitrary recursive directory deletion must be removed |
| Reliability and recovery | High risk | Binary and profile writes need crash-safe protocols |
| Test and build confidence | Incomplete | Static findings are high-confidence; complete build execution was unavailable |
| Maintainability | Medium–high risk | Several critical modules are excessively large and mixed-responsibility |

### Release Recommendation

Keep this build in development or controlled internal evaluation.

Do not use it as the sole trusted basis for:

- trading decisions;
- adjusted-history research;
- bulk financial-data correction;
- permanent EOD-data custody;
- unattended database maintenance;

until all P0 and P1 remediation items in this report are completed and independently regression-tested.

---

## 2. Scope and Repository Profile

### Active Architecture

The repository documentation identifies the active product as a local-first Windows desktop application using:

- **Renderer:** React 18, TypeScript, Vite, Zustand
- **Charting:** custom Canvas 2D chart engine and application-specific technical-analysis logic
- **Desktop shell:** Tauri 2
- **Backend:** Rust
- **Persistence:** SQLite plus custom binary `.eod` files
- **Network sources:** NSE, BSE, and official watchlist sources

Architecture evidence:

- `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md:3-33`
- `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md:38-59`

### Source Inventory

| Metric | Count |
|---|---:|
| Active source files reviewed | 179 |
| TypeScript files | 111 |
| TSX files | 46 |
| Rust files | 21 |
| CSS files | 1 |
| Approximate active-source lines | 150,641 |
| Frontend test files | 29 |
| Frontend test lines | 4,911 |

The total includes large generated watchlist datasets.

The largest non-generated critical modules include:

- `src-tauri-shell/src/database/corporate_action_imports.rs` — approximately 11,281 lines
- `src/components/DatabaseToolsDialogs.tsx` — approximately 6,923 lines
- `src/plugins/scanner/chartPatternScanners.ts` — approximately 4,902 lines
- `src-tauri-shell/src/bhavcopy.rs` — approximately 4,785 lines
- `src/engine/ChartEngine.ts` — approximately 3,767 lines
- `src/components/ScannerWindow.tsx` — approximately 2,589 lines
- `src/components/ChartCanvas.tsx` — approximately 2,414 lines
- `src/engine/Renderer.ts` — approximately 2,300 lines
- `src-tauri-shell/src/database/binary_eod.rs` — approximately 2,014 lines
- `src-tauri-shell/src/imports.rs` — approximately 1,874 lines
- `src/engine/Indicators.ts` — approximately 1,842 lines

### Threat and Failure Model

The audit treated the following as important trust boundaries:

- renderer-to-Tauri command invocation;
- user-selected database, profile, import, and export paths;
- imported CSV and TXT content;
- database manifests;
- persisted application profile files;
- network responses and configurable URL overrides;
- interruption, disk-full, permission failure, and power-loss during durable writes;
- causal and no-look-ahead requirements for analytical calculations;
- parity between SQLite and binary `.eod` storage.

---

## 3. Findings Summary

| ID | Severity | Finding | Confidence |
|---|---|---|---|
| C-01 | Critical | `delete_database` permits arbitrary recursive directory deletion | High |
| H-01 | High | Database-manifest and symbol/exchange paths are not confined to approved roots | High |
| H-02 | High | Custom formulas can read future bars through negative `barsBack` | High |
| H-03 | High | Indicator cache keys do not represent the underlying data or dependency graph | High |
| H-04 | High | Higher-timeframe indicator setting is exposed but ignored in production calculation | High |
| H-05 | High | CSV/date/OHLCV validation accepts malformed and impossible financial records | High |
| H-06 | High | SQLite and binary EOD dual-writes are not atomic or recoverable as one operation | High |
| H-07 | High | Existing binary `.eod` files are rewritten or expanded in place | High |
| M-01 | Medium | Network URL overrides and downloads lack sufficient SSRF and resource controls | High |
| M-02 | Medium | External URI launch is unrestricted and the Tauri CSP is disabled | High |
| M-03 | Medium | Profile/settings persistence is non-atomic and parse failure silently becomes defaults | High |
| M-04 | Medium | CI, linting, toolchain pinning, and automated dependency controls are absent | High |
| M-05 | Medium | Critical modules are oversized and combine unrelated responsibilities | High |

---

# 4. Detailed Confirmed Findings

## C-01 — Arbitrary Recursive Directory Deletion

**Severity:** Critical  
**Category:** Destructive filesystem boundary and local data loss

### Evidence

File:

`src-tauri-shell/src/database/connection_registry.rs:224-252`

The command:

- accepts `input.file_path`;
- normalizes the supplied path;
- clears registry and connection state;
- calls `fs::remove_dir_all` whenever the target path exists.

The normalization logic at:

`src-tauri-shell/src/database/connection_registry.rs:540-547`

merely preserves an absolute path or joins a relative path to the current working directory.

It does not:

- canonicalize the target;
- verify that the path belongs to an approved database root;
- reject filesystem roots;
- reject user-profile folders;
- reject symlinks or Windows junctions;
- verify that the folder is an EOD database;
- verify that the path came from the registered database list.

The function:

`is_database_folder`

exists at:

`src-tauri-shell/src/database/connection_registry.rs:572-582`

but the `delete_database` command does not use it.

The command is exposed through the Tauri command handler at:

`src-tauri-shell/src/main.rs:1043-1062`

### Impact

Any renderer code capable of invoking this command can request recursive deletion of an arbitrary directory accessible to the process.

Possible destructive targets could include:

- the user’s Documents folder;
- project source folders;
- database backup folders;
- application configuration folders;
- desktop folders;
- mounted data drives;
- any other writable directory.

A user-interface confirmation dialog is not sufficient protection. The backend command must independently reject unsafe targets.

The risk is amplified because the current Tauri configuration has no Content Security Policy.

### Required Correction

The backend should enforce all of the following:

1. Canonicalize the requested path before any registry or connection state is changed.
2. Require the path to match a database already present in the approved connection registry.
3. Require a valid database manifest inside the same canonical folder.
4. Require the expected database file to exist inside the same canonical folder.
5. Reject:
   - filesystem roots;
   - drive roots;
   - home or user-profile roots;
   - Documents;
   - Desktop;
   - Downloads;
   - application state directories;
   - parent directories of approved databases;
   - paths outside approved database locations.
6. Detect and reject symlinks, reparse points, and Windows junction escapes.
7. Use a backend-issued short-lived deletion token tied to the exact registered database.
8. Prefer moving a database to a quarantine or recycle location instead of immediate permanent deletion.
9. Validate everything before:
   - clearing the current connection;
   - removing registry entries;
   - deleting files.
10. Add destructive-path tests covering:
    - `C:\`;
    - home directory;
    - parent traversal;
    - relative paths;
    - UNC paths;
    - Windows device paths;
    - symlinks;
    - junctions;
    - forged database manifests;
    - unregistered database folders.

### Release Status

This defect should be treated as a **release blocker**.

The `delete_database` command should be disabled until backend containment checks are implemented and tested.

---

## H-01 — Path Confinement Is Missing for Manifests and Binary EOD Components

**Severity:** High  
**Category:** Path traversal and unintended file access

### Database Manifest Evidence

File:

`src-tauri-shell/src/database/connection_registry.rs:614-626`

The manifest validator accepts a manifest when:

- format matches;
- version matches;
- `db_file` is non-empty.

It does not reject:

- absolute paths;
- `..`;
- directory separators;
- drive prefixes;
- UNC paths;
- device paths;
- alternate path components.

The database path is later constructed at:

`src-tauri-shell/src/database/connection_registry.rs:584-589`

using:

`folder_path.join(manifest.db_file)`

The resolved location is then opened by:

`open_connection_for_folder`

at:

`src-tauri-shell/src/database/connection_registry.rs:635-654`

A crafted `database.json` could therefore point the application outside the selected database directory.

### Symbol and Exchange Path Evidence

File:

`src-tauri-shell/src/database.rs:1965-1978`

Symbol and exchange validation only:

- trims the value;
- converts it to uppercase;
- checks that it is not empty.

These values later become filesystem path components in:

- `src-tauri-shell/src/database/quotes.rs:58-66`
- `src-tauri-shell/src/database/quotes.rs:165-182`
- `src-tauri-shell/src/database/eod_data.rs:474-480`

### Impact

Malformed manifest, symbol, or exchange values could cause:

- reads outside the expected database hierarchy;
- writes outside the expected database hierarchy;
- deletion of unintended files;
- overwrite of unrelated data;
- creation of malformed or inaccessible EOD files.

On Windows, path safety must explicitly account for:

- slash and backslash separators;
- `.` and `..`;
- drive letters;
- UNC paths;
- extended device paths;
- reserved names such as `CON`, `PRN`, `AUX`, `NUL`, `COM1`, and `LPT1`;
- trailing dots;
- trailing spaces;
- alternate data streams.

### Required Correction

Create shared validated path-component types.

Examples:

#### `ValidatedDatabaseFileName`

Requirements:

- exactly one normal filename component;
- no separators;
- no `.` or `..`;
- no drive prefix;
- no absolute path;
- fixed allowed extension;
- bounded length;
- no trailing dot or space;
- no reserved Windows device name.

#### `ValidatedExchangeComponent`

Requirements:

- strict allowlist;
- bounded length;
- no separators;
- no path syntax;
- no reserved names.

#### `ValidatedSymbolComponent`

Requirements:

- strict allowlist appropriate to supported exchange symbols;
- bounded length;
- no separators;
- no parent components;
- no drive or device syntax;
- no trailing dot or space.

Before every sensitive filesystem operation:

1. construct the intended child path;
2. canonicalize the approved parent;
3. canonicalize or safely resolve the target;
4. verify that the target remains inside the approved parent;
5. reject any containment failure.

Raw strings deserialized from Tauri commands should never be used directly as durable path components.

---

## H-02 — Custom Formulas Permit Future-Bar Access

**Severity:** High  
**Category:** Analytical correctness and look-ahead bias

### Evidence

File:

`src/modules/formulaEngine/customFormulaEngine.ts:718-739`

The functions:

- `ref(series, barsBack)`
- `change(series, barsBack)`

use an integer-validation routine that permits negative integers.

The evaluation code at:

`src/modules/formulaEngine/customFormulaEngine.ts:1198-1208`

calculates:

```text
sourceIndex = index - barsBack
```

Therefore:

```text
ref(close, -1)
```

becomes:

```text
sourceIndex = index + 1
```

and reads the next bar while evaluating the current bar.

Custom formulas are integrated into production indicator rendering at:

`src/engine/Indicators.ts:1449-1456`

### Impact

A custom formula can use future information while appearing to be calculated historically.

This can contaminate:

- chart indicators;
- scanner conditions;
- alerts;
- visual research;
- historical signal assessment;
- backtesting;
- parameter optimization;
- trading conclusions.

The result may look highly accurate because it is using data that was not available at the point where the historical value is plotted.

This is a direct violation of causal and no-look-ahead analytical requirements.

### Required Correction

1. Reject `barsBack < 0` in all causal analytical functions.
2. Keep visual plot displacement separate from value evaluation.
3. Define two independent concepts:
   - historical reference;
   - graphical display offset.
4. Prevent intentionally non-causal formulas from being used in:
   - scanners;
   - alerts;
   - backtests;
   - live trading;
   - strategy signals.
5. Add causal-prefix regression tests.

### Required Prefix-Invariance Test

For every formula:

1. calculate using bars `1...N`;
2. record all outputs up to bar `N`;
3. append future bars `N+1...M`;
4. recalculate;
5. verify that values for bars `1...N` have not changed.

Tests should cover:

- `ref`;
- `change`;
- crossovers;
- nested formulas;
- indicator-on-indicator sources;
- conditional expressions;
- alert evaluation;
- scanner evaluation.

### Release Status

Until corrected, the platform should not claim complete no-look-ahead correctness for custom formulas.

---

## H-03 — Indicator Cache Can Return Stale Calculations

**Severity:** High  
**Category:** Analytical correctness and cache invalidation

### Evidence

File:

`src/engine/Indicators.ts:143-149`

The chart-data signature is based only on:

- number of bars;
- timestamp of the last bar.

It does not include:

- OHLCV values;
- data revision;
- historical correction identifier;
- corporate-action adjustment version;
- active database identity;
- chart transformation;
- source database generation;
- instrument identity;
- exchange identity.

The settings signature at:

`src/engine/Indicators.ts:132-135`

includes only:

- `sourceIndicatorId`;
- current indicator timeframe.

It does not recursively include:

- source-indicator period;
- source-indicator settings;
- source-indicator values;
- source dependency revision.

The module-level cache is read and written at:

`src/engine/Indicators.ts:188-224`

### Confirmed Stale-Cache Scenarios

The platform can return stale indicator values when:

1. A historical OHLC value is corrected.
2. Bar count remains unchanged.
3. Last-bar timestamp remains unchanged.
4. A corporate action changes earlier historical bars.
5. The active database changes but produces the same bar count and last timestamp.
6. A source indicator’s period changes.
7. A dependent indicator retains the same `sourceIndicatorId`.
8. A chart transformation changes without changing the superficial signature.

### Important Distinction

The instrument-data cache is correctly cleared on the backend `database:changed` event at:

`src/features/workspace/chartRuntimeController.ts:283-300`

This finding concerns the independent indicator-result cache.

### Impact

The chart can display indicators that no longer correspond to the currently visible OHLCV data.

This can lead to:

- incorrect moving averages;
- incorrect oscillator values;
- incorrect scanner results;
- incorrect alerts;
- inconsistent results between chart and scanner;
- inconsistent results before and after application restart;
- false confidence after corporate-action correction;
- inconsistent research output.

### Required Correction

Introduce a monotonic chart-data revision or generation identifier.

Every indicator cache key should include:

- database identity;
- database revision;
- instrument;
- exchange;
- timeframe;
- chart type;
- adjustment mode;
- adjustment revision;
- bar-generation revision;
- data-series identity;
- indicator settings;
- source dependency signature.

For indicator-on-indicator calculations:

1. calculate a recursive dependency signature;
2. include all upstream settings and revisions;
3. invalidate dependent indicators whenever the source changes.

### Required Regression Tests

- historical OHLC correction with unchanged bar count;
- unchanged last timestamp;
- database switch with same symbol and date range;
- corporate-action adjustment revision;
- source-indicator period change;
- source-indicator type change;
- chart-type change;
- timeframe change;
- adjustment-mode change;
- hidden/visible indicator transition;
- scanner and alert consumers receiving the same corrected values as the chart.

---

## H-04 — Higher-Timeframe Indicator Setting Is Not Applied

**Severity:** High  
**Category:** Product correctness and misleading UI contract

### Evidence

The indicator settings user interface exposes and saves a timeframe at:

`src/components/IndicatorSettingsDialog.tsx:500-512`

The indicator catalog displays non-daily timeframe tags at:

`src/indicators/catalog.ts:802-812`

The timeframe value is included in the cache signature at:

`src/engine/Indicators.ts:135`

However, it is not used to calculate the indicator on aggregated higher-timeframe bars.

A helper named:

`aggregateBarsToHTF`

exists at:

`src/engine/Indicators.ts:1590-1630`

but no production integration was found in:

- `buildRenderableIndicators`;
- `buildRenderableIndicator`;
- the normal indicator calculation pipeline.

### Impact

An indicator labelled as:

- weekly;
- monthly;
- quarterly;
- yearly;

may still be calculated using the current chart bars.

For example, a supposed weekly moving average on a daily chart may actually be a daily moving average carrying a weekly label.

This causes the user interface to communicate a different analytical meaning from the actual calculation.

### Required Correction

Either:

1. remove or disable the higher-timeframe control until fully implemented;

or:

2. wire higher-timeframe aggregation into the complete calculation pipeline.

### Causal Higher-Timeframe Requirements

Higher-timeframe indicators must be calculated from completed higher-timeframe periods.

For example:

- a weekly value should not be finalized before the week has completed;
- a monthly value should not be applied to earlier days using information from later days in the same month;
- a forming weekly or monthly value must be clearly labelled as provisional if displayed.

The platform must explicitly define:

- week-start and week-end rules;
- exchange session calendar;
- holidays;
- partial weeks;
- partial months;
- financial-year or calendar-year rules;
- quarterly boundaries;
- mapping from higher-timeframe bars to lower-timeframe bars.

### Important Look-Ahead Warning

The existing `indexMap` associates lower-timeframe bars with the current aggregated bucket.

A naive implementation that calculates the completed weekly value and paints that value across all days in that week would introduce repainting and look-ahead.

The safe default is:

- use the most recently completed higher-timeframe value;
- apply it only after the relevant higher-timeframe period has completed.

### Required Tests

- week boundary;
- month boundary;
- quarter boundary;
- year boundary;
- holiday-shortened week;
- incomplete final week;
- incomplete final month;
- appended future bars;
- prefix invariance.

---

## H-05 — Import Validation Is Insufficient for Financial Data

**Severity:** High  
**Category:** Data integrity

### Evidence

File:

`src-tauri-shell/src/imports.rs:1367-1393`

The import logic parses fields and immediately constructs `ParsedRow`.

File:

`src-tauri-shell/src/imports.rs:1396-1401`

accepts values that Rust parses as `f64`.

It does not require that values are:

- finite;
- positive;
- within reasonable bounds;
- consistent with OHLC relationships.

Date handling at:

`src-tauri-shell/src/imports.rs:1411-1450`

normalizes dates primarily by textual shape.

Validators at:

`src-tauri-shell/src/imports.rs:1493-1515`

check:

- character positions;
- digit presence;
- format shape.

They do not validate calendar reality.

Binary conversion at:

`src-tauri-shell/src/imports.rs:819-827`

scales prices and casts volume or open interest into unsigned values without first enforcing non-negativity and safe bounds.

Database schema at:

`src-tauri-shell/src/database/bootstrap.rs:72-86`

does not define sufficient `CHECK` constraints for:

- date validity;
- positive prices;
- OHLC relationships;
- nonnegative volume;
- nonnegative open interest.

### Examples of Problematic Data

The current validation may permit values such as:

- `2026-99-99`;
- `2026-02-31`;
- `NaN`;
- positive infinity;
- negative infinity;
- negative volume;
- negative open interest;
- `high < low`;
- `open > high`;
- `close < low`;
- unreasonable scaled price;
- integer overflow or wrapping during conversion.

### Impact

Invalid records can contaminate:

- charts;
- indicators;
- scanners;
- adjusted history;
- corporate-action calculations;
- SQLite-to-binary parity;
- historical research;
- derived technical signals;
- exports and downstream datasets.

### Required Correction

#### Date Validation

Use a real calendar type such as:

`chrono::NaiveDate`

Reject:

- impossible dates;
- invalid leap days;
- malformed year/month/day values.

#### OHLC Validation

Require:

- finite values;
- positive prices;
- bounded values;
- `high >= low`;
- `high >= open`;
- `high >= close`;
- `low <= open`;
- `low <= close`.

Equivalent requirement:

```text
high >= max(open, close, low)
low <= min(open, close, high)
```

#### Volume and Open Interest Validation

Require:

- nonnegative values;
- integer-compatible values where required;
- explicit upper bounds;
- checked conversion.

Do not rely on unchecked numeric casts.

#### Database Protection

Add controlled database `CHECK` constraints.

Because existing databases may already contain bad records, introduce these through:

1. validation report;
2. repair or quarantine stage;
3. controlled migration;
4. final constraint enforcement.

#### Invalid-Row Quarantine

Rejected rows should record:

- source file;
- line number;
- field name;
- raw value;
- rejection reason;
- symbol;
- exchange;
- date where available.

Do not silently coerce invalid data.

#### Shared Validator

The same validation layer should be reused by:

- CSV import;
- TXT import;
- bhavcopy import;
- quote editing;
- corporate-action-generated data;
- migration;
- repair tools;
- binary conversion.

---

## H-06 — SQLite and Binary EOD Writes Are Not One Durable Operation

**Severity:** High  
**Category:** Cross-store consistency and recovery

### Evidence: Import Path

In:

`src-tauri-shell/src/imports.rs:868-879`

the SQLite transaction commits and reports committed rows.

Binary-file writes occur later at:

`src-tauri-shell/src/imports.rs:557-599`

Per-symbol binary errors are collected after the SQLite commit.

At that point, the SQLite transaction cannot be rolled back.

### Evidence: Quote Deletion

In:

`src-tauri-shell/src/database/quotes.rs:687-730`

SQLite deletion and related recomputation complete first.

Binary deletion follows later at:

`src-tauri-shell/src/database/quotes.rs:732-747`

### Failure Scenario

A typical partial-failure sequence is:

1. data is written successfully to SQLite;
2. SQLite commits;
3. binary update starts;
4. disk becomes full, permission fails, or process terminates;
5. binary update fails;
6. operation returns an error;
7. SQLite remains changed;
8. binary storage remains old or partially updated.

### Impact

SQLite and binary EOD stores may represent different histories.

Depending on which storage source is used, the platform may show:

- different bar counts;
- different prices;
- different corporate-action adjustments;
- different scanner results;
- different indicators;
- missing or duplicated dates.

An error message does not restore consistency.

### Required Correction

A native transaction cannot directly cover both SQLite and filesystem operations.

The platform therefore needs a recoverable operation protocol.

### Recommended Operation-Journal Protocol

1. Create a durable operation record.
2. Record:
   - operation ID;
   - operation type;
   - symbols;
   - exchanges;
   - date range;
   - expected row counts;
   - checksums;
   - original generations;
   - target generations.
3. Stage replacement binary files in an operation-specific temporary directory.
4. Validate staged binary files completely.
5. Begin SQLite transaction.
6. Apply SQLite changes.
7. Commit SQLite changes only when staging is ready.
8. Atomically replace binary targets.
9. Run parity validation.
10. Mark the operation committed.
11. Retain prior binary generation until final success.
12. On startup, detect unfinished operations and:
    - complete them;
    - roll them back;
    - present a recovery decision.

### Reporting Requirement

Inserted, updated, or deleted counts should only be presented as successfully completed after the selected cross-storage durability contract is satisfied.

### Required Fault-Injection Tests

Inject failure:

- before staging;
- during staging;
- before SQLite commit;
- immediately after SQLite commit;
- before first binary replace;
- during binary replacement;
- after some symbols succeed;
- before parity validation;
- after parity validation but before journal completion.

---

## H-07 — Existing Binary `.eod` Files Are Modified In Place

**Severity:** High  
**Category:** Crash consistency and file corruption

### Positive Existing Control

New full-file writes use a temporary file at:

`src-tauri-shell/src/database/binary_eod.rs:330-376`

This is a useful foundation.

### Unsafe Existing-File Rewrite

Existing-file tail rewrites open the actual target for reading and writing at:

`src-tauri-shell/src/database/binary_eod.rs:558-630`

The file is overwritten or truncated in place.

Single-record insertion expands the file and shifts existing bytes inside the same target at:

`src-tauri-shell/src/database/binary_eod.rs:689-727`

### Why `flush` and `sync_data` Are Not Enough

`flush` and `sync_data` improve durability after successful operations.

They do not make a multi-step in-place rewrite atomic.

A crash can occur after:

- file extension;
- partial byte shifting;
- partial record write;
- header update;
- truncation;
- payload update.

### Impact

A binary file may be left with:

- incorrect record count;
- header and payload mismatch;
- duplicated records;
- missing records;
- misaligned records;
- partially shifted data;
- incorrect date ordering;
- valid-looking but incorrect values.

The file may remain readable while containing logically corrupted data.

### Required Correction

Use copy-on-write replacement for every operation that:

- changes existing records;
- inserts records;
- deletes records;
- changes file length;
- rewrites a tail;
- changes record ordering.

### Recommended Protocol

1. Create a uniquely named temporary replacement file.
2. Write the complete intended final dataset.
3. Validate:
   - magic/header;
   - format version;
   - record size;
   - record count;
   - date ordering;
   - duplicate dates;
   - price scale;
   - checksum.
4. Flush and `sync_all` the temporary file.
5. Atomically replace the target.
6. Sync the parent directory where supported.
7. Retain the previous file generation until verification completes.
8. Record replacement in the operation journal.

### Required Tests

Inject interruption:

- before first write;
- mid-record;
- after payload;
- before header;
- after header;
- before rename;
- after rename;
- before directory sync;
- during backup cleanup.

---

# 5. Medium-Severity Findings

## M-01 — Network URL and Payload Controls Are Incomplete

### Evidence

`BhavcopySettings` and `BatchDownloadConfig` expose four URL overrides at:

`src-tauri-shell/src/bhavcopy.rs:74-110`

`normalize_settings` at:

`src-tauri-shell/src/bhavcopy.rs:1044-1065`

only trims values and rejects empty strings.

The HTTP client at:

`src-tauri-shell/src/bhavcopy.rs:1413-1432`

does not define sufficient explicit:

- connection timeout;
- read timeout;
- total timeout;
- redirect policy.

`fetch_candidate_bytes` at:

`src-tauri-shell/src/bhavcopy.rs:2178-2194`

reads the full response into memory.

ZIP extraction at:

`src-tauri-shell/src/bhavcopy.rs:2229-2244`

reads an entry fully without sufficient limits for:

- uncompressed size;
- compression ratio;
- number of entries;
- total extracted bytes.

The official watchlist fetch validates the initial hostname at:

`src-tauri-shell/src/main.rs:360-379`

but lacks sufficient explicit:

- HTTPS enforcement;
- response-size limits;
- timeout;
- redirect-destination revalidation.

The response is converted to text at:

`src-tauri-shell/src/main.rs:394-412`

### Risks

- Server-side request forgery through override URLs;
- requests to loopback or private-network services;
- redirects to unapproved destinations;
- memory exhaustion;
- oversized downloads;
- ZIP bombs;
- long-hanging requests;
- application freeze or resource depletion.

### Required Correction

- Require HTTPS for official endpoints.
- Restrict hosts to an allowlist where overrides are unnecessary.
- Where custom endpoints are required, reject:
  - loopback;
  - private IP ranges;
  - link-local addresses;
  - file URLs;
  - device URLs;
  - unsupported schemes.
- Disable redirects or revalidate every redirect destination.
- Add:
  - connection timeout;
  - read timeout;
  - total timeout;
  - cancellation.
- Stream responses with hard byte limits.
- Validate content type.
- Cap:
  - ZIP entry count;
  - individual uncompressed entry size;
  - total uncompressed size;
  - compression ratio.

---

## M-02 — External URI Opening Is Unrestricted and CSP Is Disabled

### Evidence

File:

`src-tauri-shell/src/main.rs:245-249`

passes a renderer-supplied string to:

`open::that`

The renderer-facing platform function is exposed at:

`src/platform/shell.ts:39-41`

Tauri configuration at:

`src-tauri-shell/tauri.conf.json:26-28`

sets:

```json
"csp": null
```

### Positive Observation

No active use was found in the renderer for common direct injection primitives such as:

- `dangerouslySetInnerHTML`;
- direct `innerHTML` assignment;
- `eval`;
- `new Function`;
- `document.write`.

This lowers current exploitability but does not make unrestricted URI opening safe.

### Risks

A renderer compromise or unsafe link source could attempt to open:

- local files;
- executable paths;
- shell-related schemes;
- custom protocols;
- device paths;
- other dangerous URI handlers.

### Required Correction

Allow only explicitly required schemes, normally:

- `https`;
- possibly `mailto`.

Reject:

- `file`;
- executable paths;
- shell schemes;
- script schemes;
- device paths;
- unapproved custom protocols.

Deploy a restrictive production Content Security Policy.

Review Tauri capability and permission scopes so that each window receives only the commands it requires.

---

## M-03 — Application Profile Writes Are Not Crash-Safe

### Evidence

Direct file writes occur at:

- `src-tauri-shell/src/app_profile.rs:244-263`
- `src-tauri-shell/src/app_profile.rs:291-308`

Profile parsing at:

`src-tauri-shell/src/app_profile.rs:281-288`

uses:

`unwrap_or_default()`

### Failure Scenario

1. Application begins writing profile JSON.
2. Process crashes or disk becomes full.
3. JSON file becomes truncated.
4. Application restarts.
5. JSON parsing fails.
6. Failure silently becomes default settings.
7. A later save overwrites the damaged file and may remove the last recovery opportunity.

### Impact

Potential loss of:

- alert rules;
- alert history;
- scanner workspace;
- user settings;
- saved configuration;
- application state.

### Required Correction

- Write to a uniquely named temporary file.
- Flush and sync.
- Atomically replace the target.
- Keep a last-known-good backup.
- Add schema and version fields.
- Report parse failure explicitly.
- Provide recovery options.
- Do not silently replace malformed persisted state with defaults.

---

## M-04 — Automated Validation Governance Is Incomplete

### Existing Positive Controls

`package.json:5-18` includes scripts for:

- type checking;
- building;
- testing;
- Tauri checking.

`scripts/validate-change.ps1:39-75` provides useful focused local validation profiles.

### Missing Controls

The source archive contains no clear evidence of:

- GitHub Actions or equivalent CI workflow;
- ESLint configuration;
- mandatory Clippy policy;
- pinned Rust toolchain;
- pinned Node version;
- automated dependency-update configuration;
- automated dependency vulnerability audit;
- software bill of materials generation.

### Required Correction

Create a Windows CI pipeline that runs:

1. lockfile-based dependency installation;
2. TypeScript type checking;
3. Vitest;
4. renderer production build;
5. `cargo fmt --check`;
6. `cargo clippy -- -D warnings`;
7. Rust tests;
8. Rust check;
9. architecture-reference validation;
10. build-metadata validation;
11. dependency audit;
12. SBOM generation;
13. packaging smoke test.

Pin:

- Node version;
- package-manager version;
- Rust version;
- Tauri CLI version where appropriate.

### Dependency Observation

A source-import scan found no active imports for:

- `adm-zip`;
- `axios`;
- `csv-parse`;
- `unzip-stream`.

This should be verified before removal.

Confirmed unused runtime dependencies should be removed.

Type-only packages should be moved to development dependencies where appropriate.

---

## M-05 — Oversized Modules Increase Regression Risk

The architecture documentation itself identifies major hotspots at:

`ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md:400-406`

Several modules mix:

- user interface;
- parsing;
- networking;
- concurrency;
- storage;
- durable mutation;
- business logic;
- validation.

### Risks

- changes become difficult to review;
- unrelated behavior is coupled;
- regression scope becomes unclear;
- tests require large setup;
- ownership becomes ambiguous;
- security boundaries become harder to verify;
- performance problems become harder to isolate.

### Required Refactoring Priorities

#### Imports

Separate:

- parsing;
- validation;
- orchestration;
- storage;
- reporting.

#### Networking

Separate:

- endpoint configuration;
- request execution;
- response validation;
- archive decoding;
- persistence.

#### Binary EOD

Separate:

- binary codec;
- file validation;
- mutation planning;
- atomic replacement;
- journaling;
- startup recovery.

#### Database Tools UI

Decompose the large database-tools dialog into feature-specific windows, controllers, and state modules.

#### Indicators

Separate:

- indicator registry;
- calculation;
- source dependency resolution;
- caching;
- higher-timeframe aggregation;
- rendering.

#### Corporate Actions

Separate:

- source parsing;
- canonicalization;
- validation;
- human review;
- application;
- audit trail;
- repair workflow.

Refactoring should follow stable domain boundaries rather than arbitrary file-size targets.

---

# 6. Analytical Areas Reviewed Without a Confirmed Defect

## Chart-Pattern Scanner Causality

`findLocalPivots` uses bars on both sides to confirm a historical pivot at:

`src/plugins/scanner/chartPatternPrimitives.ts:68-86`

Using later bars to confirm a historical pivot is acceptable only when the signal is not emitted before those confirmation bars exist.

The reviewed detector path uses the latest completed endpoint and requires a completed breakout.

For example, double-bottom detection requires:

```text
setup.latest.close > neckline
```

before creating a result at:

`src/plugins/scanner/chartPatternScanners.ts:446-474`

### Audit Conclusion

No evidence was found that the principal chart-pattern scanner:

- backdates a result to the original pivot date;
- emits a result before confirmation bars exist;
- emits a breakout before the completed breakout bar.

The reviewed scanner model appears causal.

This contract should be preserved through prefix-invariance tests.

---

## Database-Change Cache Invalidation

The chart runtime clears the instrument-data cache on the backend:

`database:changed`

event and rehydrates chart tabs at:

`src/features/workspace/chartRuntimeController.ts:283-300`

This is a positive control.

It does not resolve the separate stale indicator-result cache described in H-03.

---

## Renderer Injection Surface

Static inspection found no active use of common direct DOM or code-injection primitives.

No raw `@tauri-apps` imports were found outside the intended:

`src/platform/*`

boundary.

This is a positive architectural control.

---

## SQL Construction

Reviewed data paths generally use parameterized SQL.

Dynamic SQL observed in quote deletion used generated placeholders with bound values.

No confirmed SQL-injection defect was established in this audit pass.

---

## Secrets

No obvious embedded production credential was found through manual and pattern-based inspection of active source.

This is not equivalent to:

- a full entropy-based secret scan;
- scanning Git history;
- scanning deleted commits;
- scanning external deployment configuration.

The archive did not include `.git` history.

---

# 7. Documented Operational Blockers

The repository handoff states that:

**261 confirmed-defective approved corporate actions remain unrepaired.**

Evidence:

`HANDOFF.md:173-175`

The handoff states that repair requires:

- separate design review;
- human-gated approval;
- per-row review.

The same handoff documents pending manual rebuilt-application checks at:

`HANDOFF.md:159-162`

including:

- restart behavior;
- scanner UI density;
- scanner autosave timing;
- Pattern Map QA.

The architecture documentation correctly warns that source and typecheck success do not prove:

- visual correctness;
- packaging correctness;
- network availability;
- live database repair;
- runtime behavior.

Evidence:

`ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md:408-417`

### Operational Conclusion

Until the 261 corporate-action records are reviewed and repaired with an immutable audit trail, adjusted-history outputs should be clearly labelled as containing known unresolved corporate-action defects.

The platform should not silently present those adjusted histories as fully validated.

---

# 8. Prioritized Remediation Plan

## Stage P0 — Immediate Containment Before Further Distribution

1. Disable or backend-block `delete_database` until C-01 is fixed and tested.
2. Enforce canonical path containment for:
   - database manifests;
   - symbols;
   - exchanges;
   - import destinations;
   - export destinations;
   - binary files.
3. Reject negative `barsBack` in causal formula functions.
4. Add formula prefix-invariance tests.
5. Disable higher-timeframe indicator selection until production calculation is correctly implemented.
6. Add strict shared EOD-row validation before any SQLite or binary mutation.
7. Add automatic backups before bulk imports, bulk deletions, or corporate-action repairs.
8. Add SQLite/binary parity verification around valuable data operations.

---

## Stage P1 — Analytical Correctness and Durable-Storage Redesign

1. Replace indicator cache signatures with:
   - data-generation signatures;
   - recursive dependency signatures.
2. Implement a recoverable SQLite/binary operation journal.
3. Convert all existing-file binary mutations to copy-on-write atomic replacement.
4. Add startup recovery for interrupted data operations.
5. Add database constraints through a controlled validation and migration process.
6. Build a golden-dataset suite covering:
   - imports;
   - corrections;
   - corporate actions;
   - indicators;
   - scanner causality;
   - SQLite/binary parity.
7. Implement causal higher-timeframe calculations.
8. Add cross-consumer parity tests so chart, scanner, and alert systems use the same corrected indicator values.

---

## Stage P2 — Desktop and Network Hardening

1. Restrict external URI schemes.
2. Configure a production Content Security Policy.
3. Restrict network override hosts and schemes.
4. Add redirect revalidation.
5. Add network timeouts.
6. Add hard response-size limits.
7. Add ZIP extraction limits.
8. Make profile and settings writes atomic and recoverable.
9. Review Tauri command capabilities per window.
10. Add structured audit logging for:
    - destructive operations;
    - imports;
    - deletes;
    - corporate-action application;
    - database migration;
    - repair operations.

---

## Stage P3 — Engineering Governance and Maintainability

1. Add pinned-toolchain Windows CI.
2. Add mandatory build and test checks.
3. Add ESLint.
4. Add Clippy with warnings treated as errors.
5. Add dependency vulnerability auditing.
6. Add SBOM generation.
7. Remove confirmed unused dependencies.
8. Decompose the largest mixed-responsibility modules.
9. Define release gates distinguishing:
   - source checks;
   - automated unit tests;
   - integration tests;
   - fault-injection tests;
   - rebuilt-app QA;
   - live-database validation;
   - packaging validation;
   - network validation.

---

# 9. Required Regression Suite

## Causal-Analysis Tests

- Formula prefix invariance for every formula function.
- Rejection of negative analytical offsets.
- Higher-timeframe values only after period completion.
- Scanner result date equals the date when confirmation or breakout became available.
- No historical output changes when future bars are appended, except explicitly documented developing visuals.
- Indicator-on-indicator causality.
- Alert causality.
- Scanner causality.
- Backtest causality.

---

## Cache Tests

- Historical OHLC correction with unchanged bar count.
- Historical OHLC correction with unchanged last timestamp.
- Database switch with the same symbol and date range.
- Corporate-action adjustment revision.
- Source-indicator setting change.
- Source-indicator period change.
- Chart-type change.
- Timeframe change.
- Adjustment-mode change.
- Hidden-to-visible indicator transition.
- Chart, scanner, and alert parity.

---

## Storage Tests

- Interruption before SQLite commit.
- Interruption immediately after SQLite commit.
- Interruption during staged binary write.
- Interruption during atomic replace.
- Disk-full condition.
- Permission failure.
- Corrupt operation journal.
- Missing operation journal component.
- Startup recovery.
- Binary header/payload mismatch.
- Binary checksum mismatch.
- Parity after:
  - insert;
  - overwrite;
  - delete;
  - corporate-action adjustment;
  - migration.
- Arbitrary-path rejection.
- Parent traversal rejection.
- Symlink and junction rejection.

---

## Import Tests

- Invalid calendar dates.
- Leap-year validation.
- `NaN`.
- Positive infinity.
- Negative infinity.
- Numeric overflow.
- Negative volume.
- Negative open interest.
- Impossible OHLC relationships.
- Duplicate handling modes.
- Partial file failures.
- Quoted fields.
- Locale-specific separators.
- Large files.
- Cancellation.
- Resume.
- Mixed valid and invalid rows.
- Invalid row quarantine.

---

## Desktop and Network Tests

- Disallowed external URI schemes.
- Production CSP smoke test.
- Redirect to private or unapproved host.
- Redirect from HTTPS to unsafe scheme.
- Oversized response.
- ZIP bomb.
- Excessive ZIP entry count.
- Connection timeout.
- Read timeout.
- Cancellation.
- Malformed profile recovery.
- Partial profile write.
- Last-known-good profile restoration.

---

# 10. Validation Performed and Limitations

| Check | Result | Notes |
|---|---|---|
| Repository and architecture inventory | Completed | Active `src/` and `src-tauri-shell/src/` mapped |
| Static path and data-flow review | Completed | Focused on Tauri commands, imports, SQLite, binary EOD, formulas, indicators, network, and profiles |
| Raw Tauri import boundary scan | Passed | No imports outside `src/platform/*` found |
| Common renderer injection primitive scan | Passed with scope caveat | No common direct injection primitives found in active source |
| Obvious hardcoded credential review | No confirmed finding | No Git history or full entropy scanner available |
| Frontend dependency installation | Incomplete | Configured registry returned a package 404; public-registry retry did not complete within the execution window |
| TypeScript typecheck | Not executed | Dependencies were not installed |
| Vitest | Not executed | Dependencies were not installed |
| Vite build | Not executed | Dependencies were not installed |
| Rust check | Not executed | Rust/Cargo toolchain unavailable |
| Rust tests | Not executed | Rust/Cargo toolchain unavailable |
| Clippy | Not executed | Rust/Cargo toolchain unavailable |
| Windows/Tauri rebuilt-app QA | Not executed | Requires intended Windows build and runtime environment |
| Live-database validation | Not executed | No safely disposable production-equivalent database established |
| Corporate-action repair validation | Not executed | Human-gated repair workflow remains pending |
| Dependency vulnerability audit | Not completed | Audit must not be interpreted as a clean dependency-CVE result |

### Interpretation of Limitations

The static defects documented in this report are based on direct source behavior.

They do not depend on successful compilation to be valid.

However, runtime validation remains necessary to:

- identify additional defects;
- verify corrections;
- test platform behavior under failure;
- validate packaging;
- validate rebuilt Windows/Tauri behavior;
- validate real database migration and recovery.

---

# 11. Final Audit Decision

## Acceptable at Present

- continued source development;
- controlled evaluation using disposable databases;
- chart and scanner UX evaluation where outputs are treated as provisional;
- focused refactoring protected by tests;
- development of recovery and validation infrastructure.

## Not Acceptable at Present

- claiming complete no-look-ahead correctness;
- treating higher-timeframe indicator labels as implemented;
- relying on cached indicators after data corrections without forced recalculation;
- unattended bulk mutation of valuable EOD history without backup and parity checks;
- exposing unrestricted database deletion in a distributed build;
- treating adjusted history as fully validated while the known corporate-action backlog remains unresolved;
- relying on SQLite and binary storage as guaranteed identical after partial failures;
- using current binary mutation code as crash-safe durable storage.

---

# Final Disposition

**Audit disposition: Conditional rejection for trusted release.**

The platform has a strong enough foundation to justify continued development, but trusted production release should wait until:

1. all P0 issues are corrected;
2. all P1 storage and analytical correctness issues are corrected;
3. causal-prefix tests pass;
4. fault-injection storage tests pass;
5. SQLite/binary parity tests pass;
6. full frontend and Rust validation succeeds;
7. the Windows/Tauri application is rebuilt and manually verified;
8. the known defective corporate-action backlog is repaired or explicitly quarantined;
9. destructive filesystem commands are independently security-reviewed.

The most urgent correction is the unrestricted recursive directory deletion command.

The most urgent analytical corrections are:

- future-bar formula access;
- stale indicator caching;
- misleading higher-timeframe indicator settings.

The most urgent data-integrity corrections are:

- strict OHLCV validation;
- cross-store operation journaling;
- atomic copy-on-write binary replacement.

Until these issues are resolved, the application should be treated as a capable development-stage charting platform rather than a hardened, fully trusted analytical and financial-data system.