import { afterEach, expect, it, vi } from 'vitest';
import { useWindowStore } from '../windowStore';

afterEach(() => {
  useWindowStore.getState().unregisterWindow('test-window');
  useWindowStore.getState().unregisterWindow('second-window');
  vi.unstubAllGlobals();
});

it('keeps repeatedly focused windows below modal tiers and fits restored bounds', () => {
  vi.stubGlobal('window', { innerWidth: 960, innerHeight: 640 });
  for (const id of ['test-window', 'second-window']) useWindowStore.getState().registerWindow({
    id, title: id, bounds: { x: 20, y: 20, width: 800, height: 600 }, minWidth: 700, minHeight: 500,
  });
  for (let i = 0; i < 2000; i++) useWindowStore.getState().focusWindow(i % 2 ? 'test-window' : 'second-window');
  const windows = useWindowStore.getState().windows;
  expect(windows['test-window'].zIndex).toBeGreaterThan(windows['second-window'].zIndex);
  expect(windows['test-window'].zIndex).toBeLessThan(800);
  useWindowStore.getState().maximizeWindow('test-window');
  vi.stubGlobal('window', { innerWidth: 480, innerHeight: 320 });
  useWindowStore.getState().restoreWindow('test-window');
  expect(useWindowStore.getState().windows['test-window'].bounds).toEqual({ x: 0, y: 0, width: 480, height: 320 });
  useWindowStore.getState().resizeWindow('test-window', 900, 900);
  expect(useWindowStore.getState().windows['test-window'].bounds).toEqual({ x: 0, y: 0, width: 480, height: 320 });
});

it('fits the initial floating window inside a 960 by 640 viewport', () => {
  vi.stubGlobal('window', { innerWidth: 960, innerHeight: 640 });
  useWindowStore.getState().registerWindow({
    id: 'test-window',
    title: 'Test window',
    bounds: { x: 160, y: 70, width: 980, height: 620 },
    minWidth: 480,
    minHeight: 400,
  });
  expect(useWindowStore.getState().windows['test-window'].bounds)
    .toEqual({ x: 0, y: 20, width: 960, height: 620 });
});
