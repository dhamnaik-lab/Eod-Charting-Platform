import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LazyToolBoundary, ToolFallback } from '@/components/LazyToolBoundary';

describe('lazy tool loading and error visibility', () => {
  it('announces a named loading state without a misleading reload button', () => {
    const html = renderToStaticMarkup(<ToolFallback name="Scanner" phase="loading" />);

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Opening Scanner...');
    expect(html).not.toContain('Reload application');
  });

  it('shows an accessible failure with an explicit reload action', () => {
    const html = renderToStaticMarkup(<ToolFallback name="Import CSV" phase="error" />);

    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="assertive"');
    expect(html).toContain('Import CSV unavailable');
    expect(html).toContain('Reload the application to try again.');
    expect(html).toContain('Reload application');
    expect(html).toContain('type="button"');
  });

  it('preserves successful child rendering in the tool boundary', () => {
    const html = renderToStaticMarkup(
      <LazyToolBoundary name="Scanner">
        <span>Loaded scanner</span>
      </LazyToolBoundary>,
    );

    expect(html).toContain('Loaded scanner');
    expect(html).not.toContain('Opening Scanner...');
    expect(html).not.toContain('Scanner unavailable');
  });

  it('wires all fourteen existing lazy tools through the visible boundary', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/RootApp.tsx'), 'utf8');
    const tools: Array<[string, string]> = [
      ['Bhavcopy downloads', 'LazyBhavcopyDownloadWindow'],
      ['Scanner', 'LazyScannerWindow'],
      ['Alert manager', 'LazyAlertManagerWindow'],
      ['Delete database', 'LazyDeleteDatabaseDialog'],
      ['Recent databases', 'LazyRecentDatabasesDialog'],
      ['Layout manager', 'LazyLayoutManagerDialog'],
      ['Watchlist manager', 'LazyWatchlistManagerDialog'],
      ['FAQ', 'LazyFAQDialog'],
      ['Keyboard shortcuts', 'LazyKeyboardShortcutsDialog'],
      ['About', 'LazyAboutDialog'],
      ['Import CSV', 'LazyImportCsvDialog'],
      ['Official watchlist import', 'LazyOfficialWatchlistImportDialog'],
      ['Database tools', 'LazyDatabaseToolsDialogs'],
      ['Indicator picker', 'LazyIndicatorPickerDialog'],
    ];

    for (const [name, component] of tools) {
      expect(source).toContain(`<LazyToolBoundary name="${name}">`);
      expect(source).toContain(`<${component}`);
    }

    expect(source.match(/<LazyToolBoundary name=/g)).toHaveLength(14);
    expect(source).not.toContain('fallback={null}');
    expect(source).toContain('<ErrorBoundary name="CommandPalette">');
  });

  it('uses full application reload rather than retrying a cached lazy import failure', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/LazyToolBoundary.tsx'), 'utf8');

    expect(source).toContain('window.location.reload()');
    expect(source).toContain('fallback={<ToolFallback name={name} phase="error" />}');
    expect(source).toContain('fallback={<ToolFallback name={name} phase="loading" />}');
  });
});
