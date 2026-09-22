import { getDesktopApi, requireDesktopApi } from '@/platform';

export const DEFAULT_PRICE_MODE_SETTING_KEY = 'default_price_mode';

export type DatabaseDefaultPriceMode = 'raw' | 'adjusted';

export async function readDatabaseDefaultPriceMode(): Promise<DatabaseDefaultPriceMode> {
  const api = getDesktopApi();
  if (!api) {
    return 'adjusted';
  }

  const value = await api.getSetting(DEFAULT_PRICE_MODE_SETTING_KEY);
  return value === 'raw' ? 'raw' : 'adjusted';
}

export async function writeDatabaseDefaultPriceMode(
  mode: DatabaseDefaultPriceMode,
): Promise<void> {
  await requireDesktopApi().setSetting({
    key: DEFAULT_PRICE_MODE_SETTING_KEY,
    value: mode,
  });
}
