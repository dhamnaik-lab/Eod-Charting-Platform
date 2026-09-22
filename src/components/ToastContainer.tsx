import { useEffect } from 'react';
import { useChartStore } from '@/store/chartStore';
import type { ToastMessage } from '@/store/chartStoreTypes';

export function ToastContainer() {
  const toasts = useChartStore((state) => state.toasts);
  const removeToast = useChartStore((state) => state.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div style={containerStyle}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  const isError = toast.type === 'error';
  const isWarning = toast.type === 'warning';
  const isSuccess = toast.type === 'success';

  let accentColor = 'var(--accent)';
  if (isError) accentColor = 'var(--red)';
  if (isWarning) accentColor = 'var(--yellow, #f59e0b)';
  if (isSuccess) accentColor = 'var(--green)';

  return (
    <div
      style={{
        ...toastStyle,
        borderLeft: `3px solid ${accentColor}`,
      }}
      onClick={onDismiss}
    >
      {toast.title ? <div style={titleStyle}>{toast.title}</div> : null}
      <div style={messageStyle}>{toast.message}</div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 24,
  right: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  zIndex: 9999,
  pointerEvents: 'none', // let clicks pass through when clicking between toasts
};

const toastStyle: React.CSSProperties = {
  background: 'var(--bg2)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '12px 16px',
  minWidth: 320,
  maxWidth: 520,
  boxShadow: 'var(--shadow-lg)',
  backdropFilter: 'blur(20px)',
  color: 'var(--text)',
  pointerEvents: 'auto', // make toast itself clickable
  cursor: 'pointer',
  transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s ease',
  animation: 'toast-slide-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
};

const titleStyle: React.CSSProperties = {
  fontSize: '0.95rem',
  fontWeight: 600,
  marginBottom: 4,
};

const messageStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: 'var(--text-dim)',
  lineHeight: 1.4,
};
