import { generateThemeTokens } from './generate-theme-tokens.mjs';

// Keeps src/styles/theme-tokens.generated.css in sync before any Vitest suite
// reads theme tokens from disk.
export default function setup() {
  generateThemeTokens();
}
