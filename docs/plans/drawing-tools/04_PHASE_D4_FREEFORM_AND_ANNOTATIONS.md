# Phase D4 — Freeform and Annotation Tools

**Status:** PLANNED — NOT IMPLEMENTED  
**Prerequisite:** generalized anchor infrastructure from D3 accepted.

## 1. Goal

Add variable-point paths and richer user annotations without overloading the fixed-anchor drawing model.

## 2. Planned tools

### Advanced geometry

- Fibonacci Spiral
- Gann Square Fixed
- Gann Square

### Variable-point geometry

- Path
- Polyline
- Curve
- Double Curve
- Brush
- Highlighter

### Annotations

- Callout
- Anchored Text
- Note
- Price Note
- Price Label
- Flag Mark
- Pin
- Comment
- Signpost

## 3. Variable-point storage

Brush, Highlighter, Path and Polyline should use a point collection rather than pretending they have two anchors.

Each point must define enough information for:

- chart-space persistence;
- zoom/pan;
- timeframe/symbol handling;
- Renko behavior where supported.

Do not store raw canvas pixels as the sole persisted representation.

## 4. Freehand sampling

Brush/highlighter input should be performance-conscious:

- sample/coalesce pointer events;
- avoid one persisted point per raw mouse event if unnecessary;
- simplify paths within a controlled tolerance;
- preserve visual fidelity;
- cap pathological point counts.

## 5. Curve semantics

Define the exact curve representation before coding:

- Bézier control points;
- spline interpolation;
- fixed number of control anchors.

Do not import ambiguous reference behavior without tests.

## 6. Annotation model

Rich annotations may require additional persisted fields:

- text
- font size
- font family
- bold/italic
- text alignment
- background/fill
- border
- icon/marker type
- optional leader line

Prefer shared annotation metadata rather than duplicating fields across every kind.

## 7. Editing experience

D4 must define:

- double-click or Properties editing;
- text commit/cancel;
- resizing;
- marker scaling;
- z-order policy if needed;
- pointer capture for brush.

Existing Text behavior must remain unchanged unless a deliberate compatibility migration is separately approved.

## 8. Performance validation

D4 requires stress tests such as:

- 100+ annotations;
- several large brush paths;
- zoom/pan with many drawings;
- workspace save/reload size;
- screenshot rendering if applicable.

## 9. Non-goals

- no embedded external web content;
- no Tweet/Idea widget;
- no arbitrary image embedding;
- no volume profile drawing;
- no community indicators.

## 10. Exit gate

D5 begins only after freeform drawings do not materially degrade chart interaction and persisted workspaces remain manageable.
