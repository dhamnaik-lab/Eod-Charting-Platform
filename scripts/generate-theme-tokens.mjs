import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PALETTE_PATH = resolve(PROJECT_ROOT, 'src/features/app/themePalettes.json');
const OUTPUT_PATH = resolve(PROJECT_ROOT, 'src/styles/theme-tokens.generated.css');

const HEADER = [
  '/*',
  ' * Generated file — do not edit by hand.',
  ' * Source: src/features/app/themePalettes.json',
  ' * Regenerate: npm run themes:generate',
  ' */',
  '',
].join('\n');

export function renderThemeTokensCss(palettes) {
  const defaultId = palettes.defaultThemeId;
  const blocks = Object.entries(palettes.themes).map(([id, palette]) => {
    const selector = id === defaultId ? ':root' : `[data-theme="${id}"]`;
    const declarations = Object.entries(palette.css).map(([token, value]) => `  ${token}: ${value};`);
    declarations.push(`  color-scheme: ${palette.mode};`);
    return `${selector} {\n${declarations.join('\n')}\n}\n`;
  });
  return `${HEADER}${blocks.join('\n')}`;
}

export function generateThemeTokens() {
  const palettes = JSON.parse(readFileSync(PALETTE_PATH, 'utf8'));
  const css = renderThemeTokensCss(palettes);
  writeFileSync(OUTPUT_PATH, css, 'utf8');
  return css;
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  generateThemeTokens();
  console.log(`Theme tokens generated: ${OUTPUT_PATH}`);
}
