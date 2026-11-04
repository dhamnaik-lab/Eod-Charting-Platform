import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/components/StatusBar.tsx'), 'utf8');

describe('IST status bar clock contract', () => {
  it('formats the labelled IST clock using the explicit Asia/Kolkata timezone', () => {
    expect(source).toContain("clock.toLocaleTimeString('en-IN', { hour12: false, timeZone: 'Asia/Kolkata' })");
    expect(source).toContain('>IST</span>');
  });

  it('preserves the existing one-second update and other status fields', () => {
    expect(source).toContain('window.setInterval(() => setClock(new Date()), 1000)');
    expect(source).toContain('window.clearInterval(timer)');
    expect(source).toContain('activeTab?.visibleBarCount ?? 0');
    expect(source).toContain("snapshot?.dbStats?.dateFrom ?? '-'");
  });

  it('uses India local civil time irrespective of the host timezone', () => {
    const reference = new Date('2026-11-04T15:30:00.000Z');
    expect(reference.toLocaleTimeString('en-IN', {
      hour12: false,
      timeZone: 'Asia/Kolkata',
    })).toBe('21:00:00');
  });
});
