import type { OfficialSourceHistoryEntry } from '@/platform';

export type SourceHistoryState =
  | { status: 'idle' }
  | { status: 'loading'; sourceKey: string }
  | { status: 'loaded'; sourceKey: string; entries: OfficialSourceHistoryEntry[] }
  | { status: 'error'; sourceKey: string; message: string };

/** A later selection or unmount invalidates earlier asynchronous reads. */
export function createSourceHistoryLoader(
  read: (sourceKey: string) => Promise<OfficialSourceHistoryEntry[]>,
  publish: (state: SourceHistoryState) => void,
) {
  let generation = 0;
  return {
    invalidate() { generation += 1; },
    reset() { generation += 1; publish({ status: 'idle' }); },
    async load(sourceKey: string) {
      const request = ++generation;
      publish({ status: 'loading', sourceKey });
      try {
        const entries = await read(sourceKey);
        if (request === generation) publish({ status: 'loaded', sourceKey, entries });
      } catch (error) {
        if (request === generation) publish({ status: 'error', sourceKey,
          message: error instanceof Error ? error.message : typeof error === 'string'
            ? error : 'Could not load saved source history. Try Load / Refresh History again.' });
      }
    },
  };
}
