import { describe, expect, it } from 'vitest';
import { resolveAxisTagText } from '../Renderer';

describe('axis value tag foreground', () => {
  it('uses dark text on opaque high and low tags', () => {
    expect(resolveAxisTagText('#78e7a0', '#0d1722')).toBe('#000000');
    expect(resolveAxisTagText('#ff9a9a', '#0d1722')).toBe('#000000');
  });

  it('uses the axis backdrop for translucent tag fills', () => {
    const tag = 'rgba(255, 255, 255, 0.25)';
    expect(resolveAxisTagText(tag, '#050505')).toBe('#ffffff');
    expect(resolveAxisTagText(tag, '#f3f4f6')).toBe('#000000');
  });
});
