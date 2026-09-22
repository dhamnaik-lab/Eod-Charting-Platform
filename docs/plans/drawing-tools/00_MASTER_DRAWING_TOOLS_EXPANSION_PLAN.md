# Drawing Tools Expansion — Master Plan

**Status:** PRE-IMPLEMENTATION PLAN  
**Prepared:** 2026-08-10 15:18 IST  
**Project root:** `E:\TA Projects\EOD Charting Platform`  
**Baseline:** `Eod Charting Platform Source Code 2026-08-10_150619_IST`  
**Baseline SHA-256:** `2ecf281e2f3af5af807e5f6cd2843febcc71326a7ddb0360d16e3e8fc31c77d3`

## 1. Objective

Expand the EOD Charting Platform drawing toolbox using the uploaded drawing repository as a **reference implementation**, while preserving the current custom chart engine and all existing working drawing behavior.

## 2. Confirmed current architecture

The current platform has a native drawing model in:

- `src/engine/types.ts`
- `src/engine/ChartEngine.ts`
- `src/engine/Renderer.ts`
- `src/components/ChartToolDock.tsx`
- `src/components/ChartCanvas.tsx`
- `src/components/ChartDrawingPropertiesDialog.tsx`
- `src/components/ChartDrawingContextMenu.tsx`
- `src/features/alerts/eodAlerts.ts`

The current `ChartDrawing` union contains 13 persisted drawing kinds:

1. Horizontal Line
2. Vertical Line
3. Text
4. Trend Line
5. Ray
6. Arrow
7. Rectangle
8. Parallel Channel
9. Fibonacci Retracement
10. Fibonacci Extension
11. Fibonacci Fan
12. Gann Fan
13. Measure

The uploaded reference repository registers **67 implemented drawing tools**. It targets `lightweight-charts` and therefore must not be copied as a replacement runtime.

## 3. Architectural policy

### Must preserve

- Current `ChartDrawing` persistence compatibility.
- Existing saved workspaces.
- Existing drawing selection, drag, resize, lock, delete and context-menu behavior.
- Existing magnet behavior.
- Existing Renko anchor reconciliation.
- Existing indicator panes and price-pane drawing behavior.
- Existing drawing alerts.
- Existing Fibonacci Extension semantics.
- Existing Fibonacci Fan semantics.
- Existing Measure semantics.
- Existing custom canvas renderer.

### Must not do

- Do not install or embed `lightweight-charts` merely to obtain drawing primitives.
- Do not create a second independent drawing manager.
- Do not replace existing drawing types with reference-repository equivalents.
- Do not rename existing persisted `kind` values.
- Do not silently convert the current two-anchor Fibonacci Extension into a three-anchor extension.
- Do not automatically make new line-like drawings eligible for alerts.
- Do not implement all missing tools in a single change.

## 4. Phase order

### Phase D1 — Safe lines and measurements

**Current status:** Implemented; D1.1 runtime-correction validation pending after manual acceptance findings.


Adds seven tools that fit the existing one/two-anchor lifecycle:

- Extended Line
- Horizontal Ray
- Cross Line
- Info Line
- Trend Angle
- Price Range
- Date Range

**Architecture change:** small extension only.  
**Risk:** low-to-moderate.

### Phase D2 — Advanced one/two-anchor geometry

Adds useful tools that still fit one/two-anchor storage but require richer geometry or data-aware rendering:

- Regression Trend
- Fibonacci Time Zone
- Fibonacci Speed Fan as a separate/enhanced capability if justified
- Fibonacci Circles
- Fibonacci Arcs
- Gann Box
- Circle
- Ellipse
- Forecast
- Arrow Marker
- Arrow Up
- Arrow Down

**Architecture change:** moderate renderer/hit-test expansion.  
**Risk:** moderate.

### Phase D3 — Generalized multi-anchor infrastructure

First create a safe generalized 3/4-anchor model, then add:

- Flat Top/Bottom Channel
- Disjoint Channel
- Andrews' Pitchfork
- Schiff Pitchfork
- Modified Schiff Pitchfork
- Inside Pitchfork
- Trend-Based Fibonacci Extension
- Fibonacci Channel
- Trend-Based Fib Time
- Fibonacci Wedge
- Pitchfan
- Long Position
- Short Position
- Projection
- Triangle
- Rotated Rectangle
- Arc

**Architecture change:** significant but bounded.  
**Risk:** moderate-to-high.

### Phase D4 — Freeform and annotation tools

Adds variable-point drawings and richer annotations:

- Fibonacci Spiral
- Gann Square Fixed
- Gann Square
- Path
- Polyline
- Curve
- Double Curve
- Brush
- Highlighter
- Callout
- Anchored Text
- Note
- Price Note
- Price Label
- Flag Mark
- Pin
- Comment
- Signpost

**Architecture change:** generalized point collections, richer metadata and editors.  
**Risk:** high if mixed with D3; therefore separate.

### Phase D5 — Specialized/data-heavy tools

Adds only after D1-D4 are stable:

- Bars Pattern
- Table

Also acts as the decision gate for any future specialized reference tools not actually implemented in the uploaded source.

**Risk:** high / specialized.

## 5. Phase-gating rule

A phase may begin only when the previous phase has:

1. source implementation complete;
2. focused unit tests passing;
3. renderer TypeScript typecheck passing;
4. production renderer build passing;
5. relevant Tauri/Rust validation passing when touched;
6. portable Windows package built when the phase materially changes runtime drawing behavior;
7. manual chart acceptance completed;
8. timestamped IST change report created under `docs\changes\`.

## 6. Documentation rule for each implementation phase

Every implementation phase must create:

`docs\changes\YYYY-MM-DD_HHMM_IST_DRAWING_TOOLS_PHASE_Dx_<TOPIC>.md`

The report must record:

- IST timestamp
- objective
- baseline/snapshot identity
- previous limitation
- files inspected
- files modified/created
- exact implementation
- behavior deliberately preserved
- validation commands
- actual validation output/results
- manual acceptance
- risks/limitations
- rollback guidance

## 7. Licensing/source policy

The uploaded repository declares MIT in package metadata but the provided ZIP does not contain a root `LICENSE` file.

Therefore:

- use formulas, geometry and behavior as reference;
- prefer native reimplementation in the EOD drawing architecture;
- before copying substantial source verbatim, verify licensing/attribution requirements.

## 8. Completion definition

The drawing expansion is complete only when all accepted phases are individually validated and existing saved drawings remain backward compatible. Tool count alone is not a completion criterion.
