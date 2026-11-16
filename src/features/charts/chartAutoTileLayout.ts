/**
 * At most six charts are visible in Auto-Tile; extra chart tabs remain open.
 */
export function getVisibleTileTabs<T extends { id: string }>(
  tabs: readonly T[],
  activeTabId: string,
): T[] {
  const visible = tabs.slice(0, 6);
  if (tabs.length > 6 && !visible.some((tab) => tab.id === activeTabId)) {
    const selected = tabs.find((tab) => tab.id === activeTabId);
    if (selected) visible[5] = selected;
  }
  return visible;
}

export interface AutoTileGeometry {
  columns: number;
  spans: number[];
  minRowHeight: number;
}

export function getAutoTileGeometry(count: number, width: number): AutoTileGeometry {
  const n = Math.max(1, Math.min(6, Math.floor(count)));
  const available = Number.isFinite(width) ? Math.max(0, width) : 1200;
  if (available < 700) {
    return { columns: 1, spans: Array(n).fill(1), minRowHeight: 225 };
  }
  if (available < 1200) {
    if (n === 1) return { columns: 1, spans: [1], minRowHeight: 0 };
    if (n === 3) return { columns: 2, spans: [1, 1, 2], minRowHeight: 0 };
    if (n === 5) return { columns: 2, spans: [1, 1, 1, 1, 2], minRowHeight: 0 };
    return { columns: 2, spans: Array(n).fill(1), minRowHeight: 0 };
  }
  if (n === 5) return { columns: 6, spans: [2, 2, 2, 3, 3], minRowHeight: 0 };
  const columns = n <= 3 ? n : n === 4 ? 2 : 3;
  return { columns, spans: Array(n).fill(1), minRowHeight: 0 };
}
