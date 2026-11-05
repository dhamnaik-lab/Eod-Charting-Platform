/** Fixed 30px row windowing for the Sidebar's large lists.
 * No DOM or library dependencies: index/filter/sort semantics stay outside this helper.
 */
export const SIDEBAR_VIRTUALIZE_THRESHOLD = 150;
export const SIDEBAR_VIRTUAL_OVERSCAN = 8;

export interface SidebarListWindow {
  start: number;
  end: number;
  topSpacer: number;
  bottomSpacer: number;
}

export function getSidebarListWindow(
  count: number,
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  leadingHeight = 0,
): SidebarListWindow {
  if (count <= 0 || rowHeight <= 0) {
    return { start: 0, end: 0, topSpacer: 0, bottomSpacer: 0 };
  }
  if (count <= SIDEBAR_VIRTUALIZE_THRESHOLD) {
    return { start: 0, end: count, topSpacer: 0, bottomSpacer: 0 };
  }

  const relativeTop = Math.max(0, scrollTop - Math.max(0, leadingHeight));
  const visibleStart = Math.min(count - 1, Math.floor(relativeTop / rowHeight));
  const visibleEnd = Math.min(count, Math.ceil((relativeTop + Math.max(0, viewportHeight)) / rowHeight));
  const start = Math.max(0, visibleStart - SIDEBAR_VIRTUAL_OVERSCAN);
  const end = Math.min(count, Math.max(start + 1, visibleEnd + SIDEBAR_VIRTUAL_OVERSCAN));

  return {
    start,
    end,
    topSpacer: start * rowHeight,
    bottomSpacer: (count - end) * rowHeight,
  };
}
