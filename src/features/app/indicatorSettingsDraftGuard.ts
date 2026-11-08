import type { OverlayIndicator } from '@/engine/types';

/** Invalid text overrides are unsaved edits even when the last valid number is unchanged. */
export function hasUnsavedIndicatorSettingsChanges(
  original: OverlayIndicator,
  draft: OverlayIndicator,
  numericTextOverrides: Readonly<Record<string, string>>,
): boolean {
  return Object.keys(numericTextOverrides).length > 0 || JSON.stringify(original) !== JSON.stringify(draft);
}
