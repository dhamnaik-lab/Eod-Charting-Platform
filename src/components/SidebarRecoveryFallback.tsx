import type { CSSProperties } from 'react';

interface SidebarRecoveryFallbackProps {
  width: number;
  compact: boolean;
  onRetry: () => void;
}

/** Local recovery UI: never obscures or unmounts the chart and toolbar. */
export function SidebarRecoveryFallback({ width, compact, onRetry }: SidebarRecoveryFallbackProps) {
  return (
    <aside
      role="alert"
      aria-label="Sidebar unavailable"
      style={{ ...sidebarFallbackStyle, width, minWidth: width }}
    >
      {!compact ? (
        <>
          <strong style={titleStyle}>Sidebar unavailable</strong>
          <span style={descriptionStyle}>This panel could not render. Chart controls remain available.</span>
        </>
      ) : null}
      <button
        type="button"
        aria-label="Retry Sidebar"
        title="Retry Sidebar"
        onClick={onRetry}
        style={{ ...retryButtonStyle, minWidth: compact ? 28 : 96 }}
      >
        {compact ? '↻' : 'Retry Sidebar'}
      </button>
    </aside>
  );
}

const sidebarFallbackStyle: CSSProperties = {
  flex: '0 0 auto',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  overflow: 'hidden',
  padding: 3,
  boxSizing: 'border-box',
  background: 'var(--bg2)',
  borderRight: '1px solid var(--border)',
  color: 'var(--text)',
};

const titleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--red)',
  textAlign: 'center',
};

const descriptionStyle: CSSProperties = {
  fontSize: 12,
  color: 'var(--text-dim)',
  textAlign: 'center',
  padding: '0 8px',
};

const retryButtonStyle: CSSProperties = {
  minHeight: 28,
  border: '1px solid var(--border2)',
  borderRadius: 'var(--control-radius)',
  background: 'var(--control-bg)',
  color: 'var(--text)',
  cursor: 'pointer',
  padding: '4px 5px',
};
