import { beforeEach, describe, expect, it } from 'vitest';
import {
  clampCoordinate,
  computeInitialFloatingPosition,
  readStoredFloatingPosition,
  saveStoredFloatingPosition,
} from '../useDraggableFloatingWindow';

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

describe('useDraggableFloatingWindow pure utilities', () => {
  let memoryStorage: MemoryStorage;

  beforeEach(() => {
    memoryStorage = new MemoryStorage();
  });

  it('clamps coordinates to viewport limits', () => {
    expect(clampCoordinate(-50, 0, 1000)).toBe(0);
    expect(clampCoordinate(500, 0, 1000)).toBe(500);
    expect(clampCoordinate(1200, 0, 1000)).toBe(1000);
  });

  it('computes initial centered position relative to viewport', () => {
    const pos = computeInitialFloatingPosition(800, 600, 1920, 1080);
    expect(pos.x).toBe(Math.round((1920 - 800) / 2));
    expect(pos.y).toBe(Math.round((1080 - 600) / 3));
  });

  it('handles small viewports safely', () => {
    const pos = computeInitialFloatingPosition(800, 600, 700, 500);
    expect(pos.x).toBe(16);
    expect(pos.y).toBe(32);
  });

  it('reads and saves stored position with custom storage', () => {
    const key = 'test-floating-window-storage';
    saveStoredFloatingPosition(key, { x: 250, y: 120 }, memoryStorage);
    const loaded = readStoredFloatingPosition(key, 800, 600, 1920, 1080, memoryStorage);
    expect(loaded).toEqual({ x: 250, y: 120 });
  });

  it('clamps stored position if screen was resized', () => {
    const key = 'test-floating-window-storage-resized';
    saveStoredFloatingPosition(key, { x: 2500, y: 1500 }, memoryStorage);
    const loaded = readStoredFloatingPosition(key, 800, 600, 1000, 800, memoryStorage);
    expect(loaded?.x).toBe(920); // 1000 - 80
    expect(loaded?.y).toBe(740); // 800 - 60
  });
});
