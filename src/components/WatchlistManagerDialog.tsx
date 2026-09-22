import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';

import { findSelectedWatchlist } from '@/features/watchlists/watchlistNavigationService';
import { useChartStore } from '@/store/chartStore';

/** Short timezone label appended to sync timestamps, e.g. " IST". Empty string if unavailable. */
const LOCAL_TZ_LABEL = (() => {
  try {
    const abbr =
      Intl.DateTimeFormat('en', { timeZoneName: 'short' })
        .formatToParts(new Date())
        .find((p) => p.type === 'timeZoneName')?.value ?? '';
    return abbr ? ` ${abbr}` : '';
  } catch {
    return '';
  }
})();

function formatSyncDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    return format(parseISO(raw), 'dd MMM yyyy, HH:mm') + LOCAL_TZ_LABEL;
  } catch {
    return null;
  }
}
import { WatchlistConfirmDialog, WatchlistNameDialog } from '@/components/WatchlistDialogs';
import { FloatingWindow } from './FloatingWindow';
import { useWindowStore } from '@/store/windowStore';
import { useUiStore } from '@/store/uiStore';

export const WATCHLIST_MANAGER_WINDOW_ID = 'watchlist-manager';

interface WatchlistManagerDialogProps {
  onClose: () => void;
}

export function WatchlistManagerDialog({ onClose }: WatchlistManagerDialogProps) {
  const registerWindow = useWindowStore((state) => state.registerWindow);
  const openWindow = useWindowStore((state) => state.openWindow);
  const focusWindow = useWindowStore((state) => state.focusWindow);
  const openRequestCount = useUiStore((state) => state.watchlistManagerOpenRequestCount);
  const closeWatchlistManager = useUiStore((state) => state.closeWatchlistManagerDialog);
  const snapshot = useChartStore((state) => state.snapshot);
  const selectedWatchlistId = useChartStore((state) => state.selectedWatchlistId);
  const selectWatchlist = useChartStore((state) => state.selectWatchlist);
  const createWatchlist = useChartStore((state) => state.createWatchlist);
  const renameWatchlist = useChartStore((state) => state.renameWatchlist);
  const deleteWatchlist = useChartStore((state) => state.deleteWatchlist);
  const addToast = useChartStore((state) => state.addToast);
  const [watchlistDialog, setWatchlistDialog] = useState<WatchlistDialogState | null>(null);

  const updateAllOfficialWatchlists = useChartStore((state) => state.updateAllOfficialWatchlists);
  const [isUpdatingAll, setIsUpdatingAll] = useState(false);

  useEffect(() => {
    registerWindow({
      id: WATCHLIST_MANAGER_WINDOW_ID,
      title: 'Manage Watchlists',
      bounds: {
        x: 200,
        y: 100,
        width: 780,
        height: 580,
      },
      minWidth: 620,
      minHeight: 400,
    });
  }, [registerWindow]);

  useEffect(() => {
    if (openRequestCount > 0) {
      openWindow(WATCHLIST_MANAGER_WINDOW_ID);
      focusWindow(WATCHLIST_MANAGER_WINDOW_ID);
    }
  }, [openRequestCount, openWindow, focusWindow]);

  const handleClose = () => {
    closeWatchlistManager();
    onClose();
  };

  const watchlists = snapshot?.watchlists ?? [];
  const selectedWatchlist = findSelectedWatchlist(watchlists, selectedWatchlistId);
  const hasActiveDatabase = Boolean(snapshot?.activeDatabasePath);
  const linkedWatchlistCount = watchlists.filter(
    (w) => w.sourceMeta?.sourceType === 'official',
  ).length;

  const handleCreate = async () => {
    setWatchlistDialog({
      mode: 'create',
      value: `Watchlist ${watchlists.length + 1}`,
    });
  };

  const handleRename = async () => {
    if (!selectedWatchlist) {
      return;
    }

    setWatchlistDialog({
      mode: 'rename',
      watchlistId: selectedWatchlist.id,
      value: selectedWatchlist.name,
    });
  };

  const handleConfirmNameDialog = async () => {
    if (!watchlistDialog || (watchlistDialog.mode !== 'create' && watchlistDialog.mode !== 'rename')) {
      return;
    }

    const nextName = watchlistDialog.value.trim();
    if (!nextName) {
      return;
    }

    try {
      if (watchlistDialog.mode === 'create') {
        await createWatchlist(nextName);
        addToast(`Created ${nextName}.`, 'success', 'Watchlists');
      } else {
        await renameWatchlist(watchlistDialog.watchlistId, nextName);
        addToast(`Renamed to ${nextName}.`, 'success', 'Watchlists');
      }
      setWatchlistDialog(null);
    } catch (error) {
      addToast(
        error instanceof Error
          ? error.message
          : watchlistDialog.mode === 'create'
            ? 'Watchlist creation failed.'
            : 'Watchlist rename failed.',
        'warning',
        'Watchlists',
      );
    }
  };

  const handleDelete = async () => {
    if (!selectedWatchlist) {
      return;
    }

    setWatchlistDialog({
      mode: 'delete',
      watchlistId: selectedWatchlist.id,
      watchlistName: selectedWatchlist.name,
    });
  };

  const handleConfirmDelete = async () => {
    if (!watchlistDialog || watchlistDialog.mode !== 'delete') {
      return;
    }

    try {
      await deleteWatchlist(watchlistDialog.watchlistId);
      addToast(`Deleted ${watchlistDialog.watchlistName}.`, 'success', 'Watchlists');
      setWatchlistDialog(null);
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Watchlist deletion failed.', 'warning', 'Watchlists');
    }
  };

  const handleUpdateAll = async () => {
    setIsUpdatingAll(true);
    try {
      await updateAllOfficialWatchlists();
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : 'Update All failed.',
        'warning',
        'Update All Imported Watchlists',
      );
    } finally {
      setIsUpdatingAll(false);
    }
  };

  return (
    <>
      <FloatingWindow id={WATCHLIST_MANAGER_WINDOW_ID} onClose={handleClose}>
        <div style={shellStyle}>
          <div style={toolbarStyle}>
            <button
              type="button"
              style={primaryButtonStyle(hasActiveDatabase)}
              onClick={() => void handleCreate()}
              disabled={!hasActiveDatabase}
            >
              New
            </button>
            <button
              type="button"
              style={secondaryButtonStyle(hasActiveDatabase && Boolean(selectedWatchlist))}
              onClick={() => void handleRename()}
              disabled={!hasActiveDatabase || !selectedWatchlist}
            >
              Rename
            </button>
            <button
              type="button"
              style={dangerButtonStyle(hasActiveDatabase && Boolean(selectedWatchlist))}
              onClick={() => void handleDelete()}
              disabled={!hasActiveDatabase || !selectedWatchlist}
            >
              Delete
            </button>
            <button
              type="button"
              style={updateAllButtonStyle(
                hasActiveDatabase && linkedWatchlistCount > 0 && !isUpdatingAll,
              )}
              onClick={() => void handleUpdateAll()}
              disabled={!hasActiveDatabase || linkedWatchlistCount === 0 || isUpdatingAll}
              title={
                linkedWatchlistCount > 0
                  ? `Update all ${linkedWatchlistCount} imported watchlist${linkedWatchlistCount !== 1 ? 's' : ''} from their linked sources`
                  : 'No imported watchlists to update'
              }
            >
              {isUpdatingAll ? 'Updating...' : 'Update All'}
            </button>
            <div style={toolbarMetaStyle}>
              {hasActiveDatabase
                ? `${watchlists.length} watchlist${watchlists.length !== 1 ? 's' : ''}${linkedWatchlistCount ? ` | ${linkedWatchlistCount} linked` : ''}`
                : 'Open a database to manage watchlists.'}
            </div>
          </div>

          <div style={listShellStyle}>
            {watchlists.length ? (
              watchlists.map((watchlist) => {
                const selected = watchlist.id === selectedWatchlistId;
                const isLinked = watchlist.sourceMeta?.sourceType === 'official';
                const syncedDisplay = isLinked
                  ? formatSyncDate(watchlist.sourceMeta?.lastSyncedAt)
                  : null;
                return (
                  <button
                    key={watchlist.id}
                    type="button"
                    style={watchlistRowStyle(selected)}
                    onClick={() => selectWatchlist(watchlist.id)}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                      <div style={watchlistNameStyle}>{watchlist.name}</div>
                      <div style={watchlistMetaStyle}>
                        {watchlist.items.length} symbols
                        {isLinked
                          ? ` | Source linked | ${watchlist.sourceMeta?.sourceDisplayName ?? watchlist.name}`
                          : ' | Manual'}
                      </div>
                      {syncedDisplay && (
                        <div
                          style={watchlistSyncedStyle}
                          title={watchlist.sourceMeta?.lastSyncedAt ?? undefined}
                        >
                          Last synced: {syncedDisplay}
                        </div>
                      )}
                    </div>
                    <div style={watchlistBadgeStyle(isLinked)}>
                      {isLinked ? 'Linked' : 'Manual'}
                    </div>
                  </button>
                );
              })
            ) : (
              <div style={emptyStateStyle}>
                {hasActiveDatabase
                  ? 'No watchlists are available yet.'
                  : 'Open a database before managing watchlists.'}
              </div>
            )}
          </div>

          <div style={footerStyle}>
            <div style={footerHintStyle}>
              The selected watchlist stays active in the sidebar and chart workflow.
            </div>
            <button type="button" style={footerButtonStyle} onClick={handleClose}>
              Close
            </button>
          </div>
        </div>
      </FloatingWindow>
      {watchlistDialog?.mode === 'delete' ? (
        <WatchlistConfirmDialog
          title="Delete Watchlist"
          message={
            <>
              Delete <strong>{watchlistDialog.watchlistName}</strong>? This removes the watchlist and its saved symbol
              list from the current database.
            </>
          }
          confirmLabel="Delete"
          onConfirm={() => void handleConfirmDelete()}
          onCancel={() => setWatchlistDialog(null)}
        />
      ) : null}
      {watchlistDialog && (watchlistDialog.mode === 'create' || watchlistDialog.mode === 'rename') ? (
        <WatchlistNameDialog
          title={watchlistDialog.mode === 'create' ? 'New Watchlist' : 'Rename Watchlist'}
          label={watchlistDialog.mode === 'create' ? 'Watchlist name' : 'Rename watchlist'}
          value={watchlistDialog.value}
          confirmLabel={watchlistDialog.mode === 'create' ? 'Create' : 'Save'}
          onChange={(value) =>
            setWatchlistDialog((current) =>
              current && current.mode !== 'delete'
                ? {
                    ...current,
                    value,
                  }
                : current,
            )
          }
          onConfirm={() => void handleConfirmNameDialog()}
          onCancel={() => setWatchlistDialog(null)}
        />
      ) : null}
    </>
  );
}

type WatchlistDialogState =
  | {
      mode: 'create';
      value: string;
    }
  | {
      mode: 'rename';
      watchlistId: number;
      value: string;
    }
  | {
      mode: 'delete';
      watchlistId: number;
      watchlistName: string;
    };

const shellStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: 16,
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
};

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
};

function primaryButtonStyle(enabled: boolean): React.CSSProperties {
  return {
    height: 34,
    padding: '0 14px',
    borderRadius: 5,
    border: '1px solid var(--accent)',
    backgroundColor: enabled ? 'var(--accent-soft)' : 'var(--bg2)',
    color: enabled ? 'var(--text)' : 'var(--text-dim)',
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontSize: 13,
    fontWeight: 600,
  };
}

function secondaryButtonStyle(enabled: boolean): React.CSSProperties {
  return {
    height: 34,
    padding: '0 14px',
    borderRadius: 5,
    border: '1px solid var(--border2)',
    backgroundColor: enabled ? 'var(--control-bg)' : 'var(--bg2)',
    color: enabled ? 'var(--text)' : 'var(--text-dim)',
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontSize: 13,
    fontWeight: 600,
  };
}

function updateAllButtonStyle(enabled: boolean): React.CSSProperties {
  return {
    height: 34,
    padding: '0 14px',
    borderRadius: 5,
    border: `1px solid ${enabled ? 'var(--accent)' : 'var(--border2)'}`,
    backgroundColor: enabled ? 'var(--accent-soft)' : 'var(--bg2)',
    color: enabled ? 'var(--text)' : 'var(--text-dim)',
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontSize: 13,
    fontWeight: 600,
  };
}

function dangerButtonStyle(enabled: boolean): React.CSSProperties {
  return {
    height: 34,
    padding: '0 14px',
    borderRadius: 5,
    border: '1px solid var(--red)',
    backgroundColor: enabled ? 'var(--control-bg)' : 'var(--bg2)',
    color: enabled ? 'var(--red)' : 'var(--text-dim)',
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontSize: 13,
    fontWeight: 600,
  };
}

const toolbarMetaStyle: React.CSSProperties = {
  marginLeft: 'auto',
  color: 'var(--text-dim)',
  fontSize: 12,
};

const listShellStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  paddingRight: 4,
};

function watchlistRowStyle(selected: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '12px 14px',
    borderRadius: 7,
    border: selected ? '1px solid var(--accent)' : '1px solid var(--border)',
    backgroundColor: selected ? 'var(--accent-soft)' : 'var(--bg2)',
    cursor: 'pointer',
    textAlign: 'left',
  };
}

const watchlistNameStyle: React.CSSProperties = {
  color: 'var(--text)',
  fontSize: 13,
  fontWeight: 600,
};

const watchlistMetaStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 11,
  lineHeight: 1.45,
};

const watchlistSyncedStyle: React.CSSProperties = {
  color: 'var(--text-mute)',
  fontSize: 10,
  lineHeight: 1.3,
};

function watchlistBadgeStyle(official: boolean): React.CSSProperties {
  return {
    alignSelf: 'flex-start',
    padding: '4px 8px',
    borderRadius: 999,
    border: official ? '1px solid var(--accent)' : '1px solid var(--border)',
    backgroundColor: official ? 'var(--accent-soft)' : 'var(--control-bg)',
    color: official ? 'var(--text)' : 'var(--text-dim)',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  };
}

const emptyStateStyle: React.CSSProperties = {
  padding: '18px 14px',
  borderRadius: 7,
  border: '1px dashed var(--border2)',
  color: 'var(--text-dim)',
  fontSize: 12,
  backgroundColor: 'var(--bg3)',
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '12px 16px',
  borderTop: '1px solid var(--border)',
  backgroundColor: 'var(--bg3)',
};

const footerHintStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 11,
};

const footerButtonStyle: React.CSSProperties = {
  height: 34,
  padding: '0 16px',
  borderRadius: 5,
  border: '1px solid var(--border2)',
  backgroundColor: 'transparent',
  color: 'var(--text)',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
};
