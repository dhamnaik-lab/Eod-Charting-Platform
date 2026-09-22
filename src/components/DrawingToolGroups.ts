import type { DrawingTool } from '@/engine/types';

export type DrawingToolGroupId =
  | 'lines'
  | 'channels'
  | 'pitchforks'
  | 'fibonacciGann'
  | 'shapes'
  | 'measureProjection'
  | 'positions'
  | 'arrowsMarkers'
  | 'text';

export interface DrawingToolGroupDefinition {
  id: DrawingToolGroupId;
  title: string;
  defaultToolId: DrawingTool;
  toolIds: readonly DrawingTool[];
}

export const DIRECT_DRAWING_TOOL_IDS = ['cursor', 'crosshair'] as const satisfies readonly DrawingTool[];

export const DRAWING_TOOL_GROUPS: readonly DrawingToolGroupDefinition[] = [
  {
    id: 'lines',
    title: 'Lines',
    defaultToolId: 'trendline',
    toolIds: [
      'trendline',
      'ray',
      'extendedLine',
      'horizontalRay',
      'hline',
      'vline',
      'crossLine',
      'infoLine',
      'trendAngle',
    ],
  },
  {
    id: 'channels',
    title: 'Channels',
    defaultToolId: 'channel',
    toolIds: ['channel', 'flatChannel', 'disjointChannel', 'regressionTrend'],
  },
  {
    id: 'pitchforks',
    title: 'Pitchforks',
    defaultToolId: 'andrewsPitchfork',
    toolIds: [
      'andrewsPitchfork',
      'schiffPitchfork',
      'modifiedSchiffPitchfork',
      'insidePitchfork',
      'pitchfan',
    ],
  },
  {
    id: 'fibonacciGann',
    title: 'Fibonacci / Gann',
    defaultToolId: 'fib',
    toolIds: [
      'fib',
      'fibExtension',
      'trendFibExtension',
      'fibChannel',
      'fibTimeZone',
      'fibTimeExtension',
      'fibCircles',
      'fibSpiral',
      'fibArcs',
      'fibWedge',
      'fibFan',
      'gann',
      'gannBox',
    ],
  },
  {
    id: 'shapes',
    title: 'Shapes',
    defaultToolId: 'rect',
    toolIds: ['rect', 'rotatedRect', 'circle', 'ellipse', 'triangle', 'arc'],
  },
  {
    id: 'measureProjection',
    title: 'Measure / Projection',
    defaultToolId: 'measure',
    toolIds: ['measure', 'priceRange', 'dateRange', 'forecast', 'projection'],
  },
  {
    id: 'positions',
    title: 'Positions',
    defaultToolId: 'longPosition',
    toolIds: ['longPosition', 'shortPosition'],
  },
  {
    id: 'arrowsMarkers',
    title: 'Arrows / Markers',
    defaultToolId: 'arrow',
    toolIds: ['arrow', 'arrowMarker', 'arrowUp', 'arrowDown'],
  },
  {
    id: 'text',
    title: 'Text',
    defaultToolId: 'text',
    toolIds: ['text'],
  },
] as const;

export type DrawingToolGroupSelections = Record<DrawingToolGroupId, DrawingTool>;

export function createDefaultDrawingToolGroupSelections(): DrawingToolGroupSelections {
  return Object.fromEntries(
    DRAWING_TOOL_GROUPS.map((group) => [group.id, group.defaultToolId]),
  ) as DrawingToolGroupSelections;
}

export function findDrawingToolGroup(toolId: DrawingTool): DrawingToolGroupDefinition | null {
  return DRAWING_TOOL_GROUPS.find((group) => group.toolIds.includes(toolId)) ?? null;
}

export function resolveDrawingToolGroupSelection(
  group: DrawingToolGroupDefinition,
  candidate: unknown,
): DrawingTool {
  return typeof candidate === 'string' && group.toolIds.includes(candidate as DrawingTool)
    ? (candidate as DrawingTool)
    : group.defaultToolId;
}

export function sanitizeDrawingToolGroupSelections(value: unknown): DrawingToolGroupSelections {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return Object.fromEntries(
    DRAWING_TOOL_GROUPS.map((group) => [
      group.id,
      resolveDrawingToolGroupSelection(group, source[group.id]),
    ]),
  ) as DrawingToolGroupSelections;
}
