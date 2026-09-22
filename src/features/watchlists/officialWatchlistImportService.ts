import {
  getDesktopApi,
  type DesktopApi,
  type InstrumentKey,
  type InstrumentSummary,
  type Watchlist,
} from '@/platform';
import {
  addInstrumentToWatchlist,
  applyOfficialWatchlistUpdate,
  createWatchlist,
  deleteWatchlist,
  replaceSourceLinkedWatchlist,
} from '@/features/watchlists/watchlistService';
import {
  buildOfficialWatchlistSourceLinkMeta,
  getOfficialWatchlistSource,
  loadOfficialWatchlistGroupBySourceLinkMeta,
  loadOfficialWatchlistGroups,
  type OfficialWatchlistSourceId,
} from '@/features/watchlists/officialWatchlistProviders';
import {
  buildOfficialWatchlistLookupMaps,
  buildUniqueWatchlistName,
  instrumentSymbolKey,
  officialWatchlistSourceSignature,
  pickOfficialWatchlistSearchCandidate,
  resolveOfficialWatchlistMember,
} from '@/features/watchlists/officialWatchlistResolver';

export interface OfficialImportCreatedEntry {
  id: number;
  name: string;
  groupName: string;
  importedCount: number;
}

export interface OfficialImportReplacedEntry {
  id: number;
  name: string;
  groupName: string;
  importedCount: number;
}

export interface OfficialImportSkippedEntry {
  id: number;
  name: string;
  groupName: string;
}

export interface OfficialImportRemovedDuplicateEntry {
  id: number;
  name: string;
  groupName: string;
}

export interface OfficialImportUnresolvedEntry {
  groupName: string;
  symbol?: string;
  isin?: string;
  name?: string;
}

export interface OfficialImportResult {
  createdWatchlists: OfficialImportCreatedEntry[];
  replacedWatchlists: OfficialImportReplacedEntry[];
  skippedExistingWatchlists: OfficialImportSkippedEntry[];
  removedDuplicateWatchlists: OfficialImportRemovedDuplicateEntry[];
  unresolvedMembers: OfficialImportUnresolvedEntry[];
  /** id to select after import — first created, then first replaced, then first skipped */
  selectWatchlistId: number | null;
}

export interface OfficialUpdateResult {
  watchlistName: string;
  sourceKey: string | null | undefined;
  added: number;
  removed: number;
  unchanged: number;
  unresolvedCount: number;
}

function normalizeWatchlistName(name: string): string {
  return name.trim().toLowerCase();
}

function chooseCanonicalOfficialWatchlist(
  watchlists: Watchlist[],
  requestedName: string,
): Watchlist {
  return [...watchlists].sort((left, right) => {
    const leftExactName = normalizeWatchlistName(left.name) === normalizeWatchlistName(requestedName);
    const rightExactName = normalizeWatchlistName(right.name) === normalizeWatchlistName(requestedName);
    if (leftExactName !== rightExactName) {
      return leftExactName ? -1 : 1;
    }
    return left.id - right.id;
  })[0];
}

function removeTrackedWatchlist(
  watchlist: Watchlist,
  existingWatchlistsByNormalizedName: Map<string, Watchlist[]>,
  existingOfficialWatchlistsBySignature: Map<string, Watchlist[]>,
): void {
  const normalizedName = normalizeWatchlistName(watchlist.name);
  const sameNameWatchlists = existingWatchlistsByNormalizedName.get(normalizedName) ?? [];
  const nextSameNameWatchlists = sameNameWatchlists.filter((candidate) => candidate.id !== watchlist.id);
  if (nextSameNameWatchlists.length) {
    existingWatchlistsByNormalizedName.set(normalizedName, nextSameNameWatchlists);
  } else {
    existingWatchlistsByNormalizedName.delete(normalizedName);
  }

  const signature = officialWatchlistSourceSignature(watchlist.sourceMeta);
  if (!signature) {
    return;
  }

  const sameSourceWatchlists = existingOfficialWatchlistsBySignature.get(signature) ?? [];
  const nextSameSourceWatchlists = sameSourceWatchlists.filter((candidate) => candidate.id !== watchlist.id);
  if (nextSameSourceWatchlists.length) {
    existingOfficialWatchlistsBySignature.set(signature, nextSameSourceWatchlists);
  } else {
    existingOfficialWatchlistsBySignature.delete(signature);
  }
}

type SearchResultsCache = Map<string, Promise<InstrumentSummary[]>>;

function officialWatchlistSearchCacheKey(exchange: 'NSE' | 'BSE', query: string): string {
  return `${exchange}:${query.trim().toUpperCase()}`;
}

async function getCachedSearchResults(
  api: DesktopApi,
  exchange: 'NSE' | 'BSE',
  query: string,
  searchResultsCache: SearchResultsCache,
): Promise<InstrumentSummary[]> {
  const cacheKey = officialWatchlistSearchCacheKey(exchange, query);
  const cachedResult = searchResultsCache.get(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  const pendingResult = api
    .searchSymbols({ query, exchange })
    .catch(() => [] satisfies InstrumentSummary[]);
  searchResultsCache.set(cacheKey, pendingResult);
  return pendingResult;
}

async function resolveOfficialWatchlistMemberWithFallback(
  api: DesktopApi,
  exchange: 'NSE' | 'BSE',
  member: Parameters<typeof resolveOfficialWatchlistMember>[1],
  lookupMaps: ReturnType<typeof buildOfficialWatchlistLookupMaps>,
  searchResultsCache: SearchResultsCache,
): Promise<InstrumentSummary | null> {
  const directMatch = resolveOfficialWatchlistMember(
    exchange,
    member,
    lookupMaps.bySymbol,
    lookupMaps.byIsin,
    lookupMaps.byName,
  );
  if (directMatch) {
    return directMatch;
  }

  const fallbackQueries = [member.symbol, member.name]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  for (const query of fallbackQueries) {
    const candidates = await getCachedSearchResults(api, exchange, query, searchResultsCache);
    const fallbackMatch = pickOfficialWatchlistSearchCandidate(exchange, member, candidates);
    if (fallbackMatch) {
      return fallbackMatch;
    }
  }

  return null;
}

export async function runOfficialWatchlistImport(
  existingWatchlists: Watchlist[],
  sourceId: OfficialWatchlistSourceId,
  groupIds: string[],
): Promise<OfficialImportResult> {
  const api = getDesktopApi();
  if (!api) {
    throw new Error('Open a database before importing watchlist groups.');
  }

  const source = getOfficialWatchlistSource(sourceId);
  if (!source) {
    throw new Error('The selected watchlist source is unavailable.');
  }

  const groups = await loadOfficialWatchlistGroups(sourceId, groupIds);
  if (!groups.length) {
    throw new Error('No watchlist groups were selected for import.');
  }

  const instrumentCatalog = await api.listSymbols({ limit: 10000 });
  const lookupMaps = buildOfficialWatchlistLookupMaps(instrumentCatalog);
  const searchResultsCache = new Map<string, Promise<InstrumentSummary[]>>();

  const existingNames = new Set(
    (existingWatchlists ?? []).map((watchlist) => normalizeWatchlistName(watchlist.name)),
  );
  const existingOfficialWatchlistsBySignature = new Map<string, Watchlist[]>();
  const existingWatchlistsByNormalizedName = new Map<string, Watchlist[]>();
  (existingWatchlists ?? []).forEach((watchlist) => {
    const normalizedName = normalizeWatchlistName(watchlist.name);
    const sameNameWatchlists = existingWatchlistsByNormalizedName.get(normalizedName) ?? [];
    sameNameWatchlists.push(watchlist);
    existingWatchlistsByNormalizedName.set(normalizedName, sameNameWatchlists);

    const signature = officialWatchlistSourceSignature(watchlist.sourceMeta);
    if (signature) {
      const sameSourceWatchlists = existingOfficialWatchlistsBySignature.get(signature) ?? [];
      sameSourceWatchlists.push(watchlist);
      existingOfficialWatchlistsBySignature.set(signature, sameSourceWatchlists);
    }
  });

  const createdWatchlists: OfficialImportCreatedEntry[] = [];
  const replacedWatchlists: OfficialImportReplacedEntry[] = [];
  const skippedExistingWatchlists: OfficialImportSkippedEntry[] = [];
  const removedDuplicateWatchlists: OfficialImportRemovedDuplicateEntry[] = [];
  const unresolvedMembers: OfficialImportUnresolvedEntry[] = [];

  for (const group of groups) {
    const requestedName = `${source.watchlistPrefix} - ${group.name}`;
    const requestedNameKey = normalizeWatchlistName(requestedName);
    const sourceMetaTemplate = buildOfficialWatchlistSourceLinkMeta(sourceId, group, null);
    const sourceSignature = officialWatchlistSourceSignature(sourceMetaTemplate);
    const syncedAt = new Date().toISOString();
    const sourceMeta = {
      ...sourceMetaTemplate,
      lastSyncedAt: syncedAt,
    };
    const resolvedMembers = new Map<string, InstrumentKey>();

    for (const member of group.members) {
      const resolvedInstrument = await resolveOfficialWatchlistMemberWithFallback(
        api,
        source.exchange,
        member,
        lookupMaps,
        searchResultsCache,
      );
      if (!resolvedInstrument) {
        unresolvedMembers.push({
          groupName: group.name,
          symbol: member.symbol,
          isin: member.isin,
          name: member.name,
        });
        continue;
      }

      const instrumentKey = instrumentSymbolKey(
        resolvedInstrument.exchange,
        resolvedInstrument.symbol,
      );
      resolvedMembers.set(instrumentKey, {
        symbol: resolvedInstrument.symbol,
        exchange: resolvedInstrument.exchange,
      });
    }

    const importedMembers = [...resolvedMembers.values()];
    const linkedWatchlists = sourceSignature
      ? [...(existingOfficialWatchlistsBySignature.get(sourceSignature) ?? [])]
      : [];
    if (linkedWatchlists.length) {
      const replaceTarget = chooseCanonicalOfficialWatchlist(linkedWatchlists, requestedName);
      const duplicateLinkedWatchlists = linkedWatchlists.filter(
        (watchlist) => watchlist.id !== replaceTarget.id,
      );

      await replaceSourceLinkedWatchlist({
        watchlistId: replaceTarget.id,
        members: importedMembers,
        sourceMeta,
      });

      for (const duplicateWatchlist of duplicateLinkedWatchlists) {
        await deleteWatchlist(duplicateWatchlist.id);
        removeTrackedWatchlist(
          duplicateWatchlist,
          existingWatchlistsByNormalizedName,
          existingOfficialWatchlistsBySignature,
        );
        removedDuplicateWatchlists.push({
          id: duplicateWatchlist.id,
          name: duplicateWatchlist.name,
          groupName: group.name,
        });
      }

      existingOfficialWatchlistsBySignature.set(sourceSignature!, [
        {
          ...replaceTarget,
          name: replaceTarget.name,
          sourceMeta,
          items: replaceTarget.items,
        },
      ]);

      replacedWatchlists.push({
        id: replaceTarget.id,
        name: replaceTarget.name,
        groupName: group.name,
        importedCount: importedMembers.length,
      });
      console.info('[official-watchlist-import] watchlist-replaced', {
        sourceId,
        group: group.name,
        watchlistId: replaceTarget.id,
        watchlistName: replaceTarget.name,
        symbolCount: importedMembers.length,
        removedDuplicateWatchlistIds: duplicateLinkedWatchlists.map((watchlist) => watchlist.id),
      });
      continue;
    }

    const exactNameMatches = existingWatchlistsByNormalizedName.get(requestedNameKey) ?? [];
    const replaceTarget = exactNameMatches.length === 1 ? exactNameMatches[0] : null;

    if (replaceTarget) {
      await replaceSourceLinkedWatchlist({
        watchlistId: replaceTarget.id,
        members: importedMembers,
        sourceMeta,
      });
      if (sourceSignature) {
        existingOfficialWatchlistsBySignature.set(sourceSignature, [{
          ...replaceTarget,
          sourceMeta,
          items: replaceTarget.items,
        }]);
      }

      replacedWatchlists.push({
        id: replaceTarget.id,
        name: replaceTarget.name,
        groupName: group.name,
        importedCount: importedMembers.length,
      });
      console.info('[official-watchlist-import] watchlist-replaced', {
        sourceId,
        group: group.name,
        watchlistId: replaceTarget.id,
        watchlistName: replaceTarget.name,
        symbolCount: importedMembers.length,
      });
      continue;
    }

    if (exactNameMatches.length > 1) {
      console.warn('[official-watchlist-import] ambiguous-name-match', {
        sourceId,
        group: group.name,
        requestedName,
        watchlistIds: exactNameMatches.map((watchlist) => watchlist.id),
      });
    }

    const watchlistName = buildUniqueWatchlistName(requestedName, existingNames);
    const watchlist = await createWatchlist({ name: watchlistName, sourceMeta: null }, sourceMeta);
    if (sourceSignature) {
      existingOfficialWatchlistsBySignature.set(sourceSignature, [{
        ...watchlist,
        sourceMeta,
        items: [],
      }]);
    }

    for (const instrument of importedMembers) {
      await addInstrumentToWatchlist(watchlist.id, instrument);
    }

    createdWatchlists.push({
      id: watchlist.id,
      name: watchlistName,
      groupName: group.name,
      importedCount: importedMembers.length,
    });
    console.info('[official-watchlist-import] watchlist-created', {
      sourceId,
      group: group.name,
      watchlistName,
      symbolCount: importedMembers.length,
    });
  }

  if (unresolvedMembers.length) {
    console.warn('[official-watchlist-import] unresolved-symbols', unresolvedMembers);
  }

  return {
    createdWatchlists,
    replacedWatchlists,
    skippedExistingWatchlists,
    removedDuplicateWatchlists,
    unresolvedMembers,
    selectWatchlistId:
      createdWatchlists[0]?.id ??
      replacedWatchlists[0]?.id ??
      skippedExistingWatchlists[0]?.id ??
      null,
  };
}

export async function runOfficialWatchlistUpdate(watchlist: Watchlist): Promise<OfficialUpdateResult> {
  const api = getDesktopApi();
  if (!api) {
    throw new Error('Open a database before updating an imported watchlist.');
  }

  const sourceMeta = watchlist.sourceMeta;
  const resolvedSource = sourceMeta
    ? await loadOfficialWatchlistGroupBySourceLinkMeta(sourceMeta)
    : null;
  if (!sourceMeta || !resolvedSource) {
    throw new Error('The selected watchlist is not linked to a supported source.');
  }

  const instrumentCatalog = await api.listSymbols({ limit: 10000 });
  const lookupMaps = buildOfficialWatchlistLookupMaps(instrumentCatalog);
  const searchResultsCache = new Map<string, Promise<InstrumentSummary[]>>();
  const unresolvedMembers: Array<{ symbol?: string; isin?: string; name?: string }> = [];
  const resolvedMembers = new Map<string, InstrumentKey>();

  for (const member of resolvedSource.group.members) {
    const resolvedInstrument = await resolveOfficialWatchlistMemberWithFallback(
      api,
      resolvedSource.source.exchange,
      member,
      lookupMaps,
      searchResultsCache,
    );

    if (!resolvedInstrument) {
      unresolvedMembers.push({
        symbol: member.symbol,
        isin: member.isin,
        name: member.name,
      });
      continue;
    }

    const instrumentKey = instrumentSymbolKey(
      resolvedInstrument.exchange,
      resolvedInstrument.symbol,
    );
    resolvedMembers.set(instrumentKey, {
      symbol: resolvedInstrument.symbol,
      exchange: resolvedInstrument.exchange,
    });
  }

  const currentMembers = new Map<string, InstrumentKey>();
  watchlist.items.forEach((item) => {
    currentMembers.set(instrumentSymbolKey(item.exchange, item.symbol), {
      symbol: item.symbol,
      exchange: item.exchange,
    });
  });

  const symbolsToAdd = [...resolvedMembers.entries()]
    .filter(([key]) => !currentMembers.has(key))
    .map(([, instrument]) => instrument);
  const symbolsToRemove = [...currentMembers.entries()]
    .filter(([key]) => !resolvedMembers.has(key))
    .map(([, instrument]) => instrument);
  const unchangedCount = [...resolvedMembers.keys()].filter((key) => currentMembers.has(key)).length;
  const lastSyncedAt = new Date().toISOString();

  await applyOfficialWatchlistUpdate({
    watchlistId: watchlist.id,
    symbolsToAdd,
    symbolsToRemove,
    lastSyncedAt,
  });

  if (unresolvedMembers.length) {
    console.warn('[official-watchlist-update] unresolved-symbols', {
      watchlistName: watchlist.name,
      sourceKey: sourceMeta.sourceKey,
      unresolvedMembers,
    });
  }

  console.info('[official-watchlist-update] summary', {
    watchlistName: watchlist.name,
    sourceKey: sourceMeta.sourceKey,
    added: symbolsToAdd.length,
    removed: symbolsToRemove.length,
    unchanged: unchangedCount,
    unresolved: unresolvedMembers.length,
  });

  return {
    watchlistName: watchlist.name,
    sourceKey: sourceMeta.sourceKey,
    added: symbolsToAdd.length,
    removed: symbolsToRemove.length,
    unchanged: unchangedCount,
    unresolvedCount: unresolvedMembers.length,
  };
}
