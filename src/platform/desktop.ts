import type { DesktopApi } from './types';
import { getTauriDesktopApi } from './tauriDesktop';

export function getDesktopApi(): DesktopApi | null {
  return getTauriDesktopApi();
}

export function requireDesktopApi(): DesktopApi {
  const api = getDesktopApi();
  if (!api) {
    throw new Error('Desktop API bridge is unavailable.');
  }

  return api;
}

export function hasDesktopApi(): boolean {
  return getDesktopApi() !== null;
}
