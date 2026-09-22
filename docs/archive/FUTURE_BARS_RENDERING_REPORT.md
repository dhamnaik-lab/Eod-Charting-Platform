# Future Bars Rendering Report

Date: 2026-04-08

## Summary

This pass converts the right-side blank chart margin into rendered future-bar time space for the active EOD chart engine.

The viewport already supported logical future slots through `futureMarginMode`, but the renderer and crosshair still treated the area after the last real bar as empty space. The result was a visually dead gap between the last candle and the right price scale.

## What Changed

- `src/engine/types.ts`
  - added `ChartTimeframe`
  - added `dateLabel` to `CrosshairState`
  - allowed `ChartEngineConfig` to receive the active chart timeframe

- `src/engine/ScaleManager.ts`
  - `niceXTicks(...)` now generates X-axis ticks across the full logical viewport, not only the real-bar range
  - added logical-date synthesis for future slots across `D / W / M / Q / Y`
  - added a guaranteed future tick path so the future-bar region is labeled instead of rendering as a dead hole
  - added `formatCrosshairLogicalDate(...)` so future crosshair positions can display future dates cleanly

- `src/engine/Crosshair.ts`
  - crosshair X positioning now follows logical future slots instead of snapping back to the last real bar
  - future-space hover now renders a bottom-axis date label using synthesized future dates
  - future-space hover no longer forces a fake hover-bar payload into the rest of the UI

- `src/engine/Renderer.ts`
  - `drawXAxis(...)` now renders from the engine-computed tick list so future-bar labels and gridlines stay aligned with the chart viewport

- `src/engine/ChartEngine.ts`
  - now stores the active chart timeframe and passes it into tick/crosshair generation
  - future-bar ticks, future-bar vertical gridlines, and future-date crosshair labels are rendered from the same logical timeline

- `src/components/ChartCanvas.tsx`
  - now forwards the active tab timeframe into `ChartEngine`

## Result

- the right-side future margin is still empty of candles, but it is no longer a dead visual gap
- future space now belongs to the chart timeline:
  - future-date X-axis labels can appear there
  - future vertical gridlines can appear there
  - the crosshair can move into it and display synthesized future dates

This is the EOD/offline equivalent of AmiBroker / TradingView future-bar space, without introducing intraday session logic or broker/trading-terminal behavior.

## Validation

- `npm run typecheck:renderer`
- `npm run build`
