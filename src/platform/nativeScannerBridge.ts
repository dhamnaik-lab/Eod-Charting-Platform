/**
 * NS-04 — Opt-in native scanner bridge.
 *
 * All native scanner `invoke`/`listen` calls live here, inside the approved platform
 * boundary (`src/platform/*`). Components never touch Tauri directly.
 *
 * Guarantees this module provides:
 * - Capability discovery is explicit; `defaultEnabled` is always `false`.
 * - Nothing is invoked unless the caller opts in.
 * - Every event is filtered by `runId`, and stale/out-of-order `sequence` values are
 *   dropped, so a finished run can never publish into a newer UI session.
 * - Listeners are always removed, including on error, cancellation and abort.
 */

import { getTauriCore, getNativeTauriEvent } from './tauriDesktop';
import type {
  NativeScanCancelAckV1,
  NativeScanCompleteEventV1,
  NativeScanErrorEventV1,
  NativeScanMatchBatchEventV1,
  NativeScanProgressEventV1,
  NativeScanRequestV1,
  NativeScannerCapabilitiesV1,
} from '@/features/scanner/nativeScanContract';
import {
  NATIVE_SCAN_EVENT_VERSION,
  createNativeScannerCapabilitiesV1,
} from '@/features/scanner/nativeScanContract';

export const NATIVE_SCAN_EVENT_NAMES = {
  progress: 'scan:progress',
  match: 'scan:match',
  complete: 'scan:complete',
  error: 'scan:error',
} as const;

export interface NativeScanStartAckV1 {
  accepted: boolean;
  runId: string;
  schemaVersion: number;
  databaseIdentity: string;
  workerCount: number;
  totalTargets: number;
}

export interface NativeScanCommandErrorV1 {
  code: string;
  message: string;
  issues?: Array<{ path: string; code: string; message: string }>;
}

export interface NativeScanStartOptions {
  workerCount?: number;
  eventBatchSize?: number;
  progressIntervalMs?: number;
}

export type NativeScanEvent =
  | { kind: 'progress'; event: NativeScanProgressEventV1 }
  | { kind: 'match'; event: NativeScanMatchBatchEventV1 }
  | { kind: 'complete'; event: NativeScanCompleteEventV1 }
  | { kind: 'error'; event: NativeScanErrorEventV1 };

function toCommandError(error: unknown): NativeScanCommandErrorV1 {
  if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error) {
    const candidate = error as { code: unknown; message: unknown; issues?: unknown };
    if (typeof candidate.code === 'string' && typeof candidate.message === 'string') {
      return {
        code: candidate.code,
        message: candidate.message,
        ...(Array.isArray(candidate.issues)
          ? { issues: candidate.issues as NativeScanCommandErrorV1['issues'] }
          : {}),
      };
    }
  }
  return {
    code: 'native-scan-bridge-error',
    message: error instanceof Error ? error.message : String(error),
  };
}

/** True only when a Tauri desktop bridge is available at all. */
export async function isNativeScannerBridgeAvailable(): Promise<boolean> {
  try {
    await getTauriCore();
    return true;
  } catch {
    return false;
  }
}

/**
 * Negotiates native-scanner capabilities. Any failure degrades to a capability object
 * with `workerCount: 0`, which callers treat as "native unavailable" — never as an error
 * the user has to resolve before scanning with the TypeScript backend.
 */
export async function readNativeScannerCapabilities(): Promise<NativeScannerCapabilitiesV1> {
  try {
    const { invoke } = await getTauriCore();
    const raw = await invoke<Partial<NativeScannerCapabilitiesV1> & { supportedPatternIds?: string[] }>(
      'native_scanner_capabilities',
    );
    return {
      contractVersion: 'eod-native-scan-contract-v1',
      schemaVersion: 1,
      defaultEnabled: false,
      workerCount: typeof raw.workerCount === 'number' ? raw.workerCount : 0,
      supportedPatternIds: Array.isArray(raw.supportedPatternIds) ? raw.supportedPatternIds : [],
      supportedIndicatorNames: raw.supportedIndicatorNames ?? [
        'sma',
        'ema',
        'rsi',
        'atr',
        'volumeSma',
      ],
      supportedUniverseSources: raw.supportedUniverseSources ?? [
        'explicitTargets',
        'activeNseEq',
        'activeBse',
      ],
      maxLimits: raw.maxLimits ?? createNativeScannerCapabilitiesV1(0).maxLimits,
    };
  } catch {
    return { ...createNativeScannerCapabilitiesV1(0), supportedPatternIds: [] };
  }
}

/**
 * Subscribes to the four native scan events for one run.
 *
 * Returns an unsubscribe function that is safe to call more than once. Events for another
 * run, another event version, or a lower/equal sequence than already seen are ignored.
 */
export async function subscribeToNativeScanEvents(
  runId: string,
  handlers: {
    onProgress?: (event: NativeScanProgressEventV1) => void;
    onMatches?: (event: NativeScanMatchBatchEventV1) => void;
    onComplete?: (event: NativeScanCompleteEventV1) => void;
    onError?: (event: NativeScanErrorEventV1) => void;
  },
): Promise<() => void> {
  let lastSequence = 0;
  const unlisteners: Array<() => void> = [];
  let disposed = false;

  const isCurrent = <T extends { runId: string; sequence: number; eventVersion: number }>(
    event: T,
  ): boolean => {
    if (disposed) return false;
    if (!event || event.runId !== runId) return false;
    if (event.eventVersion !== NATIVE_SCAN_EVENT_VERSION) return false;
    if (!Number.isFinite(event.sequence) || event.sequence <= lastSequence) return false;
    lastSequence = event.sequence;
    return true;
  };

  try {
    const { listen } = await getNativeTauriEvent();
    const register = async <
      T extends { runId: string; sequence: number; eventVersion: number },
    >(
      name: string,
      handler: ((event: T) => void) | undefined,
    ) => {
      if (!handler) return;
      const unlisten = await listen<T>(name, (payload) => {
        const event = (payload as { payload?: T }).payload ?? (payload as unknown as T);
        if (isCurrent(event)) handler(event);
      });
      unlisteners.push(unlisten);
    };

    await register(NATIVE_SCAN_EVENT_NAMES.progress, handlers.onProgress);
    await register(NATIVE_SCAN_EVENT_NAMES.match, handlers.onMatches);
    await register(NATIVE_SCAN_EVENT_NAMES.complete, handlers.onComplete);
    await register(NATIVE_SCAN_EVENT_NAMES.error, handlers.onError);
  } catch {
    // A missing event bridge must not leave the caller waiting for a completion event.
    handlers.onError?.({
      eventVersion: NATIVE_SCAN_EVENT_VERSION,
      runId,
      sequence: 0,
      databaseIdentity: '',
      code: 'native-scan-events-unavailable',
      message: 'Native scanner events are unavailable in this environment.',
      counts: { targets: 0, matched: 0, noMatch: 0, skipped: 0, failed: 0 },
      diagnostics: [],
    });
  }

  return () => {
    disposed = true;
    while (unlisteners.length > 0) {
      const unlisten = unlisteners.pop();
      try {
        unlisten?.();
      } catch {
        // Best-effort cleanup; a failed unsubscribe must not mask a committed result.
      }
    }
  };
}

/**
 * Starts a native scan. The caller must have opted in first; this function intentionally
 * performs no implicit activation and does not fall back on failure — the caller decides
 * whether to retry with the TypeScript backend.
 */
export async function startNativeEodScan(
  request: NativeScanRequestV1,
  options: NativeScanStartOptions = {},
): Promise<NativeScanStartAckV1> {
  const { invoke } = await getTauriCore();
  try {
    return await invoke<NativeScanStartAckV1>('start_native_eod_scan', {
      payload: {
        request,
        ...(options.workerCount !== undefined ? { workerCount: options.workerCount } : {}),
        ...(options.eventBatchSize !== undefined ? { eventBatchSize: options.eventBatchSize } : {}),
        ...(options.progressIntervalMs !== undefined
          ? { progressIntervalMs: options.progressIntervalMs }
          : {}),
      },
    });
  } catch (error) {
    throw toCommandError(error);
  }
}

/** Requests cancellation for one run. Idempotent. */
export async function cancelNativeEodScan(runId: string): Promise<NativeScanCancelAckV1> {
  const { invoke } = await getTauriCore();
  try {
    return await invoke<NativeScanCancelAckV1>('cancel_native_eod_scan', {
      payload: { runId },
    });
  } catch (error) {
    throw toCommandError(error);
  }
}
