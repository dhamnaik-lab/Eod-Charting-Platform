# Phase D3 — Generalized Multi-Anchor Infrastructure and Tools

**Status:** PLANNED — NOT IMPLEMENTED  
**Prerequisite:** D1 and D2 accepted.

## 1. Goal

Introduce a maintainable generalized anchor model for 3-anchor and 4-anchor drawings, then add tools that genuinely require it.

## 2. Why D3 must be architectural

The current platform mostly stores:

- one anchor;
- two anchors;
- one special channel represented by two anchors plus `offset`.

That model is insufficient for real:

- pitchforks;
- three-point Fibonacci projections;
- four-point disjoint channels;
- arbitrary multi-point shapes.

Do not add one-off fields such as `point3Price`, `point4Price`, `extraOffset2` independently to every new union member.

## 3. Recommended anchor model

Introduce a typed reusable anchor representation that can carry:

- bar index
- price/value
- pane ID where needed
- Renko anchor identity

A possible direction is a `DrawingAnchor` collection, but migration must preserve existing serialized forms.

### Compatibility strategy

Preferred:

- keep original 13 persisted schemas valid;
- add generalized `anchors` only to new drawing kinds;
- optionally provide adapters/helpers that expose old two-anchor drawings through common geometry functions;
- avoid bulk migration of existing saved data in D3 unless unavoidable.

## 4. Generalized creation state

Implement a reusable pending-anchor state:

- tool definition declares required anchor count;
- each click appends an anchor;
- crosshair supplies preview anchor;
- Esc cancels pending creation;
- Backspace or explicit action may remove last pending anchor only if designed;
- commit occurs only when required anchor count is satisfied.

This must replace tool-specific creation branches **only for new tools first**. Existing tools should not be rewritten unnecessarily.

## 5. Planned D3 tools

### Channels

- Flat Top/Bottom Channel — 3 anchors
- Disjoint Channel — 4 anchors

### Pitchforks

- Andrews' Pitchfork — 3 anchors
- Schiff Pitchfork — 3 anchors
- Modified Schiff Pitchfork — 3 anchors
- Inside Pitchfork — 3 anchors

### Fibonacci

- Trend-Based Fibonacci Extension — 3 anchors
- Fibonacci Channel — 3 anchors
- Trend-Based Fib Time — 3 anchors
- Fibonacci Wedge — 3 anchors
- Pitchfan — 3 anchors

### Forecasting / position

- Long Position — 3 anchors
- Short Position — 3 anchors
- Projection — 3 anchors

### Shapes

- Triangle — 3 anchors
- Rotated Rectangle — 3 anchors
- Arc — 3 anchors

## 6. Existing Fibonacci Extension protection

Current platform `fibExtension` is a two-anchor drawing.

Do not alter its meaning.

The D3 three-anchor implementation must receive a **new persisted kind and UI label**, for example:

- `trendFibExtension`
- UI: `Trend-Based Fib Extension`

This protects existing workspaces and user expectations.

## 7. Long/Short Position semantics

Before implementation define:

- entry anchor;
- target anchor;
- stop anchor;
- risk amount/percentage display;
- reward amount/percentage;
- R multiple;
- whether account size/quantity is intentionally excluded.

Default scope should be geometric risk/reward visualization only.

## 8. Multi-anchor editing

Must support:

- individual anchor selection/drag;
- body drag moving all anchors;
- lock;
- delete;
- properties;
- Renko anchor update;
- undo/redo policy consistent with existing platform.

## 9. Hit testing

Each complex drawing must have geometry-specific hit tests.

Do not use only a bounding rectangle for tools such as pitchforks or wedges, because it will create excessive accidental selection.

## 10. Persistence tests

D3 requires explicit serialized fixtures:

- original 13 drawings;
- D1 drawings;
- D2 drawings;
- every D3 anchor-count class.

Tests must verify save → reload → equality of functional anchor state.

## 11. Risk controls

D3 must be split internally if necessary:

- D3A: generalized anchor infrastructure only
- D3B: channels and simple 3-point shapes
- D3C: pitchfork family
- D3D: advanced Fibonacci family
- D3E: long/short/projection

Do not force all D3 tools into one patch if review size becomes unsafe.

## 12. Exit gate

No D4 work starts until:

- generalized anchor infrastructure is stable;
- old drawings remain backward compatible;
- Renko reconciliation is proven;
- portable Windows manual acceptance passes.
