import React, { useEffect } from 'react';
import { FloatingWindow } from '@/components/FloatingWindow';
import { useUiStore } from '@/store/uiStore';
import { useWindowStore } from '@/store/windowStore';

const KEYBOARD_SHORTCUTS_WINDOW_ID = 'keyboard-shortcuts-dialog';

interface ShortcutItem {
  keys: string;
  action: string;
  note?: string;
}

const WORKSPACE_SHORTCUTS: ShortcutItem[] = [
  {
    keys: 'S',
    action: 'Search symbols (Command Palette)',
  },
  {
    keys: 'Ctrl+K / /',
    action: 'Open the command palette',
  },
];

const CHART_SHORTCUTS: ShortcutItem[] = [
  {
    keys: 'D / W / M / Q / Y',
    action: 'Daily / Weekly / Monthly / Quarterly / Yearly timeframe',
    note: 'Requires chart focus; does not apply while editing or in dialogs.',
  },
  {
    keys: 'X',
    action: 'Toggle Crosshair',
    note: 'Requires chart focus.',
  },
  {
    keys: 'H',
    action: 'Select Horizontal Line',
    note: 'Requires chart focus.',
  },
  {
    keys: 'V',
    action: 'Select Vertical Line',
    note: 'Requires chart focus.',
  },
  {
    keys: 'L',
    action: 'Select Trendline',
    note: 'Requires chart focus.',
  },
  {
    keys: 'C',
    action: 'Return to Cursor',
    note: 'Requires chart focus.',
  },
  {
    keys: 'Arrow Up / Down',
    action: 'Previous / next symbol in the current watchlist context',
    note: 'Requires chart focus.',
  },
  {
    keys: 'Arrow Left / Right',
    action: 'Pan chart left / right',
    note: 'Requires chart focus.',
  },
  {
    keys: '+ / =',
    action: 'Zoom in',
    note: 'Requires chart focus.',
  },
  {
    keys: '-',
    action: 'Zoom out',
    note: 'Requires chart focus.',
  },
  {
    keys: '0 / Home',
    action: 'Reset chart viewport',
    note: 'Requires chart focus.',
  },
  {
    keys: 'End',
    action: 'Jump to the latest visible bar',
    note: 'Requires chart focus.',
  },
  {
    keys: 'Delete / Backspace',
    action: 'Delete the selected drawing',
    note: 'Requires chart focus.',
  },
  {
    keys: 'Shift+Delete / Shift+Backspace',
    action: 'Clear all drawings on the active chart',
    note: 'Requires chart focus.',
  },
  {
    keys: 'Esc',
    action: 'Cancel drawing mode and return to Cursor',
    note: 'Requires chart focus.',
  },
];

const COMMAND_PALETTE_SHORTCUTS: ShortcutItem[] = [
  {
    keys: 'Arrow Up / Down',
    action: 'Move through command results',
  },
  {
    keys: 'Enter',
    action: 'Run the highlighted command or open the highlighted symbol result',
  },
  {
    keys: 'Esc',
    action: 'Close the command palette',
  },
];

export function KeyboardShortcutsDialog() {
  const isOpen = useUiStore((state) => state.keyboardShortcutsDialogOpen);
  const openRequestCount = useUiStore((state) => state.keyboardShortcutsOpenRequestCount);
  const onClose = useUiStore((state) => state.closeKeyboardShortcutsDialog);

  const registerWindow = useWindowStore((state) => state.registerWindow);
  const openWindow = useWindowStore((state) => state.openWindow);
  const focusWindow = useWindowStore((state) => state.focusWindow);
  const closeWindow = useWindowStore((state) => state.closeWindow);

  useEffect(() => {
    registerWindow({
      id: KEYBOARD_SHORTCUTS_WINDOW_ID,
      title: 'Keyboard Shortcuts',
      bounds: {
        x: 240,
        y: 120,
        width: 760,
        height: 620,
      },
      minWidth: 560,
      minHeight: 420,
    });
  }, [registerWindow]);

  useEffect(() => {
    if (isOpen) {
      openWindow(KEYBOARD_SHORTCUTS_WINDOW_ID);
      focusWindow(KEYBOARD_SHORTCUTS_WINDOW_ID);
    } else {
      closeWindow(KEYBOARD_SHORTCUTS_WINDOW_ID);
    }
  }, [isOpen, openRequestCount, openWindow, focusWindow, closeWindow]);

  if (!isOpen) {
    return null;
  }

  return (
    <FloatingWindow id={KEYBOARD_SHORTCUTS_WINDOW_ID} onClose={onClose}>
      <div style={contentStyle} className="tab-strip-scroll">
        <div style={introStyle}>
          Use these shortcuts exactly as the current app supports them. Chart shortcuts work when
          the chart canvas has focus.
        </div>
        <ShortcutSection title="Workspace" items={WORKSPACE_SHORTCUTS} />
        <ShortcutSection title="Chart" items={CHART_SHORTCUTS} />
        <ShortcutSection title="Command Palette" items={COMMAND_PALETTE_SHORTCUTS} />
      </div>
      <div style={footerStyle}>
        <button type="button" onClick={onClose} style={footerButtonStyle}>
          Close
        </button>
      </div>
    </FloatingWindow>
  );
}

function ShortcutSection({ title, items }: { title: string; items: ShortcutItem[] }) {
  return (
    <div style={sectionStyle}>
      <div style={sectionTitleStyle}>{title}</div>
      <div style={tableStyle}>
        {items.map((item) => (
          <div key={`${title}-${item.keys}-${item.action}`} style={rowStyle}>
            <div style={keysCellStyle}>{item.keys}</div>
            <div style={actionCellStyle}>
              <div style={actionTitleStyle}>{item.action}</div>
              {item.note ? <div style={actionNoteStyle}>{item.note}</div> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const contentStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
};

const introStyle: React.CSSProperties = {
  padding: 14,
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'var(--bg2)',
  color: 'var(--text-dim)',
  fontSize: 13,
  lineHeight: 1.5,
};

const sectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--accent)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const tableStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  border: '1px solid var(--border)',
  borderRadius: 8,
  overflow: 'hidden',
};

const rowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '180px minmax(0, 1fr)',
  gap: 0,
  borderBottom: '1px solid var(--border)',
  background: 'var(--bg)',
};

const keysCellStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderRight: '1px solid var(--border)',
  color: 'var(--text)',
  fontSize: 12,
  fontWeight: 700,
  background: 'var(--bg2)',
};

const actionCellStyle: React.CSSProperties = {
  padding: '12px 14px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const actionTitleStyle: React.CSSProperties = {
  color: 'var(--text)',
  fontSize: 13,
  fontWeight: 600,
};

const actionNoteStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 12,
  lineHeight: 1.4,
};

const footerStyle: React.CSSProperties = {
  padding: '12px 20px',
  borderTop: '1px solid var(--border)',
  display: 'flex',
  justifyContent: 'flex-end',
  backgroundColor: 'var(--bg3)',
};

const footerButtonStyle: React.CSSProperties = {
  padding: '8px 20px',
  backgroundColor: 'var(--accent)',
  color: 'var(--text)',
  border: 'none',
  borderRadius: 4,
  fontWeight: 600,
  cursor: 'pointer',
};
