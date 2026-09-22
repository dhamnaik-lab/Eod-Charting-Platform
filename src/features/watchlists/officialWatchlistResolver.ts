import type { InstrumentSummary } from '@/platform';
import type { OfficialWatchlistMember } from '@/features/watchlists/officialWatchlistProviders';

export function normalizeLookupToken(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase() ?? '';
  return normalized || null;
}

export function normalizeLookupName(value: string | null | undefined): string | null {
  const normalized =
    value
      ?.trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() ?? '';
  return normalized || null;
}

export function instrumentSymbolKey(exchange: string, symbol: string): string {
  return `${exchange}:${symbol}`;
}

export function instrumentIsinKey(exchange: string, isin: string): string {
  return `${exchange}:${isin}`;
}

export function instrumentNameKey(exchange: string, normalizedName: string): string {
  return `${exchange}:${normalizedName}`;
}

export function buildUniqueWatchlistName(baseName: string, existingNames: Set<string>): string {
  if (!existingNames.has(baseName.toLowerCase())) {
    existingNames.add(baseName.toLowerCase());
    return baseName;
  }

  let suffix = 2;
  while (existingNames.has(`${baseName.toLowerCase()} (${suffix})`)) {
    suffix += 1;
  }

  const nextName = `${baseName} (${suffix})`;
  existingNames.add(nextName.toLowerCase());
  return nextName;
}

export function officialWatchlistSourceSignature(
  meta:
    | {
        sourceType?: string | null;
        sourceExchange?: string | null;
        sourceGroupType?: string | null;
        sourceKey?: string | null;
      }
    | null
    | undefined,
): string | null {
  if (
    meta?.sourceType !== 'official' ||
    !meta.sourceExchange ||
    !meta.sourceGroupType ||
    !meta.sourceKey
  ) {
    return null;
  }

  return `${meta.sourceType}:${meta.sourceExchange}:${meta.sourceGroupType}:${meta.sourceKey}`.toUpperCase();
}

export function resolveOfficialWatchlistMember(
  exchange: 'NSE' | 'BSE',
  member: OfficialWatchlistMember,
  bySymbol: Map<string, InstrumentSummary>,
  byIsin: Map<string, InstrumentSummary>,
  byName?: Map<string, InstrumentSummary | null>,
): InstrumentSummary | null {
  const normalizedIsin = normalizeLookupToken(member.isin);
  if (normalizedIsin) {
    const exactByIsin = byIsin.get(instrumentIsinKey(exchange, normalizedIsin));
    if (exactByIsin) {
      return exactByIsin;
    }
  }

  const normalizedSymbol = normalizeLookupToken(member.symbol);
  if (normalizedSymbol) {
    const exactBySymbol = bySymbol.get(instrumentSymbolKey(exchange, normalizedSymbol));
    if (exactBySymbol) {
      return exactBySymbol;
    }
  }

  const normalizedName = normalizeLookupName(member.name);
  if (normalizedName && byName) {
    const exactByName = byName.get(instrumentNameKey(exchange, normalizedName));
    if (exactByName) {
      return exactByName;
    }
  }

  return null;
}

export function buildOfficialWatchlistLookupMaps(instrumentCatalog: InstrumentSummary[]): {
  bySymbol: Map<string, InstrumentSummary>;
  byIsin: Map<string, InstrumentSummary>;
  byName: Map<string, InstrumentSummary | null>;
} {
  const bySymbol = new Map<string, InstrumentSummary>();
  const byIsin = new Map<string, InstrumentSummary>();
  const byName = new Map<string, InstrumentSummary | null>();

  instrumentCatalog.forEach((instrument) => {
    const normalizedExchange = normalizeLookupToken(instrument.exchange);
    const normalizedSymbol = normalizeLookupToken(instrument.symbol);
    if (normalizedExchange && normalizedSymbol) {
      bySymbol.set(instrumentSymbolKey(normalizedExchange, normalizedSymbol), instrument);
    }

    const normalizedIsin = normalizeLookupToken(instrument.isin);
    if (normalizedExchange && normalizedIsin) {
      byIsin.set(instrumentIsinKey(normalizedExchange, normalizedIsin), instrument);
    }

    const normalizedName = normalizeLookupName(instrument.name);
    if (normalizedExchange && normalizedName) {
      const nameKey = instrumentNameKey(normalizedExchange, normalizedName);
      const existingByName = byName.get(nameKey);
      if (existingByName === undefined) {
        byName.set(nameKey, instrument);
      } else if (
        existingByName &&
        instrumentSymbolKey(existingByName.exchange, existingByName.symbol) !==
          instrumentSymbolKey(instrument.exchange, instrument.symbol)
      ) {
        byName.set(nameKey, null);
      }
    }
  });

  return { bySymbol, byIsin, byName };
}

function scoreOfficialWatchlistSearchCandidate(
  exchange: 'NSE' | 'BSE',
  member: OfficialWatchlistMember,
  candidate: InstrumentSummary,
): number | null {
  if (normalizeLookupToken(candidate.exchange) !== normalizeLookupToken(exchange)) {
    return null;
  }

  const normalizedMemberIsin = normalizeLookupToken(member.isin);
  if (
    normalizedMemberIsin &&
    normalizeLookupToken(candidate.isin) === normalizedMemberIsin
  ) {
    return 0;
  }

  const normalizedMemberSymbol = normalizeLookupToken(member.symbol);
  if (normalizedMemberSymbol) {
    if (normalizeLookupToken(candidate.symbol) === normalizedMemberSymbol) {
      return 1;
    }

    if (normalizeLookupToken(candidate.matchedSymbol) === normalizedMemberSymbol) {
      return 2;
    }
  }

  const normalizedMemberName = normalizeLookupName(member.name);
  if (normalizedMemberName) {
    if (normalizeLookupName(candidate.name) === normalizedMemberName) {
      return 3;
    }

    if (normalizeLookupName(candidate.matchedName) === normalizedMemberName) {
      return 4;
    }
  }

  return null;
}

export function pickOfficialWatchlistSearchCandidate(
  exchange: 'NSE' | 'BSE',
  member: OfficialWatchlistMember,
  candidates: InstrumentSummary[],
): InstrumentSummary | null {
  const scoredCandidates = candidates
    .map((candidate) => ({
      candidate,
      score: scoreOfficialWatchlistSearchCandidate(exchange, member, candidate),
    }))
    .filter(
      (entry): entry is { candidate: InstrumentSummary; score: number } =>
        entry.score !== null,
    )
    .sort((left, right) =>
      left.score - right.score ||
      left.candidate.symbol.localeCompare(right.candidate.symbol) ||
      left.candidate.exchange.localeCompare(right.candidate.exchange),
    );

  if (!scoredCandidates.length) {
    return null;
  }

  const bestScore = scoredCandidates[0].score;
  const bestMatches = scoredCandidates.filter((entry) => entry.score === bestScore);
  const uniqueBestCandidates = new Set(
    bestMatches.map((entry) =>
      instrumentSymbolKey(entry.candidate.exchange, entry.candidate.symbol),
    ),
  );

  if (uniqueBestCandidates.size !== 1) {
    return null;
  }

  return bestMatches[0].candidate;
}
