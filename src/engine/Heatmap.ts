import type { HeatmapCell, HeatmapConfig, ScaleX, ScaleY, Viewport } from './types';

export function drawHeatmap(
  ctx: CanvasRenderingContext2D,
  cells: HeatmapCell[],
  viewport: Viewport,
  scaleX: ScaleX,
  scaleY: ScaleY,
  config: HeatmapConfig,
): void {
  const visibleCells = cells.filter(
    (c) => c.barIndex >= viewport.startIndex && c.barIndex <= viewport.endIndex,
  );

  ctx.save();
  if (config.opacity !== undefined) {
    ctx.globalAlpha = config.opacity;
  }

  visibleCells.forEach((cell) => {
    const x = scaleX.toPixel(cell.barIndex) - scaleX.bodyWidth / 2;
    const topY = scaleY.toPixel(cell.priceTop);
    const bottomY = scaleY.toPixel(cell.priceBottom);
    const w = Math.max(scaleX.bodyWidth, 1);
    const h = Math.max(Math.abs(bottomY - topY), 1);

    ctx.fillStyle = intensityToColor(cell.intensity, config);
    ctx.fillRect(x, Math.min(topY, bottomY), w, h);
  });

  ctx.restore();
}

function intensityToColor(intensity: number, config: HeatmapConfig): string {
  const t = Math.max(0, Math.min(1, intensity));
  
  if (config.colorScale === 'warm') {
    // Warm: blue(240°) → red(0°) → yellow(60°)
    let h, s, l;
    if (t < 0.5) {
      const t2 = t * 2; // 0 to 1
      h = 240 * (1 - t2); // 240 to 0
      s = 100;
      l = 50;
    } else {
      const t2 = (t - 0.5) * 2; // 0 to 1
      h = 60 * t2; // 0 to 60
      s = 100;
      l = 50;
    }
    return `hsl(${h}, ${s}%, ${l}%)`;
  } else if (config.colorScale === 'cool') {
    // Cool: green(120°) → cyan(180°) → blue(240°)
    const h = 120 + 120 * t;
    return `hsl(${h}, 100%, 50%)`;
  } else if (config.minColor && config.maxColor) {
    // Custom would need full color interpolation, just fallback for now
    return config.maxColor;
  }
  
  return `rgba(255, 0, 0, ${t})`; // fallback
}
