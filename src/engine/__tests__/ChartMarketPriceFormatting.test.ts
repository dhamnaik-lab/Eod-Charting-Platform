import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

describe('Chart primary market-price two-decimal formatting', () => {
  it('formats the visible OHLC price legend with exactly two decimal places', () => {
    const source = readSource('src/components/ChartPriceLegendOverlay.tsx');
    const start = source.indexOf('function buildPriceSummary(');
    const end = source.indexOf('function buildIndicatorLegendItems', start);
    const body = source.slice(start, end);

    expect(body).toContain('formatPrice(bar.open, 2, 2)');
    expect(body).toContain('formatPrice(bar.high, 2, 2)');
    expect(body).toContain('formatPrice(bar.low, 2, 2)');
    expect(body).toContain('formatPrice(bar.close, 2, 2)');
  });

  it('formats primary right-axis market-price tags with exactly two decimal places', () => {
    const source = readSource('src/engine/ChartEngine.ts');
    const start = source.indexOf('private buildPriceValueTags(');
    const end = source.indexOf('private getDisplaySymbolName()', start);
    const body = source.slice(start, end);

    expect(body).toContain('formatPrice(lastBar.close, 2, 2)');
    expect(body).toContain('formatPrice(lastBar.prevClose, 2, 2)');
    expect(body).toContain('formatPrice(highLow.high, 2, 2)');
    expect(body).toContain('formatPrice(highLow.low, 2, 2)');
  });

  it('preserves adaptive generic formatting and the existing minimum two-decimal price axis', () => {
    const renderer = readSource('src/engine/Renderer.ts');
    const engine = readSource('src/engine/ChartEngine.ts');

    expect(renderer).toContain('if (absValue >= 10000) {');
    expect(renderer).toContain('return [0, 0];');
    expect(engine).toContain('const pricePrecision = Math.max(getPrecisionFromStep(priceTicks.step), 2);');
    expect(engine).toContain('formatPrice(tick, pricePrecision, pricePrecision)');
    expect(engine).toContain('const formattedValue = formatPrice(value);');
  });
});
