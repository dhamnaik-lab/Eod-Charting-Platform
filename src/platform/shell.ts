import type { AppInfo } from '@/types/desktop';
import type {
  DesktopCapabilities,
  DesktopRuntime,
  DesktopShellApi,
  NativeMenuState,
} from './types';
import { getDesktopApi } from './desktop';

interface MenuCommandEnvelope {
  command?: string;
  payload?: unknown;
}

let tauriShellApi: DesktopShellApi | null = null;

function hasTauriInternals(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}

function getTauriShellApi(): DesktopShellApi | null {
  if (!hasTauriInternals()) {
    return null;
  }

  if (tauriShellApi) {
    return tauriShellApi;
  }

  tauriShellApi = {
    getAppInfo: async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      return invoke<AppInfo>('get_app_info');
    },
    openExternal: async (url: string) => {
      const { invoke } = await import('@tauri-apps/api/core');
      return invoke<{ success: boolean }>('open_external', { url });
    },
    syncMenuState: async (state: NativeMenuState) => {
      const { invoke } = await import('@tauri-apps/api/core');
      return invoke<{ success: boolean }>('sync_menu_state', { state });
    },
    onMenuCommand: (callback) => {
      let unlisten: (() => void) | null = null;
      let disposed = false;

      void import('@tauri-apps/api/event')
        .then(({ listen }) =>
          listen<MenuCommandEnvelope>('menu:command', (event) => {
            const payload = event.payload ?? {};
            if (!payload.command) {
              return;
            }
            callback(payload.command, payload.payload);
          }),
        )
        .then((nextUnlisten) => {
          if (disposed) {
            nextUnlisten();
            return;
          }
          unlisten = nextUnlisten;
        })
        .catch(() => {
          // Leave an inert unsubscribe when listener setup fails.
        });

      return () => {
        disposed = true;
        if (unlisten) {
          unlisten();
          unlisten = null;
        }
      };
    },
  };

  return tauriShellApi;
}

export function getDesktopRuntime(): DesktopRuntime | null {
  if (getTauriShellApi()) {
    return 'tauri';
  }

  return null;
}

export function getDesktopShellApi(): DesktopShellApi | null {
  return getTauriShellApi();
}

export function requireDesktopShellApi(): DesktopShellApi {
  const api = getDesktopShellApi();
  if (!api) {
    throw new Error('Desktop shell API bridge is unavailable.');
  }

  return api;
}

export function getDesktopCapabilities(): DesktopCapabilities {
  const runtime = getDesktopRuntime();
  const shellApi = getDesktopShellApi();

  return {
    runtime,
    hasBusinessBackend: getDesktopApi() !== null,
    hasAppInfo: shellApi !== null,
    hasExternalLinks: shellApi !== null,
    hasMenuCommandBridge: shellApi !== null,
  };
}
