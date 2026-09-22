import { beforeAll, describe, expect, it } from 'vitest';

type ChunkClassifier = (moduleId: string) => string | undefined;

let classifyManualChunk: ChunkClassifier;

beforeAll(async () => {
  const viteConfigSpecifier = '../../../vite.config.mts';
  const viteConfig = (await import(viteConfigSpecifier)) as {
    classifyManualChunk: ChunkClassifier;
  };
  classifyManualChunk = viteConfig.classifyManualChunk;
});

describe('W1.4 Vite chart runtime partition', () => {
  it.each([
    ['C:/repo/node_modules/technicalindicators/lib/index.js', 'vendor-technicalindicators'],
    ['C:/repo/src/indicators/registry.ts', 'feature-chart-analysis'],
    ['C:/repo/src/indicators/standard/special/pattern.ts', 'feature-chart-analysis'],
    ['C:/repo/src/engine/Patterns.ts', 'feature-chart-analysis'],
    ['C:/repo/src/engine/candlestick/index.ts', 'feature-chart-analysis'],
    ['C:/repo/src/engine/ChartEngine.ts', 'feature-chart-core'],
    ['C:/repo/src/engine/Renderer.ts', 'feature-chart-core'],
    ['C:/repo/src/components/ChartCanvas.tsx', 'feature-chart-canvas'],
    ['C:/repo/src/store/chartStore.ts', 'feature-chart-core'],
    ['C:/repo/src/features/charts/chartTypeTransformService.ts', 'feature-chart-core'],
  ])('classifies %s as %s', (moduleId: string, expectedChunk: string) => {
    expect(classifyManualChunk(moduleId)).toBe(expectedChunk);
  });

  it('classifies Windows ChartCanvas path into its dedicated chunk', () => {
    expect(
      classifyManualChunk('E:\\repo\\src\\components\\ChartCanvas.tsx'),
    ).toBe('feature-chart-canvas');
  });

  it('normalizes Windows backslashes before classification', () => {
    expect(classifyManualChunk('E:\\repo\\src\\engine\\candlestick\\patterns.ts'))
      .toBe('feature-chart-analysis');
  });

  it('does not absorb W1.3 generated watchlist payloads into chart chunks', () => {
    expect(
      classifyManualChunk('C:/repo/src/features/watchlists/generated/officialWatchlistNseIndices.generated.ts'),
    ).toBeUndefined();
  });

  it('preserves the existing static Official Watchlist feature classification', () => {
    expect(
      classifyManualChunk('C:/repo/src/features/watchlists/officialWatchlistProviders.ts'),
    ).toBe('feature-official-watchlists');
  });
});
