import { describe, expect, it } from 'vitest';
import type { InstrumentSummary } from '@/types/desktop';
import type { OfficialWatchlistMember } from '@/features/watchlists/officialWatchlistProviders';
import {
  buildOfficialWatchlistLookupMaps,
  buildUniqueWatchlistName,
  instrumentIsinKey,
  instrumentNameKey,
  instrumentSymbolKey,
  normalizeLookupName,
  normalizeLookupToken,
  officialWatchlistSourceSignature,
  pickOfficialWatchlistSearchCandidate,
  resolveOfficialWatchlistMember,
} from '@/features/watchlists/officialWatchlistResolver';

// ---------------------------------------------------------------------------
// normalizeLookupToken
// ---------------------------------------------------------------------------

describe('normalizeLookupToken', () => {
  it('trims and uppercases a normal string', () => {
    expect(normalizeLookupToken('  reliance  ')).toBe('RELIANCE');
  });

  it('returns null for an empty string', () => {
    expect(normalizeLookupToken('')).toBeNull();
  });

  it('returns null for a whitespace-only string', () => {
    expect(normalizeLookupToken('   ')).toBeNull();
  });

  it('returns null for null', () => {
    expect(normalizeLookupToken(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(normalizeLookupToken(undefined)).toBeNull();
  });

  it('uppercases mixed-case input', () => {
    expect(normalizeLookupToken('Infy')).toBe('INFY');
  });

  it('handles a string that is already uppercase', () => {
    expect(normalizeLookupToken('TCS')).toBe('TCS');
  });
});

// ---------------------------------------------------------------------------
// normalizeLookupName
// ---------------------------------------------------------------------------

describe('normalizeLookupName', () => {
  it('normalizes spacing, case, and punctuation', () => {
    expect(normalizeLookupName('  UltraTech   Cement Ltd.  ')).toBe('ULTRATECH CEMENT LTD');
  });

  it('returns null for empty input', () => {
    expect(normalizeLookupName('   ')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// instrumentSymbolKey
// ---------------------------------------------------------------------------

describe('instrumentSymbolKey', () => {
  it('formats exchange:symbol', () => {
    expect(instrumentSymbolKey('NSE', 'RELIANCE')).toBe('NSE:RELIANCE');
  });

  it('formats BSE exchange', () => {
    expect(instrumentSymbolKey('BSE', 'TATASTEEL')).toBe('BSE:TATASTEEL');
  });
});

// ---------------------------------------------------------------------------
// instrumentIsinKey
// ---------------------------------------------------------------------------

describe('instrumentIsinKey', () => {
  it('formats exchange:isin', () => {
    expect(instrumentIsinKey('NSE', 'INE002A01018')).toBe('NSE:INE002A01018');
  });

  it('formats BSE exchange', () => {
    expect(instrumentIsinKey('BSE', 'INE002A01018')).toBe('BSE:INE002A01018');
  });
});

// ---------------------------------------------------------------------------
// instrumentNameKey
// ---------------------------------------------------------------------------

describe('instrumentNameKey', () => {
  it('formats exchange:normalizedName', () => {
    expect(instrumentNameKey('NSE', 'ULTRATECH CEMENT LTD')).toBe('NSE:ULTRATECH CEMENT LTD');
  });
});

// ---------------------------------------------------------------------------
// buildUniqueWatchlistName
// ---------------------------------------------------------------------------

describe('buildUniqueWatchlistName', () => {
  it('returns the base name when the set is empty', () => {
    const existing = new Set<string>();
    const result = buildUniqueWatchlistName('NSE Sectors - IT', existing);
    expect(result).toBe('NSE Sectors - IT');
  });

  it('adds the base name (lowercased) to the set', () => {
    const existing = new Set<string>();
    buildUniqueWatchlistName('NSE Sectors - IT', existing);
    expect(existing.has('nse sectors - it')).toBe(true);
  });

  it('returns (2) suffix when base name already exists', () => {
    const existing = new Set(['nse sectors - it']);
    const result = buildUniqueWatchlistName('NSE Sectors - IT', existing);
    expect(result).toBe('NSE Sectors - IT (2)');
  });

  it('returns (3) suffix when (2) also already exists', () => {
    const existing = new Set(['nse sectors - it', 'nse sectors - it (2)']);
    const result = buildUniqueWatchlistName('NSE Sectors - IT', existing);
    expect(result).toBe('NSE Sectors - IT (3)');
  });

  it('adds the suffixed name (lowercased) to the set', () => {
    const existing = new Set(['nse sectors - it']);
    const result = buildUniqueWatchlistName('NSE Sectors - IT', existing);
    expect(existing.has(result.toLowerCase())).toBe(true);
  });

  it('mutates the set so the next call can detect the just-added name', () => {
    const existing = new Set<string>();
    buildUniqueWatchlistName('Alpha', existing);
    const second = buildUniqueWatchlistName('Alpha', existing);
    expect(second).toBe('Alpha (2)');
  });
});

// ---------------------------------------------------------------------------
// officialWatchlistSourceSignature
// ---------------------------------------------------------------------------

describe('officialWatchlistSourceSignature', () => {
  it('returns null for null input', () => {
    expect(officialWatchlistSourceSignature(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(officialWatchlistSourceSignature(undefined)).toBeNull();
  });

  it('returns null when sourceType is not "official"', () => {
    expect(
      officialWatchlistSourceSignature({
        sourceType: 'custom',
        sourceExchange: 'NSE',
        sourceGroupType: 'sector',
        sourceKey: 'nse-it',
      }),
    ).toBeNull();
  });

  it('returns null when sourceExchange is missing', () => {
    expect(
      officialWatchlistSourceSignature({
        sourceType: 'official',
        sourceExchange: null,
        sourceGroupType: 'sector',
        sourceKey: 'nse-it',
      }),
    ).toBeNull();
  });

  it('returns null when sourceGroupType is missing', () => {
    expect(
      officialWatchlistSourceSignature({
        sourceType: 'official',
        sourceExchange: 'NSE',
        sourceGroupType: null,
        sourceKey: 'nse-it',
      }),
    ).toBeNull();
  });

  it('returns null when sourceKey is missing', () => {
    expect(
      officialWatchlistSourceSignature({
        sourceType: 'official',
        sourceExchange: 'NSE',
        sourceGroupType: 'sector',
        sourceKey: null,
      }),
    ).toBeNull();
  });

  it('returns an uppercase canonical signature for a valid meta object', () => {
    expect(
      officialWatchlistSourceSignature({
        sourceType: 'official',
        sourceExchange: 'NSE',
        sourceGroupType: 'sector',
        sourceKey: 'nse-it',
      }),
    ).toBe('OFFICIAL:NSE:SECTOR:NSE-IT');
  });

  it('uppercases the full signature regardless of input casing', () => {
    expect(
      officialWatchlistSourceSignature({
        sourceType: 'official',
        sourceExchange: 'bse',
        sourceGroupType: 'index',
        sourceKey: 'bse-sensex',
      }),
    ).toBe('OFFICIAL:BSE:INDEX:BSE-SENSEX');
  });
});

// ---------------------------------------------------------------------------
// resolveOfficialWatchlistMember — ISIN-first, symbol fallback
// ---------------------------------------------------------------------------

describe('resolveOfficialWatchlistMember', () => {
  const makeInstrument = (
    exchange: string,
    symbol: string,
    isin?: string,
  ): InstrumentSummary => ({ exchange, symbol, isin: isin ?? null });

  const reliance: InstrumentSummary = makeInstrument('NSE', 'RELIANCE', 'INE002A01018');
  const infy: InstrumentSummary = makeInstrument('NSE', 'INFY', 'INE009A01021');
  const noIsin: InstrumentSummary = makeInstrument('NSE', 'NOISYN', undefined);

  function buildMaps(instruments: InstrumentSummary[]) {
    return buildOfficialWatchlistLookupMaps(instruments);
  }

  it('resolves by ISIN when ISIN matches', () => {
    const { bySymbol, byIsin } = buildMaps([reliance, infy]);
    const member: OfficialWatchlistMember = { isin: 'INE002A01018', symbol: 'RELIANCE' };
    expect(resolveOfficialWatchlistMember('NSE', member, bySymbol, byIsin)).toBe(reliance);
  });

  it('falls back to symbol when ISIN is absent', () => {
    const { bySymbol, byIsin } = buildMaps([reliance]);
    const member: OfficialWatchlistMember = { symbol: 'RELIANCE' };
    expect(resolveOfficialWatchlistMember('NSE', member, bySymbol, byIsin)).toBe(reliance);
  });

  it('falls back to symbol when ISIN does not match any instrument', () => {
    const { bySymbol, byIsin } = buildMaps([reliance]);
    // Provide wrong ISIN but correct symbol — symbol fallback must fire
    const member: OfficialWatchlistMember = { isin: 'INE000XXXXXX', symbol: 'RELIANCE' };
    expect(resolveOfficialWatchlistMember('NSE', member, bySymbol, byIsin)).toBe(reliance);
  });

  it('returns null when neither ISIN nor symbol matches', () => {
    const { bySymbol, byIsin } = buildMaps([reliance]);
    const member: OfficialWatchlistMember = { isin: 'INE000XXXXXX', symbol: 'UNKNOWN' };
    expect(resolveOfficialWatchlistMember('NSE', member, bySymbol, byIsin)).toBeNull();
  });

  it('returns null for an empty member', () => {
    const { bySymbol, byIsin } = buildMaps([reliance]);
    const member: OfficialWatchlistMember = {};
    expect(resolveOfficialWatchlistMember('NSE', member, bySymbol, byIsin)).toBeNull();
  });

  it('normalizes the member ISIN (lowercase input resolves correctly)', () => {
    const { bySymbol, byIsin } = buildMaps([reliance]);
    const member: OfficialWatchlistMember = { isin: 'ine002a01018' };
    expect(resolveOfficialWatchlistMember('NSE', member, bySymbol, byIsin)).toBe(reliance);
  });

  it('normalizes the member symbol (lowercase input resolves correctly)', () => {
    const { bySymbol, byIsin } = buildMaps([reliance]);
    const member: OfficialWatchlistMember = { symbol: 'reliance' };
    expect(resolveOfficialWatchlistMember('NSE', member, bySymbol, byIsin)).toBe(reliance);
  });

  it('resolves an instrument with no ISIN by symbol', () => {
    const { bySymbol, byIsin } = buildMaps([noIsin]);
    const member: OfficialWatchlistMember = { symbol: 'NOISYN' };
    expect(resolveOfficialWatchlistMember('NSE', member, bySymbol, byIsin)).toBe(noIsin);
  });

  it('resolves by unique normalized company name when symbol does not match', () => {
    const ultratech: InstrumentSummary = {
      exchange: 'NSE',
      symbol: 'ULTRACEMCO',
      isin: 'INE481G01011',
      name: 'UltraTech Cement Ltd.',
    };
    const { bySymbol, byIsin, byName } = buildMaps([ultratech]);
    const member: OfficialWatchlistMember = { symbol: 'ULTRATECH', name: 'UltraTech Cement Ltd' };

    expect(resolveOfficialWatchlistMember('NSE', member, bySymbol, byIsin, byName)).toBe(ultratech);
  });

  it('does not resolve ambiguous normalized company names', () => {
    const one: InstrumentSummary = {
      exchange: 'NSE',
      symbol: 'ABCONE',
      isin: 'INE000A01001',
      name: 'ABC Industries Ltd.',
    };
    const two: InstrumentSummary = {
      exchange: 'NSE',
      symbol: 'ABCTWO',
      isin: 'INE000A01002',
      name: 'ABC Industries Ltd',
    };
    const { bySymbol, byIsin, byName } = buildMaps([one, two]);
    const member: OfficialWatchlistMember = { name: 'ABC Industries Ltd.' };

    expect(resolveOfficialWatchlistMember('NSE', member, bySymbol, byIsin, byName)).toBeNull();
  });

  it('does not cross-resolve across exchanges (BSE member not found in NSE maps)', () => {
    // bySymbol/byIsin built from NSE instruments; resolving BSE member against NSE maps → null
    const { bySymbol, byIsin } = buildMaps([reliance]);
    const member: OfficialWatchlistMember = { symbol: 'RELIANCE' };
    expect(resolveOfficialWatchlistMember('BSE', member, bySymbol, byIsin)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildOfficialWatchlistLookupMaps
// ---------------------------------------------------------------------------

describe('buildOfficialWatchlistLookupMaps', () => {
  it('builds a bySymbol map keyed by EXCHANGE:SYMBOL (uppercase)', () => {
    const instrument: InstrumentSummary = { exchange: 'NSE', symbol: 'RELIANCE', isin: null };
    const { bySymbol } = buildOfficialWatchlistLookupMaps([instrument]);
    expect(bySymbol.get('NSE:RELIANCE')).toBe(instrument);
  });

  it('normalizes lowercase exchange and symbol when building bySymbol', () => {
    const instrument: InstrumentSummary = { exchange: 'nse', symbol: 'reliance', isin: null };
    const { bySymbol } = buildOfficialWatchlistLookupMaps([instrument]);
    expect(bySymbol.get('NSE:RELIANCE')).toBe(instrument);
  });

  it('builds a byIsin map keyed by EXCHANGE:ISIN (uppercase)', () => {
    const instrument: InstrumentSummary = {
      exchange: 'NSE',
      symbol: 'RELIANCE',
      isin: 'INE002A01018',
    };
    const { byIsin } = buildOfficialWatchlistLookupMaps([instrument]);
    expect(byIsin.get('NSE:INE002A01018')).toBe(instrument);
  });

  it('skips byIsin entry when isin is null', () => {
    const instrument: InstrumentSummary = { exchange: 'NSE', symbol: 'NOISYN', isin: null };
    const { byIsin } = buildOfficialWatchlistLookupMaps([instrument]);
    expect(byIsin.size).toBe(0);
  });

  it('handles an empty catalog without throwing', () => {
    const { bySymbol, byIsin, byName } = buildOfficialWatchlistLookupMaps([]);
    expect(bySymbol.size).toBe(0);
    expect(byIsin.size).toBe(0);
    expect(byName.size).toBe(0);
  });

  it('populates both maps for a catalog with multiple instruments', () => {
    const reliance: InstrumentSummary = {
      exchange: 'NSE',
      symbol: 'RELIANCE',
      isin: 'INE002A01018',
    };
    const infy: InstrumentSummary = { exchange: 'NSE', symbol: 'INFY', isin: 'INE009A01021' };
    const { bySymbol, byIsin } = buildOfficialWatchlistLookupMaps([reliance, infy]);
    expect(bySymbol.size).toBe(2);
    expect(byIsin.size).toBe(2);
    expect(bySymbol.get('NSE:INFY')).toBe(infy);
    expect(byIsin.get('NSE:INE009A01021')).toBe(infy);
  });
});

// ---------------------------------------------------------------------------
// pickOfficialWatchlistSearchCandidate
// ---------------------------------------------------------------------------

describe('pickOfficialWatchlistSearchCandidate', () => {
  it('selects an alias-matched search result when matchedSymbol equals the requested symbol', () => {
    const member: OfficialWatchlistMember = { symbol: 'OLDACC' };
    const candidate: InstrumentSummary = {
      exchange: 'NSE',
      symbol: 'ACC',
      isin: 'INE012A01025',
      matchedSymbol: 'OLDACC',
      resolvedFromAlias: true,
    };

    expect(pickOfficialWatchlistSearchCandidate('NSE', member, [candidate])).toBe(candidate);
  });

  it('returns null when multiple candidates tie for the same best name match', () => {
    const member: OfficialWatchlistMember = { name: 'Acme Cement Ltd.' };
    const first: InstrumentSummary = {
      exchange: 'NSE',
      symbol: 'ACME1',
      isin: 'INE000A01011',
      name: 'Acme Cement Ltd',
    };
    const second: InstrumentSummary = {
      exchange: 'NSE',
      symbol: 'ACME2',
      isin: 'INE000A01012',
      name: 'Acme Cement Ltd.',
    };

    expect(pickOfficialWatchlistSearchCandidate('NSE', member, [first, second])).toBeNull();
  });
});
