import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  renderFallback?: (retry: () => void) => ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public retry = () => {
    this.setState({ hasError: false, error: null });
  };

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`ErrorBoundary [${this.props.name ?? 'Unknown'}]:`, error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.renderFallback) {
        return this.props.renderFallback(this.retry);
      }
      if (this.props.fallback !== undefined) {
        return this.props.fallback;
      }

      return (
        <div style={fallbackStyle}>
          <div style={titleStyle}>Tool Error</div>
          <div style={messageStyle}>
            {this.state.error?.message ?? 'An unexpected error occurred in this tool.'}
          </div>
          <button
            type="button"
            style={buttonStyle}
            onClick={this.retry}
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const fallbackStyle: React.CSSProperties = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  padding: '20px',
  background: 'var(--bg2)',
  border: '1px solid var(--red)',
  borderRadius: '8px',
  color: 'var(--text)',
  zIndex: 9999,
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  boxShadow: 'var(--shadow-lg)',
  maxWidth: '400px',
};

const titleStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 'bold',
  color: 'var(--red)',
};

const messageStyle: React.CSSProperties = {
  fontSize: '13px',
  lineHeight: '1.5',
  color: 'var(--text-dim)',
};

const buttonStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: 'var(--control-bg)',
  border: 'none',
  borderRadius: '4px',
  color: 'var(--text)',
  cursor: 'pointer',
};
