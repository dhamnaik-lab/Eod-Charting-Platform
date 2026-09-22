import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  findOfficialWatchlistGroupBySourceLinkMeta,
  getOfficialWatchlistGroups,
  getOfficialWatchlistSource,
  listOfficialWatchlistSources,
  loadOfficialWatchlistSource,
  toOfficialWatchlistSourceKey,
} from '@/features/watchlists/officialWatchlistProviders';

describe('officialWatchlistProviders catalog integrity', () => {
  it('lists all six expected official sources in the existing tab order', () => {
    expect(listOfficialWatchlistSources().map((source) => source.id)).toEqual([
      'nse-sectors',
      'nse-indices',
      'bse-sectors',
      'bse-indices',
      'nse-all-stocks-sectors',
      'bse-all-stocks-sectors',
    ]);
  });

  it('provides BSE Stocks by Sector metadata with 10+ groups and 1500+ stocks', () => {
    const source = getOfficialWatchlistSource('bse-all-stocks-sectors');
    expect(source).not.toBeNull();
    expect(source!.label).toBe('BSE Stocks by Sector');
    expect(source!.watchlistPrefix).toBe('BSE Sector Universe');
    expect(source!.exchange).toBe('BSE');
    expect(source!.refreshMode).toBe('snapshot');
    const groups = getOfficialWatchlistGroups('bse-all-stocks-sectors');
    expect(groups.length).toBeGreaterThanOrEqual(10);
    expect(groups.map((group) => group.id)).toEqual(expect.arrayContaining([
      'sector-universe-bse-financial-services',
      'sector-universe-bse-information-technology',
      'sector-universe-bse-healthcare',
      'sector-universe-bse-consumer-discretionary',
      'sector-universe-bse-industrials',
    ]));
    expect(groups.reduce((sum, group) => sum + group.memberCount, 0)).toBeGreaterThanOrEqual(1500);
  });

  it('provides expanded BSE Sectors metadata with distinct Power and Energy URLs', () => {
    const groups = getOfficialWatchlistGroups('bse-sectors');
    expect(groups.length).toBeGreaterThanOrEqual(25);
    const power = groups.find((group) => group.id === 'bse-power');
    const energy = groups.find((group) => group.id === 'bse-energy');
    expect(power).toBeDefined();
    expect(energy).toBeDefined();
    expect(power!.officialSourceUrl).toContain('code=69');
    expect(energy!.officialSourceUrl).toContain('code=90');
    expect(power!.officialSourceUrl).not.toBe(energy!.officialSourceUrl);
  });

  it('provides BSE Indices metadata including unhidden BSE 500', () => {
    const groups = getOfficialWatchlistGroups('bse-indices');
    expect(groups.length).toBeGreaterThanOrEqual(14);
    const bse500 = groups.find((group) => group.id === 'bse-500');
    expect(bse500).toBeDefined();
    expect(bse500!.memberCount).toBeGreaterThanOrEqual(500);
  });

  it('resolves source-linked BSE 500 from metadata without loading members', () => {
    const resolution = findOfficialWatchlistGroupBySourceLinkMeta({
      sourceType: 'official',
      sourceExchange: 'BSE',
      sourceGroupType: 'index',
      sourceKey: 'BSE_500',
    });
    expect(resolution?.sourceId).toBe('bse-indices');
    expect(resolution?.group.id).toBe('bse-500');
    expect('members' in (resolution?.group ?? {})).toBe(false);
  });

  it('loads one requested snapshot payload and validates catalog member counts', async () => {
    const source = await loadOfficialWatchlistSource('nse-sectors');
    expect(source.id).toBe('nse-sectors');
    const catalog = getOfficialWatchlistGroups('nse-sectors');
    expect(source.groups.map((group) => group.id)).toEqual(catalog.map((group) => group.id));
    expect(source.groups.map((group) => group.members.length)).toEqual(catalog.map((group) => group.memberCount));
  });

  it('correctly maps source keys using toOfficialWatchlistSourceKey', () => {
    expect(toOfficialWatchlistSourceKey('bse-capital-goods')).toBe('BSE_CAPITAL_GOODS');
    expect(toOfficialWatchlistSourceKey('bse-500')).toBe('BSE_500');
  });

  it('keeps constituent modules out of the static provider import graph', () => {
    const providerText = readFileSync(resolve(process.cwd(), 'src/features/watchlists/officialWatchlistProviders.ts'), 'utf8');
    expect(providerText).not.toMatch(/^import .*officialWatchlistData\.generated/m);
    expect(providerText).not.toMatch(/^import .*nseSectorUniverseWatchlistData\.generated/m);
    expect(providerText).not.toMatch(/^import .*bseSectorUniverseWatchlistData\.generated/m);
    expect(providerText).toContain("import('./generated/officialWatchlistNseSectors.generated')");
    expect(providerText).toContain("import('./generated/officialWatchlistNseIndices.generated')");
    expect(providerText).toContain("import('./nseSectorUniverseWatchlistData.generated')");
    expect(providerText).toContain("import('./generated/officialWatchlistBseSectors.generated')");
    expect(providerText).toContain("import('./generated/officialWatchlistBseIndices.generated')");
    expect(providerText).toContain("import('./bseSectorUniverseWatchlistData.generated')");
  });
});
