# Fibonacci Retracement — Read-Only Audit
**vs. Trend-based Fibo Extension (reference baseline)**
_EOD Charting Platform · 2026-08-12_

---

## Scope

| File | Role |
|------|------|
| [`DrawingFibonacciContracts.ts`](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/engine/DrawingFibonacciContracts.ts) | Type contracts for all Fib tools |
| [`DrawingFibonacciDefaults.ts`](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/engine/DrawingFibonacciDefaults.ts) | Default level values |
| [`DrawingFibonacciGeometry.ts`](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/engine/DrawingFibonacciGeometry.ts) | Shared geometry primitives |
| [`DrawingF1BGeometry.ts`](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/engine/DrawingF1BGeometry.ts) | Level geometry builders |
| [`DrawingF1BRuntime.ts`](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/engine/DrawingF1BRuntime.ts) | Level resolution, options, label text |
| [`DrawingStyleSchema.ts`](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/engine/DrawingStyleSchema.ts) | Style slot definitions, presentation resolvers |
| [`Renderer.ts`](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/engine/Renderer.ts) | Actual draw functions |

---

## Architecture Baseline — How `trendFibExtension` Works (Reference: ✅ Perfect)

**Entry point:** [`drawTrendFibExtension`](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/engine/Renderer.ts#L1956-L2015)

**Flow:**
1. Converts 3 anchor points to pixel coords via `toMultiAnchorPixels`.
2. Calls `resolveFibonacciLevels(drawing, fallback)` → gets `RuntimeFibonacciLevel[]` with stable `id` fields.
3. Calls `buildF1BTrendFibExtensionLevels(...)` → returns `FibHorizontalLevelGeometry[]`.
4. Maps price → pixel Y: `scaleY.toPixel(entry.price)`.
5. Draws background bands via `drawF1BHorizontalBands(ctx, drawing, rendered, 'background')`.
6. Loops rendered entries, calls `resolveF1BLevelPresentation(drawing, entry.level)` — which looks up style slot by **stable ID** (`level:{levelId}`) then falls back to **coefficient slot** (`level:{value}`).
7. Draws label with `buildF1BLabelText(entry.level, entry.price, drawing)` — uses `resolveFibonacciOptions(drawing)` for coefficient format and `showPrices`.
8. `ctx.save()`/`ctx.restore()` wraps the entire operation ✅.

**Style schema** ([`DrawingStyleSchema.ts:214-219`](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/engine/DrawingStyleSchema.ts#L214-L219)):
```ts
trendFibExtension: baseSchema(
  'trendFibExtension', 'multi-anchor',
  [trendGuideSlot('Trend Line', 0.4), ...levelSlots(TREND_FIB_EXTENSION_LEVELS)],
  [fill('background', 'Background', { defaultVisible: false, defaultOpacity: 0.08 })],
  { supportsLabelStyle: true },
)
```
Level slot IDs: `level:0`, `level:0.236`, ... keyed by **numeric value** (legacy compatible).

---

## Fibonacci Retracement Analysis — Current State

**Entry point:** [`drawFibRetracement`](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/engine/Renderer.ts#L2884-L2946)

**Flow:**
1. Converts 2 anchor points to pixel — `startX`, `endX`, `startY`, `endY`.
2. Draws the trend guide line between anchor points.
3. Calls `resolveFibonacciLevels(drawing, FIB_RETRACEMENT_LEVELS)` — but `FIB_RETRACEMENT_LEVELS` **is the local 7-value shortlist** (`[0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]`), NOT the full 16-value list from `DrawingFibonacciDefaults.ts`.
4. Calls `buildF1BRetracementLevels(...)` — geometry builder is correct (same F1B family).
5. Maps price → pixel Y correctly.
6. Calls `drawF1BHorizontalBands(ctx, drawing, rendered, 'levels')` — same band logic.
7. Draws each level line and label — same F1B path as trendFibExtension.
8. ⚠️ **No `ctx.save()`/`ctx.restore()`** wrapping the whole function (minor, but trendFibExtension has it).

---

## Identified Issues

### Issue 1 — Level Count Mismatch (Fallback Truncation) ⚠️ HIGH

| | Fib Retracement | Trend Fibo Extension |
|---|---|---|
| **Fallback levels** | Local constant: `[0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]` **(7 values)** | Inline: `[0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.618, 2, 2.618]` **(11 values)** |
| **Default values** (from `DrawingFibonacciDefaults.ts`) | `FIB_RETRACEMENT_DEFAULT_VALUES` = **16 values** (0 → 4.236) | `TREND_FIB_EXTENSION_DEFAULT_VALUES` = **13 values** |

**Root cause:**
- [`Renderer.ts:L221`](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/engine/Renderer.ts#L221): `const FIB_RETRACEMENT_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] as const;`
- This is used as `fallback` in `resolveFibonacciLevels(drawing, FIB_RETRACEMENT_LEVELS)`.
- If `drawing.toolSettings.levels` is absent/null, **only 7 levels are plotted** instead of the full 16 from defaults.
- The style schema at [`DrawingStyleSchema.ts:L92`](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/engine/DrawingStyleSchema.ts#L92) also defines only 7 levels: `const FIB_RETRACEMENT_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]`.
- This means **style slots for levels 1.272, 1.414, 1.618, 2, 2.272, 2.414, 2.618, 3.618, 4.236 do not exist in the schema** → they default to drawing.color with no per-level color differentiation.

**Impact on plotting:**
- New drawings or migrated drawings that rely on fallback get only 7 levels.
- Extension levels (>1.0) from `FIB_RETRACEMENT_DEFAULT_VALUES` are silently dropped.

---

### Issue 2 — Style Schema Level Coverage Mismatch ⚠️ HIGH

**`DrawingStyleSchema.ts:L350-L355` (fib schema):**
```ts
fib: baseSchema(
  'fib', 'two-anchor',
  [trendGuideSlot(), ...levelSlots(FIB_RETRACEMENT_LEVELS)],  // ← 7 levels only
  [fill('levels', 'Background', ...)],
  { supportsLabelStyle: true },
)
```

**`FIB_RETRACEMENT_LEVELS` in StyleSchema = `[0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]`** — 7 slots.

**`FIB_RETRACEMENT_DEFAULT_VALUES` in Defaults = 16 values**.

When `resolveFibonacciLevels` returns the full 16 levels (from persisted `toolSettings`), `getDrawingLinePresentationDefaults` at [`DrawingStyleSchema.ts:L485`](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/engine/DrawingStyleSchema.ts#L485) looks up `slotId` in `getDrawingStyleSchema(drawing.kind).lines`:

```ts
const slotDefinition = getDrawingStyleSchema(drawing.kind).lines.find((slot) => slot.id === slotId);
```

For levels above 1.0 (e.g., `level:retracement-08` which maps to value `1.272`), the **legacy slot** `level:1.272` is not in the schema → `slotDefinition` is `undefined` → **no TradingView color is assigned** — falls back to `drawing.color` for all extended levels. Colors look wrong — all extension levels appear as the same monotone drawing color instead of the TV rainbow palette.

---

### Issue 3 — Label Format Inconsistency ⚠️ MEDIUM

**Fib Retracement** ([`Renderer.ts:L2932`](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/engine/Renderer.ts#L2932)):
```ts
buildF1BLabelText(entry.level, entry.price, drawing)
// → "0.618  18500.00"  (coefficient  price)
```

**Old `drawHorizontalFibLevels`** used by `fibExtension` ([`Renderer.ts:L3070`](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/engine/Renderer.ts#L3070)):
```ts
const labelText = `${level.toFixed(3)} (${formatPrice(...)})`;
// → "0.618 (18500.00)"  (different format with parens)
```

Both are **different label formats** — `drawFibRetracement` uses the correct F1B path, which is good. However, the old `drawHorizontalFibLevels` (used for `fibExtension`) uses a **hardcoded static format** and ignores `coefficientFormat`, `customText`, `showPrices` options — a known regression risk if users expect consistent formatting.

---

### Issue 4 — `ctx.save()`/`ctx.restore()` Missing in `drawFibRetracement` ⚠️ LOW

[`drawTrendFibExtension`](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/engine/Renderer.ts#L1979-L2014) wraps its canvas operations in `ctx.save()` / `ctx.restore()`. `drawFibRetracement` does **not**. This means any canvas state mutations (globalAlpha, lineWidth, lineDash, etc.) from the level drawing could leak into subsequent draw calls. Low probability of visible bug since `strokeDrawingSegmentWithPresentation` does its own save/restore internally, but it is an inconsistency vs the reference implementation.

---

### Issue 5 — `getDrawingStyleSchemaForDrawing` Not Used for `fib` Rendering ⚠️ MEDIUM

[`DrawingStyleSchema.ts:L435-L460`](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/engine/DrawingStyleSchema.ts#L435-L460) — `getDrawingStyleSchemaForDrawing()` is the **instance-aware** schema builder. It reads `getNormalizedFibonacciSettings(drawing)` and, for tools with `levels`, replaces the static level slots with **stable-ID slots** matching the drawing's actual saved levels.

The renderer's `resolveF1BLevelPresentation` at L1904-1916 does try both stable and legacy slots, but `getDrawingLinePresentationDefaults` (called inside it) always uses `getDrawingStyleSchema(drawing.kind)` — the **kind-only static schema** — to look up defaults. So for a `fib` drawing with persisted 16 levels, the 9 extra levels beyond the 7 in the schema have **no schema-side defaults** for color, opacity, or visibility. Their colors fall back to `drawing.color`.

---

## Summary Table

| Issue | Severity | File | Line(s) | Description |
|-------|----------|------|---------|-------------|
| Fallback level count (7 vs 16) | 🔴 High | `Renderer.ts` | L221 | `FIB_RETRACEMENT_LEVELS` fallback is 7-value shortlist; full default has 16 |
| Schema level slot count (7 vs 16) | 🔴 High | `DrawingStyleSchema.ts` | L92, L353 | Schema only registers 7 level slots; colors for extended levels not defined |
| Extended level colors fall to drawing.color | 🔴 High | `DrawingStyleSchema.ts` | L485 | `slotDefinition` is undefined for non-schema levels → no TV rainbow colors |
| `ctx.save/restore` missing | 🟡 Low | `Renderer.ts` | L2884-2946 | Unlike trendFibExtension, no canvas state guard |
| Static schema used instead of instance-aware | 🟠 Medium | `DrawingStyleSchema.ts` | L485 | `getDrawingStyleSchema` (static) used in defaults vs `getDrawingStyleSchemaForDrawing` (instance-aware) |
| `fibExtension` label format diverges | 🟡 Low | `Renderer.ts` | L3070 | Legacy `drawHorizontalFibLevels` uses hardcoded format, ignores user settings |

---

## Key Difference vs Trend Fibo Extension

| Dimension | `trendFibExtension` ✅ | `fib` (Retracement) ⚠️ |
|-----------|----------------------|------------------------|
| Fallback level count | 11 inline values | 7 (truncated local constant) |
| Full default count | 13 | 16 (but fallback only uses 7) |
| Schema slot count | 13 (matches TREND_FIB_EXTENSION_LEVELS from DrawingD3BGeometry) | 7 (mismatches full 16-value defaults) |
| Style resolution | F1B stable→legacy fallback chain | Same chain BUT schema gaps cause color fallback |
| Label builder | `buildF1BLabelText` (respects options) | `buildF1BLabelText` (correct — same) |
| Canvas save/restore | ✅ | ❌ Missing |

---

## Recommended Next Steps (for planning phase)

1. **Fix the schema level list** — `FIB_RETRACEMENT_LEVELS` in `DrawingStyleSchema.ts` should be expanded to cover all 16 default values (or at minimum the 7 that users will actually see, with the schema growing when levels are customized).
2. **Fix the fallback in Renderer.ts** — The local `FIB_RETRACEMENT_LEVELS` constant at L221 (7 values) should match `FIB_RETRACEMENT_DEFAULT_VALUES` from `DrawingFibonacciDefaults.ts` (16 values), or import from Defaults.
3. **Use `getDrawingStyleSchemaForDrawing` for defaults** — or ensure the static schema covers the full level range.
4. **Add `ctx.save()`/`ctx.restore()`** to `drawFibRetracement` to match `trendFibExtension`.

> [!IMPORTANT]
> These are **read-only audit findings**. No files have been modified.
> All fixes require explicit user approval before implementation.
