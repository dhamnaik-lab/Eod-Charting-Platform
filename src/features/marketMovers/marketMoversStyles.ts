import type { CSSProperties } from 'react';

export const marketMoversStyles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    backgroundColor: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '12px',
    boxSizing: 'border-box',
    overflow: 'hidden',
  },

  headerBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderBottom: '1px solid var(--border)',
    backgroundColor: 'var(--bg2)',
    flexShrink: 0,
    gap: '8px',
  },

  titleArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: 600,
    fontSize: '13px',
    color: 'var(--text)',
  },

  actionButtons: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },

  iconButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px 6px',
    backgroundColor: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    color: 'var(--text-dim)',
    cursor: 'pointer',
    fontSize: '11px',
    lineHeight: 1,
    transition: 'background-color 0.15s ease, color 0.15s ease',
  },

  tabRow: {
    display: 'flex',
    alignItems: 'center',
    borderBottom: '1px solid var(--border)',
    backgroundColor: 'var(--bg2)',
    padding: '0 8px',
    flexShrink: 0,
    gap: '2px',
  },

  tabButton: {
    padding: '6px 10px',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: 'var(--text-dim)',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 500,
    transition: 'all 0.15s ease',
  },

  activeTabButton: {
    color: 'var(--accent-text)',
    borderBottomColor: 'var(--accent)',
    fontWeight: 600,
  },

  subToolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 12px',
    borderBottom: '1px solid var(--border)',
    backgroundColor: 'var(--bg3)',
    fontSize: '11px',
    color: 'var(--text-mute)',
    flexShrink: 0,
    gap: '8px',
  },

  selectInput: {
    backgroundColor: 'var(--bg)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: '3px',
    padding: '2px 6px',
    fontSize: '11px',
    outline: 'none',
    cursor: 'pointer',
  },

  numberInput: {
    backgroundColor: 'var(--bg)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: '3px',
    padding: '2px 6px',
    fontSize: '11px',
    width: '60px',
    outline: 'none',
  },

  listArea: {
    flex: 1,
    minWidth: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
    position: 'relative',
  },

  row: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 72px 64px',
    alignItems: 'center',
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    padding: '6px 8px 6px 12px',
    borderBottom: '1px solid var(--border2)',
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'background-color 0.1s ease',
  },

  rowHovered: {
    backgroundColor: 'var(--bg3)',
  },

  rowSelected: {
    backgroundColor: 'var(--accent-soft)',
  },

  symbolCol: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    overflow: 'hidden',
  },

  symbolText: {
    fontWeight: 600,
    color: 'var(--text)',
    fontSize: '12px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  exchangeText: {
    fontSize: '10px',
    color: 'var(--text-mute)',
  },

  priceCol: {
    textAlign: 'right',
    fontWeight: 500,
    color: 'var(--text)',
    whiteSpace: 'nowrap',
  },

  changeCol: {
    textAlign: 'right',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },

  greenText: {
    color: 'var(--green-text)',
  },

  redText: {
    color: 'var(--red-text)',
  },

  volumeCol: {
    textAlign: 'right',
    color: 'var(--text-dim)',
    fontSize: '11px',
  },

  badge: {
    display: 'inline-block',
    padding: '1px 4px',
    borderRadius: '3px',
    fontSize: '9px',
    fontWeight: 600,
    lineHeight: 1.2,
    marginLeft: '4px',
  },

  warningBadge: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    color: 'var(--warning, #eab308)',
    border: '1px solid rgba(234, 179, 8, 0.3)',
  },

  statusBanner: {
    padding: '8px 12px',
    fontSize: '11px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },

  warningBanner: {
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
    color: 'var(--text)',
    borderLeft: '3px solid var(--warning, #eab308)',
  },

  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    color: 'var(--red-text)',
    borderLeft: '3px solid var(--red)',
  },

  emptyState: {
    padding: '24px 16px',
    textAlign: 'center',
    color: 'var(--text-mute)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },

  footer: {
    padding: '6px 10px',
    borderTop: '1px solid var(--border)',
    backgroundColor: 'var(--bg2)',
    fontSize: '10px',
    lineHeight: 1.35,
    color: 'var(--text-mute)',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    rowGap: '2px',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },

  popover: {
    position: 'fixed',
    zIndex: 100,
    backgroundColor: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    boxShadow: 'var(--shadow-lg)',
    padding: '12px',
    width: '240px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },

  fullViewHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    backgroundColor: 'var(--bg2)',
    borderBottom: '1px solid var(--border)',
    gap: '12px',
  },

  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '12px',
    textAlign: 'left',
  },

  th: {
    padding: '8px 12px',
    backgroundColor: 'var(--bg2)',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-dim)',
    fontWeight: 600,
    fontSize: '11px',
    userSelect: 'none',
    position: 'sticky',
    top: 0,
    zIndex: 2,
  },

  td: {
    padding: '8px 12px',
    borderBottom: '1px solid var(--border2)',
  },

  primaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '5px 9px',
    backgroundColor: 'var(--accent)',
    border: '1px solid var(--accent-strong)',
    borderRadius: '4px',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: '11px',
  },

  filterLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    color: 'var(--text-dim)',
    fontSize: '10px',
  },

  contextMenu: {
    position: 'fixed',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    minWidth: '170px',
    padding: '4px',
    border: '1px solid var(--border)',
    borderRadius: '5px',
    backgroundColor: 'var(--bg2)',
    boxShadow: 'var(--shadow-lg)',
  },

  contextMenuButton: {
    padding: '6px 8px',
    border: 'none',
    borderRadius: '3px',
    backgroundColor: 'transparent',
    color: 'var(--text)',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: '11px',
  },

};
