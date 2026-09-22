import { appendIndicator } from '@/features/charts/chartDataUtils';
import type {
  CollapsedIndicatorPanes,
  IndicatorPaneHeights,
  OverlayIndicator,
  PaneScaleOverrides,
} from '@/engine/types';

export const MIN_INDICATOR_PANE_HEIGHT = 72;
export const DEFAULT_INDICATOR_PANE_HEIGHT = 104;
export const MAX_INDICATOR_PANE_HEIGHT = 168;

function shouldWarnInvalidPaneScaleOverride(): boolean {
  return typeof window !== 'undefined' && window.location.protocol !== 'tauri:';
}

export function normalizeIndicatorPaneHeight(height: number): number {
  return Math.max(
    MIN_INDICATOR_PANE_HEIGHT,
    Math.min(MAX_INDICATOR_PANE_HEIGHT, Math.round(height)),
  );
}

export function getPaneIndicatorIds(indicators: OverlayIndicator[]): string[] {
  return indicators
    .filter((indicator) => indicator.placement === 'pane')
    .map((indicator) => indicator.id);
}

export function ensureIndicatorPaneHeights(
  indicators: OverlayIndicator[],
  indicatorPaneHeights: IndicatorPaneHeights,
  fallbackHeight: number,
): IndicatorPaneHeights {
  const next: IndicatorPaneHeights = {};
  const normalizedFallbackHeight = normalizeIndicatorPaneHeight(fallbackHeight);
  getPaneIndicatorIds(indicators).forEach((paneId) => {
    next[paneId] = normalizeIndicatorPaneHeight(
      indicatorPaneHeights[paneId] ?? normalizedFallbackHeight,
    );
  });
  return next;
}

export function pruneCollapsedIndicatorPanes(
  indicators: OverlayIndicator[],
  collapsedIndicatorPanes: CollapsedIndicatorPanes,
): CollapsedIndicatorPanes {
  const allowedPaneIds = new Set<string>(getPaneIndicatorIds(indicators));
  return Object.fromEntries(
    Object.entries(collapsedIndicatorPanes).filter(
      // Only collapsed panes are persisted; expanded panes are removed from the map.
      ([paneId, collapsed]) => allowedPaneIds.has(paneId) && collapsed,
    ),
  ) as CollapsedIndicatorPanes;
}

export function prunePaneScaleOverrides(
  indicators: OverlayIndicator[],
  paneScaleOverrides: PaneScaleOverrides,
): PaneScaleOverrides {
  const allowedPaneIds = new Set<string>(['price', ...getPaneIndicatorIds(indicators)]);
  return Object.fromEntries(
    Object.entries(paneScaleOverrides).flatMap(([paneId, range]) => {
      if (!allowedPaneIds.has(paneId)) {
        return [];
      }

      if (range.max > range.min) {
        return [[paneId, range]];
      }

      if (shouldWarnInvalidPaneScaleOverride()) {
        console.warn('[chart-indicator-pane] dropping invalid pane scale override', {
          paneId,
          range,
        });
      }

      return [];
    }),
  ) as PaneScaleOverrides;
}

export function addPaneIndicator(
  indicators: OverlayIndicator[],
  nextIndicator: OverlayIndicator,
): OverlayIndicator[] {
  return appendIndicator(indicators, nextIndicator);
}

export function movePaneIndicator(
  indicators: OverlayIndicator[],
  indicatorId: string,
  direction: 'up' | 'down',
): OverlayIndicator[] {
  const paneIndicators = indicators.filter((indicator) => indicator.placement === 'pane');
  const currentIndex = paneIndicators.findIndex((indicator) => indicator.id === indicatorId);
  if (currentIndex < 0) {
    return indicators;
  }

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= paneIndicators.length) {
    return indicators;
  }

  const reorderedPaneIndicators = [...paneIndicators];
  [reorderedPaneIndicators[currentIndex], reorderedPaneIndicators[targetIndex]] = [
    reorderedPaneIndicators[targetIndex],
    reorderedPaneIndicators[currentIndex],
  ];

  let paneCursor = 0;
  return indicators.map((indicator) =>
    // Reinsert pane indicators in their new order while leaving non-pane overlays untouched.
    indicator.placement === 'pane' ? reorderedPaneIndicators[paneCursor++] : indicator,
  );
}
