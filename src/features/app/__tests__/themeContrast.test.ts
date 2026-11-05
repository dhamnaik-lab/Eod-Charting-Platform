import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/styles/global.css'), 'utf8');
const themes = [
  ['Midnight Slate Pro', ':root'],
  ['AMOLED Black', '[data-theme="amoled-black"]'],
  ['Classic Light', '[data-theme="classic-light"]'],
  ['Classic Light Refined', '[data-theme="classic-light-refined"]'],
  ['Deep Light', '[data-theme="deep-light"]'],
  ['Eikon Dark Pro', '[data-theme="refinitiv-dark"]'],
  ['Charcoal Pro', '[data-theme="tos-charcoal"]'],
] as const;

function themeBlock(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`Missing theme selector: ${selector}`);
  const end = css.indexOf('\n}', start);
  if (end < 0) throw new Error(`Unclosed theme selector: ${selector}`);
  return css.slice(start, end);
}

function themeColor(block: string, name: string): string {
  const declaration = block.match(new RegExp(`^\\s*${name}:\\s*(#[0-9a-fA-F]{6});`, 'm'));
  if (!declaration) throw new Error(`Missing hex token: ${name}`);
  return declaration[1];
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground: string, background: string): number {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

describe('UX-12 theme text contrast across standard panel backgrounds', () => {
  for (const [theme, selector] of themes) {
    it(`keeps normal text readable in ${theme}`, () => {
      const block = themeBlock(selector);
      for (const foreground of ['--text', '--text-dim', '--text-mute', '--legend-muted']) {
        for (const background of ['--bg', '--bg2', '--bg3', '--bg4']) {
          const ratio = contrastRatio(themeColor(block, foreground), themeColor(block, background));
          expect(ratio, `${theme}: ${foreground} against ${background}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  }

  it('retains a distinguishable keyboard focus ring across standard panel backgrounds', () => {
    expect(css.match(/var\(--focus-ring, var\(--accent\)\)/g)).toHaveLength(4);
    for (const [theme, selector] of themes) {
      const block = themeBlock(selector);
      const foreground = block.includes('--focus-ring:')
        ? themeColor(block, '--focus-ring')
        : themeColor(block, '--accent');
      for (const background of ['--bg', '--bg2', '--bg3', '--bg4']) {
        const ratio = contrastRatio(foreground, themeColor(block, background));
        expect(ratio, `${theme}: focus against ${background}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('preserves Eikon Dark accent and background palette while separating its focus ring', () => {
    const block = themeBlock('[data-theme="refinitiv-dark"]');
    expect(themeColor(block, '--accent')).toBe('#0284c7');
    expect(themeColor(block, '--bg4')).toBe('#334155');
    expect(themeColor(block, '--focus-ring')).toBe('#38bdf8');
  });
});
