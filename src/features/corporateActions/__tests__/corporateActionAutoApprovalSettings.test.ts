import { describe, expect, it, vi } from 'vitest';
import type { DesktopApi } from '@/platform';
import {
  CORPORATE_ACTION_SPLIT_BONUS_AUTO_APPROVAL_SETTING_KEY,
  parseCorporateActionSplitBonusAutoApprovalSetting,
  readCorporateActionSplitBonusAutoApprovalEnabled,
  writeCorporateActionSplitBonusAutoApprovalEnabled,
} from '../workflow/corporateActionAutoApprovalSettings';

type SettingsApi = Pick<DesktopApi, 'getSetting' | 'setSetting'>;

function api(value: string | null): SettingsApi {
  return {
    getSetting: vi.fn(async () => value),
    setSetting: vi.fn(async () => ({ success: true })),
  } as SettingsApi;
}

describe('Corporate Action Split/Bonus auto-approval setting', () => {
  it('is fail-closed and OFF by default for missing or unrecognized values', () => {
    expect(parseCorporateActionSplitBonusAutoApprovalSetting(null)).toBe(false);
    expect(parseCorporateActionSplitBonusAutoApprovalSetting('')).toBe(false);
    expect(parseCorporateActionSplitBonusAutoApprovalSetting('1')).toBe(false);
    expect(parseCorporateActionSplitBonusAutoApprovalSetting('yes')).toBe(false);
  });

  it('accepts only an explicit true value, case-insensitively', () => {
    expect(parseCorporateActionSplitBonusAutoApprovalSetting('true')).toBe(true);
    expect(parseCorporateActionSplitBonusAutoApprovalSetting(' TRUE ')).toBe(true);
    expect(parseCorporateActionSplitBonusAutoApprovalSetting('false')).toBe(false);
  });

  it('reads the independent persisted family setting using the existing generic settings bridge', async () => {
    const settingsApi = api(null);
    await expect(readCorporateActionSplitBonusAutoApprovalEnabled(settingsApi)).resolves.toBe(false);
    expect(settingsApi.getSetting).toHaveBeenCalledWith(
      CORPORATE_ACTION_SPLIT_BONUS_AUTO_APPROVAL_SETTING_KEY,
    );
  });

  it('writes explicit true/false values to the exact family key', async () => {
    const settingsApi = api(null);
    await writeCorporateActionSplitBonusAutoApprovalEnabled(settingsApi, true);
    await writeCorporateActionSplitBonusAutoApprovalEnabled(settingsApi, false);
    expect(settingsApi.setSetting).toHaveBeenNthCalledWith(1, {
      key: CORPORATE_ACTION_SPLIT_BONUS_AUTO_APPROVAL_SETTING_KEY,
      value: 'true',
    });
    expect(settingsApi.setSetting).toHaveBeenNthCalledWith(2, {
      key: CORPORATE_ACTION_SPLIT_BONUS_AUTO_APPROVAL_SETTING_KEY,
      value: 'false',
    });
  });
});
