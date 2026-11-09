import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const normalizeSourceLineEndings = (source: string): string => source.replace(/\r\n?/g, '\n');

describe('D3C.1 visual rendering contracts', () => {
  const renderer = normalizeSourceLineEndings(readFileSync(resolve(process.cwd(), 'src/engine/Renderer.ts'), 'utf8'));

  it('normalizes LF, CRLF, and CR source newlines for text layout contracts', () => {
    const expected = "'center',\n        fontSize";
    for (const newline of ['\n', '\r\n', '\r']) {
      expect(normalizeSourceLineEndings(expected.replace(/\n/g, newline))).toBe(expected);
    }
  });

  it('uses TradingView-style position zones with compact Target / Entry / Stop statistics', () => {
    // S2.3.1 intentionally supersedes the earlier split "--- text ---" experiment.
    expect(renderer).not.toContain('drawInlinePositionLevel');
    expect(renderer).toContain('drawPositionStatText');
    expect(renderer).toContain('rewardFill');
    expect(renderer).toContain('riskFill');
    expect(renderer).toContain('strokeDrawingSegmentWithPresentation(ctx, geometry.target, targetPresentation)');
    expect(renderer).toContain('strokeDrawingSegmentWithPresentation(ctx, geometry.entry, entryPresentation)');
    expect(renderer).toContain('strokeDrawingSegmentWithPresentation(ctx, geometry.stop, stopPresentation)');
    expect(renderer).toContain('LONG');
    expect(renderer).toContain('SHORT');
    expect(renderer).toContain('R:R');
  });

  it('removes the old debug-orientation annotation from chart rendering', () => {
    expect(renderer).not.toContain('Check target / stop orientation');
  });

  it('uses clean Fib endpoint labels instead of the previous above-line halo contract', () => {
    expect(renderer).toContain('getSegmentLabelPlacement');
    expect(renderer).toContain('gap: 6');
    expect(renderer).toContain("alignment === 'right' ? 'right' : 'left'");
    expect(renderer).toContain("'center',\n        fontSize");
    expect(renderer).toContain('ctx.shadowBlur = 2;');
    expect(renderer).toContain('ctx.fillText(text, box.textX, box.textY);');
    expect(renderer).not.toContain('ctx.strokeText(text, box.textX, box.textY);');
  });
});
