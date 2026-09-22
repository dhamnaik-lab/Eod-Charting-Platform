import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { useWindowStore } from '@/store/windowStore';
import {
  CORPORATE_ACTION_MAINTENANCE_WINDOW_ID,
  CORPORATE_ACTION_NORMAL_WINDOW_ID,
} from '../workspace/CorporateActionManagedWindow';
import {
  buildCorporateActionNormalDefaultFetchRange,
  buildCorporateActionNormalFetchInputs,
} from '../workflow/corporateActionNormalWorkflowAdapter';
import {
  CorporateActionNormalWorkflowWorkspace,
  formatCorporateActionNormalWorkflowError,
} from '../workspace/CorporateActionNormalWorkflowWorkspace';

describe('Task 6A manual checkpoint corrections', () => {
  it('keeps the managed-window reconstruction available as donor code but outside RootApp', () => {
    const root = readFileSync(resolve(process.cwd(), 'src/RootApp.tsx'), 'utf8');
    const managed = readFileSync(
      resolve(
        process.cwd(),
        'src/features/corporateActions/workspace/CorporateActionManagedWindow.tsx',
      ),
      'utf8',
    );

    expect(CORPORATE_ACTION_NORMAL_WINDOW_ID).toBe('corporate-action-normal');
    expect(CORPORATE_ACTION_MAINTENANCE_WINDOW_ID).toBe('corporate-action-maintenance');
    expect(root).not.toContain('<CorporateActionManagedWindow');
    expect(root).not.toContain('CORPORATE_ACTION_NORMAL_WINDOW_ID');
    expect(root).not.toContain('CORPORATE_ACTION_MAINTENANCE_WINDOW_ID');
    expect(managed).toContain('<FloatingWindow');
    expect(managed).toContain('preserveChildrenWhenMinimized');
    expect(managed).toContain('maximizeWindow(id)');
  });

  it('preserves managed window state across minimize and restore with opt-in child preservation', () => {
    const id = 'task6a-preserve-minimized-test';
    const store = useWindowStore.getState();

    store.registerWindow({
      id,
      title: 'Task 6A test',
      bounds: { x: 10, y: 10, width: 640, height: 480 },
      minWidth: 320,
      minHeight: 240,
    });
    store.openWindow(id);
    store.minimizeWindow(id);

    try {
      expect(useWindowStore.getState().windows[id]?.isMinimized).toBe(true);

      const source = readFileSync(
        resolve(process.cwd(), 'src/components/FloatingWindow.tsx'),
        'utf8',
      );

      expect(source).toContain('preserveChildrenWhenMinimized?: boolean;');
      expect(source).toContain('preserveChildrenWhenMinimized = false');
      expect(source).toContain(
        'windowState.isMinimized && !preserveChildrenWhenMinimized',
      );
      expect(source).toContain(
        "display: windowState.isMinimized ? 'none' : 'flex'",
      );

      useWindowStore.getState().restoreWindow(id);
      expect(useWindowStore.getState().windows[id]?.isMinimized).toBe(false);
    } finally {
      useWindowStore.getState().unregisterWindow(id);
    }
  });

  it('keeps the 90-day default but accepts an explicit From/To window for both exchanges', () => {
    expect(buildCorporateActionNormalDefaultFetchRange('2026-09-02')).toEqual({
      fromDate: '2026-06-04',
      toDate: '2026-09-02',
    });

    expect(
      buildCorporateActionNormalFetchInputs({
        fromDate: '2026-08-01',
        toDate: '2026-09-02',
      }),
    ).toEqual([
      {
        exchange: 'NSE',
        fromDate: '2026-08-01',
        toDate: '2026-09-02',
        forceRefresh: false,
      },
      {
        exchange: 'BSE',
        fromDate: '2026-08-01',
        toDate: '2026-09-02',
        forceRefresh: false,
      },
    ]);
  });

  it('renders editable From/To date inputs without adding Maintenance-only execution controls', () => {
    const html = renderToStaticMarkup(
      <CorporateActionNormalWorkflowWorkspace onClose={() => undefined} />,
    );

    expect((html.match(/type="date"/g) ?? [])).toHaveLength(2);
    expect(html).toContain('From');
    expect(html).toContain('To');
    expect(html).toContain('FETCH LATEST DATA');
    expect(html).toContain('NSE + BSE');
    expect(html).toContain('last 90 calendar days through today');

    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/features/corporateActions/workspace/CorporateActionNormalWorkflowWorkspace.tsx',
      ),
      'utf8',
    );
    expect(source).not.toContain('forceRefresh: true');
    expect(source).not.toContain('importCorporateActionsCsv');
  });

  it('preserves real string/message rejection text instead of replacing it with the generic fallback', () => {
    expect(
      formatCorporateActionNormalWorkflowError(
        'BSE official fetch failed: HTTP 403',
        'fallback',
      ),
    ).toBe('BSE official fetch failed: HTTP 403');

    expect(
      formatCorporateActionNormalWorkflowError(
        { message: 'NSE source rejected the request' },
        'fallback',
      ),
    ).toBe('NSE source rejected the request');

    expect(formatCorporateActionNormalWorkflowError('', 'fallback')).toBe('fallback');
  });
});