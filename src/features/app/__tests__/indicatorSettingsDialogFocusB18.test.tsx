import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { OverlayIndicator } from '@/engine/types';
import { IndicatorSettingsDialog } from '@/components/IndicatorSettingsDialog';
import { getModalTabWrapTarget } from '../modalFocusNavigation';
import { hasUnsavedIndicatorSettingsChanges } from '../indicatorSettingsDraftGuard';

const original: OverlayIndicator = { id: 'b18-rsi', kind: 'RSI', placement: 'pane', period: 14, source: 'close', color: '#123456' };
const code = readFileSync('src/components/IndicatorSettingsDialog.tsx', 'utf8');

describe('B18 indicator settings modal and dirty-draft protection', () => {
  it('does not request discard when the cloned draft is identical', () => {
    expect(hasUnsavedIndicatorSettingsChanges(original, { ...original }, {})).toBe(false);
  });
  it('detects changed fields and reverted edits without mutating the original', () => {
    const changed = { ...original, period: 21 } as OverlayIndicator;
    expect(hasUnsavedIndicatorSettingsChanges(original, changed, {})).toBe(true);
    expect(hasUnsavedIndicatorSettingsChanges(original, { ...changed, period: 14 }, {})).toBe(false);
    expect(original.period).toBe(14);
  });
  it('detects invalid text overrides even if numeric state is unchanged', () => {
    expect(hasUnsavedIndicatorSettingsChanges(original, original, { period: '' })).toBe(true);
    expect(hasUnsavedIndicatorSettingsChanges(original, original, { period: 'invalid' })).toBe(true);
  });
  it('uses existing modal Tab wrapping for backward, forward and outside focus', () => {
    const items = ['reset', 'close', 'field', 'cancel', 'save'];
    expect(getModalTabWrapTarget(items, 'save', false)).toBe('reset');
    expect(getModalTabWrapTarget(items, 'reset', true)).toBe('save');
    expect(getModalTabWrapTarget(items, 'field', false)).toBeNull();
    expect(getModalTabWrapTarget(items, null, false)).toBe('reset');
  });
  it('renders accessible dialog title, modal semantics and unchanged Save/Cancel/Remove actions', () => {
    const html = renderToStaticMarkup(createElement(IndicatorSettingsDialog, {
      indicator: original, onSave: () => undefined, onRemove: () => undefined, onClose: () => undefined,
    }));
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="indicator-settings-title"');
    expect(html).toContain('id="indicator-settings-title"');
    for (const action of ['Save</button>', 'Cancel</button>', 'Remove</button>']) expect(html).toContain(action);
  });
  it('routes clean close, dirty Escape, backdrop, Close and Cancel through one guarded request', () => {
    expect(code).toContain('const requestClose = () =>');
    expect(code).toContain('if (hasUnsavedChanges)');
    expect(code).toContain('onMouseDown={requestClose}');
    expect(code).toContain('onClick={requestClose}');
    expect(code).toContain("event.key === 'Escape'");
    expect(code).toContain('getModalTabWrapTarget(focusable, document.activeElement');
  });
  it('requires explicit discard confirmation and restores focus after an actual close', () => {
    expect(code).toContain('Discard unsaved indicator changes?');
    expect(code).toContain('Keep editing');
    expect(code).toContain('Discard changes');
    expect(code).toContain('onClick={onClose}');
    expect(code).toContain('closeButtonRef.current?.focus()');
    expect(code).toContain('opener.focus()');
    expect(code).toContain('opener.isConnected');
  });
  it('retains numeric Save guard, PATTERN persistence and floating placement', () => {
    expect(code).toContain('if (hasInvalidNumericInputs)');
    expect(code).toContain('saveCandlestickSettings(');
    expect(code).toContain('useDraggableFloatingWindow({');
    expect(code).toContain('onPointerDown={handlePointerDown}');
  });
});
