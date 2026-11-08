import type { OHLCBar, OverlayIndicator } from '@/engine/types';
import { getIndicatorCatalogItemByKind } from '@/indicators/catalog';
import { supportsChainedIndicatorSource } from '@/indicators/chaining';
import { buildRenderableIndicators } from '@/indicators/registry';

export interface StudySourceChoice {
  value: string;
  indicatorId: string;
  plotKey: string;
  label: string;
}

/** Keep IDs and plot keys unambiguous even if either contains punctuation. */
export function studySourceOptionValue(indicatorId: string, plotKey: string): string {
  return `study:${encodeURIComponent(indicatorId)}:${encodeURIComponent(plotKey)}`;
}

function hasFiniteNumber(values: Array<number | null>): boolean {
  return values.some((value) => typeof value === 'number' && Number.isFinite(value));
}

/** A source cannot transitively depend on the indicator being edited. */
function dependsOnTarget(
  candidate: OverlayIndicator,
  targetId: string,
  indicatorsById: Map<string, OverlayIndicator>,
): boolean {
  const visited = new Set([candidate.id]);
  let upstreamId = candidate.sourceIndicatorId;

  while (upstreamId) {
    if (upstreamId === targetId || visited.has(upstreamId)) return true;
    visited.add(upstreamId);
    const upstream = indicatorsById.get(upstreamId);
    if (!upstream) return true;
    upstreamId = upstream.sourceIndicatorId;
  }
  return false;
}

/**
 * Advertise only actual aligned, numeric renderable lines/histograms. This
 * shares B05's dependency, gap and missing-source rules instead of inventing
 * a separate indicator-output allowlist or silently substituting price Close.
 */
export function getEligibleStudySourceChoices(
  bars: OHLCBar[],
  allIndicators: OverlayIndicator[],
  currentIndicator: OverlayIndicator,
): StudySourceChoice[] {
  if (!bars.length || !supportsChainedIndicatorSource(currentIndicator.kind)) return [];

  const byId = new Map(allIndicators.map((indicator) => [indicator.id, indicator]));
  const counts = new Map<string, number>();
  for (const indicator of allIndicators) {
    counts.set(indicator.id, (counts.get(indicator.id) ?? 0) + 1);
  }

  const renderable = buildRenderableIndicators(bars, allIndicators);
  const byRenderedId = new Map(
    [...renderable.overlays, ...renderable.panes].map((item) => [item.indicator.id, item]),
  );

  const choices: StudySourceChoice[] = [];
  for (const indicator of allIndicators) {
    if (
      indicator.id === currentIndicator.id ||
      indicator.visible === false ||
      counts.get(indicator.id) !== 1 ||
      dependsOnTarget(indicator, currentIndicator.id, byId)
    ) {
      continue;
    }
    const output = byRenderedId.get(indicator.id);
    if (!output) continue;

    const kindLabel = getIndicatorCatalogItemByKind(indicator.kind)?.label ?? indicator.kind;
    const plots = [
      ...output.lines.map((line) => ({ key: line.key, label: line.label, values: line.values })),
      ...('histogram' in output && output.histogram
        ? [{
            key: output.histogram.key,
            label: output.histogram.label,
            values: output.histogram.values,
          }]
        : []),
    ];

    for (const plot of plots) {
      if (!plot.key || !hasFiniteNumber(plot.values)) continue;
      choices.push({
        value: studySourceOptionValue(indicator.id, plot.key),
        indicatorId: indicator.id,
        plotKey: plot.key,
        label: `${kindLabel} · ${plot.label || plot.key}`,
      });
    }
  }
  return choices;
}
