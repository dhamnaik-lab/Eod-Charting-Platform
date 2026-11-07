import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/styles/global.css'), 'utf8');

describe('sidebar keyboard focus visibility', () => {
  it('suppresses outlines for pointer focus, not keyboard focus', () => {
    const suppression = css.match(/\/\* Suppress pointer outlines[\s\S]*?\}/)?.[0] ?? '';
    expect(suppression).toContain('aside button:not(:focus-visible)');
    expect(suppression).toContain('button:not(:focus-visible)');
    expect(suppression).not.toContain('aside button:focus-visible,');
    expect(suppression).not.toContain('aside button:focus,');
    expect(suppression).toContain('outline: none !important;');
  });

  it('retains the shared accent focus ring for all themes', () => {
    expect(css).toMatch(/button:focus-visible\s*\{\s*outline: 2px solid var\(--focus-ring,\s*var\(--accent\)\);/);
    expect(css).toContain('outline-offset: 1px;');
  });

  it('preserves the existing refined-light sidebar focus treatment', () => {
    expect(css).toContain('html[data-theme="classic-light-refined"] aside button:focus-visible');
    expect(css).toContain('box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.9) !important;');
  });
});
