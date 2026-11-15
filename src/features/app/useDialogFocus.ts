import { useEffect, useRef, type RefObject } from 'react';
import { getModalTabWrapTarget } from './modalFocusNavigation';

export function dialogFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(
    'button, input, select, textarea, a[href], summary, [tabindex], [contenteditable="true"]',
  )).filter(element => element.tabIndex >= 0 && !element.matches(':disabled')
    && !element.closest('[hidden], [inert], [aria-hidden="true"]')
    && getComputedStyle(element).visibility !== 'hidden' && element.getClientRects().length > 0);
}

export function topModal(): HTMLElement | undefined {
  const level = (element: HTMLElement) => {
    let result = 0;
    for (let node: HTMLElement | null = element; node; node = node.parentElement) {
      result = Math.max(result, Number.parseInt(getComputedStyle(node).zIndex, 10) || 0);
    }
    return result;
  };
  return Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"], [role="alertdialog"]'))
    .filter(element => element.getClientRects().length > 0)
    .sort((a, b) => level(a) - level(b)).at(-1);
}

/** Modal focus stays inside the top dialog; modeless windows retain chart access. */
export function useDialogFocus(ref: RefObject<HTMLElement>, onClose: () => void, modal = true, open = true): void {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const root = ref.current;
    if (!open || !root) return;
    const opener = document.activeElement;
    const focusFirst = () => (dialogFocusable(root)[0] ?? root).focus();
    focusFirst();
    const handleKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      const top = topModal();
      if (top && top !== root) return;
      if (!modal && !root.contains(event.target as Node)) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close.current();
      } else if (modal && event.key === 'Tab') {
        const elements = dialogFocusable(root);
        const target = getModalTabWrapTarget(elements, document.activeElement as HTMLElement, event.shiftKey);
        if (target || elements.length === 0) {
          event.preventDefault();
          (target ?? root).focus();
        }
      }
    };
    const handleFocus = (event: FocusEvent) => {
      if (modal && topModal() === root && !root.contains(event.target as Node)) focusFirst();
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('focusin', handleFocus);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('focusin', handleFocus);
      if (opener instanceof HTMLElement && opener.isConnected
        && (root.contains(document.activeElement) || document.activeElement === document.body)) opener.focus();
    };
  }, [ref, modal, open]);
}
