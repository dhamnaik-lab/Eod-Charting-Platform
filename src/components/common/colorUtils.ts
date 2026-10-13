/**
 * colorUtils.ts
 * Unified color parsing, serialization, and curated financial charting palettes.
 * Inspired by TradingView's design system swatches and color hierarchies.
 */

export interface ParsedColor {
  hex: string;
  alpha: number;
  isRgba: boolean;
}

/**
 * Top semantic quick-pick swatches for financial charting.
 */
export const TRADING_SEMANTIC_SWATCHES = [
  '#089981', // TV Bullish Green
  '#f23645', // TV Bearish Red
  '#2962ff', // TV Accent Blue
  '#ff9800', // Amber/Orange
  '#ab47bc', // Purple
  '#787b86', // Neutral Slate
  '#ffffff', // Pure White
  '#000000', // Pure Black
] as const;

/**
 * TradingView-inspired 9-column palette matrix across 6 tonal rows.
 * Columns: Monochromes, Reds, Oranges, Yellows, Greens, Teals, Sky Blues, Indigos, Magentas.
 */
export const TRADING_PALETTE_MATRIX: string[][] = [
  // Row 1: Tint / Light pastel
  ['#ffffff', '#fee2e2', '#ffedd5', '#fef9c3', '#dcfce7', '#ccfbf1', '#e0f2fe', '#ede9fe', '#fce7f3'],
  // Row 2: Soft accents
  ['#e2e8f0', '#fca5a5', '#fdba74', '#fde047', '#86efac', '#5eead4', '#7dd3fc', '#c4b5fd', '#f472b6'],
  // Row 3: Mid-tones
  ['#94a3b8', '#f87171', '#fb923c', '#facc15', '#4ade80', '#2dd4bf', '#38bdf8', '#a78bfa', '#ec4899'],
  // Row 4: Core / Vibrant primaries
  ['#64748b', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9', '#8b5cf6', '#d946ef'],
  // Row 5: Deep saturated
  ['#334155', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0d9488', '#0284c7', '#7c3aed', '#c026d3'],
  // Row 6: Dark anchors
  ['#0f172a', '#991b1b', '#9a3412', '#854d0e', '#166534', '#0f766e', '#075985', '#5b21b6', '#86198f'],
];

/**
 * Checks if a string is a valid 3, 6, or 8-digit hex code with optional leading #.
 */
export function isValidHex(hex: string): boolean {
  const clean = hex.trim().replace(/^#/, '');
  return /^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$|^[0-9a-fA-F]{8}$/.test(clean);
}

/**
 * Converts any hex string to 6-digit uppercase format with leading # (omits alpha channel).
 */
export function toHex6(hex: string): string {
  const clean = hex.trim().replace(/^#/, '');
  if (clean.length === 3) {
    return `#${clean[0]}${clean[0]}${clean[1]}${clean[1]}${clean[2]}${clean[2]}`.toUpperCase();
  }
  if (clean.length === 6 || clean.length === 8) {
    return `#${clean.slice(0, 6)}`.toUpperCase();
  }
  return '#22C55E';
}

/**
 * Parses RGB components from a 6-digit hex string.
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = toHex6(hex).replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return {
    r: Number.isNaN(r) ? 34 : r,
    g: Number.isNaN(g) ? 197 : g,
    b: Number.isNaN(b) ? 94 : b,
  };
}

/**
 * Parses any color input (hex, rgb, rgba) into a normalized 6-digit hex, alpha (0-1), and type.
 */
export function parseColor(color: string | null | undefined): ParsedColor {
  if (!color || typeof color !== 'string') {
    return { hex: '#22C55E', alpha: 1, isRgba: false };
  }

  const trimmed = color.trim();

  // Handle rgba(...) or rgb(...)
  const rgbMatch = /^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(trimmed);
  if (rgbMatch) {
    const r = Math.min(255, Math.max(0, parseInt(rgbMatch[1], 10)));
    const g = Math.min(255, Math.max(0, parseInt(rgbMatch[2], 10)));
    const b = Math.min(255, Math.max(0, parseInt(rgbMatch[3], 10)));
    const rawAlpha = rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1;
    const alpha = Math.min(1, Math.max(0, Number.isNaN(rawAlpha) ? 1 : rawAlpha));
    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
    return { hex, alpha: Math.round(alpha * 100) / 100, isRgba: true };
  }

  // Handle hex codes: #RGB, #RRGGBB, #RRGGBBAA
  const cleanHex = trimmed.replace(/^#/, '');
  if (cleanHex.length === 8) {
    const hex = `#${cleanHex.slice(0, 6)}`.toUpperCase();
    const alphaInt = parseInt(cleanHex.slice(6, 8), 16);
    const alpha = Number.isNaN(alphaInt) ? 1 : Math.round((alphaInt / 255) * 100) / 100;
    return { hex, alpha, isRgba: false };
  }

  if (isValidHex(trimmed)) {
    return { hex: toHex6(trimmed), alpha: 1, isRgba: false };
  }

  return { hex: '#22C55E', alpha: 1, isRgba: false };
}

/**
 * Formats a hex color and alpha into the desired output format.
 * - 'auto': returns rgba(...) if alpha < 1 or original was rgba, else #RRGGBB
 * - 'hex': returns #RRGGBB (or #RRGGBBAA if alpha < 1 and includeAlphaInHex is true)
 * - 'rgba': returns rgba(r, g, b, alpha)
 */
export function serializeColor(
  hex: string,
  alpha: number,
  mode: 'auto' | 'hex' | 'rgba' = 'auto',
  originalIsRgba = false,
): string {
  const normHex = toHex6(hex);
  const clampedAlpha = Math.min(1, Math.max(0, Math.round(alpha * 100) / 100));

  if (mode === 'rgba' || (mode === 'auto' && (clampedAlpha < 1 || originalIsRgba))) {
    const { r, g, b } = hexToRgb(normHex);
    return `rgba(${r}, ${g}, ${b}, ${clampedAlpha})`;
  }

  return normHex;
}
