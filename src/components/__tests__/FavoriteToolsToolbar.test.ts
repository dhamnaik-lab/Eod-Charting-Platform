import { describe, expect, it } from 'vitest';
import { clampFavoriteToolbarPosition } from '../FavoriteToolsToolbar';

describe('favorite toolbar position', () => {
  it('retains any position that fits the viewport', () => {
    const position = { x: 40, y: 60 };
    expect(clampFavoriteToolbarPosition(position, { width: 100, height: 36 }, { width: 800, height: 600 }))
      .toEqual(position);
  });

  it('brings a stored right-edge or bottom-edge position into the resized viewport', () => {
    expect(clampFavoriteToolbarPosition({ x: 750, y: 550 }, { width: 40, height: 240 }, { width: 500, height: 360 }))
      .toEqual({ x: 452, y: 112 });
  });

  it('keeps the start edge reachable if the toolbar exceeds the viewport', () => {
    expect(clampFavoriteToolbarPosition({ x: 20, y: -10 }, { width: 520, height: 400 }, { width: 500, height: 360 }))
      .toEqual({ x: 8, y: 8 });
  });
});
