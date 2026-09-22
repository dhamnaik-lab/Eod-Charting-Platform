import type { AppSnapshot } from '@/platform';
import type { DesktopApi } from '@/platform/types';

export interface DatabaseLifecycleHandlers {
  getApi: () => DesktopApi | null;
  setSuppressEvent: (active: boolean) => void;
  applySnapshot: (snapshot: AppSnapshot) => Promise<void>;
}

/**
 * Binds the four database lifecycle operations to a set of store-provided
 * handlers, removing the repeated get-api / suppress-event / apply-snapshot
 * boilerplate from chartStore.ts.
 *
 * chartStore remains the orchestrator — it supplies the handlers and calls
 * the returned actions. This service owns only the shared execution pattern.
 */
export function bindDatabaseLifecycle(handlers: DatabaseLifecycleHandlers) {
  async function run(operation: (api: DesktopApi) => Promise<AppSnapshot>): Promise<void> {
    const api = handlers.getApi();
    if (!api) {
      throw new Error('Desktop database API is unavailable.');
    }
    handlers.setSuppressEvent(true);
    try {
      const snapshot = await operation(api);
      await handlers.applySnapshot(snapshot);
    } finally {
      handlers.setSuppressEvent(false);
    }
  }

  return {
    createDatabaseInteractive: (): Promise<void> => run((api) => api.createDatabaseInteractive('binary')),
    openDatabaseInteractive: (): Promise<void> => run((api) => api.openDatabaseInteractive()),
    activateDatabasePath: (filePath: string): Promise<void> => run((api) => api.activateDatabasePath(filePath)),
    closeDatabase: (): Promise<void> => run((api) => api.closeDatabase()),
  };
}
