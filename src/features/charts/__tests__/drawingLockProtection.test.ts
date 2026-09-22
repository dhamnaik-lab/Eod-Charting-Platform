import { describe, expect, it } from 'vitest';
import type { ChartDrawing } from '@/engine/types';
import type { ChartTabState } from '@/store/chartStoreTypes';
import {
  clearTabDrawings,
  deleteSelectedTabDrawing,
  removeLastTabDrawing,
} from '@/features/charts/chartTabStateMutationService';

const unlocked: ChartDrawing = {
  id: 'unlocked',
  kind: 'hline',
  price: 100,
  color: '#3b82f6',
  locked: false,
};
const locked: ChartDrawing = {
  id: 'locked',
  kind: 'hline',
  price: 110,
  color: '#ef4444',
  locked: true,
};
const laterUnlocked: ChartDrawing = {
  id: 'later-unlocked',
  kind: 'hline',
  price: 120,
  color: '#22c55e',
  locked: false,
};

function tab(drawings: ChartDrawing[], selectedDrawingId: string | null): ChartTabState {
  return { drawings, selectedDrawingId } as ChartTabState;
}

describe('drawing lock deletion protection', () => {
  it('refuses direct deletion of a selected locked drawing', () => {
    const source = tab([unlocked, locked], locked.id);
    expect(deleteSelectedTabDrawing(source)).toBe(source);
  });

  it('clear drawings preserves locked drawings', () => {
    const result = clearTabDrawings(tab([unlocked, locked, laterUnlocked], unlocked.id));
    expect(result.drawings.map((drawing) => drawing.id)).toEqual([locked.id]);
  });

  it('remove-last/undo skips locked drawings and removes the latest unlocked drawing', () => {
    const result = removeLastTabDrawing(tab([unlocked, locked, laterUnlocked], laterUnlocked.id));
    expect(result.drawings.map((drawing) => drawing.id)).toEqual([unlocked.id, locked.id]);
  });
});
