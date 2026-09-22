import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  buildOfficialWatchlistSourceLinkMeta,
  getOfficialWatchlistGroups,
  listOfficialWatchlistSources,
  loadOfficialWatchlistSource,
  type OfficialWatchlistMember,
  type OfficialWatchlistSourceId,
} from '@/features/watchlists/officialWatchlistProviders';
import {
  initialOfficialWatchlistSourceDataState,
  officialWatchlistDialogSourceReducer,
} from '@/features/watchlists/officialWatchlistDialogSourceState';
import { officialWatchlistSourceSignature } from '@/features/watchlists/officialWatchlistResolver';
import { useChartStore } from '@/store/chartStore';
import { useUiStore } from '@/store/uiStore';
import { useWindowStore } from '@/store/windowStore';
import { FloatingWindow } from '@/components/FloatingWindow';

export function OfficialWatchlistImportDialog() {
  const OFFICIAL_WATCHLIST_WINDOW_ID = 'official-watchlist-import';

  const dialogState = useUiStore((state) => state.officialWatchlistImportDialog);
  const closeDialog = useUiStore((state) => state.closeOfficialWatchlistImportDialog);
  const importOfficialWatchlists = useChartStore((state) => state.importOfficialWatchlists);

  const registerWindow = useWindowStore((state) => state.registerWindow);
  const openWindow = useWindowStore((state) => state.openWindow);
  const focusWindow = useWindowStore((state) => state.focusWindow);
  const closeWindow = useWindowStore((state) => state.closeWindow);

  const [activeSourceId, setActiveSourceId] = useState<OfficialWatchlistSourceId>('nse-sectors');
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [previewGroupId, setPreviewGroupId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [sourceDataState, dispatchSourceData] = useReducer(
    officialWatchlistDialogSourceReducer,
    initialOfficialWatchlistSourceDataState,
  );
  const requestSequenceRef = useRef(0);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const watchlists = useChartStore((state) => state.snapshot?.watchlists ?? []);
  const importedSignatures = useMemo(() => {
    const signatures = new Set<string>();
    watchlists.forEach((watchlist) => {
      const signature = officialWatchlistSourceSignature(watchlist.sourceMeta);
      if (signature) signatures.add(signature);
    });
    return signatures;
  }, [watchlists]);

  const sources = useMemo(() => listOfficialWatchlistSources(), []);

  useEffect(() => {
    registerWindow({
      id: OFFICIAL_WATCHLIST_WINDOW_ID,
      title: 'Import Watchlist Groups',
      bounds: { x: 100, y: 60, width: 1000, height: 700 },
      minWidth: 800,
      minHeight: 500,
    });
  }, [registerWindow]);

  useEffect(() => {
    if (dialogState.open) {
      openWindow(OFFICIAL_WATCHLIST_WINDOW_ID);
      focusWindow(OFFICIAL_WATCHLIST_WINDOW_ID);
    }
  }, [dialogState.open, openWindow, focusWindow]);

  useEffect(() => {
    if (dialogState.openRequestCount > 0) {
      openWindow(OFFICIAL_WATCHLIST_WINDOW_ID);
      focusWindow(OFFICIAL_WATCHLIST_WINDOW_ID);
    }
  }, [dialogState.openRequestCount, openWindow, focusWindow]);

  useEffect(() => {
    if (!dialogState.open) {
      dispatchSourceData({ type: 'reset' });
      return;
    }

    const nextSourceId = dialogState.sourceId ?? sources[0]?.id ?? 'nse-sectors';
    setActiveSourceId(nextSourceId);
    setSelectedGroupIds(new Set());
    setPreviewGroupId(null);
    setIsImporting(false);
    setError(null);
  }, [dialogState.open, dialogState.sourceId, sources]);

  const activeSource = useMemo(
    () => sources.find((source) => source.id === activeSourceId) ?? null,
    [activeSourceId, sources],
  );
  const catalogGroups = useMemo(
    () => (activeSource ? getOfficialWatchlistGroups(activeSource.id) : []),
    [activeSource],
  );

  useEffect(() => {
    if (!dialogState.open || !activeSource) return;
    const requestId = ++requestSequenceRef.current;
    setSelectedGroupIds(new Set());
    setPreviewGroupId(null);
    setError(null);
    dispatchSourceData({ type: 'request', requestId, sourceId: activeSource.id });
    void loadOfficialWatchlistSource(activeSource.id).then(
      (source) => {
        if (isMountedRef.current) {
          dispatchSourceData({ type: 'success', requestId, sourceId: activeSource.id, source });
        }
      },
      (nextError) => {
        if (isMountedRef.current) {
          dispatchSourceData({
            type: 'failure',
            requestId,
            sourceId: activeSource.id,
            error: nextError instanceof Error ? nextError.message : 'Could not load watchlist constituents.',
          });
        }
      },
    );
  }, [dialogState.open, activeSource, retryNonce]);

  const loadedGroups =
    sourceDataState.status === 'ready' && sourceDataState.sourceId === activeSource?.id
      ? sourceDataState.source.groups
      : [];

  useEffect(() => {
    if (sourceDataState.status !== 'ready' || sourceDataState.sourceId !== activeSource?.id) return;
    if (!sourceDataState.source.groups.length) {
      setPreviewGroupId(null);
      setSelectedGroupIds(new Set());
      return;
    }
    setPreviewGroupId((current) =>
      current && sourceDataState.source.groups.some((group) => group.id === current)
        ? current
        : sourceDataState.source.groups[0].id,
    );
  }, [sourceDataState, activeSource]);

  if (!activeSource) return null;

  const previewGroup =
    loadedGroups.find((group) => group.id === previewGroupId) ?? loadedGroups[0] ?? null;
  const sourceReady = sourceDataState.status === 'ready' && sourceDataState.sourceId === activeSource.id;

  const toggleGroupSelection = (groupId: string) => {
    if (!sourceReady) return;
    setSelectedGroupIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const handleClose = () => {
    if (isImporting) return;
    closeWindow(OFFICIAL_WATCHLIST_WINDOW_ID);
    closeDialog();
  };

  const handleImport = async () => {
    if (sourceDataState.status !== 'ready') {
      setError('Wait for constituents to finish loading.');
      return;
    }
    const groupIds = [...selectedGroupIds];
    if (!groupIds.length) {
      setError('Select at least one group to import.');
      return;
    }

    setError(null);
    setIsImporting(true);
    try {
      await importOfficialWatchlists(activeSource.id, groupIds);
    } catch (nextError) {
      if (isMountedRef.current) {
        setError(nextError instanceof Error ? nextError.message : 'Watchlist group import failed.');
      }
    } finally {
      if (isMountedRef.current) setIsImporting(false);
    }
  };

  return (
    <FloatingWindow id={OFFICIAL_WATCHLIST_WINDOW_ID} onClose={handleClose}>
      <div style={contentBodyStyle}>
        <div style={subtitleStyle}>
          Choose a source, preview constituents, and import one source-linked watchlist per selected group.
        </div>

        <div style={sourceTabsStyle}>
          {sources.map((source) => (
            <button
              key={source.id}
              type="button"
              style={sourceTabStyle(source.id === activeSource.id)}
              onClick={() => {
                setActiveSourceId(source.id);
                setSelectedGroupIds(new Set());
                setPreviewGroupId(null);
                setError(null);
              }}
              disabled={isImporting}
            >
              {source.label}
            </button>
          ))}
        </div>

        <div style={bodyShellStyle}>
          <div style={groupPaneStyle}>
            <div style={paneHeaderStyle}>
              <div style={paneTitleStyle}>{activeSource.label}</div>
              <div style={paneMetaStyle}>{catalogGroups.length} groups available</div>
            </div>
            <div style={groupListStyle}>
              {catalogGroups.map((group) => {
                const checked = selectedGroupIds.has(group.id);
                const previewing = previewGroup?.id === group.id;
                const sourceMetaTemplate = buildOfficialWatchlistSourceLinkMeta(activeSource.id, group, null);
                const groupSignature = officialWatchlistSourceSignature(sourceMetaTemplate);
                const isImported = groupSignature ? importedSignatures.has(groupSignature) : false;
                return (
                  <div
                    key={group.id}
                    style={groupRowStyle(previewing, checked)}
                    onClick={() => {
                      if (sourceReady) setPreviewGroupId(group.id);
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleGroupSelection(group.id)}
                      onClick={(event) => event.stopPropagation()}
                      style={checkboxStyle}
                      disabled={isImporting || !sourceReady}
                    />
                    <div style={groupTextShellStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={groupNameStyle}>{group.name}</div>
                        {isImported && <div style={importedBadgeStyle}>Imported</div>}
                      </div>
                      <div style={groupMetaStyle}>{group.memberCount} constituents</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={previewPaneStyle}>
            <div style={paneHeaderStyle}>
              <div style={paneTitleStyle}>{previewGroup?.name ?? 'Preview'}</div>
              <div style={paneMetaStyle}>
                {previewGroup ? `${previewGroup.members.length} constituents previewed` : 'Select a group'}
              </div>
            </div>
            {sourceDataState.status === 'loading' ? (
              <div style={emptyPreviewStyle}>Loading constituents…</div>
            ) : sourceDataState.status === 'error' ? (
              <div style={emptyPreviewStyle}>
                <div>{sourceDataState.error}</div>
                <button
                  type="button"
                  style={cancelButtonStyle}
                  onClick={() => {
                    setSelectedGroupIds(new Set());
                    setPreviewGroupId(null);
                    setRetryNonce((value) => value + 1);
                  }}
                  disabled={isImporting}
                >
                  Retry
                </button>
              </div>
            ) : previewGroup ? (
              <div style={previewListStyle}>
                {previewGroup.members.map((member, index) => (
                  <PreviewRow
                    key={`${previewGroup.id}-${member.isin ?? member.symbol ?? member.name ?? index}`}
                    member={member}
                  />
                ))}
              </div>
            ) : (
              <div style={emptyPreviewStyle}>Select a group on the left to preview its constituents.</div>
            )}
          </div>
        </div>

        <div style={footerStyle}>
          <div style={footerMetaStyle}>
            Importing creates or refreshes one source-linked watchlist per selected group.
          </div>
          <div style={footerActionsStyle}>
            {error ? <div style={errorStyle}>{error}</div> : null}
            <button type="button" style={cancelButtonStyle} onClick={handleClose} disabled={isImporting}>
              Cancel
            </button>
            <button
              type="button"
              style={importButtonStyle(selectedGroupIds.size > 0 && !isImporting && sourceReady)}
              onClick={() => void handleImport()}
              disabled={selectedGroupIds.size === 0 || isImporting || !sourceReady}
            >
              {isImporting
                ? 'Importing...'
                : `Import Selected${selectedGroupIds.size ? ` (${selectedGroupIds.size})` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </FloatingWindow>
  );
}

function PreviewRow({ member }: { member: OfficialWatchlistMember }) {
  return (
    <div style={previewRowStyle}>
      <div style={previewPrimaryStyle}>{member.symbol ?? member.name ?? '-'}</div>
      <div style={previewSecondaryShellStyle}>
        {member.symbol && member.name ? <span style={previewSecondaryStyle}>{member.name}</span> : null}
        {member.isin ? <span style={previewTagStyle}>{member.isin}</span> : null}
      </div>
    </div>
  );
}

const contentBodyStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
};

const subtitleStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 12,
  lineHeight: 1.45,
  padding: '12px 16px 8px',
};

const sourceTabsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  padding: '8px 16px 0',
  borderBottom: '1px solid var(--border)',
  backgroundColor: 'var(--bg3)',
};

function sourceTabStyle(active: boolean): React.CSSProperties {
  return {
    height: 34,
    padding: '0 14px',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border2)'}`,
    borderBottomColor: active ? 'var(--accent)' : 'var(--border2)',
    borderRadius: '6px 6px 0 0',
    backgroundColor: active ? 'var(--accent-soft)' : 'var(--bg2)',
    color: active ? 'var(--text)' : 'var(--text-dim)',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700,
  };
}

const bodyShellStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '340px minmax(0, 1fr)',
  gap: 0,
  minHeight: 0,
  flex: 1,
};

const groupPaneStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  borderRight: '1px solid var(--border)',
  backgroundColor: 'var(--bg2)',
};

const previewPaneStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  backgroundColor: 'var(--bg2)',
};

const paneHeaderStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
  padding: '14px 16px 12px',
  borderBottom: '1px solid var(--border)',
};

const paneTitleStyle: React.CSSProperties = {
  color: 'var(--text)',
  fontSize: 13,
  fontWeight: 700,
};

const paneMetaStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 11,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
};

const groupListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: 12,
  minHeight: 0,
  overflow: 'auto',
};

function groupRowStyle(previewing: boolean, checked: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '10px 12px',
    borderRadius: 7,
    border: previewing
      ? '1px solid var(--accent)'
      : checked
        ? '1px solid var(--accent)'
        : '1px solid var(--border)',
    backgroundColor: previewing
      ? 'var(--accent-soft)'
      : checked
        ? 'var(--accent-faint)'
        : 'var(--control-bg)',
    cursor: 'pointer',
  };
}

const checkboxStyle: React.CSSProperties = {
  width: 16,
  height: 16,
  marginTop: 2,
  cursor: 'pointer',
  flexShrink: 0,
};

const groupTextShellStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  minWidth: 0,
};

const groupNameStyle: React.CSSProperties = {
  color: 'var(--text)',
  fontSize: 13,
  fontWeight: 600,
};

const groupMetaStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 11,
};

const importedBadgeStyle: React.CSSProperties = {
  padding: '2px 6px',
  borderRadius: 4,
  backgroundColor: 'var(--accent-faint)',
  border: '1px solid var(--border)',
  color: 'var(--green)',
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.02em',
};

const previewListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 0,
  minHeight: 0,
  overflow: 'auto',
};

const previewRowStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: '10px 16px',
  borderBottom: '1px solid var(--border)',
};

const previewPrimaryStyle: React.CSSProperties = {
  color: 'var(--text)',
  fontSize: 13,
  fontWeight: 600,
};

const previewSecondaryShellStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  alignItems: 'center',
};

const previewSecondaryStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 11,
};

const previewTagStyle: React.CSSProperties = {
  padding: '2px 6px',
  borderRadius: 999,
  border: '1px solid var(--border)',
  color: 'var(--text-dim)',
  fontSize: 10,
  fontFamily: 'Consolas, monospace',
  backgroundColor: 'var(--control-bg)',
};

const emptyPreviewStyle: React.CSSProperties = {
  padding: 18,
  color: 'var(--text-dim)',
  fontSize: 12,
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '12px 18px',
  borderTop: '1px solid var(--border)',
  backgroundColor: 'var(--bg3)',
};

const footerMetaStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 11,
};

const footerActionsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 8,
  flexWrap: 'wrap',
};

const errorStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 5,
  border: '1px solid var(--red)',
  backgroundColor: 'var(--control-bg)',
  color: 'var(--red)',
  fontSize: 12,
};

const cancelButtonStyle: React.CSSProperties = {
  height: 32,
  minWidth: 72,
  padding: '0 14px',
  border: '1px solid var(--border2)',
  borderRadius: 5,
  backgroundColor: 'var(--control-bg)',
  color: 'var(--text)',
  cursor: 'pointer',
};

function importButtonStyle(enabled: boolean): React.CSSProperties {
  return {
    height: 32,
    minWidth: 140,
    padding: '0 14px',
    border: '1px solid var(--accent)',
    borderRadius: 5,
    backgroundColor: enabled ? 'var(--accent-soft)' : 'var(--control-bg)',
    color: enabled ? 'var(--text)' : 'var(--text-dim)',
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontWeight: 700,
    opacity: enabled ? 1 : 0.68,
  };
}
