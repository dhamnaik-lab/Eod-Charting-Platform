import type { CSSProperties, ReactNode } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface SidebarRegionBoundaryProps {
  width: number;
  collapsed: boolean;
  children: ReactNode;
}

interface SidebarRecoveryPanelProps {
  width: number;
  collapsed: boolean;
  onRetry: () => void;
}

/**
 * On success, ErrorBoundary returns the Sidebar itself without a wrapper,
 * preserving the existing split-pane geometry and mouse interaction.
 */
export function SidebarRegionBoundary({ width, collapsed, children }: SidebarRegionBoundaryProps) {
  return (
    <ErrorBoundary
      name="Sidebar"
      renderFallback={(retry) => (
        <SidebarRecoveryPanel width={width} collapsed={collapsed} onRetry={retry} />
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

export function SidebarRecoveryPanel({ width, collapsed, onRetry }: SidebarRecoveryPanelProps) {
  // Only an error fallback expands the collapsed rail so Retry stays usable.
  const recoveryWidth = collapsed ? 220 : Math.max(220, width);
  return (
    <aside
      role="alert"
      aria-label="Sidebar unavailable"
      style={{ ...recoveryPanelStyle, width: recoveryWidth, minWidth: recoveryWidth }}
    >
      <strong style={{ fontSize: 13 }}>Sidebar unavailable</strong>
      <span style={{ fontSize: 12, lineHeight: 1.5 }}>
        The sidebar encountered a rendering error. Your charts remain available.
      </span>
      <button type="button" style={retryButtonStyle} onClick={onRetry}>
        Retry Sidebar
      </button>
    </aside>
  );
}

const recoveryPanelStyle: CSSProperties = {
  height: '100%',
  boxSizing: 'border-box',
  flex: '0 0 auto',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 10,
  padding: 12,
  borderRight: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  overflowY: 'auto',
};

const retryButtonStyle: CSSProperties = {
  minHeight: 30,
  padding: '5px 10px',
  border: '1px solid var(--border2)',
  borderRadius: 4,
  background: 'var(--control-bg)',
  color: 'var(--text)',
  cursor: 'pointer',
};
