import { getDesktopApi } from '@/platform';
import { officialWatchlistCatalogSnapshot } from './generated/officialWatchlistCatalog.generated';
import { createOfficialWatchlistSourceLoaderCache } from './officialWatchlistLazyLoader';

export type OfficialWatchlistSourceId =
  | 'nse-sectors'
  | 'nse-indices'
  | 'nse-all-stocks-sectors'
  | 'bse-sectors'
  | 'bse-indices'
  | 'bse-all-stocks-sectors';

export type OfficialWatchlistGroupType = 'sector' | 'index';

export interface OfficialWatchlistMember {
  symbol?: string;
  isin?: string;
  name?: string;
}

export interface OfficialWatchlistGroupMeta {
  id: string;
  name: string;
  exchange: 'NSE' | 'BSE';
  officialSourceUrl: string;
  memberCount: number;
}

export interface OfficialWatchlistGroup extends OfficialWatchlistGroupMeta {
  members: OfficialWatchlistMember[];
}

export interface OfficialWatchlistSourceMeta {
  id: OfficialWatchlistSourceId;
  label: string;
  watchlistPrefix: string;
  exchange: 'NSE' | 'BSE';
  refreshMode?: 'live' | 'snapshot';
  groups: OfficialWatchlistGroupMeta[];
}

export interface OfficialWatchlistSource extends Omit<OfficialWatchlistSourceMeta, 'groups'> {
  groups: OfficialWatchlistGroup[];
}

export interface OfficialWatchlistSourceLinkMeta {
  sourceType: 'official';
  sourceExchange: 'NSE' | 'BSE';
  sourceGroupType: OfficialWatchlistGroupType;
  sourceKey: string;
  sourceDisplayName: string;
  lastSyncedAt: string | null;
}

interface OfficialWatchlistGroupMetaResolution {
  sourceId: OfficialWatchlistSourceId;
  source: OfficialWatchlistSourceMeta;
  group: OfficialWatchlistGroupMeta;
}

interface OfficialWatchlistGroupResolution {
  sourceId: OfficialWatchlistSourceId;
  source: OfficialWatchlistSource;
  group: OfficialWatchlistGroup;
}

const OFFICIAL_WATCHLIST_PROVIDER_LOG_PREFIX = '[official-watchlist-provider]';
const PARTIAL_GROUP_IDS = new Set<string>();

const officialWatchlistSources = (
  officialWatchlistCatalogSnapshot as unknown as { sources: OfficialWatchlistSourceMeta[] }
).sources.map((source) => ({
  ...source,
  groups: source.groups.filter((group) => !PARTIAL_GROUP_IDS.has(group.id)),
}));

const sourceMap = new Map<OfficialWatchlistSourceId, OfficialWatchlistSourceMeta>(
  officialWatchlistSources.map((source) => [source.id, source]),
);

function extractSingleSource(
  snapshot: unknown,
  expectedSourceId: OfficialWatchlistSourceId,
): OfficialWatchlistSource {
  const sources = (snapshot as { sources?: Array<Record<string, unknown>> } | null)?.sources;
  if (!Array.isArray(sources) || sources.length !== 1) {
    throw new Error(`Official watchlist payload mismatch for ${expectedSourceId}: expected exactly one source.`);
  }

  const source = sources[0] as unknown as Omit<OfficialWatchlistSource, 'groups'> & {
    groups: Array<Omit<OfficialWatchlistGroup, 'memberCount'>>;
  };
  if (source.id !== expectedSourceId) {
    throw new Error(
      `Official watchlist payload mismatch for ${expectedSourceId}: received source ${String(source.id)}.`,
    );
  }

  return {
    ...source,
    groups: source.groups
      .filter((group) => !PARTIAL_GROUP_IDS.has(group.id))
      .map((group) =>
        normalizeOfficialWatchlistGroup(expectedSourceId, {
          ...group,
          memberCount: group.members.length,
        }),
      ),
  };
}

function validateSourceAgainstCatalog(
  sourceId: OfficialWatchlistSourceId,
  source: OfficialWatchlistSource,
): OfficialWatchlistSource {
  const meta = getOfficialWatchlistSource(sourceId);
  if (!meta) {
    throw new Error(`Official watchlist payload mismatch for ${sourceId}: catalog source missing.`);
  }

  for (const field of ['id', 'label', 'watchlistPrefix', 'exchange', 'refreshMode'] as const) {
    if (source[field] !== meta[field]) {
      throw new Error(
        `Official watchlist payload mismatch for ${sourceId}: ${field} expected ${String(meta[field])}, received ${String(source[field])}.`,
      );
    }
  }
  if (source.groups.length !== meta.groups.length) {
    throw new Error(
      `Official watchlist payload mismatch for ${sourceId}: expected ${meta.groups.length} groups, received ${source.groups.length}.`,
    );
  }

  meta.groups.forEach((groupMeta, index) => {
    const group = source.groups[index];
    if (!group) {
      throw new Error(`Official watchlist payload mismatch for ${sourceId}: group ${groupMeta.id} missing.`);
    }
    for (const field of ['id', 'name', 'exchange', 'officialSourceUrl'] as const) {
      if (group[field] !== groupMeta[field]) {
        throw new Error(
          `Official watchlist payload mismatch for ${sourceId}: group ${groupMeta.id} ${field} differs from catalog.`,
        );
      }
    }
    if (group.members.length !== groupMeta.memberCount) {
      throw new Error(
        `Official watchlist payload mismatch for ${sourceId}: group ${groupMeta.id} expected ${groupMeta.memberCount} members, received ${group.members.length}.`,
      );
    }
  });
  return source;
}

const sourceLoaders: Record<OfficialWatchlistSourceId, () => Promise<OfficialWatchlistSource>> = {
  'nse-sectors': async () =>
    validateSourceAgainstCatalog(
      'nse-sectors',
      extractSingleSource(
        (await import('./generated/officialWatchlistNseSectors.generated')).officialWatchlistNseSectorsSourceSnapshot,
        'nse-sectors',
      ),
    ),
  'nse-indices': async () =>
    validateSourceAgainstCatalog(
      'nse-indices',
      extractSingleSource(
        (await import('./generated/officialWatchlistNseIndices.generated')).officialWatchlistNseIndicesSourceSnapshot,
        'nse-indices',
      ),
    ),
  'nse-all-stocks-sectors': async () =>
    validateSourceAgainstCatalog(
      'nse-all-stocks-sectors',
      extractSingleSource(
        (await import('./nseSectorUniverseWatchlistData.generated')).nseSectorUniverseWatchlistSourceSnapshot,
        'nse-all-stocks-sectors',
      ),
    ),
  'bse-sectors': async () =>
    validateSourceAgainstCatalog(
      'bse-sectors',
      extractSingleSource(
        (await import('./generated/officialWatchlistBseSectors.generated')).officialWatchlistBseSectorsSourceSnapshot,
        'bse-sectors',
      ),
    ),
  'bse-indices': async () =>
    validateSourceAgainstCatalog(
      'bse-indices',
      extractSingleSource(
        (await import('./generated/officialWatchlistBseIndices.generated')).officialWatchlistBseIndicesSourceSnapshot,
        'bse-indices',
      ),
    ),
  'bse-all-stocks-sectors': async () =>
    validateSourceAgainstCatalog(
      'bse-all-stocks-sectors',
      extractSingleSource(
        (await import('./bseSectorUniverseWatchlistData.generated')).bseSectorUniverseWatchlistSourceSnapshot,
        'bse-all-stocks-sectors',
      ),
    ),
};

const sourceLoaderCache = createOfficialWatchlistSourceLoaderCache(sourceLoaders);

export function listOfficialWatchlistSources(): OfficialWatchlistSourceMeta[] {
  return officialWatchlistSources;
}

export function getOfficialWatchlistSource(
  sourceId: OfficialWatchlistSourceId,
): OfficialWatchlistSourceMeta | null {
  return sourceMap.get(sourceId) ?? null;
}

export function getOfficialWatchlistGroups(
  sourceId: OfficialWatchlistSourceId,
): OfficialWatchlistGroupMeta[] {
  return getOfficialWatchlistSource(sourceId)?.groups ?? [];
}

export function loadOfficialWatchlistSource(
  sourceId: OfficialWatchlistSourceId,
): Promise<OfficialWatchlistSource> {
  return sourceLoaderCache.load(sourceId);
}

export async function loadOfficialWatchlistGroups(
  sourceId: OfficialWatchlistSourceId,
  groupIds?: string[],
): Promise<OfficialWatchlistGroup[]> {
  const sourceMeta = getOfficialWatchlistSource(sourceId);
  if (!sourceMeta) return [];

  const snapshotSource = await loadOfficialWatchlistSource(sourceId);
  const requestedIds = groupIds?.length ? new Set(groupIds) : null;
  const snapshotGroups = snapshotSource.groups.filter(
    (group) => !requestedIds || requestedIds.has(group.id),
  );
  return Promise.all(
    snapshotGroups.map((group) => loadOfficialWatchlistGroup(sourceId, sourceMeta, group)),
  );
}

export function getOfficialWatchlistGroupType(
  sourceId: OfficialWatchlistSourceId,
): OfficialWatchlistGroupType {
  return sourceId.endsWith('sectors') ? 'sector' : 'index';
}

export function toOfficialWatchlistSourceKey(groupId: string): string {
  return groupId
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

export function buildOfficialWatchlistSourceLinkMeta(
  sourceId: OfficialWatchlistSourceId,
  group: OfficialWatchlistGroupMeta,
  lastSyncedAt: string | null,
): OfficialWatchlistSourceLinkMeta {
  const source = getOfficialWatchlistSource(sourceId);
  if (!source) throw new Error(`Unknown official watchlist source: ${sourceId}`);
  return {
    sourceType: 'official',
    sourceExchange: source.exchange,
    sourceGroupType: getOfficialWatchlistGroupType(sourceId),
    sourceKey: toOfficialWatchlistSourceKey(group.id),
    sourceDisplayName: group.name,
    lastSyncedAt,
  };
}

export function findOfficialWatchlistGroupBySourceLinkMeta(meta: {
  sourceType?: string | null;
  sourceExchange?: string | null;
  sourceGroupType?: string | null;
  sourceKey?: string | null;
}): OfficialWatchlistGroupMetaResolution | null {
  if (
    meta.sourceType !== 'official' ||
    (meta.sourceExchange !== 'NSE' && meta.sourceExchange !== 'BSE') ||
    (meta.sourceGroupType !== 'sector' && meta.sourceGroupType !== 'index') ||
    !meta.sourceKey
  ) return null;

  for (const source of officialWatchlistSources) {
    if (source.exchange !== meta.sourceExchange) continue;
    if (getOfficialWatchlistGroupType(source.id) !== meta.sourceGroupType) continue;
    const group = source.groups.find(
      (candidate) => toOfficialWatchlistSourceKey(candidate.id) === meta.sourceKey,
    );
    if (group) return { sourceId: source.id, source, group };
  }
  return null;
}

export async function loadOfficialWatchlistGroupBySourceLinkMeta(meta: {
  sourceType?: string | null;
  sourceExchange?: string | null;
  sourceGroupType?: string | null;
  sourceKey?: string | null;
}): Promise<OfficialWatchlistGroupResolution | null> {
  const catalogResolution = findOfficialWatchlistGroupBySourceLinkMeta(meta);
  if (!catalogResolution) return null;

  const snapshotSource = await loadOfficialWatchlistSource(catalogResolution.sourceId);
  const snapshotGroup = snapshotSource.groups.find(
    (group) => group.id === catalogResolution.group.id,
  );
  if (!snapshotGroup) {
    throw new Error(`Official watchlist payload missing catalog group ${catalogResolution.group.id}.`);
  }
  return {
    sourceId: catalogResolution.sourceId,
    source: snapshotSource,
    group: await loadOfficialWatchlistGroup(
      catalogResolution.sourceId,
      catalogResolution.source,
      snapshotGroup,
    ),
  };
}

async function loadOfficialWatchlistGroup(
  sourceId: OfficialWatchlistSourceId,
  source: OfficialWatchlistSourceMeta,
  snapshotGroup: OfficialWatchlistGroup,
): Promise<OfficialWatchlistGroup> {
  if (source.refreshMode === 'snapshot') {
    return normalizeOfficialWatchlistGroup(sourceId, snapshotGroup);
  }

  try {
    const sourceText = await fetchOfficialWatchlistSourceText(snapshotGroup.officialSourceUrl);
    const members = parseOfficialWatchlistMembers(sourceId, source, snapshotGroup, sourceText);
    if (!members.length) throw new Error('Parsed zero constituents from live source.');

    console.info(`${OFFICIAL_WATCHLIST_PROVIDER_LOG_PREFIX} live-fetch-success`, {
      sourceId,
      groupId: snapshotGroup.id,
      url: snapshotGroup.officialSourceUrl,
      memberCount: members.length,
    });
    return {
      ...snapshotGroup,
      memberCount: members.length,
      members: sortOfficialWatchlistMembers(sourceId, members),
    };
  } catch (error) {
    console.warn(`${OFFICIAL_WATCHLIST_PROVIDER_LOG_PREFIX} fallback-snapshot`, {
      sourceId,
      groupId: snapshotGroup.id,
      url: snapshotGroup.officialSourceUrl,
      snapshotMemberCount: snapshotGroup.members.length,
      error: error instanceof Error ? error.message : String(error),
    });
    return normalizeOfficialWatchlistGroup(sourceId, snapshotGroup);
  }
}

function normalizeOfficialWatchlistGroup(
  sourceId: OfficialWatchlistSourceId,
  group: OfficialWatchlistGroup,
): OfficialWatchlistGroup {
  return {
    ...group,
    memberCount: group.members.length,
    members: sortOfficialWatchlistMembers(sourceId, group.members),
  };
}

function sortOfficialWatchlistMembers(
  sourceId: OfficialWatchlistSourceId,
  members: OfficialWatchlistMember[],
): OfficialWatchlistMember[] {
  if (sourceId !== 'nse-all-stocks-sectors' && sourceId !== 'bse-all-stocks-sectors') {
    return members;
  }
  return [...members].sort((left, right) => {
    const leftKey = (left.symbol ?? left.name ?? '').trim().toUpperCase();
    const rightKey = (right.symbol ?? right.name ?? '').trim().toUpperCase();
    return (
      leftKey.localeCompare(rightKey) ||
      (left.name ?? '').localeCompare(right.name ?? '') ||
      (left.isin ?? '').localeCompare(right.isin ?? '')
    );
  });
}

async function fetchOfficialWatchlistSourceText(url: string): Promise<string> {
  const api = getDesktopApi();
  if (!api?.fetchOfficialWatchlistSource) {
    throw new Error('Desktop API bridge is unavailable for live official watchlist fetch.');
  }
  return api.fetchOfficialWatchlistSource({ url });
}

function parseOfficialWatchlistMembers(
  sourceId: OfficialWatchlistSourceId,
  _source: OfficialWatchlistSourceMeta,
  group: OfficialWatchlistGroup,
  sourceText: string,
): OfficialWatchlistMember[] {
  const trimmed = sourceText.trim();
  if (trimmed.startsWith('<') || trimmed.includes('<html') || trimmed.includes('<table')) {
    return parseBseHtmlMembers(sourceId, group, sourceText);
  }

  return parseCsvMembers(sourceId, group, sourceText);
}

function parseCsvMembers(
  sourceId: OfficialWatchlistSourceId,
  group: OfficialWatchlistGroup,
  csvText: string,
): OfficialWatchlistMember[] {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) {
    throw new Error('Live source did not include any constituent rows.');
  }

  const headers = rows[0].map(normalizeHeaderToken);
  const symbolIndex = headers.findIndex(
    (header) => header === 'symbol' || header === 'securitycode' || header === 'scripcode',
  );
  const isinIndex = headers.findIndex((header) => header === 'isincode' || header === 'isin');
  const nameIndex = headers.findIndex(
    (header) =>
      header === 'companyname' || header === 'constituents' || header === 'securityname' || header === 'name',
  );

  if (symbolIndex < 0 && isinIndex < 0 && nameIndex < 0) {
    throw new Error('Live source headers did not include Symbol, ISIN, or Company Name.');
  }

  const parsedMembers = rows.slice(1).map((row) => ({
    symbol: symbolIndex >= 0 ? normalizeProviderToken(row[symbolIndex]) : undefined,
    isin: isinIndex >= 0 ? normalizeProviderToken(row[isinIndex]) : undefined,
    name: nameIndex >= 0 ? normalizeProviderName(row[nameIndex]) : undefined,
  }));

  return finalizeParsedMembers(sourceId, group, parsedMembers);
}

function parseBseHtmlMembers(
  sourceId: OfficialWatchlistSourceId,
  group: OfficialWatchlistGroup,
  htmlText: string,
): OfficialWatchlistMember[] {
  if (/Page\$\d+/i.test(htmlText)) {
    throw new Error('Live BSE source is paginated; using packaged snapshot fallback.');
  }

  if (typeof DOMParser === 'undefined') {
    throw new Error('DOMParser is unavailable for live BSE parsing.');
  }

  const document = new DOMParser().parseFromString(htmlText, 'text/html');
  const table = document.querySelector('#ContentPlaceHolder1_gvData');
  if (!table) {
    throw new Error('Live BSE source did not include the constituent table.');
  }

  const rows = Array.from(table.querySelectorAll('tr'));
  if (!rows.length) {
    throw new Error('Live BSE source table did not include constituent rows.');
  }

  const parsedMembers = rows
    .slice(1)
    .map((row) => Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent ?? ''))
    .filter((cells) => cells.length >= 3)
    .map((cells) => ({
      name: normalizeProviderName(cells[1]),
      isin: normalizeProviderToken(cells[2]),
    }));

  return finalizeParsedMembers(sourceId, group, parsedMembers);
}

function finalizeParsedMembers(
  sourceId: OfficialWatchlistSourceId,
  group: OfficialWatchlistGroup,
  parsedMembers: OfficialWatchlistMember[],
): OfficialWatchlistMember[] {
  const filteredMembers = parsedMembers.filter((member) => Boolean(member.symbol || member.isin || member.name));
  const dedupedMembers: OfficialWatchlistMember[] = [];
  const seen = new Set<string>();

  filteredMembers.forEach((member) => {
    const key = [member.isin ?? '', member.symbol ?? '', member.name ?? ''].join('|').toUpperCase();
    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    dedupedMembers.push(member);
  });

  console.info(`${OFFICIAL_WATCHLIST_PROVIDER_LOG_PREFIX} normalization`, {
    sourceId,
    groupId: group.id,
    parsedCount: parsedMembers.length,
    keptCount: dedupedMembers.length,
    droppedCount: parsedMembers.length - dedupedMembers.length,
  });

  return dedupedMembers;
}

function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  const input = csvText.replace(/^\uFEFF/, '');

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const nextChar = input[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ',') {
      currentRow.push(currentField);
      currentField = '';
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }

      currentRow.push(currentField);
      if (currentRow.some((field) => field.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
      continue;
    }

    currentField += char;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((field) => field.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function normalizeHeaderToken(value: string | undefined): string {
  return (value ?? '').replace(/[^a-z0-9]+/gi, '').toLowerCase();
}

function normalizeProviderToken(value: string | undefined): string | undefined {
  const trimmed = (value ?? '').replace(/\u00A0/g, ' ').trim();
  return trimmed || undefined;
}

function normalizeProviderName(value: string | undefined): string | undefined {
  const trimmed = normalizeProviderToken(value);
  return trimmed ? trimmed.replace(/\s+/g, ' ') : undefined;
}
