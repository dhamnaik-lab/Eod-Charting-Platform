import { useEffect, useMemo, useState } from 'react';
import { FloatingWindow } from '@/components/FloatingWindow';
import { getDesktopApi } from '@/platform';
import type { KnownDatabase } from '@/types/desktop';
import { useChartStore } from '@/store/chartStore';
import { useUiStore } from '@/store/uiStore';
import { useWindowStore } from '@/store/windowStore';

const RECENT_DATABASES_WINDOW_ID = 'recent-databases-dialog';

interface RecentDatabasesDialogProps {
  onClose: () => void;
}

export function RecentDatabasesDialog({ onClose }: RecentDatabasesDialogProps) {
  const isOpen = useUiStore((state) => state.recentDatabasesDialogOpen);
  const openRequestCount = useUiStore((state) => state.recentDatabasesOpenRequestCount);
  const snapshot = useChartStore((state) => state.snapshot);
  const activateDatabasePath = useChartStore((state) => state.activateDatabasePath);
  const isDatabaseTransitioning = useChartStore((state) => state.isDatabaseTransitioning);

  const registerWindow = useWindowStore((state) => state.registerWindow);
  const openWindow = useWindowStore((state) => state.openWindow);
  const focusWindow = useWindowStore((state) => state.focusWindow);
  const closeWindow = useWindowStore((state) => state.closeWindow);

  const [removingPath, setRemovingPath] = useState<string | null>(null);

  useEffect(() => {
    registerWindow({
      id: RECENT_DATABASES_WINDOW_ID,
      title: 'Recent Databases',
      bounds: {
        x: 200,
        y: 120,
        width: 760,
        height: 560,
      },
      minWidth: 600,
      minHeight: 360,
    });
  }, [registerWindow]);

  useEffect(() => {
    if (isOpen) {
      openWindow(RECENT_DATABASES_WINDOW_ID);
      focusWindow(RECENT_DATABASES_WINDOW_ID);
    } else {
      closeWindow(RECENT_DATABASES_WINDOW_ID);
    }
  }, [isOpen, openRequestCount, openWindow, focusWindow, closeWindow]);

  const knownDatabases = snapshot?.knownDatabases ?? [];
  const activeDatabasePath = snapshot?.activeDatabasePath ?? null;
  const api = getDesktopApi();

  const rows = useMemo(
    () =>
      knownDatabases.map((database) => ({
        ...database,
        isActive: database.path === activeDatabasePath,
        lastOpenedLabel: formatRecentTimestamp(database.lastOpenedAt),
      })),
    [knownDatabases, activeDatabasePath],
  );

  const handleOpen = async (database: KnownDatabase) => {
    if (database.path === activeDatabasePath || isDatabaseTransitioning) {
      onClose();
      return;
    }

    await activateDatabasePath(database.path);
    onClose();
  };

  const handleRemove = async (database: KnownDatabase) => {
    if (!api || removingPath || isDatabaseTransitioning) {
      return;
    }

    setRemovingPath(database.path);
    try {
      await api.removeRecentDatabase(database.path);
    } finally {
      setRemovingPath(null);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <FloatingWindow id={RECENT_DATABASES_WINDOW_ID} onClose={onClose}>
      <div style={contentStyle} className="tab-strip-scroll">
        <div style={introCardStyle}>
          <div style={introTitleStyle}>Recent Databases</div>
          <div style={introBodyStyle}>
            Reopen a previously used database without browsing for the folder again.
          </div>
        </div>

        {rows.length === 0 ? (
          <div style={emptyStateStyle}>
            No recent databases yet. Open or create a database once and it will appear here.
          </div>
        ) : (
          <div style={listStyle}>
            {rows.map((database) => (
              <div key={database.path} style={rowStyle}>
                <div style={rowInfoStyle}>
                  <div style={rowTitleLineStyle}>
                    <div style={rowTitleStyle}>{database.label}</div>
                    {database.isActive ? <span style={activeBadgeStyle}>Active</span> : null}
                  </div>
                  <div style={rowMetaStyle}>Last opened: {database.lastOpenedLabel}</div>
                  <div style={rowPathStyle}>{database.path}</div>
                </div>
                <div style={rowActionsStyle}>
                  <button
                    type="button"
                    style={database.isActive ? mutedButtonStyle : primaryButtonStyle}
                    onClick={() => void handleOpen(database)}
                    disabled={
                      database.isActive || isDatabaseTransitioning || removingPath === database.path
                    }
                  >
                    {database.isActive ? 'Current' : 'Open'}
                  </button>
                  <button
                    type="button"
                    style={secondaryButtonStyle}
                    onClick={() => void handleRemove(database)}
                    disabled={!api || Boolean(removingPath) || isDatabaseTransitioning}
                  >
                    {removingPath === database.path ? 'Removing...' : 'Remove'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={footerStyle}>
        <button type="button" onClick={onClose} style={footerButtonStyle}>
          Close
        </button>
      </div>
    </FloatingWindow>
  );
}

function formatRecentTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

const contentStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: 18,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const introCardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 16,
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg2)',
};

const introTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: 'var(--text)',
};

const introBodyStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text-dim)',
  lineHeight: 1.5,
};

const emptyStateStyle: React.CSSProperties = {
  padding: 24,
  borderRadius: 8,
  border: '1px dashed var(--border)',
  color: 'var(--text-dim)',
  textAlign: 'center',
  background: 'var(--bg2)',
};

const listStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 16,
  padding: 16,
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg2)',
};

const rowInfoStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const rowTitleLineStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
};

const rowTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: 'var(--text)',
};

const activeBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 8px',
  borderRadius: 999,
  border: '1px solid var(--accent)',
  color: 'var(--accent)',
  fontSize: 11,
  fontWeight: 600,
};

const rowMetaStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-dim)',
};

const rowPathStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-muted)',
  wordBreak: 'break-all',
};

const rowActionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  flexShrink: 0,
};

const baseButtonStyle: React.CSSProperties = {
  minWidth: 88,
  height: 34,
  padding: '0 14px',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const primaryButtonStyle: React.CSSProperties = {
  ...baseButtonStyle,
  border: '1px solid var(--accent)',
  background: 'var(--accent)',
  color: 'white',
};

const mutedButtonStyle: React.CSSProperties = {
  ...baseButtonStyle,
  border: '1px solid var(--border)',
  background: 'var(--control-bg)',
  color: 'var(--text-dim)',
};

const secondaryButtonStyle: React.CSSProperties = {
  ...baseButtonStyle,
  border: '1px solid var(--border)',
  background: 'var(--bg3)',
  color: 'var(--text)',
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  padding: 16,
  borderTop: '1px solid var(--border)',
  background: 'var(--bg2)',
};

const footerButtonStyle: React.CSSProperties = {
  minWidth: 92,
  height: 34,
  padding: '0 14px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--bg3)',
  color: 'var(--text)',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};
