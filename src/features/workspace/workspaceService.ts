import { getDesktopApi, requireDesktopApi } from '@/platform';

export const WORKSPACE_SETTING_KEY = 'workspace.chartLayout.v1';

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
