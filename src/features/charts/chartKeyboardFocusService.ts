/** Keep chart-only shortcuts bound to the explicitly focused viewport, not bubbling child controls. */
export function shouldHandleChartViewportShortcut(
  event: Pick<KeyboardEvent, 'defaultPrevented' | 'target' | 'currentTarget'>,
): boolean {
  return !event.defaultPrevented && event.currentTarget !== null && event.target === event.currentTarget;
}
