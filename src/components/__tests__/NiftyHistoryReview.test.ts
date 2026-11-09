import { describe, it, expect, vi } from 'vitest';
import { canApproveNiftyHistory } from '../NiftyHistoryReview';
import type { NiftyHistoryPreview } from '@/platform';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ImportCsvDialog } from '../ImportCsvDialog';

vi.mock('@/platform', () => ({ getDesktopApi: () => null }));
vi.mock('@/store/chartStore', () => ({ useChartStore: (select: (state: unknown) => unknown) => select({
  importProgress: { running: false, progress: 0, message: '', error: null, result: null },
  refreshSnapshot: vi.fn(), loadInstrument: vi.fn(), setImportProgress: vi.fn(),
}) }));
vi.mock('@/store/uiStore', () => ({ useUiStore: (select: (state: unknown) => unknown) => select({
  importDialog: { open: true, openRequestCount: 1, filePaths: [] },
  closeImportDialog: vi.fn(), openImportDialog: vi.fn(),
}) }));
vi.mock('@/store/windowStore', () => ({ useWindowStore: (select: (state: unknown) => unknown) => select({
  registerWindow: vi.fn(), openWindow: vi.fn(), focusWindow: vi.fn(), closeWindow: vi.fn(),
}) }));
vi.mock('@/components/FloatingWindow', () => ({ FloatingWindow: ({ children }: { children: ReactNode }) => children }));

describe('reviewed NIFTY approval', () => {
  it('renders the historical review and explicit approval inside Manual Import', () => {
    const html = renderToStaticMarkup(createElement(ImportCsvDialog));
    expect(html).toContain('NIFTY Historical Review');
    expect(html).toContain('Reviewed NIFTY history');
    expect(html).toContain('Approval is required before adding prices.');
    expect(html).toContain('disabled=""');
  });
  const ready = { ready: 2, officialSha256: 'official-hash' } as NiftyHistoryPreview;
  it('requires a preview, official corroboration, new bars and explicit approval', () => {
    expect(canApproveNiftyHistory(null, true, false)).toBe(false);
    expect(canApproveNiftyHistory(ready, false, false)).toBe(false);
    expect(canApproveNiftyHistory({ ...ready, officialSha256: null }, true, false)).toBe(false);
    expect(canApproveNiftyHistory({ ...ready, ready: 0 }, true, false)).toBe(false);
    expect(canApproveNiftyHistory(ready, true, true)).toBe(false);
    expect(canApproveNiftyHistory(ready, true, false)).toBe(true);
  });
});
