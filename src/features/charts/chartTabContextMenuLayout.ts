const CHART_TAB_MENU_WIDTH = 166;
const CHART_TAB_MENU_HEIGHT = 40;
const CHART_TAB_MENU_MARGIN = 8;

/** Keep the tab context menu within the current window, including edge clicks. */
export function clampChartTabContextMenuPosition(
  x: number,
  y: number,
  viewportWidth: number,
  viewportHeight: number,
): { x: number; y: number } {
  return {
    x: Math.min(Math.max(CHART_TAB_MENU_MARGIN, x), Math.max(CHART_TAB_MENU_MARGIN, viewportWidth - CHART_TAB_MENU_WIDTH - CHART_TAB_MENU_MARGIN)),
    y: Math.min(Math.max(CHART_TAB_MENU_MARGIN, y), Math.max(CHART_TAB_MENU_MARGIN, viewportHeight - CHART_TAB_MENU_HEIGHT - CHART_TAB_MENU_MARGIN)),
  };
}
