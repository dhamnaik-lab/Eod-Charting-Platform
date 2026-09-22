import type {
  OfficialWatchlistSource,
  OfficialWatchlistSourceId,
} from './officialWatchlistProviders';

export type OfficialWatchlistSourceDataState =
  | { status: 'idle'; requestId: number; sourceId: null; source: null; error: null }
  | { status: 'loading'; requestId: number; sourceId: OfficialWatchlistSourceId; source: null; error: null }
  | { status: 'ready'; requestId: number; sourceId: OfficialWatchlistSourceId; source: OfficialWatchlistSource; error: null }
  | { status: 'error'; requestId: number; sourceId: OfficialWatchlistSourceId; source: null; error: string };

export type OfficialWatchlistSourceDataAction =
  | { type: 'request'; requestId: number; sourceId: OfficialWatchlistSourceId }
  | { type: 'success'; requestId: number; sourceId: OfficialWatchlistSourceId; source: OfficialWatchlistSource }
  | { type: 'failure'; requestId: number; sourceId: OfficialWatchlistSourceId; error: string }
  | { type: 'reset' };

export const initialOfficialWatchlistSourceDataState: OfficialWatchlistSourceDataState = {
  status: 'idle',
  requestId: 0,
  sourceId: null,
  source: null,
  error: null,
};

export function officialWatchlistDialogSourceReducer(
  state: OfficialWatchlistSourceDataState,
  action: OfficialWatchlistSourceDataAction,
): OfficialWatchlistSourceDataState {
  if (action.type === 'reset') return initialOfficialWatchlistSourceDataState;
  if (action.type === 'request') {
    return {
      status: 'loading',
      requestId: action.requestId,
      sourceId: action.sourceId,
      source: null,
      error: null,
    };
  }

  if (
    state.status !== 'loading' ||
    state.requestId !== action.requestId ||
    state.sourceId !== action.sourceId
  ) {
    return state;
  }

  if (action.type === 'success') {
    return {
      status: 'ready',
      requestId: action.requestId,
      sourceId: action.sourceId,
      source: action.source,
      error: null,
    };
  }

  return {
    status: 'error',
    requestId: action.requestId,
    sourceId: action.sourceId,
    source: null,
    error: action.error,
  };
}
