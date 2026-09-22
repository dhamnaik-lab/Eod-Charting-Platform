import { describe, expect, it } from 'vitest';
import {
  DIRECT_DRAWING_TOOL_IDS,
  DRAWING_TOOL_GROUPS,
  createDefaultDrawingToolGroupSelections,
  findDrawingToolGroup,
  sanitizeDrawingToolGroupSelections,
} from '@/components/DrawingToolGroups';

describe('DrawingToolGroups', () => {
  it('keeps cursor/crosshair direct and places all 49 persisted drawing tools in exactly one group', () => {
    expect(DIRECT_DRAWING_TOOL_IDS).toEqual(['cursor', 'crosshair']);

    const grouped = DRAWING_TOOL_GROUPS.flatMap((group) => [...group.toolIds]);
    expect(grouped).toHaveLength(49);
    expect(new Set(grouped).size).toBe(49);
    expect(grouped).not.toContain('cursor');
    expect(grouped).not.toContain('crosshair');
  });

  it('provides nine stable TradingView-style tool families with valid defaults', () => {
    expect(DRAWING_TOOL_GROUPS.map((group) => group.id)).toEqual([
      'lines',
      'channels',
      'pitchforks',
      'fibonacciGann',
      'shapes',
      'measureProjection',
      'positions',
      'arrowsMarkers',
      'text',
    ]);

    for (const group of DRAWING_TOOL_GROUPS) {
      expect(group.toolIds).toContain(group.defaultToolId);
      expect(findDrawingToolGroup(group.defaultToolId)?.id).toBe(group.id);
    }
  });

  it('sanitizes persisted last-used selections back to group defaults when stale or invalid', () => {
    const defaults = createDefaultDrawingToolGroupSelections();
    const sanitized = sanitizeDrawingToolGroupSelections({
      lines: 'horizontalRay',
      channels: 'fib',
      fibonacciGann: 'trendFibExtension',
      positions: 'shortPosition',
      text: 'not-a-tool',
    });

    expect(sanitized.lines).toBe('horizontalRay');
    expect(sanitized.channels).toBe(defaults.channels);
    expect(sanitized.fibonacciGann).toBe('trendFibExtension');
    expect(sanitized.positions).toBe('shortPosition');
    expect(sanitized.text).toBe(defaults.text);
  });
});
