/**
 * Gann Price-Time Analysis Plugin — Manifest & Registration
 *
 * This file is the sole platform coupling point for the plugin.
 * It exports the RegisteredPlugin object consumed by registry.ts.
 */

import type { RegisteredPlugin } from '@/plugins/types';
import { computeGannSetup, DEFAULT_GANN_OPTIONS } from './engine';
import { renderGannOverlay } from './canvasOverlay';
import type { GannBar } from './types';

export const GANN_PRICE_TIME_PLUGIN_ID = 'gann-price-time';

export const gannPriceTimePlugin: RegisteredPlugin = {
  externalLoadingSupported: false,
  defaultEnabled: false,
  manifest: {
    id: GANN_PRICE_TIME_PLUGIN_ID,
    name: 'Gann Price-Time Analysis',
    version: '0.1.0',
    type: 'indicator',
    status: 'bundled',
    description:
      'Read-only analysis overlay that projects pivot-pair scale-locked Gann angle rays (2×1, 1×1, 1×2), ' +
      'Square of Nine harmonic price targets, and 45/90/180/360-bar time cycle boundaries with ' +
      'automatic breakout confirmation from completed daily OHLCV bars. ' +
      'Zero external dependencies. No database writes.',
    capabilities: [
      'completed-daily-bars-only',
      'pivot-pair-scale-locked-geometry',
      'gann-angle-rays',
      'square-of-nine-levels',
      'time-cycle-boundaries',
      'breakout-confirmation-5bar',
      'canvas-2d-overlay',
      'read-only-eod-bars',
      'no-order-execution',
      'no-db-writes',
    ],
  },
  lifecycle: {
    init(context) {
      context.registerChartOverlay({
        id: 'gann-price-time-overlay',
        name: 'Gann Price-Time Overlay',
        render: (ctx, bars, mapper, width, height) => {
          const gannBars: GannBar[] = bars.map((b, i) => ({
            date: b.date,
            timestamp: b.timestamp ?? i,
            open: b.open,
            high: b.high,
            low: b.low,
            close: b.close,
            volume: b.volume,
          }));
          const setup = computeGannSetup(gannBars);
          if (!setup) return;
          renderGannOverlay(ctx, setup, mapper, DEFAULT_GANN_OPTIONS, width, height);
        },
      });
      context.log('info', 'Gann Price-Time plugin initialized.');
    },
    destroy() {
      // Disposables are automatically cleaned up by PluginHost
    },
  },
};
