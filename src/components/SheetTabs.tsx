import { useState, type CSSProperties } from 'react';

import { useChartStore } from '@/store/chartStore';
import type { Sheet } from '@/store/chartStoreTypes';

interface SheetTabsProps {
  tabId?: string;
  inline?: boolean;
}

export function SheetTabs({ tabId, inline = false }: SheetTabsProps) {
  const activateChartTab = useChartStore((state) => state.activateChartTab);
  const chartTabs = useChartStore((state) => state.chartTabs);
  const activeTab = tabId ? chartTabs.find((tab) => tab.id === tabId) : null;

  const sheets = activeTab?.sheets ?? [];
  const activeSheetId = activeTab?.activeSheetId ?? null;
  const loadSheet = useChartStore((state) => state.loadSheet);
  const deleteSheet = useChartStore((state) => state.deleteSheet);
  const renameSheet = useChartStore((state) => state.renameSheet);
  const saveCurrentAsSheet = useChartStore((state) => state.saveCurrentAsSheet);
  const [sheetDialog, setSheetDialog] = useState<SheetDialogState | null>(null);

  if (!tabId || !activeTab) {
    return null;
  }

  const focusTab = () => {
    activateChartTab(tabId);
  };

function formatSheetLabel(name: string): string {
  const match = /^Sheet\s*(\d+)$/i.exec(name);
  if (match) {
    return match[1];
  }
  return name;
}

  const handleNewSheet = () => {
    const num = sheets.length + 1;
    setSheetDialog({
      mode: 'create',
      value: `${num}`,
    });
  };

  const handleRename = (sheet: Sheet) => {
    setSheetDialog({
      mode: 'rename',
      sheet,
      value: sheet.name,
    });
  };

  const handleDelete = (sheet: Sheet) => {
    setSheetDialog({
      mode: 'delete',
      sheet,
      value: sheet.name,
    });
  };

  const closeDialog = () => {
    setSheetDialog(null);
  };

  const handleSubmitSheetName = () => {
    if (!sheetDialog || (sheetDialog.mode !== 'create' && sheetDialog.mode !== 'rename')) {
      return;
    }

    const nextName = sheetDialog.value.trim();
    if (!nextName) {
      return;
    }

    focusTab();
    if (sheetDialog.mode === 'create') {
      saveCurrentAsSheet(tabId, nextName);
    } else if (sheetDialog.sheet && nextName !== sheetDialog.sheet.name) {
      renameSheet(tabId, sheetDialog.sheet.id, nextName);
    }
    closeDialog();
  };

  const handleConfirmDelete = () => {
    if (!sheetDialog || sheetDialog.mode !== 'delete' || !sheetDialog.sheet) {
      return;
    }

    focusTab();
    deleteSheet(tabId, sheetDialog.sheet.id);
    closeDialog();
  };

  return (
    <>
      <div style={inline ? inlineSheetBarStyle : sheetBarStyle}>
        <div style={sheetStripStyle(inline)} className="tab-strip-scroll">
          {sheets.map((sheet) => (
            <div
              key={sheet.id}
              style={sheetTabStyle(sheet.id === activeSheetId, inline)}
              onClick={() => {
                focusTab();
                loadSheet(tabId, sheet.id);
              }}
              onDoubleClick={() => handleRename(sheet)}
              title="Double-click to rename. Click to load."
            >
              <span style={sheetLabelStyle(sheet.id === activeSheetId, inline)}>{formatSheetLabel(sheet.name)}</span>
              <button
                type="button"
                style={sheetCloseBtnStyle(inline)}
                onClick={(event) => {
                  event.stopPropagation();
                  handleDelete(sheet);
                }}
                title="Delete sheet"
              >
                x
              </button>
            </div>
          ))}
            <button
              type="button"
              style={newSheetBtnStyle(inline)}
            onClick={handleNewSheet}
            title="Create new plain candle sheet"
          >
            +
          </button>
        </div>
      </div>
      {sheetDialog ? (
        <div style={dialogBackdropStyle} onMouseDown={closeDialog}>
          <div style={dialogPanelStyle} onMouseDown={(event) => event.stopPropagation()}>
            {sheetDialog.mode === 'delete' ? (
              <>
                <div style={dialogTitleStyle}>Delete Sheet</div>
                <div style={dialogBodyStyle}>
                  Delete <strong>{sheetDialog.sheet?.name ?? 'this sheet'}</strong>? This only removes the saved sheet entry for
                  the current chart window.
                </div>
                <div style={dialogActionsStyle}>
                  <button type="button" style={dialogButtonStyle} onClick={closeDialog}>
                    Cancel
                  </button>
                  <button type="button" style={dialogDangerButtonStyle} onClick={handleConfirmDelete}>
                    Delete
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={dialogTitleStyle}>{sheetDialog.mode === 'create' ? 'New Sheet' : 'Rename Sheet'}</div>
                <label style={dialogLabelStyle}>
                  <span>{sheetDialog.mode === 'create' ? 'Plain candle sheet name' : 'Rename sheet'}</span>
                  <input
                    autoFocus
                    value={sheetDialog.value}
                    onChange={(event) =>
                      setSheetDialog((current) =>
                        current && current.mode !== 'delete'
                          ? {
                              ...current,
                              value: event.target.value,
                            }
                          : current,
                      )
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        handleSubmitSheetName();
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        closeDialog();
                      }
                    }}
                    style={dialogInputStyle}
                  />
                </label>
                <div style={dialogActionsStyle}>
                  <button type="button" style={dialogButtonStyle} onClick={closeDialog}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    style={dialogPrimaryButtonStyle}
                    onClick={handleSubmitSheetName}
                    disabled={!sheetDialog.value.trim()}
                  >
                    {sheetDialog.mode === 'create' ? 'Create' : 'Save'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

type SheetDialogState =
  | {
      mode: 'create';
      value: string;
    }
  | {
      mode: 'rename';
      sheet: Sheet;
      value: string;
    }
  | {
      mode: 'delete';
      sheet: Sheet;
      value: string;
    };

const sheetBarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'flex-start',
  padding: '0 8px',
  background: 'var(--bg2)',
  borderTop: '1px solid var(--border)',
  minHeight: 32,
  flex: '0 0 auto',
};

const inlineSheetBarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  minWidth: 0,
  maxWidth: '100%',
  padding: 0,
  minHeight: 24,
  flex: '0 1 auto',
};

function sheetStripStyle(inline: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: inline ? 'center' : 'flex-end',
    gap: 3,
    minWidth: 0,
    maxWidth: '100%',
    overflowX: 'auto',
    overflowY: 'hidden',
    paddingTop: inline ? 0 : 4,
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  };
}

function sheetTabStyle(active: boolean, inline: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: inline ? 4 : 6,
    minWidth: inline ? 32 : 44,
    maxWidth: 164,
    height: inline ? 22 : 28,
    padding: inline ? '0 6px' : '0 10px',
    background: active ? 'var(--chart-bg)' : 'var(--control-bg)',
    border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
    borderBottom: inline
      ? active
        ? '1px solid var(--accent)'
        : '1px solid var(--border)'
      : active
        ? '1px solid var(--chart-bg)'
        : '1px solid var(--border)',
    borderRadius: inline ? 'var(--control-radius)' : '7px 7px 0 0',
    cursor: 'pointer',
    marginBottom: inline ? 0 : -1,
    boxShadow: active && !inline ? '0 10px 20px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255,255,255,0.04)' : 'none',
    flex: '0 0 auto',
  };
}

function sheetLabelStyle(active: boolean, inline: boolean): CSSProperties {
  return {
    color: active ? 'var(--text)' : 'var(--text-dim)',
    fontSize: inline ? 12 : 13,
    fontWeight: active ? 700 : 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    lineHeight: 1,
    textAlign: 'center',
  };
}

function sheetCloseBtnStyle(inline: boolean): CSSProperties {
  return {
    width: inline ? 12 : 14,
    height: inline ? 12 : 14,
    border: 'none',
    background: 'transparent',
    color: 'var(--text-mute)',
    borderRadius: 3,
    cursor: 'pointer',
    fontSize: inline ? 10 : 11,
    lineHeight: 1,
    padding: 0,
    flex: '0 0 auto',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.65,
  };
}

function newSheetBtnStyle(inline: boolean): CSSProperties {
  return {
    minWidth: inline ? 22 : 28,
    height: inline ? 22 : 28,
    border: '1px solid var(--border)',
    background: 'var(--control-bg)',
    color: 'var(--text-dim)',
    borderRadius: inline ? 'var(--control-radius)' : '7px 7px 0 0',
    cursor: 'pointer',
    flex: '0 0 auto',
    fontSize: inline ? 14 : 16,
    fontWeight: 600,
    lineHeight: 1,
    padding: inline ? '0 6px' : '0 10px',
    marginBottom: inline ? 0 : -1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}

const dialogBackdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--overlay-bg)',
  zIndex: 1200,
};

const dialogPanelStyle: CSSProperties = {
  width: 360,
  maxWidth: 'calc(100vw - 32px)',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  padding: 18,
  borderRadius: 'var(--panel-radius)',
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  boxShadow: 'var(--shadow-lg)',
};

const dialogTitleStyle: CSSProperties = {
  color: 'var(--text)',
  fontSize: 16,
  fontWeight: 700,
};

const dialogBodyStyle: CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 12,
  lineHeight: 1.5,
};

const dialogLabelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  color: 'var(--text-dim)',
  fontSize: 12,
};

const dialogInputStyle: CSSProperties = {
  width: '100%',
  height: 36,
  border: '1px solid var(--border2)',
  borderRadius: 'var(--control-radius)',
  background: 'var(--bg2)',
  color: 'var(--text)',
  padding: '0 12px',
  outline: 'none',
};

const dialogActionsStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 10,
};

const dialogButtonStyle: CSSProperties = {
  minWidth: 88,
  height: 34,
  border: '1px solid var(--border)',
  borderRadius: 'var(--control-radius)',
  background: 'var(--bg3)',
  color: 'var(--text)',
  cursor: 'pointer',
};

const dialogPrimaryButtonStyle: CSSProperties = {
  ...dialogButtonStyle,
  borderColor: 'var(--accent)',
  color: 'var(--text)',
  background: 'var(--accent-soft)',
};

const dialogDangerButtonStyle: CSSProperties = {
  ...dialogButtonStyle,
  borderColor: 'var(--red)',
  color: 'var(--red)',
  background: 'transparent',
};
