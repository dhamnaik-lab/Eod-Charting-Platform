import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/global.css', 'utf8');
const status = readFileSync('src/components/StatusBar.tsx', 'utf8');

describe('B26: respect reduced-motion preference without layout or theme redesign', () => {
  it('gates CSS transition suppression on an explicit reduced-motion media query', () => {
    const declaration = '@media (prefers-reduced-motion: reduce)';
    expect(css.split(declaration)).toHaveLength(2);
    const section = css.split(declaration)[1];
    expect(section).toMatch(/\.sidebar-row-shell\s*,\s*\.sidebar-indicator-row\s*\{\s*transition:\s*none;/);
  });

  it('preserves ordinary hover transitions when reduced motion is not requested', () => {
    const baseCss = css.split('@media (prefers-reduced-motion: reduce)')[0];
    for (const selector of ['.sidebar-row-shell', '.sidebar-indicator-row']) {
      const start = baseCss.indexOf(selector + ' {');
      expect(start).toBeGreaterThanOrEqual(0);
      expect(baseCss.slice(start, baseCss.indexOf('}', start))).toContain('transition: background-color 0.1s ease;');
    }
    expect(baseCss).toContain('.sidebar-row-shell:hover');
    expect(baseCss).toContain('.sidebar-indicator-row:hover');
  });

  it('does not suppress all animations, disable essential progress updates, or alter global geometry', () => {
    const section = css.split('@media (prefers-reduced-motion: reduce)')[1];
    expect(section).not.toContain('* {');
    expect(section).not.toContain('!important');
    expect(section).not.toContain('animation: none');
    expect(section).not.toMatch(/font-size:|line-height:|display:|width:|height:|opacity:/);
    expect(status).toContain('Import {importProgress.progress}%');
    expect(status).toContain('Download {downloadProgress.progress}%');
  });

  it('does not change existing seven-theme identity selectors', () => {
    for (const theme of [
      ':root {', '[data-theme="amoled-black"] {', '[data-theme="classic-light"] {',
      '[data-theme="classic-light-refined"] {', '[data-theme="deep-light"] {',
      '[data-theme="refinitiv-dark"] {', '[data-theme="tos-charcoal"] {',
    ]) {
      expect(css).toContain(theme);
    }
    expect(css.split('@media (prefers-reduced-motion: reduce)')[1]).not.toContain('data-theme');
  });
});
