import { useState, useEffect } from 'react';
import { getDesktopApi } from '@/platform';
import { serializeWorkspaceState } from '@/features/workspace/workspacePersistence';
import { useChartStore } from '@/store/chartStore';

interface SavedLayout {
  name: string;
  timestamp: string;
}

interface LayoutManagerDialogProps {
  onClose: () => void;
}

export function LayoutManagerDialog({ onClose }: LayoutManagerDialogProps) {
  const api = getDesktopApi();
  const chartTabs = useChartStore((state) => state.chartTabs);
  const activeChartTabId = useChartStore((state) => state.activeChartTabId);
  const loadWorkspaceFromLayout = useChartStore((state) => state.loadWorkspaceFromLayout);
  const [layouts, setLayouts] = useState<SavedLayout[]>([]);
  const [newLayoutName, setNewLayoutName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [layoutPendingDelete, setLayoutPendingDelete] = useState<SavedLayout | null>(null);

  const loadLayouts = async () => {
    if (!api) return;
    try {
      const savedLayouts = await api.getSavedLayouts();
      setLayouts(savedLayouts);
    } catch (err) {
      console.error('Failed to load layouts:', err);
    }
  };

  useEffect(() => {
    void loadLayouts();
  }, []);

  const handleSaveLayout = async () => {
    if (!api || !newLayoutName.trim()) return;
    setIsLoading(true);
    try {
      const layoutData = JSON.stringify(serializeWorkspaceState({ chartTabs, activeChartTabId }));
      await api.saveLayout(newLayoutName.trim(), layoutData);
      setNewLayoutName('');
      void loadLayouts();
    } catch (err) {
      console.error('Failed to save layout:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadLayout = async (name: string) => {
    if (!api) return;
    setIsLoading(true);
    try {
      const layoutData = await api.loadLayout(name);
      if (layoutData) {
        loadWorkspaceFromLayout(layoutData);
      }
      onClose();
    } catch (err) {
      console.error('Failed to load layout:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteLayout = async (name: string) => {
    const layout = layouts.find((item) => item.name === name);
    if (!layout) return;
    setLayoutPendingDelete(layout);
  };

  const handleConfirmDeleteLayout = async () => {
    if (!api || !layoutPendingDelete) return;
    try {
      await api.deleteLayout(layoutPendingDelete.name);
      setLayoutPendingDelete(null);
      void loadLayouts();
    } catch (err) {
      console.error('Failed to delete layout:', err);
    }
  };

  return (
    <div style={overlayStyle} onMouseDown={onClose}>
      <div style={windowStyle} onMouseDown={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>Chart Layouts</h2>
          <button style={closeButtonStyle} onClick={onClose}>×</button>
        </div>

        <div style={contentStyle}>
          <div style={saveSectionStyle}>
            <h3 style={sectionTitleStyle}>Save Current Layout</h3>
            <div style={saveFormStyle}>
              <input
                type="text"
                value={newLayoutName}
                onChange={(e) => setNewLayoutName(e.target.value)}
                placeholder="Layout name..."
                style={inputStyle}
                onKeyDown={(e) => e.key === 'Enter' && void handleSaveLayout()}
              />
              <button
                style={saveButtonStyle}
                onClick={() => void handleSaveLayout()}
                disabled={!newLayoutName.trim() || isLoading}
              >
                Save
              </button>
            </div>
          </div>

          <div style={dividerStyle} />

          <div style={listSectionStyle}>
            <h3 style={sectionTitleStyle}>Saved Layouts</h3>
            {layouts.length === 0 ? (
              <div style={emptyStyle}>No saved layouts yet.</div>
            ) : (
              <div style={listStyle}>
                {layouts.map((layout) => (
                  <div key={layout.name} style={layoutItemStyle}>
                    <div style={layoutInfoStyle}>
                      <span style={layoutNameStyle}>{layout.name}</span>
                      <span style={layoutDateStyle}>{new Date(layout.timestamp).toLocaleString()}</span>
                    </div>
                    <div style={layoutActionsStyle}>
                      <button
                        style={loadButtonStyle}
                        onClick={() => void handleLoadLayout(layout.name)}
                        disabled={isLoading}
                      >
                        Load
                      </button>
                      <button
                        style={deleteButtonStyle}
                        onClick={() => void handleDeleteLayout(layout.name)}
                        disabled={isLoading}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {layoutPendingDelete ? (
        <div style={confirmBackdropStyle} onMouseDown={() => setLayoutPendingDelete(null)}>
          <div style={confirmDialogStyle} onMouseDown={(event) => event.stopPropagation()}>
            <div style={confirmTitleStyle}>Delete Layout</div>
            <div style={confirmBodyStyle}>
              Delete <strong>{layoutPendingDelete.name}</strong>? This removes the saved layout entry only.
            </div>
            <div style={confirmActionsStyle}>
              <button type="button" style={confirmCancelButtonStyle} onClick={() => setLayoutPendingDelete(null)}>
                Cancel
              </button>
              <button type="button" style={confirmDeleteButtonStyle} onClick={() => void handleConfirmDeleteLayout()}>
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'var(--overlay-bg)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const windowStyle: React.CSSProperties = {
  width: 480,
  maxHeight: '80vh',
  backgroundColor: 'var(--bg2)',
  borderRadius: 8,
  border: '1px solid var(--border)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  borderBottom: '1px solid var(--border)',
  backgroundColor: 'var(--bg3)',
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 600,
  color: 'var(--text)',
};

const closeButtonStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  border: 'none',
  borderRadius: 4,
  backgroundColor: 'transparent',
  color: 'var(--text-dim)',
  fontSize: 20,
  cursor: 'pointer',
};

const contentStyle: React.CSSProperties = {
  padding: 16,
  overflow: 'auto',
};

const saveSectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text)',
};

const saveFormStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  height: 36,
  padding: '0 12px',
  border: '1px solid var(--border2)',
  borderRadius: 4,
  backgroundColor: 'var(--control-bg)',
  color: 'var(--text)',
  fontSize: 13,
};

const saveButtonStyle: React.CSSProperties = {
  height: 36,
  padding: '0 16px',
  border: '1px solid var(--accent)',
  borderRadius: 4,
  backgroundColor: 'var(--accent)',
  color: 'var(--text)',
  fontSize: 13,
  cursor: 'pointer',
};

const dividerStyle: React.CSSProperties = {
  height: 1,
  backgroundColor: 'var(--border)',
  margin: '16px 0',
};

const listSectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const emptyStyle: React.CSSProperties = {
  padding: '20px 0',
  textAlign: 'center',
  color: 'var(--text-dim)',
  fontSize: 13,
};

const listStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const layoutItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 12px',
  backgroundColor: 'var(--control-bg)',
  borderRadius: 4,
  border: '1px solid var(--border)',
};

const layoutInfoStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const layoutNameStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  color: 'var(--text)',
};

const layoutDateStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-dim)',
};

const layoutActionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 6,
};

const loadButtonStyle: React.CSSProperties = {
  height: 28,
  padding: '0 12px',
  border: '1px solid var(--border2)',
  borderRadius: 4,
  backgroundColor: 'var(--control-bg)',
  color: 'var(--text)',
  fontSize: 12,
  cursor: 'pointer',
};

const deleteButtonStyle: React.CSSProperties = {
  height: 28,
  padding: '0 12px',
  border: '1px solid var(--red)',
  borderRadius: 4,
  backgroundColor: 'transparent',
  color: 'var(--red-text)',
  fontSize: 12,
  cursor: 'pointer',
};

const confirmBackdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'var(--overlay-bg)',
  zIndex: 1100,
};

const confirmDialogStyle: React.CSSProperties = {
  width: 360,
  maxWidth: 'calc(100vw - 32px)',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  padding: 18,
  borderRadius: 10,
  border: '1px solid var(--border)',
  backgroundColor: 'var(--bg2)',
  boxShadow: 'var(--shadow-lg)',
};

const confirmTitleStyle: React.CSSProperties = {
  color: 'var(--text)',
  fontSize: 16,
  fontWeight: 700,
};

const confirmBodyStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 12,
  lineHeight: 1.5,
};

const confirmActionsStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 10,
};

const confirmCancelButtonStyle: React.CSSProperties = {
  minWidth: 88,
  height: 34,
  border: '1px solid var(--border)',
  borderRadius: 6,
  backgroundColor: 'var(--control-bg)',
  color: 'var(--text)',
  cursor: 'pointer',
};

const confirmDeleteButtonStyle: React.CSSProperties = {
  minWidth: 88,
  height: 34,
  border: '1px solid var(--red)',
  borderRadius: 6,
  backgroundColor: 'var(--control-bg)',
  color: 'var(--red-text)',
  cursor: 'pointer',
};
