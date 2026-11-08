import { getDesktopApi, requireDesktopApi } from '@/platform';
import { WORKSPACE_SETTING_KEY } from '@/platform/workspaceSettingKey';

// Preserve the existing workspaceService export for its callers.
export { WORKSPACE_SETTING_KEY } from '@/platform/workspaceSettingKey';

export async function readWorkspaceLayoutSetting(): Promise<string | null> {
  const api = getDesktopApi();
  if (!api) {
    return null;
  }

  return api.getSetting(WORKSPACE_SETTING_KEY);
}

export async function writeWorkspaceLayoutSetting(value: string): Promise<void> {
  await requireDesktopApi().setSetting({
    key: WORKSPACE_SETTING_KEY,
    value,
  });
}
