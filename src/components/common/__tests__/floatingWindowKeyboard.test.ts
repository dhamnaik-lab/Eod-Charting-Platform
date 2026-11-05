import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getFloatingWindowArrowDelta } from '../floatingWindowKeyboard';

describe('floating window keyboard accessibility', () => {
  it('moves left and right with a 10px default step', () => {
    expect(getFloatingWindowArrowDelta('ArrowLeft')).toEqual({ x: -10, y: 0 });
    expect(getFloatingWindowArrowDelta('ArrowRight')).toEqual({ x: 10, y: 0 });
  });

  it('moves up and down with a 10px default step', () => {
    expect(getFloatingWindowArrowDelta('ArrowUp')).toEqual({ x: 0, y: -10 });
    expect(getFloatingWindowArrowDelta('ArrowDown')).toEqual({ x: 0, y: 10 });
  });

  it('supports a custom step without changing direction', () => {
    expect(getFloatingWindowArrowDelta('ArrowUp', 4)).toEqual({ x: 0, y: -4 });
    expect(getFloatingWindowArrowDelta('ArrowRight', 25)).toEqual({ x: 25, y: 0 });
  });

  it('does not capture typing, Escape, Tab, or unrelated commands', () => {
    for (const key of ['Tab', 'Escape', 'Enter', ' ', 'a', 'Delete']) {
      expect(getFloatingWindowArrowDelta(key)).toBeNull();
    }
  });

  it('keeps the store-managed window named and keyboard reachable while preserving pointer controls', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/FloatingWindow.tsx'), 'utf8');
    expect(source).toContain('aria-labelledby={`${id}-title`}');
    expect(source).toContain('onKeyDown={handleTitleKeyDown}');
    expect(source).toContain('onKeyDown={handleResizeKeyDown}');
    expect(source).toContain('onMouseDown={handleTitleMouseDown}');
    expect(source).toContain('onMouseDown={handleResizeMouseDown}');
    expect(source).toContain('event.target !== event.currentTarget');
    expect(source).toContain('aria-label={`Minimize ${title}`}');
    expect(source).toContain('aria-label={`Close ${title}`}');
    expect(source).toContain('aria-label={`Resize ${title} window with arrow keys`}');
    expect(source).toContain('handleClose();');
    expect(source).toContain('resizeWindow(');
    expect(source).toContain('moveWindow(');
  });

  it('keeps modeless floating dialogs named and keyboard movable with persisted position', () => {
    const shell = readFileSync(resolve(process.cwd(), 'src/components/common/FloatingDialogShell.tsx'), 'utf8');
    const hook = readFileSync(resolve(process.cwd(), 'src/components/common/useDraggableFloatingWindow.ts'), 'utf8');

    expect(shell).toContain('role="dialog"');
    expect(shell).toContain('aria-modal={!isModeless}');
    expect(shell).toContain('aria-labelledby={titleId}');
    expect(shell).toContain('onPointerDown={handlePointerDown}');
    expect(shell).toContain('onKeyDown={handleHeaderKeyDown}');
    expect(shell).toContain('event.target !== event.currentTarget');
    expect(shell).toContain('moveByKeyboard(delta.x, delta.y)');
    expect(shell).toContain('aria-label={`Reset ${title} position`}');
    expect(shell).toContain('aria-label={`Close ${title}`}');
    expect(hook).toContain('saveStoredFloatingPosition(storageKey, next, storage)');
    expect(hook).toContain('window.addEventListener(\'pointermove\', handlePointerMove)');
    expect(hook).toContain('window.addEventListener(\'pointerup\', handlePointerUp)');
  });
});
