/**
 * Find the focus target when Tab would escape an open modal.
 * Returning null leaves normal in-modal Tab navigation to the browser.
 */
export function getModalTabWrapTarget<T>(
  focusable: readonly T[],
  active: T | null,
  shiftKey: boolean,
): T | null {
  if (focusable.length === 0) {
    return null;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const activeInside = active !== null && focusable.includes(active);

  if (shiftKey && (!activeInside || active === first)) {
    return last;
  }
  if (!shiftKey && (!activeInside || active === last)) {
    return first;
  }
  return null;
}
