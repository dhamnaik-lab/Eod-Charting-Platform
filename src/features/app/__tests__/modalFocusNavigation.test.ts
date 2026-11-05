import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getModalTabWrapTarget } from '../modalFocusNavigation';

describe('Delete Databases modal focus navigation', () => {
  const elements = ['close', 'db-row', 'confirm', 'cancel', 'delete'];

  it('wraps Tab from the last enabled control to the first', () => {
    expect(getModalTabWrapTarget(elements, 'delete', false)).toBe('close');
  });

  it('wraps Shift+Tab from the first enabled control to the last', () => {
    expect(getModalTabWrapTarget(elements, 'close', true)).toBe('delete');
  });

  it('leaves normal forward and backward navigation inside the modal untouched', () => {
    expect(getModalTabWrapTarget(elements, 'confirm', false)).toBeNull();
    expect(getModalTabWrapTarget(elements, 'confirm', true)).toBeNull();
  });

  it('recovers focus from outside the modal in either Tab direction', () => {
    expect(getModalTabWrapTarget(elements, 'external', false)).toBe('close');
    expect(getModalTabWrapTarget(elements, 'external', true)).toBe('delete');
    expect(getModalTabWrapTarget(elements, null, false)).toBe('close');
  });

  it('does not choose a focus target when all actions are disabled', () => {
    expect(getModalTabWrapTarget([], null, false)).toBeNull();
    expect(getModalTabWrapTarget([], null, true)).toBeNull();
  });

  it('keeps active focus in a one-control modal', () => {
    expect(getModalTabWrapTarget(['cancel'], 'cancel', false)).toBe('cancel');
    expect(getModalTabWrapTarget(['cancel'], 'cancel', true)).toBe('cancel');
  });

  it('wires modal semantics, opener restoration, Escape guard, and existing deletion protections', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/DeleteDatabaseDialog.tsx'), 'utf8');
    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain('aria-labelledby="delete-databases-title"');
    expect(source).toContain('aria-describedby="delete-databases-warning"');
    expect(source).toContain('closeButtonRef.current?.focus()');
    expect(source).toContain('previouslyFocused.focus()');
    expect(source).toContain('getModalTabWrapTarget(');
    expect(source).toContain("event.key === 'Escape'");
    expect(source).toContain('requestClose()');
    expect(source).toContain("if (!deletionInFlightRef.current) onClose();");
    expect(source).toContain("confirmText !== 'DELETE'");
    expect(source).toContain('deleteDatabasesSequentially(');
    expect(source).toContain("button:not([disabled]), input:not([disabled])");
  });
});
