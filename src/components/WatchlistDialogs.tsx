import { useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { useDialogFocus } from '@/features/app/useDialogFocus';

interface WatchlistNameDialogProps {
  title: string;
  label: string;
  value: string;
  confirmLabel: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

interface WatchlistConfirmDialogProps {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function WatchlistNameDialog({
  title,
  label,
  value,
  confirmLabel,
  onChange,
  onConfirm,
  onCancel,
}: WatchlistNameDialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, onCancel);
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onConfirm();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <div style={backdropStyle} onMouseDown={onCancel}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
        style={dialogStyle} onMouseDown={(event) => event.stopPropagation()}>
        <div style={titleStyle}>{title}</div>
        <label style={labelStyle}>
          <span>{label}</span>
          <input
            autoFocus
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            style={inputStyle}
          />
        </label>
        <div style={actionsStyle}>
          <button type="button" style={secondaryButtonStyle} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            style={primaryButtonStyle}
            onClick={onConfirm}
            disabled={!value.trim()}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function WatchlistConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: WatchlistConfirmDialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, onCancel);
  return (
    <div style={backdropStyle} onMouseDown={onCancel}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
        style={dialogStyle} onMouseDown={(event) => event.stopPropagation()}>
        <div style={titleStyle}>{title}</div>
        <div style={bodyStyle}>{message}</div>
        <div style={actionsStyle}>
          <button type="button" style={secondaryButtonStyle} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" style={dangerButtonStyle} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0, 0, 0, 0.15)', // Clear non-blur overlay
  zIndex: 1300,
};

const dialogStyle: CSSProperties = {
  width: 360,
  maxWidth: 'calc(100vw - 32px)',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  padding: 18,
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--bg2)',
  boxShadow: 'var(--shadow-lg)',
};

const titleStyle: CSSProperties = {
  color: 'var(--text)',
  fontSize: 16,
  fontWeight: 700,
};

const bodyStyle: CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 12,
  lineHeight: 1.5,
};

const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  color: 'var(--text-dim)',
  fontSize: 12,
};

const inputStyle: CSSProperties = {
  width: '100%',
  height: 36,
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--control-bg)',
  color: 'var(--text)',
  padding: '0 12px',
  outline: 'none',
};

const actionsStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 10,
};

const baseButtonStyle: CSSProperties = {
  minWidth: 88,
  height: 34,
  borderRadius: 6,
  cursor: 'pointer',
};

const secondaryButtonStyle: CSSProperties = {
  ...baseButtonStyle,
  border: '1px solid var(--border)',
  background: 'var(--control-bg)',
  color: 'var(--text)',
};

const primaryButtonStyle: CSSProperties = {
  ...baseButtonStyle,
  border: '1px solid var(--accent)',
  background: 'var(--accent-soft)',
  color: 'var(--text)',
};

const dangerButtonStyle: CSSProperties = {
  ...baseButtonStyle,
  border: '1px solid var(--red)',
  background: 'var(--control-bg)',
  color: 'var(--red-text)',
};
