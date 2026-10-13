import { describe, expect, it } from 'vitest';
import {
  hexToRgb,
  isValidHex,
  parseColor,
  serializeColor,
  toHex6,
  TRADING_PALETTE_MATRIX,
  TRADING_SEMANTIC_SWATCHES,
} from '../colorUtils';

describe('colorUtils', () => {
  it('identifies valid hex strings', () => {
    expect(isValidHex('#fff')).toBe(true);
    expect(isValidHex('fff')).toBe(true);
    expect(isValidHex('#089981')).toBe(true);
    expect(isValidHex('089981')).toBe(true);
    expect(isValidHex('#089981ff')).toBe(true);
    expect(isValidHex('invalid')).toBe(false);
    expect(isValidHex('#12345')).toBe(false);
  });

  it('normalizes hex to 6-digit uppercase', () => {
    expect(toHex6('#fff')).toBe('#FFFFFF');
    expect(toHex6('abc')).toBe('#AABBCC');
    expect(toHex6('#22c55e')).toBe('#22C55E');
    expect(toHex6('#22c55eff')).toBe('#22C55E');
  });

  it('converts hex to RGB channels', () => {
    expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb('#22C55E')).toEqual({ r: 34, g: 197, b: 94 });
  });

  it('parses standard hex colors', () => {
    const result = parseColor('#26A69A');
    expect(result.hex).toBe('#26A69A');
    expect(result.alpha).toBe(1);
    expect(result.isRgba).toBe(false);
  });

  it('parses rgba strings correctly with alpha channel', () => {
    const result = parseColor('rgba(78, 101, 128, 0.18)');
    expect(result.hex).toBe('#4E6580');
    expect(result.alpha).toBe(0.18);
    expect(result.isRgba).toBe(true);
  });

  it('serializes colors back to rgba when original was rgba or alpha is less than 1', () => {
    expect(serializeColor('#4E6580', 0.18, 'auto', true)).toBe('rgba(78, 101, 128, 0.18)');
    expect(serializeColor('#22C55E', 1, 'auto', false)).toBe('#22C55E');
    expect(serializeColor('#22C55E', 0.5, 'auto', false)).toBe('rgba(34, 197, 94, 0.5)');
    expect(serializeColor('#22C55E', 0.5, 'hex', false)).toBe('#22C55E');
    expect(serializeColor('#22C55E', 1, 'rgba', false)).toBe('rgba(34, 197, 94, 1)');
  });

  it('contains populated TradingView palette definitions', () => {
    expect(TRADING_SEMANTIC_SWATCHES.length).toBeGreaterThan(0);
    expect(TRADING_PALETTE_MATRIX.length).toBe(6);
    expect(TRADING_PALETTE_MATRIX[0].length).toBe(9);
  });
});
