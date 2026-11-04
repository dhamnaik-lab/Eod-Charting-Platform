import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { clampChartTabContextMenuPosition } from '../chartTabContextMenuLayout';

describe('chart tab context menu layout', () => {
  it('preserves a menu position already inside the window', () => {
    expect(clampChartTabContextMenuPosition(100, 130, 1000, 800)).toEqual({ x: 100, y: 130 });
  });

  it('clamps right and bottom edge openings inside the window', () => {
    expect(clampChartTabContextMenuPosition(995, 797, 1000, 800)).toEqual({ x: 826, y: 752 });
  });

  it('clamps negative coordinates to the window margin', () => {
    expect(clampChartTabContextMenuPosition(-9, -5, 1000, 800)).toEqual({ x: 8, y: 8 });
  });

  it('handles very narrow windows without negative menu coordinates', () => {
    expect(clampChartTabContextMenuPosition(200, 100, 120, 40)).toEqual({ x: 8, y: 8 });
  });

  it('preserves existing tab geometry while making close controls easier to hit', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/ChartTabs.tsx'), 'utf8').replace(/\r\n?/g, '\n');
    expect(source).toContain('clampChartTabContextMenuPosition(event.clientX, event.clientY, window.innerWidth, window.innerHeight)');
    expect(source).toContain('width: 22,\n  height: 22,');
    expect(source).toContain('gap: 6,\n    minWidth: 90,');
    expect(source).toContain("padding: '0 8px',\n    background: active");
    expect(source).toContain('aria-label={`Close chart tab ${tab.title}`}');
    expect(source).toContain('aria-label="New chart tab"');
  });
});
