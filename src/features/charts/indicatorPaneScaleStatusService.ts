import type { OverlayIndicator, PaneScaleOverrides } from '@/engine/types';

export type IndicatorPaneScaleStatus = 'automatic' | 'manual';

/** Report chart state; no scaling math or persistence is modified. */
export function getIndicatorPaneScaleStatus(
  indicator: Pick<OverlayIndicator, 'id' | 'placement'>,
  overrides: PaneScaleOverrides,
): IndicatorPaneScaleStatus {
  const paneId = indicator.placement === 'overlay' ? 'price' : indicator.id;
  return overrides[paneId] ? 'manual' : 'automatic';
}
