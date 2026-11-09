import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/components/CommandPalette.tsx'), 'utf8');

describe('Command Palette keyboard navigation', () => {
  it('keeps separate BSE settlement symbols out of normal and recent search', () => {
    const filter = source.indexOf("symbol.exchange.toUpperCase() === 'BSE' && symbol.symbol.endsWith('#')");
    expect(filter).toBeGreaterThan(source.indexOf('rawSymbols = recentSymbols'));
    expect(filter).toBeLessThan(source.indexOf('const symbolResults'));
  });
  it('does not intercept Tab or Shift+Tab from symbol search', () => {
    const start = source.indexOf('const handleInputKeyDown');
    const end = source.indexOf('return (', start);
    const handler = source.slice(start, end);
    expect(handler).not.toContain("e.key === 'Tab'");
    expect(handler).not.toContain('setExchangeFilter');
  });

  it('preserves keyboard search, result navigation and close keys', () => {
    for (const key of ['Escape', 'ArrowUp', 'ArrowDown', 'Enter']) {
      expect(source).toContain(`e.key === '${key}'`);
    }
    expect(source).toContain('onKeyDown={handleInputKeyDown}');
    expect(source).toContain("aria-label={isSymbolMode ? 'Search symbols' : 'Search symbols and commands'}");
  });

  it('keeps all exchange filter buttons without misleading Tab instructions', () => {
    expect(source).toContain("(['all', 'NSE', 'BSE'] as const).map");
    expect(source).toContain('onClick={() => {');
    expect(source).toContain('Exchange: choose a filter button');
    expect(source).not.toContain('>Tab</kbd> Filter Exchange');
  });
});
