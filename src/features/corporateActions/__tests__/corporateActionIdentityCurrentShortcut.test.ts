import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE_PATH = resolve(process.cwd(), 'src/components/DatabaseToolsDialogs.tsx');

function readSource(): string {
  return readFileSync(SOURCE_PATH, 'utf8');
}

function sliceBetween(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  expect(start, `Missing start marker: ${startMarker}`).toBeGreaterThanOrEqual(0);
  const end = source.indexOf(endMarker, start + startMarker.length);
  expect(end, `Missing end marker after ${startMarker}: ${endMarker}`).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('Identity I1 current shortcut exchange behavior', () => {
  it('uses the loaded Identity preview exchange, falling back to the active chart exchange', () => {
    const source = readSource();
    const identity = sliceBetween(source, 'const renderIdentityTab = () => (', 'const renderImportsTab');

    const normalizedIdentity = identity.replace(/\s+/g, ' ');

    expect(normalizedIdentity).toContain(
      "currentUniverseSyncResult ? 'NSE' : bseCurrentUniverseSyncResult ? 'BSE' : activeInstrument?.exchange ?? null",
    );
    expect(identity).not.toContain("applyCurrentSymbolFilter(setIdentitySearchQuery, 'NSE')");
  });

  it('preserves the existing exchange-mismatch guard in applyCurrentSymbolFilter', () => {
    const source = readSource();
    const helper = sliceBetween(source, 'const applyCurrentSymbolFilter = (', 'const loadMoreScanResults');

    expect(helper).toContain('if (!activeInstrument)');
    expect(helper).toContain('if (exchangeOverride && activeInstrument.exchange !== exchangeOverride)');
    expect(helper).toContain('Switch to a ${exchangeOverride} chart or type a symbol manually.');
    expect(helper).toContain('setter(activeInstrument.symbol);');
  });

  it('does not alter other Current shortcut exchange rules', () => {
    const source = readSource();

    expect(source).toContain(
      'applyCurrentSymbolFilter(setScanSearchQuery, activeInstrument?.exchange ?? null)',
    );
    expect(source).toContain(
      'applyCurrentSymbolFilter(setResolveSearchQuery, resolveTargetRow.exchange)',
    );
  });
});
