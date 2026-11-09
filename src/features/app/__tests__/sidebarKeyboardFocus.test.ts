import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/styles/global.css'), 'utf8');
const themeCss = readFileSync(
  resolve(process.cwd(), 'src/styles/theme-tokens.generated.css'),
  'utf8',
);

describe('sidebar keyboard focus visibility', () => {
  it('suppresses outlines for pointer focus, not keyboard focus', () => {
    const suppression = css.match(/\/\* Suppress pointer outlines[\s\S]*?\}/)?.[0] ?? '';
    expect(suppression).toContain('aside button:not(:focus-visible)');
    expect(suppression).toContain('button:not(:focus-visible)');
    expect(suppression).not.toContain('aside button:focus-visible,');
    expect(suppression).not.toContain('aside button:focus,');
    expect(suppression).toContain('outline: none !important;');
  });

  it('retains a theme-aware keyboard focus ring with an accent fallback', () => {
    expect(css).toMatch(/button:focus-visible\s*\{\s*outline: 2px solid var\(--focus-ring, var\(--accent\)\);/);
    expect(themeCss).toMatch(/\[data-theme="refinitiv-dark"\]\s*\{[^}]*--focus-ring:\s*#[0-9a-fA-F]{6};/);
    expect(css).toContain('outline-offset: 1px;');
  });

  it('preserves the existing refined-light sidebar focus treatment', () => {
    expect(css).toContain('html[data-theme="classic-light-refined"] aside button:focus-visible');
    expect(css).toContain('box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.9) !important;');
  });
});
