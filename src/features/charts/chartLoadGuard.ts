// Shared by manual instrument loads and workspace hydration. A cache clear or
// newer request must revoke publication rights, even when the old read finishes.
interface RequestState {
  generation: number;
  tabs: Map<string, number>;
  reads: Map<string, number>;
}
const states = new WeakMap<object, RequestState>();

function stateFor(owner: object): RequestState {
  let state = states.get(owner);
  if (!state) {
    state = { generation: 0, tabs: new Map(), reads: new Map() };
    states.set(owner, state);
  }
  return state;
}

export function invalidateChartRequests(owner: object): void {
  const state = stateFor(owner);
  state.generation += 1;
  state.tabs.clear();
  state.reads.clear();
}

export function chartReadKey(
  databasePath: string | null, instrument: { exchange: string; symbol: string },
  adjusted: boolean, dividends: boolean, rights: boolean, resolveIdentity = true,
): string {
  return `${databasePath}::${instrument.exchange}:${instrument.symbol}::${adjusted ? 'adjusted' : 'raw'}::${dividends ? 'dividend' : 'no-dividend'}::${rights ? 'rights' : 'no-rights'}::${resolveIdentity ? 'identity' : 'exact'}`;
}

export function beginChartDataRead(owner: object, key: string, forceReload = false) {
  const state = stateFor(owner);
  const generation = state.generation;
  if (forceReload) state.reads.set(key, (state.reads.get(key) ?? 0) + 1);
  const revision = state.reads.get(key) ?? 0;
  return { isCurrent: () => generation === state.generation && revision === (state.reads.get(key) ?? 0) };
}

export function beginChartRequest(owner: object, tabIds: string[]) {
  const state = stateFor(owner);
  const generation = state.generation;
  const revisions = new Map(tabIds.map((id) => {
    const revision = (state.tabs.get(id) ?? 0) + 1;
    state.tabs.set(id, revision);
    return [id, revision] as const;
  }));
  return {
    isCurrent: (id: string) => generation === state.generation
      && revisions.has(id) && state.tabs.get(id) === revisions.get(id),
  };
}
