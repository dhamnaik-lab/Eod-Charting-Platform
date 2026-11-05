import { Suspense, type ReactNode } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface LazyToolBoundaryProps {
  name: string;
  children: ReactNode;
}

interface ToolFallbackProps {
  name: string;
  phase: 'loading' | 'error';
}

/**
 * Lazy module load failures are cached by React.lazy. Remounting the same
 * ErrorBoundary is not a reliable retry; explicitly reloading the app is.
 */
export function LazyToolBoundary({ name, children }: LazyToolBoundaryProps) {
  return (
    <ErrorBoundary name={name} fallback={<ToolFallback name={name} phase="error" />}>
      <Suspense fallback={<ToolFallback name={name} phase="loading" />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

export function ToolFallback({ name, phase }: ToolFallbackProps) {
  const failed = phase === 'error';

  return (
    <div role={failed ? 'alert' : 'status'} aria-live={failed ? 'assertive' : 'polite'} aria-atomic="true" style={panelStyle}>
      <div style={titleStyle}>{failed ? `${name} unavailable` : `Opening ${name}...`}</div>
      {failed ? (
        <>
          <div style={messageStyle}>
            This tool could not be loaded. Reload the application to try again.
          </div>
          <button type="button" style={reloadButtonStyle} onClick={() => window.location.reload()}>
            Reload application
          </button>
        </>
      ) : null}
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  zIndex: 9999,
  width: 340,
  maxWidth: 'calc(100vw - 32px)',
  padding: 18,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  border: '1px solid var(--border2)',
  borderRadius: 8,
  background: 'var(--bg2)',
  color: 'var(--text)',
  boxShadow: 'var(--shadow-lg)',
};

const titleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
};

const messageStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 12,
  lineHeight: 1.5,
};

const reloadButtonStyle: React.CSSProperties = {
  minHeight: 30,
  padding: '5px 12px',
  alignSelf: 'flex-end',
  border: '1px solid var(--border2)',
  borderRadius: 4,
  background: 'var(--bg3)',
  color: 'var(--text)',
  cursor: 'pointer',
};
