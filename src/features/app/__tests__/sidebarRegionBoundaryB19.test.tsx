import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SidebarRecoveryPanel, SidebarRegionBoundary } from '@/components/SidebarRegionBoundary';

describe('B19: Sidebar render error containment', () => {
  it('preserves successful Sidebar children without a wrapper or fallback', () => {
    const html = renderToStaticMarkup(
      <SidebarRegionBoundary width={284} collapsed={false}>
        <aside data-testid="working-sidebar">Working sidebar</aside>
      </SidebarRegionBoundary>,
    );
    expect(html).toBe('<aside data-testid="working-sidebar">Working sidebar</aside>');
  });

  it('shows a named, keyboard-actionable fallback without a fixed overlay', () => {
    const html = renderToStaticMarkup(
      <SidebarRecoveryPanel width={284} collapsed={false} onRetry={() => undefined} />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-label="Sidebar unavailable"');
    expect(html).toContain('Sidebar unavailable');
    expect(html).toContain('Your charts remain available.');
    expect(html).toContain('type="button"');
    expect(html).toContain('Retry Sidebar');
    expect(html).toContain('width:284px');
    expect(html).not.toContain('position:fixed');
    expect(html).not.toContain('Reload application');
  });

  it('makes Retry usable if the failed Sidebar was collapsed', () => {
    const html = renderToStaticMarkup(
      <SidebarRecoveryPanel width={34} collapsed onRetry={() => undefined} />,
    );
    expect(html).toContain('width:220px');
    expect(html).toContain('min-width:220px');
    expect(html).toContain('Retry Sidebar');
  });

  it('surfaces a render-error fallback and invokes the existing reset contract', () => {
    const error = new Error('Sidebar render test failure');
    let retry: (() => void) | undefined;
    const boundary = new ErrorBoundary({
      name: 'Sidebar',
      children: <aside>Restored sidebar</aside>,
      renderFallback: (reset, receivedError) => {
        expect(receivedError).toBe(error);
        retry = reset;
        return <SidebarRecoveryPanel width={260} collapsed={false} onRetry={reset} />;
      },
    });
    boundary.state = ErrorBoundary.getDerivedStateFromError(error);
    const failed = renderToStaticMarkup(boundary.render());
    expect(failed).toContain('Sidebar unavailable');
    expect(failed).not.toContain('Restored sidebar');
    expect(retry).toBeTypeOf('function');
    const setStateSpy = vi.spyOn(boundary, 'setState').mockImplementation(() => undefined);
    retry?.();
    expect(setStateSpy).toHaveBeenCalledWith({ hasError: false, error: null });
    boundary.state = { hasError: false, error: null };
    expect(renderToStaticMarkup(boundary.render())).toContain('Restored sidebar');
    setStateSpy.mockRestore();
  });

  it('preserves the existing ErrorBoundary full-screen fallback for other consumers', () => {
    const boundary = new ErrorBoundary({ name: 'CommandPalette', children: <span>Command</span> });
    boundary.state = ErrorBoundary.getDerivedStateFromError(new Error('Palette rendering failed'));
    const html = renderToStaticMarkup(boundary.render());
    expect(html).toContain('Tool Error');
    expect(html).toContain('Palette rendering failed');
    expect(html).toContain('Retry');
    expect(html).toContain('position:fixed');
  });

  it('keeps only Sidebar wrapped and chart, toolbar and resize handle outside its boundary', () => {
    const root = readFileSync('src/RootApp.tsx', 'utf8');
    const start = root.indexOf('<SidebarRegionBoundary width={sidebarWidth} collapsed={sidebarCollapsed}>');
    const child = root.indexOf('<Sidebar\n', start);
    const end = root.indexOf('</SidebarRegionBoundary>', start);
    const resize = root.indexOf('sidebarResizeHandleStyle', start);
    const main = root.indexOf('<main\n', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(child).toBeGreaterThan(start);
    expect(end).toBeGreaterThan(child);
    expect(resize).toBeGreaterThan(end);
    expect(main).toBeGreaterThan(end);
    expect(root.slice(end)).toContain('<Toolbar />');
    expect(root.slice(end)).toContain('<ChartCanvas');
    expect((root.match(/<SidebarRegionBoundary /g) ?? [])).toHaveLength(1);
    expect(root).toContain('<ErrorBoundary name="CommandPalette">');
  });
});
