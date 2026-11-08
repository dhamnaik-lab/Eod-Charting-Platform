import type { OverlayIndicator } from '@/engine/types';

export interface IndicatorNumericField {
  key: string;
  label: string;
  step?: string;
  min?: number;
  max?: number;
}

function isPeriodKey(key: string): boolean {
  return key === 'period' || /(?:Period|Length|Len)$/.test(key);
}

/**
 * Validate exactly what the settings form presents, without silently
 * clamping a value or changing a persisted indicator. In particular, a
 * legitimate negative LSMA offset must not be treated as a positive period.
 */
export function validateIndicatorNumericInput(
  kind: OverlayIndicator['kind'],
  field: IndicatorNumericField,
  raw: unknown,
): string | null {
  if (kind === 'LSMA' && field.key === 'offset' && raw === undefined) {
    return null; // Optional in saved legacy LSMA configurations; builder defaults to zero.
  }
  if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) {
    return 'Enter a number.';
  }
  if (typeof raw !== 'string' && typeof raw !== 'number') {
    return 'Enter a valid number.';
  }

  const number = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(number)) {
    return 'Enter a finite number.';
  }

  const isPeriod = isPeriodKey(field.key);
  const integer = isPeriod || field.step === '1';
  if (integer && !Number.isInteger(number)) {
    return 'Enter a whole number.';
  }

  // Named period fields need a positive count even where old shared schemas
  // did not provide a minimum. LSMA regression needs at least two samples.
  const minimum = kind === 'LSMA' && field.key === 'period' ? 2
    : kind === 'ALMA' && field.key === 'offset' ? 0
    : field.min ?? (isPeriod ? 1 : undefined);
  const maximum = kind === 'ALMA' && field.key === 'offset' ? 1 : field.max;
  if (kind === 'ALMA' && field.key === 'sigma' && number <= 0) {
    return 'Sigma must be greater than zero.';
  }
  if (minimum !== undefined && number < minimum) {
    return `Enter a value of at least ${minimum}.`;
  }
  if (maximum !== undefined && number > maximum) {
    return `Enter a value of at most ${maximum}.`;
  }
  return null;
}

/** Check saved configuration values and any in-progress invalid text before Save. */
export function getIndicatorNumericInputErrors(
  indicator: OverlayIndicator,
  fields: IndicatorNumericField[],
  textOverrides: Readonly<Record<string, string>> = {},
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const raw = Object.prototype.hasOwnProperty.call(textOverrides, field.key)
      ? textOverrides[field.key]
      : (indicator as unknown as Record<string, unknown>)[field.key];
    const error = validateIndicatorNumericInput(indicator.kind, field, raw);
    if (error) {
      errors[field.key] = error;
    }
  }
  return errors;
}
