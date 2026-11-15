import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDialogFocus } from '@/features/app/useDialogFocus';
import { useChartStore } from '@/store/chartStore';

function ActionConfirmation({ message, finish }: { message: string; finish: (confirmed: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const title = useId();
  const description = useId();
  useDialogFocus(ref, () => finish(false));
  useEffect(() => () => finish(false), []);
  return createPortal(<div style={{ position: 'fixed', inset: 0, zIndex: 1400, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.45)' }}>
    <div ref={ref} role="alertdialog" aria-modal="true" aria-labelledby={title} aria-describedby={description} tabIndex={-1}
      style={{ background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: 20, width: 'min(520px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 32px)', overflow: 'auto' }}>
      <h2 id={title} style={{ marginTop: 0, fontSize: 16 }}>Confirm action</h2>
      <p id={description} style={{ whiteSpace: 'pre-wrap' }}>{message}</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <button type="button" onClick={() => finish(false)}>Cancel</button>
        <button type="button" onClick={() => finish(true)}>Confirm action</button>
      </div>
    </div>
  </div>, document.body);
}

/** Cancel on owner unmount or database switch; never reuse approval for a new context. */
export function useActionConfirmation() {
  const [message, setMessage] = useState<string | null>(null);
  const pending = useRef<((value: boolean) => void) | null>(null);
  const finish = (confirmed: boolean) => {
    const resolve = pending.current;
    pending.current = null;
    setMessage(null);
    resolve?.(confirmed);
  };
  useEffect(() => {
    const unsubscribe = useChartStore.subscribe((next, previous) => {
      if (next.snapshot?.activeDatabasePath !== previous.snapshot?.activeDatabasePath || next.isDatabaseTransitioning) finish(false);
    });
    return () => { unsubscribe(); pending.current?.(false); pending.current = null; };
  }, []);
  return {
    confirm: (text: string) => {
      if (pending.current) return Promise.resolve(false);
      setMessage(text);
      return new Promise<boolean>(resolve => { pending.current = resolve; });
    },
    dialog: message === null ? null : <ActionConfirmation message={message} finish={finish} />,
  };
}
