/** Keyboard alternative to pointer-only floating-window movement and resizing. */
export function getFloatingWindowArrowDelta(
  key: string,
  step = 10,
): { x: number; y: number } | null {
  switch (key) {
    case 'ArrowLeft':
      return { x: -step, y: 0 };
    case 'ArrowRight':
      return { x: step, y: 0 };
    case 'ArrowUp':
      return { x: 0, y: -step };
    case 'ArrowDown':
      return { x: 0, y: step };
    default:
      return null;
  }
}
