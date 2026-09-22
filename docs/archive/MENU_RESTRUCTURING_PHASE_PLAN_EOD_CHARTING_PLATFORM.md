# Menu Restructuring Phase Plan

Date: 2026-06-10
Project: EOD Charting Platform
Scope: Native menu restructuring plan only. No runtime behavior changes are implemented by this document.

## Goal

Restructure the native Tauri menu so that:

- menu ownership is clearer
- chart-local actions are easier to find
- global settings are separated from chart actions
- database lifecycle is separated from database maintenance tools
- the menu stays aligned with the current app architecture instead of copying another platform blindly

## Inputs Used

Repo files reviewed:

- `src-tauri-shell/src/main.rs`
- `src/features/app/menuCommandRouter.ts`
- `src/components/SettingsDialog.tsx`
- `src/components/Toolbar.tsx`
- `src/store/chartStore.ts`

External references reviewed:

- AmiBroker View menu
- AmiBroker Window menu
- AmiBroker Preferences
- AmiBroker sheets/layout model
- TradingView toolbar model
- thinkorswim chart/style settings model
- Sierra Chart chart settings vs global settings model

Local installed reference checked on this PC:

- `C:\Program Files\AmiBroker\Broker.exe`
- Installed version found: AmiBroker 6.20.1 x64

## Design Position

Do not copy AmiBroker literally.

Reason:

- AmiBroker has a heavier MDI and dock-window model than the current EOD Chart app.
- TradingView and thinkorswim are stronger references for high-frequency chart controls.
- Sierra Chart is the strongest reference for separating per-chart actions from application/global settings.

Result:

- keep `View`, not a new top-level `Window`, for now
- add a real top-level `Settings`
- split drawing actions out of `Chart`

## Current Menu Reality

Current top-level native menu:

- `File`
- `Database`
- `Watchlist`
- `Chart`
- `View`
- `Help`

Current issues:

1. `Settings` is under `File`, but it now owns app-profile settings and database defaults.
2. `Database` mixes lifecycle and data-maintenance tools.
3. `Chart` is overloaded with:
   - timeframe
   - price mode
   - event toggles
   - compare
   - magnet
   - drawing tools
   - indicators
4. Native menu exposes only `D/W/M`, while the store already supports `Q/Y`.
5. Layout mode support exists in the store/router but is not surfaced in the native menu.
6. Chart type exists in the toolbar/store but is not surfaced in the native menu.

## Target Menu Structure

### 1. File

- `Import CSV / TXT`
- `Download Bhavcopy`
- separator
- `Exit`

### 2. Database

- `New Database`
- `Open Database`
- `Recent Databases`
- `Save Active Database`
- `Close Database`
- `Delete Database`
- separator
- `Data Tools >`
  - `Quote Editor`
  - `Merge Symbols`
  - `Corporate Actions / Identity`
  - `Binary EOD Parity Audit`

### 3. Watchlist

- `Manage Watchlists`
- `Import Watchlist Groups`

### 4. Chart

- `New Chart`
- `Chart Layouts`
- separator
- `Timeframe > D / W / M / Q / Y`
- `Chart Type > Candles / Line / Area / Bar / Baseline / HLC Area / Heikin Ashi / Renko`
- `Price Mode > Raw / Adjusted`
- `Adjustments > Dividend Adjustments / Rights Adjustments`
- `Compare...`
- separator
- `Indicators >`
- `Clear Indicators`

### 5. Draw

- drawing tool selections
- separator
- `Properties`
- `Lock / Unlock Drawing`
- `Delete Selected Drawing`
- `Undo Last Drawing`
- `Clear Drawings`

### 6. View

- `Sidebar`
- `OHLCV Bar`
- `Status Bar`
- separator
- `Layout Mode > Single / Tile / Tile Horizontal / Tile Vertical / Tile Grid`
- `Fullscreen`

### 7. Settings

- `Application Settings...`
- separator
- later optional direct shortcuts:
  - `Theme >`
  - `Default Exchange > NSE / BSE`
  - `Database Default Price Mode > Raw / Adjusted`
  - `Application Profile Folder...`

### 8. Help

- `FAQ`
- `Keyboard Shortcuts`
- `About EOD Chart`

## Ownership Rules

These rules should guide every menu decision in this repo.

### File

Use only for import/export, launch-level app actions, and exit.

### Database

Use for:

- database lifecycle
- data repair or data maintenance tools
- symbol or corporate-action mutation tools

Do not put chart display settings here.

### Chart

Use only for active-chart behavior:

- timeframe
- chart type
- price mode
- adjustment inclusion
- compare
- indicators

### Draw

Use only for drawing tool selection and drawing operations.

### View

Use for visibility and workspace arrangement only.

### Settings

Use for saved preferences and defaults:

- app-profile settings
- theme
- default exchange
- database default price mode
- profile path

### Help

Use for documentation, shortcuts, and about/version information.

## Phase Plan

## Phase 1 - Menu Taxonomy Cleanup

Status: Implemented on 2026-06-10

Follow-up on 2026-06-10:

- nested submenu checked-state sync needed recursive item lookup on the Tauri shell side because top-level `Menu::get(id)` is not sufficient for submenu children

### Goal

Fix the menu structure without changing core product behavior.

### Changes

- move `Settings` out of `File` into top-level `Settings`
- split `Draw` out of `Chart`
- move database tools under `Database > Data Tools`
- add `Q` and `Y` to the native `Timeframe` submenu
- add `View > Layout Mode`
- keep all existing actions and dialogs

### Files

- `src-tauri-shell/src/main.rs`
- `src/features/app/menuCommandRouter.ts`

### Validation

- `npm run typecheck:renderer`
- `npm run tauri:check`

### Acceptance

- top-level menu becomes:
  - `File / Database / Watchlist / Chart / Draw / View / Settings / Help`
- native `Timeframe` now exposes `D / W / M / Q / Y`
- native `View` now exposes `Layout Mode`
- all existing menu commands still open the same dialogs and actions

### Risk

- low
- mostly label and structure churn

## Phase 2 - Surface Existing Missing Chart Controls

Status: Implemented on 2026-06-10

### Goal

Expose already-supported chart/session actions that are missing from the native menu.

### Changes

- add `Chart Type` submenu
- add `Chart > Adjustments > Include Dividend / Include Rights`

### Files

- `src-tauri-shell/src/main.rs`
- `src/features/app/menuCommandRouter.ts`
- `src/store/chartStore.ts`
- possibly `src/store/chartStoreTypes.ts`

### Validation

- `npm run typecheck:renderer`
- `npm run test`
- `npm run tauri:check`

### Acceptance

- native menu can drive the same chart modes already available in toolbar/store
- no direct renderer-to-Tauri bypass is introduced
- native `Chart > Adjustments` toggles reuse the existing adjusted-mode rehydration path instead of adding a second adjustment pipeline

### Risk

- medium
- new command wiring must stay aligned with store capabilities
- native checked state for dividend/right inclusion is not yet synchronized when those same toggles are changed from the chart settings popover

## Phase 3 - Settings Entry-Point Refinement

Status: Implemented on 2026-06-10

### Goal

Make saved preferences discoverable without pushing dense controls directly into the native menu.

### Changes

- keep the full settings form inside `SettingsDialog`
- add section-focused entry points from the native `Settings` menu for:
  - `General Preferences...`
  - `Application Profile Folder...`
  - `Active Database Defaults...`
  - `Chart Colors...`
- add `Keyboard Shortcuts` under `Help`

### Files

- `src-tauri-shell/src/main.rs`
- `src/features/app/menuCommandRouter.ts`
- `src/components/SettingsDialog.tsx`
- `src/store/uiStore.ts`

### Validation

- `npm run typecheck:renderer`
- `npm run test`
- `npm run tauri:check`

### Acceptance

- menu improves discoverability
- detailed setting edits still happen inside the dialog
- `Help > Keyboard Shortcuts` documents only shortcuts the app already supports

### Risk

- low to medium
- only if section-focused opening adds extra state handling

## Phase 4 - Native Menu State Sync

Status: Implemented on 2026-06-10

### Goal

Make check/radio menu state reflect current application state.

### Changes

- sync native menu checked state for:
  - price mode
  - event visibility
  - timeframe
  - chart type
  - layout mode
  - view toggles
  - magnet
  - post-dispatch resync for no-op clicks on already-selected native check items

### Files

- `src-tauri-shell/src/main.rs`
- shell/menu state bridge code
- `src/platform/shell.ts`
- `src/platform/types.ts`
- `src/features/app/menuCommandRouter.ts`
- `src/features/workspace/chartRuntimeController.ts`
- `src/store/chartStore.ts`

### Validation

- `npm run typecheck:renderer`
- `npm run test`
- `npm run tauri:check`
- manual runtime verification

### Acceptance

- native menu accurately reflects current state after user interaction
- no stale checked items after switching chart/session state
- no stale unchecked item after clicking the already-selected native timeframe / chart type / price mode item

### Risk

- highest of all phases
- current menu bridge is mostly shell-to-renderer, so this phase needs renderer-to-shell state feedback

## Phase 5 - Optional Future Window Menu

### Goal

Reassess whether a top-level `Window` menu is needed after the app grows further.

### Current Decision

Do not implement this now.

### Trigger Condition

Only revisit if the app later gains more independent dockable windows, pane inspectors, editors, or MDI-like workspace management that no longer fits cleanly inside `View`.

## Recommended Execution Order

1. Phase 1
2. Phase 2
3. Phase 3
4. Phase 4
5. Re-evaluate Phase 5 only if needed

## Recommended First Implementation Slice

Start with Phase 1 only.

Why:

- highest clarity gain
- lowest regression risk
- no product-behavior redesign
- creates a clean base for later chart-type and settings work

## Explicit Non-Goals

This plan does not propose:

- removing toolbar controls
- replacing chart-local quick controls with menus
- copying AmiBroker's `Window` model directly
- putting dense color pickers inside the native menu
- redesigning the Tauri renderer/platform seam

## Definition of Done for the Full Menu Program

The menu program is complete when:

- menu ownership is clear and stable
- chart/session actions are grouped under `Chart` and `Draw`
- saved defaults/preferences are under `Settings`
- database lifecycle and maintenance are clearly separated
- native menu state reflects current app state where appropriate
- toolbar controls and menu controls complement each other without duplication drift
