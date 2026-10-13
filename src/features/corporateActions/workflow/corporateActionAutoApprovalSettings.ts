import type { DesktopApi } from '@/platform';

export const CORPORATE_ACTION_SPLIT_BONUS_AUTO_APPROVAL_SETTING_KEY =
  'corporate_actions.auto_approval.split_bonus.enabled';

type CorporateActionAutoApprovalSettingsApi = Pick<DesktopApi, 'getSetting' | 'setSetting'>;

export function parseCorporateActionSplitBonusAutoApprovalSetting(
  value: string | null,
): boolean {
  return value?.trim().toLowerCase() === 'true';
}

export async function readCorporateActionSplitBonusAutoApprovalEnabled(
  api: CorporateActionAutoApprovalSettingsApi,
): Promise<boolean> {
  const value = await api.getSetting(CORPORATE_ACTION_SPLIT_BONUS_AUTO_APPROVAL_SETTING_KEY);
  return parseCorporateActionSplitBonusAutoApprovalSetting(value);
}

export async function writeCorporateActionSplitBonusAutoApprovalEnabled(
  api: CorporateActionAutoApprovalSettingsApi,
  enabled: boolean,
): Promise<void> {
  await api.setSetting({
    key: CORPORATE_ACTION_SPLIT_BONUS_AUTO_APPROVAL_SETTING_KEY,
    value: enabled ? 'true' : 'false',
  });
}
